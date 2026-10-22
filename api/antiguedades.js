/**
 * api/antiguedades.js
 *
 * Servidor del módulo "Antigüedades ENAP".
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
 *   accesos.json   { consulta:[{correo, agregado, por, descarga}], vistos:{correo: ISO} }
 *   descargas.json [ {correo, fecha} ]   bitácora de descargas del Excel
 *   BD.xlsx        el Excel "BD Antigüedades" que se descarga (lo sube un administrador)
 *   excel-meta.json { actualizado, por, nombre, bytes }
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
const MAX_BYTES_EXCEL = 3 * 1024 * 1024; // el cuerpo de una función de Vercel admite ~4,5 MB (base64 incluido)

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

async function leerBinario(nombre) {
  const resp = await fetch(rutaArchivo(nombre), { headers: { Authorization: `Bearer ${appToken}` } });
  if (resp.status === 404) return null;
  if (!resp.ok) throw error(`No se pudo leer ${nombre} en SharePoint (${resp.status}).`, 502);
  return Buffer.from(await resp.arrayBuffer());
}

async function escribirBinario(nombre, buffer) {
  const resp = await fetch(rutaArchivo(nombre), {
    method: 'PUT',
    headers: { Authorization: `Bearer ${appToken}`, 'Content-Type': 'application/octet-stream' },
    body: buffer,
  });
  if (!resp.ok) throw error(`No se pudo guardar ${nombre} en SharePoint (${resp.status}). ${(await resp.text()).slice(0, 300)}`, 502);
}

/* --------------------------------- Reglas --------------------------------- */

const REGEX_PERIODO = /^\d{4}-[12]$/;
const ahora = () => new Date().toISOString();
const esCorreoValido = (c) => /^[^\s@]+@enap\.edu\.co$/i.test(c);

function rolDe(correo, accesos) {
  if (ADMINS.includes(correo)) return 'ADMIN';
  if ((accesos.consulta || []).some((x) => x.correo === correo)) return 'CONSULTA';
  return null;
}

function puedeDescargar(correo, accesos) {
  if (ADMINS.includes(correo)) return true;
  const x = (accesos.consulta || []).find((c) => c.correo === correo);
  return !!(x && x.descarga === true);
}

/* ---- ACCESO TEMPORAL DE CONSULTA ----
 * Mientras dure el escalafonamiento 2026-2, quienes tienen en la lista de permisos del Portal
 * (la misma de Solicitud de Grado) el rol DECANO o JEFE_PROGRAMA, más los correos de abajo, entran como CONSULTA
 * (solo ven; no descargan ni administran). Para quitarlo: poner ACCESO_TEMPORAL = false. */
const ACCESO_TEMPORAL = true;
const ROLES_TEMPORALES = ['DECANO', 'JEFE_PROGRAMA'];
const CORREOS_TEMPORALES = ['cben@enap.edu.co', 'sac@enap.edu.co', 'daen@enap.edu.co', 'denap@enap.edu.co', 'aspapen@enap.edu.co'];

