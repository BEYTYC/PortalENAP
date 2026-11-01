/**
 * api/bajas.js
 *
 * Servidor del módulo "Registro de bajas" y de la validación final de
 * Ascensos (botón en Antigüedades › Administración).
 *
 * Quién puede usarlo: solo sea@enap.edu.co y jestadisticaplen@enap.edu.co.
 *
 * De dónde salen los datos (OneDrive de jestadisticaplen, solo lectura):
 *   - Antigüedades (SharePoint del Portal, carpeta Antiguedades/): curso y grado
 *     de los estudiantes activos del último periodo cargado.
 *   - CONGLOMERADO: nombre, cédula, sigla, contingente, fecha y año de ingreso,
 *     nacionalidad y sexo. También los recién ingresados que aún no están en
 *     Antigüedades.
 *   - Bajas y Ascensos: quién ya está retirado y la tabla de cursos (Hoja8).
 *   - Graduados en la ENAP: columna CIENCIAS de Ascensos.
 *
 * A dónde escribe:
 *   - Bajas y Ascensos (.xlsx), hoja "Bajas desde 1935" (tabla Tabla2) y hoja
 *     "Ascensos". La escritura la hace la aplicación del Portal (no la cuenta
 *     de quien entra), así que sea@ no necesita permiso de edición en el archivo.
 *   - SharePoint del Portal, carpeta Bajas/: registros.json (fecha de registro,
 *     quién registró, estado) y ascensos.json (validaciones por periodo).
 *
 * Recordatorios (Vercel Cron, una vez al día, GET con ?cron=recordatorios):
 *   - Bajas sin fecha o documento de retiro a los 5 días: correo diario a
 *     sea@enap.edu.co hasta que se carguen (se revisa el Excel, así que también
 *     cuenta si alguien los escribe directo en el archivo).
 *   - Ascensos validados sin fecha o resolución al mes: correo diario a sea@.
 *   El correo sale desde jestadisticaplen@enap.edu.co (permiso Mail.Send de la app).
 */

const roles = require('./roles.js');
const X = require('./_xlsx.js');

const GRAPH = 'https://graph.microsoft.com/v1.0';
const ADMINS = ['sea@enap.edu.co', 'jestadisticaplen@enap.edu.co'];
const DUENO = 'jestadisticaplen@enap.edu.co';
const AVISAR_A = 'sea@enap.edu.co';
const PORTAL_URL = process.env.PORTAL_URL || 'https://enap.vercel.app/';
const CARPETA = 'Bajas';
const CAUSALES = ['CONSEJO ACADÉMICO', 'CONSEJO DISCIPLINARIO', 'APTITUD NAVAL', 'SOLICITUD PROPIA', 'APTITUD PSICOFÍSICA'];
const GRADOS = ['ASP', 'CD', 'GM', 'ALF'];
const DIAS_AVISO_BAJA = 5;
const DIAS_AVISO_ASCENSO = 30;

const RUTA_BD = 'Estadística/Bases de Datos/';
const RUTAS = {
  conglomerado: [RUTA_BD + 'B.D Ingresos/CONGLOMERADO.xlsx', RUTA_BD + 'B.D Ingresos/CONGLOMERADO.xlsm'],
  bajas: [RUTA_BD + 'B.D Retiros y Ascensos/Bajas y Ascensos.xlsx', RUTA_BD + 'B.D Retiros y Ascensos/Bajas y Ascensos.xlsm'],
  graduados: [RUTA_BD + 'B.D Grados - Balances Académicos/Graduados en la ENAP.xlsx'],
};
const HOJA_BAJAS = 'Bajas desde 1935';
const TABLA_BAJAS = 'Tabla2';
const HOJA_ASC = 'Ascensos';

function error(mensaje, status) { const e = new Error(mensaje); e.status = status || 500; return e; }
const ahora = () => new Date().toISOString();
const sinTildes = (s) => String(s == null ? '' : s).replace(/[ñÑ]/g, '\u0001').normalize('NFD').replace(/\u0001(?:̃)?/g, 'Ñ').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
const cedKey = (v) => String(v == null ? '' : v).toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/^0+(?=\d)/, '');

/* ------------------------------ Graph básico ------------------------------ */

let TOKEN = null, SITE = null;
async function ctx() { TOKEN = await roles.getAppAccessToken(); SITE = await roles.resolveSiteId(TOKEN); }

