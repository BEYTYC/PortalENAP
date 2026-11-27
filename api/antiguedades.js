/*!
 * Portal de Servicios Digitales Estadística — Escuela Naval de Cadetes "Almirante Padilla"
 * Autora y desarrolladora: CAMARGO MARTÍNEZ BEYTY PATRICIA — Oficina de Estadística
 * Derechos morales de autor reservados (Ley 23 de 1982, art. 30). Este aviso de autoría no debe eliminarse ni alterarse.
 */
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
const XLSX = require('./_xlsx.js');

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

/* Cédulas verificadas (ciudad de expedición y nombres contrastados con la cédula).
 * Viven en SharePoint, no en el repositorio. Mientras se completa el traslado: si aún
 * no están en SharePoint se toman de la copia local y se guardan allá. Si SharePoint
 * falla, se sigue con la copia local para no interrumpir la consulta. */
async function cedulasVerificadas() {
  try {
    const sp = await leerJson('cedulas-verificadas.json');
    if (sp && sp.lx && sp.nom) return sp;
  } catch (e) { /* sigue con la copia local */ }
  const local = require('./_cedulas-verificadas.json');
  try { await escribirJson('cedulas-verificadas.json', local); } catch (e) { /* se reintenta en la próxima consulta */ }
  return local;
}

/* --------------------------------- Reglas --------------------------------- */

const REGEX_PERIODO = /^\d{4}-[12]$/;
const ahora = () => new Date().toISOString();
const esCorreoValido = (c) => /^[^\s@]+@enap\.edu\.co$/i.test(c);

/* Cuentas con acceso a TODOS los módulos del Portal (permanente, no depende de ACCESO_TEMPORAL). */
const ACCESO_TOTAL = ['sac@enap.edu.co'];

function rolDe(correo, accesos) {
  if (ADMINS.includes(correo)) return 'ADMIN';
  if (ACCESO_TOTAL.includes(correo) || DESCARGA_EXTRA.includes(correo)) return 'CONSULTA';
  if ((accesos.consulta || []).some((x) => x.correo === correo)) return 'CONSULTA';
  return null;
}

/* Cuentas a las que se les permite descargar el Excel (además de entrar como consulta). */
const DESCARGA_EXTRA = ['ssac@enap.edu.co'];

function puedeDescargar(correo, accesos) {
  if (ADMINS.includes(correo) || ACCESO_TOTAL.includes(correo) || DESCARGA_EXTRA.includes(correo)) return true;
  const x = (accesos.consulta || []).find((c) => c.correo === correo);
  return !!(x && x.descarga === true);
}

/* ---- ACCESO DE CONSULTA PARA JEFES DE PROGRAMA Y DECANOS ----
 * Quienes tienen en la lista de permisos del Portal (la misma de Solicitud de Grado) el rol DECANO o JEFE_PROGRAMA,
 * más los correos de abajo, entran como CONSULTA (solo ven; no descargan ni administran). Es permanente. */
const SIN_ACCESO_ANTIGUEDADES = ['guardia.baena@enap.edu.co'];
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

/* Graduados en Ciencias Navales (NAV) o Ciencias Náuticas (NAU, mercantes): se lee "Graduados en la ENAP.xlsx" (OneDrive de Estadística) con el mismo lector del módulo Hoja de vida.
   Devuelve { cédula: { t: ['NAV'|'NAU'], f: fecha de grado } } o null si no se pudo leer (así el Excel deja la columna vacía en vez de poner "No"). Se guarda 10 minutos. */