async function rolTemporal(correo) {
  if (!ACCESO_TEMPORAL) return null;
  if (CORREOS_TEMPORALES.includes(correo)) return 'CONSULTA';
  try {
    const t = await roles.getAppAccessToken();
    const sid = await roles.resolveSiteId(t);
    const lid = await roles.resolveListId(t, sid);
    const filas = await roles.leerFilas(t, sid, lid);
    return roles.rolesActivosPara(filas, correo).some((x) => ROLES_TEMPORALES.includes(x)) ? 'CONSULTA' : null;
  } catch (e) {
    return null;
  }
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
    const rol = rolDe(yo.correo, accesos) || (await rolTemporal(yo.correo));

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
      res.status(200).json({ correo: yo.correo, nombre: yo.nombre, rol, descarga: puedeDescargar(yo.correo, accesos) });
      return;
    }

    if (!rol) throw error('No tiene permiso para ver las antigüedades.', 403);

    if (accion === 'datos') {
      // Cada periodo vive en su archivo (datos-AAAA-N.json); periodos.json los lista.
      const idx = (await leerJson('periodos.json')) || { lista: [] };
      let lista = idx.lista.slice();
      let d = null;
      const pedido = typeof body.periodo === 'string' && REGEX_PERIODO.test(body.periodo) ? body.periodo : null;
      if (lista.length) {
        const per = pedido && lista.includes(pedido) ? pedido : lista.slice().sort().pop();
        d = await leerJson(`datos-${per}.json`);
      }
      if (!d) {
        d = await leerJson('datos.json'); // datos anteriores a la carga por periodo
        if (d && d.meta && d.meta.periodo && !lista.includes(d.meta.periodo)) lista.push(d.meta.periodo);
      }
      lista.sort();
      res.status(200).json(d ? { ...d, periodo: d.meta && d.meta.periodo, periodos: lista } : { meta: null, datos: null, periodos: lista });
      return;
    }

    /* ---- descargar el Excel: solo quien tenga permiso; queda anotado ---- */
    if (accion === 'descargar') {
      if (!puedeDescargar(yo.correo, accesos)) throw error('No tiene permiso para descargar el Excel.', 403);
      const d = (await leerJson('descargas.json')) || [];
      d.push({ correo: yo.correo, fecha: ahora() });
      await escribirJson('descargas.json', d.slice(-500));
      const bin = await leerBinario('BD.xlsx');
      res.status(200).json({ ok: true, fecha: ahora(), correo: yo.correo, xlsx: bin ? bin.toString('base64') : null });
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
      const periodo = String(body.periodo || '').trim();
      if (!REGEX_PERIODO.test(periodo)) throw error('Indica el periodo con el formato 2026-2.', 400);
      const meta = { actualizado: ahora(), por: yo.correo, periodo };
      await escribirJson(`datos-${periodo}.json`, { meta, datos });
      const idx = (await leerJson('periodos.json')) || { lista: [] };
      if (!idx.lista.length) {
        const previo = await leerJson('datos.json'); // conserva los datos que ya estaban cargados
        const pp = previo && previo.meta && previo.meta.periodo;
        if (pp && REGEX_PERIODO.test(pp) && pp !== periodo) { await escribirJson(`datos-${pp}.json`, previo); idx.lista.push(pp); }
      }
      if (!idx.lista.includes(periodo)) idx.lista.push(periodo);
      idx.lista.sort();
      await escribirJson('periodos.json', idx);
      await escribirJson('datos.json', { meta, datos }); // el último cargado queda como respaldo
      res.status(200).json({ ok: true, meta, periodos: idx.lista });
      return;
    }

    if (accion === 'accesos') {
      const intentos = (await leerJson('intentos.json')) || {};
      res.status(200).json({
        admins: ADMINS.map((c) => ({ correo: c, ultimo: accesos.vistos[c] || null })),
        consulta: accesos.consulta.map((x) => ({ ...x, ultimo: accesos.vistos[x.correo] || null })),
        intentos: Object.entries(intentos).map(([correo, v]) => ({ correo, ...v })).sort((a, b) => String(b.ultimo).localeCompare(String(a.ultimo))),
        descargas: ((await leerJson('descargas.json')) || []).slice(-20).reverse(),
        excel: await leerJson('excel-meta.json'),
      });
      return;
    }

    if (accion === 'acceso-agregar') {
      const correo = String(body.correo || '').trim().toLowerCase();
      if (!esCorreoValido(correo)) throw error(`Escriba un correo institucional (${DOMINIO}).`, 400);
      if (rolDe(correo, accesos)) throw error('Ese correo ya tiene acceso.', 409);
      accesos.consulta.push({ correo, agregado: ahora(), por: yo.correo, descarga: body.descarga === true });
      await escribirJson('accesos.json', accesos);
      const intentos = (await leerJson('intentos.json')) || {};
      if (intentos[correo]) { delete intentos[correo]; await escribirJson('intentos.json', intentos); }
      res.status(200).json({ ok: true });
      return;
    }

    if (accion === 'guardar-excel') {
      const b64 = String(body.xlsx || '');
      if (!b64) throw error('Falta el archivo.', 400);
      const buf = Buffer.from(b64, 'base64');
      if (buf.length < 4 || buf[0] !== 0x50 || buf[1] !== 0x4b) throw error('El archivo no es un Excel (.xlsx) válido.', 400);
      if (buf.length > MAX_BYTES_EXCEL) throw error('El Excel es demasiado grande (máximo 3 MB).', 413);
      await escribirBinario('BD.xlsx', buf);
      const meta = { actualizado: ahora(), por: yo.correo, nombre: String(body.nombre || 'BD Antigüedades.xlsx').slice(0, 120), bytes: buf.length };
      await escribirJson('excel-meta.json', meta);
      res.status(200).json({ ok: true, meta });
      return;
    }

    if (accion === 'descarga-permiso') {
      const correo = String(body.correo || '').trim().toLowerCase();
      const x = accesos.consulta.find((c) => c.correo === correo);
      if (!x) throw error('Ese correo no está en la lista de consulta.', 404);
      x.descarga = body.valor === true;
      await escribirJson('accesos.json', accesos);
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
