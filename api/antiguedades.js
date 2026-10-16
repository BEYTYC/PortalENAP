/**
 * api/antiguedades.js
 *
 * Servidor del módulo "Generación de Antigüedades".
 *
 * Por qué existe: los datos de los estudiantes (notas, cédulas, puestos) NO
 * pueden estar en el repositorio (es público) ni en el navegador de nadie.
 * Viven en SharePoint -- en la biblioteca de documentos del mismo sitio que
 * ya usa el Portal, carpeta "Antiguedades" -- y este endpoint es la única
 * puerta: valida la sesión de Microsoft de quien pregunta, decide si tiene
 * permiso y solo entonces lee o escribe.
 *
 * Quién puede qué:
 *   - ADMIN (fijos, abajo en ADMINS): ven los datos, cargan datos nuevos,
 *     dan/quitan accesos y ven los intentos sin permiso.
 *   - CONSULTA: correos dados de alta por un ADMIN. Solo ven los datos.
 *   - Cualquier otra cuenta: no ve nada y el intento queda registrado.
 *
 * Archivos en SharePoint (carpeta Antiguedades/):
 *   datos.json     { meta:{actualizado, por, periodo}, datos:{...} }
 *   accesos.json   { consulta:[{correo, agregado, por}], vistos:{correo: ISO} }
 *   intentos.json  { "correo": {intentos, ultimo} }
 *
 * Todas las acciones son POST con { accessToken, accion, ... }, donde
 * accessToken es el token de Microsoft (User.Read) de la sesión del Portal.
 */

const roles = require('./roles.js');

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const DOMINIO = '@enap.edu.co';
const ADMINS = ['sea@enap.edu.co', 'jestadisticaplen@enap.edu.co'];
const CARPETA = 'Antiguedades';
const MAX_BYTES_DATOS = 8 * 1024 * 1024;

function error(mensaje, status) {
  const e = new Error(mensaje);
  e.status = status || 500;
  return e;
}

/* ------------------------------- Identidad -------------------------------- */

async function identificar(accessToken) {
  const resp = await fetch(`${GRAPH_BASE}/me`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!resp.ok) throw error('La sesión de Microsoft no es válida o expiró. Vuelva a iniciar sesión en el Portal.', 401);
  const perfil = await resp.json();
  const correo = String(perfil.mail || perfil.userPrincipalName || '').trim().toLowerCase();
  if (!correo) throw error('La cuenta no tiene un correo asociado.', 403);
  return { correo, nombre: perfil.displayName || correo };
}

/* ------------------------------- SharePoint ------------------------------- */

let appToken = null;
let siteId = null;
async function contexto() {
  appToken = await roles.getAppAccessToken();
  siteId = await roles.resolveSiteId(appToken);
  return { token: appToken, siteId };
}

function rutaArchivo(nombre) {
  return `${GRAPH_BASE}/sites/${siteId}/drive/root:/${CARPETA}/${nombre}:/content`;
}

async function leerJson(nombre) {
  const resp = await fetch(rutaArchivo(nombre), { headers: { Authorization: `Bearer ${appToken}` } });
  if (resp.status === 404) return null;
  if (!resp.ok) throw error(`No se pudo leer ${nombre} en SharePoint (${resp.status}).`, 502);
  return resp.json();
}