let gdCache = null, gdCacheHora = 0;
async function graduadosNavales() {
  if (gdCache && Date.now() - gdCacheHora < 600000) return gdCache;
  try {
    const H = { Authorization: `Bearer ${appToken}` };
    const ruta = 'Estadística/Bases de Datos/B.D Grados - Balances Académicos/Graduados en la ENAP.xlsx';
    const r = await fetch(`${GRAPH_BASE}/users/${encodeURIComponent('jestadisticaplen@enap.edu.co')}/drive/root:/${ruta.split('/').map(encodeURIComponent).join('/')}:/content`, { headers: H });
    if (!r.ok) return null;
    const lib = XLSX.abrir(Buffer.from(await r.arrayBuffer()));
    const g = require('./hoja-de-vida.js')._test.procesarGraduados(lib);
    const out = {};
    Object.keys(g.porCed).forEach((k) => {
      const tipos = [];
      (g.porCed[k] || []).forEach((x) => {
        const t = String(x.programa || x.titulo || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
        if (/CIENCIAS NAVALES/.test(t) && !tipos.includes('NAV')) tipos.push('NAV');
        if (/CIENCIAS NAUTICAS/.test(t) && !tipos.includes('NAU')) tipos.push('NAU');
      });
      const fechas = (g.porCed[k] || []).map((x) => x.fecha || '').filter(Boolean).sort();
      if (tipos.length) out[k.replace(/^0+/, '')] = { t: tipos, f: fechas.length ? fechas[fechas.length - 1] : '' };
    });
    gdCache = Object.keys(out).length ? out : null; gdCacheHora = Date.now();
    return gdCache;
  } catch (e) { return null; }
}

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
    if (!(await require('./accesos-modulos.js').puedeEntrar(yo.correo))) {
      throw error('Esta cuenta no puede usar el Portal.', 403);
    }
    await contexto();
    const accesos = await leerAccesos();
    // Las cuentas de SIN_ACCESO_ANTIGUEDADES no entran por rol (Decano/Jefe de Programa): deben pedir ingreso y que Estadística se lo conceda.
    const rol = rolDe(yo.correo, accesos) || (await require('./accesos-modulos.js').tieneModulo(yo.correo, 'Antigüedades ENAP') ? 'CONSULTA' : null) || (SIN_ACCESO_ANTIGUEDADES.includes(yo.correo) ? null : await rolTemporal(yo.correo));

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
      const CV = await cedulasVerificadas(); // contrastado con la cédula: ciudad de expedición y nombres
      const TT = await leerJson('titulacion.json'); // listado aprobado por el Consejo Académico: cédulas + fecha de grado
      const GD = await graduadosNavales(); // quién figura graduado en Ciencias Navales (null si no se pudo leer)
      res.status(200).json(d ? { ...d, periodo: d.meta && d.meta.periodo, periodos: lista, lx: CV.lx, nv: CV.nom, gd: GD, tt: TT && TT.ceds ? { fecha: TT.fecha, ceds: TT.ceds } : null } : { meta: null, datos: null, periodos: lista });
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

    /* ---- titulación del periodo: cédulas que se gradúan y fecha de grado (solo ADMIN). Vive en SharePoint, nunca en el repositorio. ---- */
    if (accion === 'guardar-titulacion') {
      const fecha = String(body.fecha || '').trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || isNaN(Date.parse(fecha))) throw error('Escribe la fecha de grado completa.', 400);
      const lista = Array.isArray(body.ceds) ? body.ceds : [];
      const ceds = [...new Set(lista.map((c) => String(c == null ? '' : c).replace(/[^0-9]/g, '').replace(/^0+/, '')).filter((c) => c.length >= 6 && c.length <= 12))];
      if (lista.length && !ceds.length) throw error('No se reconoció ninguna cédula en el listado.', 400);
      if (ceds.length > 600) throw error('El listado es demasiado grande.', 413);
      const meta = { actualizado: ahora(), por: yo.correo };
      await escribirJson('titulacion.json', { ...meta, fecha, ceds });
      /* nombres contrastados con la cédula física (opcional): pasan al mapa de cédulas verificadas y corrigen el nombre en el reporte */
      const nn = body.nombres && typeof body.nombres === 'object' ? body.nombres : {};
      const cv = await cedulasVerificadas(); let cambios = 0;
      Object.keys(nn).forEach((k) => {
        const ck = String(k).replace(/[^0-9]/g, '').replace(/^0+/, ''), nm = String(nn[k] || '').toUpperCase().replace(/\s+/g, ' ').trim();
        if (ck.length >= 6 && /^[A-ZÑ ]{5,80}$/.test(nm) && cv.nom[ck] !== nm) { cv.nom[ck] = nm; cambios++; }
      });
      if (cambios) await escribirJson('cedulas-verificadas.json', cv);
      res.status(200).json({ ok: true, total: ceds.length, fecha, nombres: cambios, ...meta });
      return;
    }

    /* ---- retiros: quién figura retirado en Bajas y Ascensos (hoja "Bajas desde 1935") ---- */
    if (accion === 'retiros') {
      const dueno = 'jestadisticaplen@enap.edu.co';
      const carpeta = 'Estadística/Bases de Datos/B.D Retiros y Ascensos';
      const enc = (r) => r.split('/').map(encodeURIComponent).join('/');
      const H = { Authorization: `Bearer ${appToken}` };
      const norm = (n) => String(n).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9.]/g, '');
      const rl = await fetch(`${GRAPH_BASE}/users/${encodeURIComponent(dueno)}/drive/root:/${enc(carpeta)}:/children?$select=id,name,lastModifiedDateTime,file&$top=200`, { headers: H });
      if (!rl.ok) throw error(`No se pudo abrir la carpeta de Bajas y Ascensos (${rl.status}).`, 502);
      const L = ((await rl.json()).value || []).filter((x) => x.file && !x.name.startsWith('~$') && norm(x.name).startsWith('BAJASYASCENSOS') && /\.XLS[XM]$/.test(norm(x.name)));
      L.sort((a, b) => String(b.lastModifiedDateTime).localeCompare(String(a.lastModifiedDateTime)));
      if (!L[0]) throw error('No se encontró el archivo Bajas y Ascensos.', 404);
      const rb = await fetch(`${GRAPH_BASE}/users/${encodeURIComponent(dueno)}/drive/items/${L[0].id}/content`, { headers: H });
      if (!rb.ok) throw error(`No se pudo descargar Bajas y Ascensos (${rb.status}).`, 502);
      const libro = XLSX.abrir(Buffer.from(await rb.arrayBuffer()));
      const F = libro.leer('Bajas desde 1935', { maxCols: 33 });
      const desde = typeof body.desde === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.desde) ? body.desde : '2024-01-01';
      const ced = (v) => { let t = typeof v === 'number' ? (Number.isInteger(v) ? v.toFixed(0) : String(v)) : String(v == null ? '' : v).trim().toUpperCase(); t = t.replace(/^(C\.?\s?C\.?|C\.?\s?E\.?|T\.?\s?I\.?)\s*[:#.\-]?\s*(?=\d)/, '').replace(/[^0-9A-Z]/g, '').replace(/^0+(?=\d)/, ''); return /\d/.test(t) ? t : ''; };
      const iso = (v) => { if (typeof v === 'number') { const d = new Date(Math.round((v - 25569) * 86400000)); return d.toISOString().slice(0, 10); } const m = String(v || '').trim().match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/); if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; const n = String(v || '').match(/^(\d{4}-\d{2}-\d{2})/); return n ? n[1] : ''; };
      const out = {};
      for (let i = 1; i < F.length; i++) {
        const r = F[i], ck = ced(r[5]), f = iso(r[14]);
        if (!ck || !f || f < desde) continue;
        if (!out[ck] || f > out[ck].f) out[ck] = { f, causal: String(r[20] == null ? '' : r[20]).trim(), doc: String(r[16] == null ? '' : r[16]).trim() };
      }
      /* nombres oficiales: CONGLOMERADO por cédula (corrige nombres mal escritos que vienen de las notas) */
      const nombres = {};
      try {
        const base = 'Estadística/Bases de Datos/B.D Ingresos/';
        let rc = null;
        for (const nm of ['CONGLOMERADO.xlsm', 'CONGLOMERADO.xlsx']) {
          const x = await fetch(`${GRAPH_BASE}/users/${encodeURIComponent(dueno)}/drive/root:/${enc(base + nm)}:/content`, { headers: H });
          if (x.ok) { rc = x; break; }
        }
        if (rc) {
          const lc = XLSX.abrir(Buffer.from(await rc.arrayBuffer()));
          const hoja = lc.hojas.find((h) => /todos los ingresos/i.test(h)) || lc.hojas[0];
          const FC = lc.leer(hoja, { maxCols: 30 });
          const nh = (v) => String(v == null ? '' : v).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
          const HH = (FC[0] || []).map(nh);
          const iN = HH.indexOf('APELLIDOS Y NOMBRES'), iC = HH.indexOf('CEDULA'), iF = HH.indexOf('FECHA INGRESO');
          if (iN >= 0 && iC >= 0) {
            for (let i = 1; i < FC.length; i++) {
              const r = FC[i], ck = ced(r[iC]), f = iF >= 0 ? iso(r[iF]) : '';
              if (!ck || !r[iN] || (f && f < desde)) continue;
              if (!nombres[ck] || f >= nombres[ck].f) nombres[ck] = { f, n: nh(r[iN]) };
            }
            Object.keys(nombres).forEach((k) => { nombres[k] = nombres[k].n; });
          }
        }
      } catch (e) { /* si CONGLOMERADO no se puede leer, los retiros siguen funcionando */ }
      res.status(200).json({ retiros: out, nombres, archivo: L[0].name, modificado: L[0].lastModifiedDateTime });
      return;
    }

    /* ---- fuentes en el OneDrive de jestadisticaplen: comprueba que la app puede leerlas ---- */
    if (accion === 'fuentes') {
      const dueno = 'jestadisticaplen@enap.edu.co';
      const FUENTES = [
        { clave: 'conglomerado', nombre: 'CONGLOMERADO', ruta: 'Estadística/Bases de Datos/B.D Ingresos/CONGLOMERADO.xlsm' },
        { clave: 'bajas', nombre: 'Bajas y Ascensos', ruta: 'Estadística/Bases de Datos/B.D Retiros y Ascensos/Bajas y Ascensos.xlsx', alterna: 'Estadística/Bases de Datos/B.D Retiros y Ascensos/Bajas y Ascensos.xlsm' },
      ];
      const salida = [];
      for (const f of FUENTES) {
        const url = (ruta) => `${GRAPH_BASE}/users/${encodeURIComponent(dueno)}/drive/root:/${ruta.split('/').map(encodeURIComponent).join('/')}`;
        try {
          let r = await fetch(url(f.ruta), { headers: { Authorization: `Bearer ${appToken}` } });
          if (r.status === 404 && f.alterna) r = await fetch(url(f.alterna), { headers: { Authorization: `Bearer ${appToken}` } });
          if (r.ok) {
            const m = await r.json();
            salida.push({ clave: f.clave, nombre: f.nombre, ok: true, bytes: m.size, modificado: m.lastModifiedDateTime, por: m.lastModifiedBy && m.lastModifiedBy.user && m.lastModifiedBy.user.displayName });
          } else {
            const t = (await r.text()).slice(0, 200);
            salida.push({ clave: f.clave, nombre: f.nombre, ok: false, estado: r.status, detalle: r.status === 403 ? 'La aplicación no tiene permiso de lectura sobre ese OneDrive.' : r.status === 404 ? 'No se encontró el archivo en esa ruta.' : t });
          }
        } catch (e) {
          salida.push({ clave: f.clave, nombre: f.nombre, ok: false, detalle: String(e.message || e).slice(0, 200) });
        }
      }
      res.status(200).json({ fuentes: salida });
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