async function g(url, op) {
  op = op || {};
  const headers = Object.assign({ Authorization: `Bearer ${TOKEN}` }, op.headers || {});
  let body = op.body;
  if (body && typeof body === 'object' && !(body instanceof Buffer)) { body = JSON.stringify(body); headers['Content-Type'] = 'application/json'; }
  for (let intento = 0; intento < 3; intento++) {
    const r = await fetch(url.startsWith('http') ? url : GRAPH + url, { method: op.method || 'GET', headers, body });
    if ((r.status === 429 || r.status === 503 || r.status === 504) && intento < 2) { await new Promise((ok) => setTimeout(ok, 1500 * (intento + 1))); continue; }
    return r;
  }
}
async function gj(url, op, que) {
  const r = await g(url, op);
  if (!r.ok) {
    const t = (await r.text()).slice(0, 400);
    let msg = `${que || 'Microsoft Graph'} respondió ${r.status}.`;
    if (r.status === 423) msg = 'El archivo de Bajas y Ascensos está bloqueado (alguien lo tiene abierto sin coautoría). Se reintentará.';
    if (r.status === 403) msg = `${que || 'Graph'}: la aplicación del Portal no tiene permiso (403).`;
    const e = error(msg + (r.status === 423 || r.status === 403 ? '' : ' ' + t), 502); e.graph = r.status; throw e;
  }
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

/* SharePoint del Portal: Bajas/*.json */
const rutaSp = (n) => `/sites/${SITE}/drive/root:/${CARPETA}/${n}:/content`;
async function leerJson(n) { const r = await g(rutaSp(n)); if (r.status === 404) return null; if (!r.ok) throw error(`No se pudo leer ${n} (${r.status}).`, 502); return r.json(); }
async function escribirJson(n, v) { const r = await g(rutaSp(n), { method: 'PUT', body: Buffer.from(JSON.stringify(v)), headers: { 'Content-Type': 'application/json' } }); if (!r.ok) throw error(`No se pudo guardar ${n} (${r.status}).`, 502); }
async function leerJsonAnt(n) { const r = await g(`/sites/${SITE}/drive/root:/Antiguedades/${n}:/content`); if (r.status === 404) return null; if (!r.ok) throw error(`No se pudo leer Antiguedades/${n} (${r.status}).`, 502); return r.json(); }

/* OneDrive de jestadisticaplen */
const enc = (ruta) => ruta.split('/').map(encodeURIComponent).join('/');
async function item(clave) {
  for (const ruta of RUTAS[clave]) {
    const r = await g(`/users/${encodeURIComponent(DUENO)}/drive/root:/${enc(ruta)}`);
    if (r.ok) { const m = await r.json(); return { id: m.id, eTag: m.eTag, nombre: m.name, modificado: m.lastModifiedDateTime, xlsx: /\.xlsx$/i.test(m.name) }; }
    if (r.status !== 404) throw error(`No se pudo abrir ${ruta} (${r.status}).`, 502);
  }
  throw error(`No se encontró el archivo de ${clave} en el OneDrive de Estadística.`, 404);
}
async function descargar(it) {
  const r = await g(`/users/${encodeURIComponent(DUENO)}/drive/items/${it.id}/content`);
  if (!r.ok) throw error(`No se pudo descargar ${it.nombre} (${r.status}).`, 502);
  return Buffer.from(await r.arrayBuffer());
}
const wb = (it) => `/users/${encodeURIComponent(DUENO)}/drive/items/${it.id}/workbook`;
const hojaUrl = (it, hoja) => `${wb(it)}/worksheets('${encodeURIComponent(hoja.replace(/'/g, "''"))}')`;

/* --------------------------- Lectura de fuentes --------------------------- */

const CACHE = {}; // por instancia de la función
async function fuente(clave, procesar) {
  const it = await item(clave);
  const c = CACHE[clave];
  if (c && c.eTag === it.eTag) return c.valor;
  const valor = procesar(X.abrir(await descargar(it)), it);
  CACHE[clave] = { eTag: it.eTag, valor };
  return valor;
}

function indiceCols(enc, nombres) {
  const H = enc.map((h) => sinTildes(h).replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim());
  const out = {};
  for (const [k, alts] of Object.entries(nombres)) {
    out[k] = -1;
    for (const a of alts) { const i = H.indexOf(a); if (i >= 0) { out[k] = i; break; } }
  }
  return out;
}

const fmtFecha = (d) => (d ? `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}` : '');

function procesarConglomerado(libro) {
  const hoja = libro.hojas.find((h) => /todos los ingresos/i.test(h)) || libro.hojas[0];
  const F = libro.leer(hoja, { maxCols: 30 });
  const c = indiceCols(F[0] || [], {
    esp: ['ESP INGRESO'], cont: ['CONTING', 'CONTINGENTE'], fecha: ['FECHA INGRESO'], periodo: ['PERIODO INGRESO'],
    nombre: ['APELLIDOS Y NOMBRES'], cedula: ['CEDULA'], sexo: ['SEXO'], ext: ['EXTRANJERO'], pais: ['PAIS'],
    salida: ['MOTIVO SALIDA'], anioSal: ['ANO DEFINITIVO SALIDA'],
  });
  if (c.nombre < 0 || c.cedula < 0) throw error('CONGLOMERADO no tiene las columnas esperadas (APELLIDOS Y NOMBRES, CEDULA).', 500);
  const minAnio = new Date().getUTCFullYear() - 9;
  const porCed = {};
  for (let i = 1; i < F.length; i++) {
    const r = F[i];
    const ck = cedKey(r[c.cedula]);
    if (!ck || !r[c.nombre]) continue;
    const d = X.serialAFecha(r[c.fecha]);
    let anio = d ? d.getUTCFullYear() : null;
    if (!anio && c.periodo >= 0) { const m = String(r[c.periodo] || '').match(/^(\d{4})/); if (m) anio = +m[1]; }
    if (anio && anio < minAnio) continue;
    const ext = String(r[c.ext] || '').toUpperCase().startsWith('S');
    const reg = {
      nombre: sinTildes(r[c.nombre]), cedula: r[c.cedula], sigla: String(r[c.esp] || '').trim(), cont: String(r[c.cont] || '').replace(/\s+/g, '').trim(),
      fecha: d ? fmtFecha(d) : '', anio: anio || '', sexo: /^[MF]$/i.test(String(r[c.sexo] || '').trim()) ? String(r[c.sexo]).trim().toUpperCase() : '',
      nac: ext ? sinTildes(r[c.pais] || '') : 'COLOMBIA', salida: String(r[c.salida] || '').trim(), anioSal: r[c.anioSal] || '', orden: d ? d.getTime() : i,
    };
    if (!porCed[ck] || porCed[ck].orden <= reg.orden) porCed[ck] = reg;
  }
  return porCed;
}

function procesarBajas(libro) {
  const F = libro.leer(HOJA_BAJAS, { maxCols: 33 });
  const ced = {};
  for (let i = 1; i < F.length; i++) {
    const r = F[i]; const ck = cedKey(r[5]); if (!ck) continue;
    const d = X.serialAFecha(r[7]);
    (ced[ck] = ced[ck] || []).push({ fila: i + 1, ingreso: d ? d.getTime() : null, retiro: r[14], doc: r[16] });
  }
  const H8 = {};
  try {
    libro.leer('Hoja8', { maxCols: 4 }).forEach((r) => { if (r[0]) H8[String(r[0]).toUpperCase().replace(/\s+/g, '')] = { sin: r[1], prog: r[2], sig: r[3] }; });
  } catch (e) { /* sin Hoja8: se calcula por reglas */ }
  return { ced, H8 };
}

const SIGLA_PROG = { NAV: 'CNN', IM: 'CIM', MC: 'MC', MM: 'MM', PR: 'PR', CDPRIM: 'CDPRIM', CDPRON: 'CDPRON', CDLOG: 'CDLOG', CEXTIM: 'CEXTIM' };
function programaDe(curso, sigla, H8) {
  const k = String(curso || '').toUpperCase().replace(/\s+/g, '');
  let h = H8[k];
  if (!h) { const base = k.replace(/-\d+$/, ''); h = H8[base]; }
  const sinLetra = h && h.sin ? String(h.sin) : ((k.match(/^\d\.\d/) || [])[0] || k.replace(/-\d+$/, ''));
  let sig = h && h.sig ? String(h.sig) : (SIGLA_PROG[String(sigla || '').toUpperCase()] || '');
  let prog = h && h.prog ? String(h.prog) : '';
  if (!prog && sig) { const x = Object.values(H8).find((v) => String(v.sig) === sig && v.prog); if (x) prog = String(x.prog); }
  return { sinLetra, siglas: sig, programa: prog };
}

/* Separa "APELLIDOS NOMBRES": los dos primeros apellidos (con partículas). */
const PART = new Set(['DE', 'DEL', 'LA', 'LAS', 'LOS', 'SAN', 'SANTA', 'VAN', 'VON', 'MC', 'MAC', 'DA', 'DI', 'Y']);
function partirNombre(n) {
  const t = sinTildes(n).split(' ').filter(Boolean);
  const ap = []; let i = 0, unidades = 0;
  while (i < t.length && unidades < 2 && t.length - i > 1) {
    const u = [];
    while (i < t.length - 1 && PART.has(t[i])) u.push(t[i++]);
    u.push(t[i++]); ap.push(u.join(' ')); unidades++;
  }
  return { ap: ap.join(' '), no: t.slice(i).join(' ') };
}

async function antiguedadesActuales() {
  const idx = (await leerJsonAnt('periodos.json')) || { lista: [] };
  const per = (idx.lista || []).slice().sort().pop();
  const d = per ? await leerJsonAnt(`datos-${per}.json`) : await leerJsonAnt('datos.json');
  const D = d && d.datos;
  if (!D) return { periodo: per || null, est: {} };
  const est = {};
  const listas = [D.esc || [], ...Object.values(D.sheets || {})];
  listas.forEach((L) => (L || []).forEach((s) => {
    const ck = cedKey(s.ce); if (!ck) return;
    if (s.e === 'Retirado' || s.e === 'Salió') { est[ck] = Object.assign(est[ck] || {}, { retirado: true }); return; }
    if (!est[ck] || !est[ck].cu) est[ck] = { n: s.n, cu: s.cu || '', g: s.g || '', ct: s.ct || '', retirado: false };
  }));
  return { periodo: per || (d.meta && d.meta.periodo) || null, est };
}

async function vigentes() {
  const [ant, cong, baj, reg] = await Promise.all([
    antiguedadesActuales(),
    fuente('conglomerado', procesarConglomerado),
    fuente('bajas', procesarBajas),
    leerJson('registros.json'),
  ]);
  const yaRegistrados = new Set((reg || []).map((r) => cedKey(r.datos.ce)));
  const out = [];
  const visto = new Set();
  const armar = (ck, a, c) => {
    const nombre = (c && c.nombre) || sinTildes(a && a.n);
    const { ap, no } = partirNombre(nombre);
    const sigla = (c && c.sigla) || '';
    const cu = (a && a.cu) || '';
    const p = programaDe(cu, sigla, baj.H8);
    return {
      id: ck, ap, no, ce: String((c && c.cedula) || ck), sx: (c && c.sexo) || '', na: (c && c.nac) || '', si: sigla,
      co: (c && c.cont) || (a && a.ct) || '', ai: c && c.anio ? String(c.anio) : '', fi: (c && c.fecha) || '',
      cu, gr: GRADOS.includes(a && a.g) ? a.g : '', ps: p.siglas, pr: p.programa, nuevo: !a,
    };
  };
  for (const [ck, a] of Object.entries(ant.est)) {
    if (a.retirado || yaRegistrados.has(ck)) continue;
    visto.add(ck); out.push(armar(ck, a, cong[ck]));
  }
  // Recién ingresados en CONGLOMERADO que aún no están en Antigüedades
  const limite = Date.now() - 400 * 86400000;
  for (const [ck, c] of Object.entries(cong)) {
    if (visto.has(ck) || yaRegistrados.has(ck) || c.salida || c.anioSal) continue;
    if (!(c.orden > limite)) continue;
    const ret = baj.ced[ck];
    if (ret && ret.some((x) => !x.ingreso || x.ingreso >= c.orden - 86400000)) continue;
    out.push(armar(ck, null, c));
  }
  out.sort((x, y) => (x.ap + ' ' + x.no).localeCompare(y.ap + ' ' + y.no, 'es'));
  return { periodo: ant.periodo, lista: out };
}

/* ---------------------------- Escritura en Excel --------------------------- */

async function bajasXlsx() {
  const it = await item('bajas');
  if (!it.xlsx) throw error('Bajas y Ascensos sigue en .xlsm. Para que el Portal pueda escribir, guárdelo como "Bajas y Ascensos.xlsx" en la misma carpeta.', 409);
  return it;
}

const numCed = (v) => { const s = String(v || '').trim(); return /^\d{5,12}$/.test(s) ? +s : s; };
const serialDe = (dmy) => { const m = String(dmy || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); return m ? X.fechaASerial(+m[3], +m[2], +m[1]) : ''; };
const LETRAS = (n) => { let s = ''; n++; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };

async function escribirBaja(r) {
  const it = await bajasXlsx();
  const base = hojaUrl(it, HOJA_BAJAS);
  const tabla = await gj(`${wb(it)}/tables('${TABLA_BAJAS}')/range?$select=address,rowCount,columnCount`, null, 'Tabla de bajas');
  const ultima = +(String(tabla.address).match(/(\d+)$/) || [])[1];
  const nAnt = await gj(`${base}/range(address='A${ultima}')?$select=values`, null, 'Bajas');
  const N = (+((nAnt.values || [[0]])[0][0]) || ultima - 1) + 1;
  const d = r.datos;
  const p = r.calc;
  const fila = new Array(Math.max(33, tabla.columnCount)).fill('');
  Object.assign(fila, {
    0: N, 1: 'RETIRO', 2: d.si, 3: d.co, 4: `${d.ap} ${d.no}`.trim(), 5: numCed(d.ce), 6: d.ai ? +d.ai || d.ai : '', 7: serialDe(d.fi),
    8: new Date().getFullYear(), 9: d.sx, 10: d.na, 11: d.cu, 12: p.sinLetra, 13: d.gr, 18: p.siglas, 19: p.programa,
    20: d.ca, 22: d.ob || '', 32: 'RETIRO',
  });
  if (tabla.columnCount >= 35) { fila[33] = r.fecha.slice(0, 10).split('-').reverse().join('/'); fila[34] = r.por; }
  const res = await gj(`${wb(it)}/tables('${TABLA_BAJAS}')/rows/add`, { method: 'POST', body: { index: null, values: [fila] } }, 'Agregar fila en Bajas');
  return { N, fila: ultima + 1, indice: res && res.index };
}

/* Busca la fila del retiro por cédula (la última) y devuelve su número de fila en la hoja. */
async function filaDeBaja(it, ced, ultimaConocida) {
  const tabla = await gj(`${wb(it)}/tables('${TABLA_BAJAS}')/range?$select=address`, null, 'Tabla de bajas');
  const ultima = +(String(tabla.address).match(/(\d+)$/) || [])[1];
  const desde = Math.max(2, Math.min(ultimaConocida || ultima, ultima) - 400);
  const v = await gj(`${hojaUrl(it, HOJA_BAJAS)}/range(address='F${desde}:F${ultima}')?$select=values`, null, 'Bajas');
  const ck = cedKey(ced);
  for (let i = v.values.length - 1; i >= 0; i--) if (cedKey(v.values[i][0]) === ck) return desde + i;
  return null;
}

/* ---------------------------------- Correo -------------------------------- */

async function enviarCorreo(asunto, html) {
  await gj(`/users/${encodeURIComponent(DUENO)}/sendMail`, {
    method: 'POST',
    body: { message: { subject: asunto, body: { contentType: 'HTML', content: html }, toRecipients: [{ emailAddress: { address: AVISAR_A } }] }, saveToSentItems: true },
  }, 'Envío de correo');
}
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function plantillaCorreo(titulo, intro, cab, filas, cierre) {
  const th = cab.map((h) => `<th style="text-align:left;padding:8px 10px;font-size:12px;color:#64748B;border-bottom:1px solid #E2E8F0">${esc(h)}</th>`).join('');
  const tr = filas.map((f) => `<tr>${f.map((c) => `<td style="padding:8px 10px;font-size:13px;color:#071C3C;border-bottom:1px solid #E2E8F0">${esc(c)}</td>`).join('')}</tr>`).join('');
  return `<div style="font-family:Aptos,'Segoe UI',Arial,sans-serif;max-width:720px;color:#071C3C">
<div style="font-size:12px;letter-spacing:.16em;color:#A8861D;font-weight:600">OFICINA DE ESTADÍSTICA · ENAP</div>
<h2 style="margin:6px 0 10px;font-size:20px">${esc(titulo)}</h2><p style="font-size:14px;color:#334155">${intro}</p>
<table style="border-collapse:collapse;width:100%;margin:12px 0">${'<thead><tr>' + th + '</tr></thead>'}<tbody>${tr}</tbody></table>
<p style="font-size:14px;color:#334155">${cierre}</p>
<p><a href="${esc(PORTAL_URL)}" style="display:inline-block;background:#0B2A5B;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px">Abrir el Portal</a></p>
<p style="font-size:12px;color:#94A3B8">Mensaje automático del Portal de servicios digitales Estadística. Se repetirá cada día hasta que la información quede cargada.</p></div>`;
}

const diasDesde = (iso) => Math.floor((Date.now() - Date.parse(iso)) / 86400000);

async function recordatorios() {
  const salida = { bajas: 0, ascensos: 0, reintentos: 0 };
  const regs = (await leerJson('registros.json')) || [];
  let cambio = false;
  let it = null;
  try { it = await bajasXlsx(); } catch (e) { salida.error = e.message; }
  if (it) {
    // 1) reintenta las bajas que no alcanzaron a escribirse en el Excel
    for (const r of regs.filter((x) => !x.excel)) {
      try { const w = await escribirBaja(r); r.excel = true; r.N = w.N; r.fila = w.fila; delete r.errorExcel; cambio = true; salida.reintentos++; } catch (e) { r.errorExcel = e.message; }
    }
    // 2) revisa en el Excel si ya tienen fecha (O) y documento (Q)
    const pend = regs.filter((x) => x.excel && x.estado !== 'completo');
    if (pend.length) {
      const tabla = await gj(`${wb(it)}/tables('${TABLA_BAJAS}')/range?$select=address`, null, 'Tabla de bajas');
      const ultima = +(String(tabla.address).match(/(\d+)$/) || [])[1];
      const desde = Math.max(2, Math.min(...pend.map((x) => x.fila || ultima)) - 400);
      const v = await gj(`${hojaUrl(it, HOJA_BAJAS)}/range(address='F${desde}:Q${ultima}')?$select=values`, null, 'Bajas');
      for (const r of pend) {
        const ck = cedKey(r.datos.ce);
        let fila = null;
        for (let i = v.values.length - 1; i >= 0; i--) if (cedKey(v.values[i][0]) === ck) { fila = v.values[i]; break; }
        if (fila && fila[9] !== '' && fila[9] != null && String(fila[11] || '').trim()) { r.estado = 'completo'; r.completado = ahora(); r.completadoPor = r.completadoPor || 'Excel'; cambio = true; }
      }
    }
  }
  const vencidas = regs.filter((x) => x.estado !== 'completo' && diasDesde(x.fecha) >= DIAS_AVISO_BAJA);
  if (vencidas.length) {
    await enviarCorreo(
      `Registro de bajas: ${vencidas.length} retiro${vencidas.length > 1 ? 's' : ''} sin resolución cargada`,
      plantillaCorreo('Retiros pendientes de resolución',
        `Los siguientes retiros se registraron hace ${DIAS_AVISO_BAJA} días o más y todavía no tienen la <b>fecha de retiro</b> y el <b>documento de retiro</b> cargados.`,
        ['Estudiante', 'Cédula', 'Curso', 'Causal', 'Registrado', 'Días'],
        vencidas.map((r) => [`${r.datos.ap} ${r.datos.no}`, r.datos.ce, r.datos.cu, r.datos.ca, r.fecha.slice(0, 10).split('-').reverse().join('/'), diasDesde(r.fecha)]),
        'Por favor ingrese al Portal, menú <b>Estadística › Registro de bajas</b>, pestaña <b>Pendientes de resolución</b>, y use <b>Añadir resolución</b>.'));
    salida.bajas = vencidas.length;
  }
  if (cambio) await escribirJson('registros.json', regs);

  // 3) Ascensos validados sin fecha o resolución al mes
  const asc = (await leerJson('ascensos.json')) || { validaciones: [] };
  let cambioA = false;
  const vencA = [];
  for (const v of asc.validaciones.filter((x) => !x.completo)) {
    if (it && v.desde && v.hasta) {
      try {
        const r = await gj(`${hojaUrl(it, HOJA_ASC)}/range(address='O${v.desde}:Q${v.hasta}')?$select=values`, null, 'Ascensos');
        if (r.values.every((f) => f[0] !== '' && f[0] != null && String(f[2] || '').trim())) { v.completo = true; v.completado = ahora(); cambioA = true; continue; }
      } catch (e) { /* se reintenta mañana */ }
    }
    if (diasDesde(v.fecha) >= DIAS_AVISO_ASCENSO) vencA.push(v);
  }
  if (vencA.length) {
    await enviarCorreo('Ascensos: falta la fecha y la resolución de ascenso',
      plantillaCorreo('Ascensos sin resolución',
        `Hace más de un mes se hizo la validación final de escalafonamiento y en la hoja <b>Ascensos</b> todavía falta la <b>fecha de ascenso</b> o la <b>resolución</b>.`,
        ['Periodo', 'Validado', 'Estudiantes'],
        vencA.map((v) => [v.periodo, v.fecha.slice(0, 10).split('-').reverse().join('/'), v.total]),
        'Ingrese al Portal, <b>Estadística › Antigüedades ENAP › Administración</b>, tarjeta <b>Validación final</b>, y use <b>Añadir resolución de ascenso</b>.'));
    salida.ascensos = vencA.length;
  }
  if (cambioA) await escribirJson('ascensos.json', asc);
  return salida;
}

/* --------------------------------- Ascensos -------------------------------- */

const PROG_CIENCIAS = { NAV: 'CIENCIAS NAVALES PARA OFICIALES NAVALES', IM: 'CIENCIAS NAVALES PARA OFICIALES DE INFANTERIA DE MARINA', MC: 'CIENCIAS NAUTICAS PARA OFICIALES MERCANTES', MM: 'CIENCIAS NAUTICAS PARA OFICIALES MERCANTES DE MAQUINAS' };
function procesarGraduados(libro) {
  const hoja = libro.hojas.find((h) => /^grados$/i.test(h)) || libro.hojas[0];
  const F = libro.leer(hoja, { maxCols: 30 });
  const c = indiceCols(F[0] || [], { ced: ['CEDULA'], prog: ['NOMBRE PROGRAMA'] });
  const m = {};
  for (let i = 1; i < F.length; i++) { const ck = cedKey(F[i][c.ced]); if (ck) (m[ck] = m[ck] || []).push(sinTildes(F[i][c.prog])); }
  return m;
}

async function validarAscensos(yo, body) {
  const periodo = String(body.periodo || '');
  if (!/^\d{4}-[12]$/.test(periodo)) throw error('Periodo inválido.', 400);
  const grupos = Array.isArray(body.grupos) ? body.grupos : [];
  const filas = [];
  grupos.forEach((gr) => (gr.filas || []).forEach((f) => filas.push({ gr, f })));
  if (!filas.length) throw error('No hay estudiantes escalafonados para validar.', 400);
  if (filas.some((x) => x.f.riesgo)) throw error('Todavía hay estudiantes "En riesgo". La validación final solo se puede hacer cuando no quede ninguno.', 409);
  const asc = (await leerJson('ascensos.json')) || { validaciones: [] };
  if (asc.validaciones.some((v) => v.periodo === periodo)) throw error(`El escalafonamiento ${periodo} ya fue validado y está en la hoja Ascensos.`, 409);
  const it = await bajasXlsx();
  const grad = await fuente('graduados', procesarGraduados);
  const used = await gj(`${hojaUrl(it, HOJA_ASC)}/usedRange(valuesOnly=true)?$select=address`, null, 'Ascensos');
  const ultima = +(String(used.address).match(/(\d+)$/) || [])[1];
  const nAnt = await gj(`${hojaUrl(it, HOJA_ASC)}/range(address='A${ultima}')?$select=values`, null, 'Ascensos');
  let N = +((nAnt.values || [[0]])[0][0]) || ultima - 1;
  const valores = filas.map(({ gr, f }) => {
    const esp = String(f.esp || gr.esp || '').toUpperCase();
    const progC = PROG_CIENCIAS[esp];
    const g2 = grad[cedKey(f.ce)] || [];
    const ciencias = progC && g2.some((p) => p === progC || p.startsWith(progC)) ? 'SÍ' : 'NO';
    return [++N, 'ASCENSO', f.ct || '', esp, gr.promocion || '', f.sp || gr.especialidad || '', sinTildes(f.n), numCed(f.ce), ciencias,
      f.p, `${f.p}/${f.tot}`, f.tot, typeof f.f === 'number' ? f.f : '', periodo, '', '', '', ''];
  });
  const desde = ultima + 1, hasta = ultima + valores.length;
  await gj(`${hojaUrl(it, HOJA_ASC)}/range(address='A${desde}:R${hasta}')`, { method: 'PATCH', body: { values: valores } }, 'Escribir Ascensos');
  asc.validaciones.push({ periodo, fecha: ahora(), por: yo.correo, desde, hasta, total: valores.length, grupos: grupos.map((x) => ({ clave: x.clave, n: (x.filas || []).length })) });
  await escribirJson('ascensos.json', asc);
  return { ok: true, total: valores.length, desde, hasta };
}

async function resolucionAscenso(yo, body) {
  const periodo = String(body.periodo || '');
  const asc = (await leerJson('ascensos.json')) || { validaciones: [] };
  const v = asc.validaciones.find((x) => x.periodo === periodo);
  if (!v) throw error('Ese periodo no ha sido validado.', 404);
  const m = String(body.fecha || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const doc = String(body.resolucion || '').trim().toUpperCase();
  if (!m || !doc) throw error('Escriba la fecha y la resolución de ascenso.', 400);
  const it = await bajasXlsx();
  const n = v.hasta - v.desde + 1;
  const serial = X.fechaASerial(+m[1], +m[2], +m[3]);
  await gj(`${hojaUrl(it, HOJA_ASC)}/range(address='O${v.desde}:Q${v.hasta}')`, { method: 'PATCH', body: { values: Array.from({ length: n }, () => [serial, +m[1], doc]) } }, 'Escribir resolución de ascenso');
  try { await gj(`${hojaUrl(it, HOJA_ASC)}/range(address='O${v.desde}:O${v.hasta}')`, { method: 'PATCH', body: { numberFormat: Array.from({ length: n }, () => ['dd/mm/yyyy']) } }); } catch (e) { /* formato opcional */ }
  Object.assign(v, { completo: true, completado: ahora(), completadoPor: yo.correo, fechaAscenso: body.fecha, resolucion: doc });
  await escribirJson('ascensos.json', asc);
  return { ok: true };
}

/* --------------------------------- Handler -------------------------------- */

async function identificar(accessToken) {
  const r = await fetch(`${GRAPH}/me`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!r.ok) throw error('La sesión de Microsoft no es válida o expiró. Vuelva a iniciar sesión en el Portal.', 401);
  const p = await r.json();
  const correo = String(p.mail || p.userPrincipalName || '').trim().toLowerCase();
  return { correo, nombre: p.displayName || correo };
}

function validarDatos(d) {
  const req = { ap: 'Apellidos', no: 'Nombres', ce: 'Cédula', sx: 'Sexo', si: 'Sigla', co: 'Contingente', ai: 'Año de ingreso', fi: 'Fecha de ingreso', na: 'Nacionalidad', cu: 'Curso de retiro', gr: 'Grado', ca: 'Primera causal de retiro' };
  const out = {};
  for (const k of Object.keys(req).concat(['ob'])) out[k] = String(d[k] == null ? '' : d[k]).trim().replace(/\s+/g, ' ');
  ['ap', 'no', 'na', 'si', 'co', 'cu'].forEach((k) => { out[k] = out[k].toUpperCase(); });
  const faltan = Object.keys(req).filter((k) => !out[k]).map((k) => req[k]);
  if (faltan.length) throw error('Faltan campos obligatorios: ' + faltan.join(', ') + '.', 400);
  if (!/^[MF]$/.test(out.sx)) throw error('Sexo debe ser M o F.', 400);
  if (!GRADOS.includes(out.gr)) throw error('Grado inválido.', 400);
  if (!CAUSALES.includes(out.ca)) throw error('Causal inválida.', 400);
  if (!/^\d{4}$/.test(out.ai)) throw error('Año de ingreso inválido.', 400);
  if (!/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(out.fi)) throw error('La fecha de ingreso debe tener el formato dd/mm/aaaa.', 400);
  return out;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    /* ---- Cron diario de recordatorios ---- */
    if (req.method === 'GET') {
      const q = req.query || {};
      if (q.cron !== 'recordatorios') { res.status(405).json({ error: 'Use POST.' }); return; }
      const secreto = process.env.CRON_SECRET;
      if (secreto && req.headers.authorization !== `Bearer ${secreto}`) throw error('No autorizado.', 401);
      await ctx();
      res.status(200).json(await recordatorios());
      return;
    }
    if (req.method !== 'POST') { res.status(405).json({ error: 'Use POST.' }); return; }
    const body = typeof req.body === 'object' && req.body ? req.body : {};
    if (!body.accessToken || !body.accion) throw error('Faltan "accessToken" o "accion".', 400);
    const yo = await identificar(body.accessToken);
    if (!ADMINS.includes(yo.correo)) throw error('Este módulo es solo para sea@enap.edu.co y jestadisticaplen@enap.edu.co.', 403);
    await ctx();
    const a = body.accion;

    if (a === 'sesion') { res.status(200).json({ correo: yo.correo, nombre: yo.nombre, causales: CAUSALES, grados: GRADOS }); return; }

    if (a === 'vigentes') { res.status(200).json(await vigentes()); return; }

    if (a === 'registrar') {
      const datos = validarDatos(body.datos || {});
      const regs = (await leerJson('registros.json')) || [];
      if (regs.some((r) => cedKey(r.datos.ce) === cedKey(datos.ce) && r.estado !== 'completo')) throw error('Ese estudiante ya tiene un retiro registrado pendiente de resolución.', 409);
      const baj = await fuente('bajas', procesarBajas);
      const calc = programaDe(datos.cu, datos.si, baj.H8);
      const r = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), fecha: ahora(), por: yo.correo, datos, calc, estado: 'pendiente', excel: false };
      let aviso = null;
      try { const w = await escribirBaja(r); r.excel = true; r.N = w.N; r.fila = w.fila; }
      catch (e) { r.errorExcel = e.message; aviso = `La baja quedó registrada en el Portal, pero no se pudo escribir todavía en Bajas y Ascensos: ${e.message} Se reintentará automáticamente cada día.`; }
      regs.push(r);
      await escribirJson('registros.json', regs);
      res.status(200).json({ ok: true, registro: r, aviso });
      return;
    }

    if (a === 'pendientes') {
      const regs = (await leerJson('registros.json')) || [];
      res.status(200).json({ lista: regs.filter((r) => r.estado !== 'completo').map((r) => ({ id: r.id, fecha: r.fecha, por: r.por, datos: r.datos, excel: r.excel, errorExcel: r.errorExcel || null, dias: diasDesde(r.fecha) })) });
      return;
    }

    if (a === 'resolucion') {
      const regs = (await leerJson('registros.json')) || [];
      const r = regs.find((x) => x.id === body.id);
      if (!r) throw error('No se encontró el registro.', 404);
      const m = String(body.fecha || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
      const doc = String(body.documento || '').trim().toUpperCase();
      if (!m || !doc) throw error('Escriba la fecha de retiro y el documento.', 400);
      const it = await bajasXlsx();
      if (!r.excel) { const w = await escribirBaja(r); r.excel = true; r.N = w.N; r.fila = w.fila; delete r.errorExcel; }
      const fila = await filaDeBaja(it, r.datos.ce, r.fila);
      if (!fila) throw error('No se encontró la fila de este retiro en Bajas y Ascensos (búsqueda por cédula).', 404);
      const y = +m[1], mes = +m[2], d = +m[3];
      const hu = hojaUrl(it, HOJA_BAJAS);
      await gj(`${hu}/range(address='I${fila}')`, { method: 'PATCH', body: { values: [[y]] } }, 'Bajas');
      await gj(`${hu}/range(address='O${fila}:R${fila}')`, { method: 'PATCH', body: { formulas: [[X.fechaASerial(y, mes, d), mes <= 6 ? 1 : 2, doc, `=RIGHT(LEFT(Q${fila},9),4)`]] } }, 'Bajas');
      try { await gj(`${hu}/range(address='O${fila}')`, { method: 'PATCH', body: { numberFormat: [['dd/mm/yyyy']] } }); } catch (e) { /* opcional */ }
      Object.assign(r, { estado: 'completo', completado: ahora(), completadoPor: yo.correo, fechaRetiro: body.fecha, documento: doc, fila });
      await escribirJson('registros.json', regs);
      res.status(200).json({ ok: true });
      return;
    }

    /* ---- Ascensos (desde Antigüedades › Administración) ---- */
    if (a === 'ascensos-estado') {
      const asc = (await leerJson('ascensos.json')) || { validaciones: [] };
      res.status(200).json({ validacion: asc.validaciones.find((v) => v.periodo === body.periodo) || null });
      return;
    }
    if (a === 'validar-ascensos') { res.status(200).json(await validarAscensos(yo, body)); return; }
    if (a === 'ascensos-resolucion') { res.status(200).json(await resolucionAscenso(yo, body)); return; }

    if (a === 'probar-correo') {
      await enviarCorreo('Prueba · Registro de bajas', plantillaCorreo('Prueba de recordatorio', 'Este es un correo de prueba del módulo Registro de bajas.', ['Dato'], [['Si lo recibe, los recordatorios funcionan.']], ''));
      res.status(200).json({ ok: true });
      return;
    }

    throw error(`Acción desconocida: ${a}`, 400);
  } catch (e) {
    res.status(e.status || 500).json({ error: e instanceof Error ? e.message : String(e) });
  }
};

module.exports._test = { procesarConglomerado, procesarBajas, programaDe, partirNombre, procesarGraduados, validarDatos, cedKey };