async function escribirJson(nombre, valor) {
  const resp = await fetch(rutaArchivo(nombre), {
    method: 'PUT',
    headers: { Authorization: `Bearer ${appToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(valor),
  });
  if (!resp.ok) throw error(`No se pudo guardar ${nombre} en SharePoint (${resp.status}). ${(await resp.text()).slice(0, 300)}`, 502);
}

/* --------------------------------- Reglas --------------------------------- */

const ahora = () => new Date().toISOString();
const esCorreoValido = (c) => /^[^\s@]+@enap\.edu\.co$/i.test(c);

function rolDe(correo, accesos) {
  if (ADMINS.includes(correo)) return 'ADMIN';
  if ((accesos.consulta || []).some((x) => x.correo === correo)) return 'CONSULTA';
  return null;
}

async function leerAccesos() {
  const a = (await leerJson('accesos.json')) || {};
  return { consulta: a.consulta || [], vistos: a.vistos || {} };
}

/* --------------------------------- Handler -------------------------------- */

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Use POST.' }); return; }

  const body = typeof req.body === 'object' && req.body ? req.body : {};
  const { accessToken, accion } = body;

  try {
    if (!accessToken || !accion) throw error('Faltan "accessToken" o "accion".', 400);
    const yo = await identificar(accessToken);
    if (!yo.correo.endsWith(DOMINIO) || roles.CORREOS_BLOQUEADOS.includes(yo.correo)) {
      throw error('Esta cuenta no puede usar el Portal.', 403);
    }
    await contexto();
    const accesos = await leerAccesos();
    const rol = rolDe(yo.correo, accesos);

    /* ---- sesión: dice qué rol tiene; si no tiene, deja registrado el intento ---- */
    if (accion === 'sesion') {
      if (!rol) {
        const intentos = (await leerJson('intentos.json')) || {};
        const previo = intentos[yo.correo] || { intentos: 0 };
        intentos[yo.correo] = { intentos: previo.intentos + 1, ultimo: ahora(), nombre: yo.nombre };
        await escribirJson('intentos.json', intentos);
        res.status(200).json({ correo: yo.correo, nombre: yo.nombre, rol: null });
        return;
      }
      const ultimo = accesos.vistos[yo.correo];
      if (!ultimo || Date.now() - Date.parse(ultimo) > 10 * 60 * 1000) {
        accesos.vistos[yo.correo] = ahora();
        await escribirJson('accesos.json', accesos);
      }
      res.status(200).json({ correo: yo.correo, nombre: yo.nombre, rol });
      return;
    }

    if (!rol) throw error('No tiene permiso para ver las antigüedades.', 403);

    if (accion === 'datos') {
      const d = await leerJson('datos.json');
      res.status(200).json(d || { meta: null, datos: null });
      return;
    }

    /* ---- de aquí en adelante: solo ADMIN ---- */
    if (rol !== 'ADMIN') throw error('Solo un administrador puede hacer esto.', 403);

    if (accion === 'guardar-datos') {
      const datos = body.datos;
      if (!datos || typeof datos !== 'object' || !datos.sheets || !datos.order) {
        throw error('El archivo no tiene el formato esperado (faltan "sheets" y "order").', 400);
      }
      if (JSON.stringify(datos).length > MAX_BYTES_DATOS) throw error('El archivo es demasiado grande.', 413);
      const meta = { actualizado: ahora(), por: yo.correo, periodo: String(body.periodo || '').slice(0, 40) };
      await escribirJson('datos.json', { meta, datos });
      res.status(200).json({ ok: true, meta });
      return;
    }

    if (accion === 'accesos') {
      const intentos = (await leerJson('intentos.json')) || {};
      res.status(200).json({
        admins: ADMINS.map((c) => ({ correo: c, ultimo: accesos.vistos[c] || null })),
        consulta: accesos.consulta.map((x) => ({ ...x, ultimo: accesos.vistos[x.correo] || null })),
        intentos: Object.entries(intentos).map(([correo, v]) => ({ correo, ...v })).sort((a, b) => String(b.ultimo).localeCompare(String(a.ultimo))),
      });
      return;
    }

    if (accion === 'acceso-agregar') {
      const correo = String(body.correo || '').trim().toLowerCase();
      if (!esCorreoValido(correo)) throw error(`Escriba un correo institucional (${DOMINIO}).`, 400);
      if (rolDe(correo, accesos)) throw error('Ese correo ya tiene acceso.', 409);
      accesos.consulta.push({ correo, agregado: ahora(), por: yo.correo });
      await escribirJson('accesos.json', accesos);
      const intentos = (await leerJson('intentos.json')) || {};
      if (intentos[correo]) { delete intentos[correo]; await escribirJson('intentos.json', intentos); }
      res.status(200).json({ ok: true });
      return;
    }

    if (accion === 'acceso-quitar') {
      const correo = String(body.correo || '').trim().toLowerCase();
      if (ADMINS.includes(correo)) throw error('Un administrador no se puede quitar desde aquí.', 400);
      accesos.consulta = accesos.consulta.filter((x) => x.correo !== correo);
      await escribirJson('accesos.json', accesos);
      res.status(200).json({ ok: true });
      return;
    }

    if (accion === 'intento-descartar') {
      const correo = String(body.correo || '').trim().toLowerCase();
      const intentos = (await leerJson('intentos.json')) || {};
      delete intentos[correo];
      await escribirJson('intentos.json', intentos);
      res.status(200).json({ ok: true });
      return;
    }

    throw error(`Acción desconocida: ${accion}`, 400);
  } catch (e) {
    res.status(e.status || 500).json({ error: e instanceof Error ? e.message : String(e) });
  }
};
