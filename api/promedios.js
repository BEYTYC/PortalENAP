/*!
 * Portal de Servicios Digitales Estadística — Escuela Naval de Cadetes "Almirante Padilla"
 * Autora y desarrolladora: CAMARGO MARTÍNEZ BEYTY PATRICIA — Oficina de Estadística
 * Derechos morales de autor reservados (Ley 23 de 1982, art. 30). Este aviso de autoría no debe eliminarse ni alterarse.
 */
/**
 * api/promedios.js — servidor del módulo "Generación de Promedios Académicos".
 *
 * Los certificados se generan en el navegador (jsPDF); aquí se guarda todo y se envían los correos.
 * Datos (SharePoint del Portal, carpeta Promedios/; nunca en el repo):
 *   registros.json            un registro por certificado (clave única: cédula + programa)
 *   ajustes.json              firmante, tabla programa/sigla/facultad, usuarios autorizados
 *   Certificados/<código>.pdf PDF emitido
 *   Revision/<código>/*.jpg   imágenes de los escaneados mientras esperan revisión (se borran al resolver)
 *
 * Quién entra: Estadística (jestadisticaplen@) y los usuarios que esta agregue en Ajustes (solo cargar y consultar).
 * Ajustes, revisión y correcciones: solo Estadística.
 * Público (sin sesión): GET /api/promedios?verificar=PA-2026-000001 → datos mínimos del certificado (cédula parcial).
 * Correo: sale de certificaciones@enap.edu.co (Mail.Send de la aplicación; el buzón debe existir y no estar excluido por política de acceso), uno por lote con un ZIP.
 */

const roles = require('./roles.js');

const GRAPH = 'https://graph.microsoft.com/v1.0';
const DUENO = 'jestadisticaplen@enap.edu.co';
const ESTADISTICA = [DUENO];
const REMITENTE = 'certificaciones@enap.edu.co';   /* los correos salen de Certificaciones */
const PORTAL_URL = process.env.PORTAL_URL || 'https://enap.vercel.app/';
const CARPETA = 'Promedios';

function error(m, s) { const e = new Error(m); e.status = s || 500; return e; }
const ahora = () => new Date().toISOString();
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const sinTildes = (s) => String(s == null ? '' : s).replace(/[ñÑ]/g, '\u0001').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\u0001/g, 'Ñ').toUpperCase().replace(/\s+/g, ' ').trim();
const cedKey = (v) => String(v == null ? '' : v).toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/^0+(?=\d)/, '');
const limpio = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max || 200);

/* ------------------------------ Graph ------------------------------ */
let TOKEN = null, SITE = null;
async function ctx() { TOKEN = await roles.getAppAccessToken(); SITE = await roles.resolveSiteId(TOKEN); }
async function g(url, op) {
  op = op || {};
  const headers = Object.assign({ Authorization: `Bearer ${TOKEN}` }, op.headers || {});
  let body = op.body;
  if (body && typeof body === 'object' && !(body instanceof Buffer)) { body = JSON.stringify(body); headers['Content-Type'] = 'application/json'; }
  for (let i = 0; i < 3; i++) {
    const r = await fetch(url.startsWith('http') ? url : GRAPH + url, { method: op.method || 'GET', headers, body });
    if ((r.status === 429 || r.status === 503 || r.status === 504) && i < 2) { await new Promise((ok) => setTimeout(ok, 1500 * (i + 1))); continue; }
    return r;
  }
}
const rutaSp = (n) => `/sites/${SITE}/drive/root:/${CARPETA}/${n.split('/').map(encodeURIComponent).join('/')}`;
async function leerJson(n) {
  const m = await g(rutaSp(n)); if (m.status === 404) return { valor: null, eTag: null }; if (!m.ok) throw error(`No se pudo leer ${n} (${m.status}).`, 502);
  const meta = await m.json(); const c = await g(rutaSp(n) + ':/content'); if (!c.ok) throw error(`No se pudo leer ${n} (${c.status}).`, 502);
  return { valor: await c.json(), eTag: meta.eTag };
}
async function escribirJson(n, v, eTag) {
  const headers = { 'Content-Type': 'application/json' }; if (eTag) headers['If-Match'] = eTag;
  const r = await g(rutaSp(n) + ':/content', { method: 'PUT', body: Buffer.from(JSON.stringify(v)), headers });
  if (r.status === 412) { const e = error('Otro proceso modificó los datos al mismo tiempo.', 409); e.conflicto = true; throw e; }
  if (!r.ok) throw error(`No se pudo guardar ${n} (${r.status}).`, 502);
}
async function leerBin(n) { const r = await g(rutaSp(n) + ':/content'); if (r.status === 404) return null; if (!r.ok) throw error(`No se pudo leer ${n} (${r.status}).`, 502); return Buffer.from(await r.arrayBuffer()); }
async function escribirBin(n, buf, tipo) { const r = await g(rutaSp(n) + ':/content', { method: 'PUT', body: buf, headers: { 'Content-Type': tipo } }); if (!r.ok) throw error(`No se pudo guardar ${n} (${r.status}).`, 502); }
async function borrar(n) { const r = await g(rutaSp(n), { method: 'DELETE' }); if (!r.ok && r.status !== 404) throw error(`No se pudo borrar ${n} (${r.status}).`, 502); }

/* Lee-modifica-escribe con control de versión (reintenta si otro proceso escribió en medio). */
async function mutar(nombre, porDefecto, fn) {
  for (let i = 0; i < 5; i++) {
    const { valor, eTag } = await leerJson(nombre); const v = valor == null ? porDefecto() : valor;
    const salida = await fn(v);
    try { await escribirJson(nombre, v, eTag); return salida; } catch (e) { if (!e.conflicto || i === 4) throw e; await new Promise((ok) => setTimeout(ok, 400 * (i + 1))); }
  }
}

/* ------------------------------ Ajustes ------------------------------ */
const PROGRAMAS_BASE = [
  ['cn-navales', 'Ciencias Navales para Oficiales Navales', 'NAV', 'pregrado', 'Ciencias Navales'],
  ['cn-infanteria', 'Ciencias Navales para Oficiales de Infantería de Marina', 'IM', 'pregrado', 'Infantería de Marina'],
  ['cn-puente', 'Ciencias Náuticas para Oficiales Mercantes de Puente', 'MC', 'pregrado', ''],
  ['cn-maquinas', 'Ciencias Náuticas para Oficiales Mercantes de Máquinas', 'MM', 'pregrado', ''],
  ['administracion', 'Administración', 'CCPAD', 'pregrado', ''],
  ['administracion-maritima', 'Administración Marítima', 'CCPAM', 'pregrado', ''],
  ['ing-electronica', 'Ingeniería Electrónica', 'CCPEL', 'pregrado', ''],
  ['ing-naval', 'Ingeniería Naval', 'CCPIN', 'pregrado', ''],
  ['oceanografia-fisica', 'Oceanografía Física', 'CCPOF', 'pregrado', ''],
  ['esp-logistica', 'Especialización en Gestión Logística', 'ESP LOGÍSTICA', 'posgrado', ''],
  ['esp-politica', 'Especialización en Política y Estrategia Marítima', 'ESP POLÍTICA', 'posgrado', ''],
  ['mae-logistica', 'Maestría en Gestión Logística', 'MSC LOGÍSTICA', 'posgrado', ''],
  ['mae-ing-naval', 'Maestría en Ingeniería Naval', 'MSC INGENIERÍA NAVAL', 'posgrado', ''],
  ['mae-oceanografia', 'Maestría en Oceanografía', 'MSC OCEANOGRAFÍA', 'posgrado', 'Oceanografía Física'],
  ['doctorado-mar', 'Doctorado en Ciencias del Mar', 'PHD', 'posgrado', ''],
].map(([id, nombre, sigla, nivel, facultad]) => ({ id, nombre, sigla, nivel, facultad }));
const ajustesBase = () => ({
  firmante: { grado: 'PD02', nombre: 'Beyty Patricia Camargo Martínez', cargo: 'Jefe de Estadística Escuela Naval de Cadetes “Almirante Padilla”', firma: null },
  programas: PROGRAMAS_BASE, usuarios: [], enlaceVerificacion: 'https://enap.vercel.app/verificar'
});
async function leerAjustes() { const { valor } = await leerJson('ajustes.json'); const b = ajustesBase(); return valor ? Object.assign(b, valor) : b; }

/* ------------------------------ ZIP (sin compresión, nombres UTF-8) ------------------------------ */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function zip(archivos) { /* [{nombre:'Carpeta/a.pdf', datos:Buffer}] */
  const partes = [], central = []; let desp = 0; const d = new Date();
  const hora = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), fecha = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  archivos.forEach((a) => {
    const nom = Buffer.from(a.nombre, 'utf8'), crc = crc32(a.datos), h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(0, 8); h.writeUInt16LE(hora, 10); h.writeUInt16LE(fecha, 12);
    h.writeUInt32LE(crc, 14); h.writeUInt32LE(a.datos.length, 18); h.writeUInt32LE(a.datos.length, 22); h.writeUInt16LE(nom.length, 26); h.writeUInt16LE(0, 28);
    partes.push(h, nom, a.datos);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(0, 10); c.writeUInt16LE(hora, 12); c.writeUInt16LE(fecha, 14);
    c.writeUInt32LE(crc, 16); c.writeUInt32LE(a.datos.length, 20); c.writeUInt32LE(a.datos.length, 24); c.writeUInt16LE(nom.length, 28); c.writeUInt32LE(desp, 42);
    central.push(c, nom); desp += 30 + nom.length + a.datos.length;
  });
  const cd = Buffer.concat(central), fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0); fin.writeUInt16LE(archivos.length, 8); fin.writeUInt16LE(archivos.length, 10); fin.writeUInt32LE(cd.length, 12); fin.writeUInt32LE(desp, 16);
  return Buffer.concat(partes.concat([cd, fin]));
}

/* ------------------------------ Correo ------------------------------ */
/* Sale de Certificaciones; si Microsoft rechaza ese buzón, se intenta con el de Estadística y se informa cuál salió. Devuelve el buzón usado. */
async function enviarCorreo(para, asunto, html, adjunto) {
  try { await enviarDesde(REMITENTE, para, asunto, html, adjunto); return REMITENTE; }
  catch (e1) {
    try { await enviarDesde(DUENO, para, asunto, html, adjunto); return DUENO; }
    catch (e2) { throw error(`${e1.message} | Respaldo (${DUENO}): ${e2.message}`.slice(0, 500), 502); }
  }
}
async function enviarDesde(remitente, para, asunto, html, adjunto) {
  const lista = !adjunto ? [] : Array.isArray(adjunto) ? adjunto : [adjunto];
  const mensaje = { subject: asunto, body: { contentType: 'HTML', content: html }, toRecipients: [{ emailAddress: { address: para } }] };
  const base = `/users/${encodeURIComponent(remitente)}`;
  const total = lista.reduce((a, x) => a + x.datos.length, 0);
  if (total <= 2.5 * 1024 * 1024) {
    if (lista.length) mensaje.attachments = lista.map((x) => ({ '@odata.type': '#microsoft.graph.fileAttachment', name: x.nombre, contentType: x.tipo || 'application/zip', contentBytes: x.datos.toString('base64') }));
    const r = await g(base + '/sendMail', { method: 'POST', body: { message: mensaje, saveToSentItems: true } });
    if (!r.ok) throw error(`No se pudo enviar el correo (${r.status}): ${(await r.text()).slice(0, 200)}`, 502);
    return;
  }
  /* adjuntos grandes: borrador + sesión de carga por cada archivo */
  const b = await g(base + '/messages', { method: 'POST', body: mensaje }); if (!b.ok) throw error(`No se pudo crear el correo (${b.status}).`, 502);
  const id = (await b.json()).id;
  for (const adj of lista) {
    const s = await g(`${base}/messages/${id}/attachments/createUploadSession`, { method: 'POST', body: { AttachmentItem: { attachmentType: 'file', name: adj.nombre, size: adj.datos.length, contentType: adj.tipo || 'application/zip' } } });
    if (!s.ok) throw error(`No se pudo preparar el adjunto (${s.status}).`, 502);
    const url = (await s.json()).uploadUrl, T = 320 * 1024 * 12;
    for (let ini = 0; ini < adj.datos.length; ini += T) {
      const trozo = adj.datos.subarray(ini, Math.min(ini + T, adj.datos.length));
      const u = await fetch(url, { method: 'PUT', headers: { 'Content-Length': String(trozo.length), 'Content-Range': `bytes ${ini}-${ini + trozo.length - 1}/${adj.datos.length}`, 'Content-Type': 'application/octet-stream' }, body: trozo });
      if (!u.ok) throw error(`No se pudo subir el adjunto (${u.status}).`, 502);
    }
  }
  const e = await g(`${base}/messages/${id}/send`, { method: 'POST' }); if (!e.ok) throw error(`No se pudo enviar el correo (${e.status}).`, 502);
}
function htmlCorreo(o) {
  o = o || {};
  const titulo = o.titulo || 'Certificados de promedio académico';
  const cuerpo = o.cuerpo || `<p style="font-size:14.5px;color:#334155;margin:0 0 10px">Se adjunta un archivo comprimido con los certificados de promedio académico solicitados, uno por estudiante.</p>`;
  const logo = PORTAL_URL.replace(/\/?$/, '/') + 'assets/escudo.png';
  const pre = o.pre ? `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all">${esc(o.pre)}</div>` : '';
  return `${pre}<div style="background:#f4f6f8;padding:24px 0;font-family:Aptos,'Segoe UI',Arial,sans-serif;color:#212529">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #d9e2ec;border-radius:14px;overflow:hidden">
<tr><td style="background:#0b3d66;border-bottom:3px solid #c9a227;padding:16px 24px"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="padding-right:14px"><img src="${esc(logo)}" alt="" height="42" style="display:block;height:42px"></td><td style="color:#ffffff"><div style="font-size:16px;font-weight:600;line-height:1.25">Portal de Servicios Digitales - Oficina de Estadística</div><div style="font-size:12px;opacity:.85">Escuela Naval de Cadetes “Almirante Padilla”</div></td></tr></table></td></tr>
<tr><td style="padding:26px 28px 8px">
<div style="font-size:12px;letter-spacing:.2em;color:#8a6d0b;font-weight:700">GENERACIÓN DE PROMEDIOS ACADÉMICOS</div>
<h2 style="margin:8px 0 14px;font-size:21px;color:#062a4a;font-weight:600">${titulo}</h2>
<p style="font-size:14.5px;color:#334155;margin:0 0 10px">Cordial saludo.</p>
${cuerpo}
<p style="font-size:14.5px;color:#334155;margin:0 0 18px">Si desea generar más certificados, ingrese al módulo Generación de Promedios Académicos del Portal de Servicios Digitales - Oficina de Estadística.</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px"><tr><td>
<a href="${esc(PORTAL_URL)}" target="_blank" style="text-decoration:none"><img src="${esc(PORTAL_URL.replace(/\/?$/, '/') + 'assets/boton-abrir-portal.png')}" width="176" height="36" alt="Abrir el Portal" style="display:block;border:0;width:176px;height:36px;border-radius:18px;background:#0b3d66;color:#ffffff;font-family:'Segoe UI',Arial,sans-serif;font-size:14px;font-weight:600;line-height:36px;text-align:center"></a>
</td></tr></table>
</td></tr>
<tr><td style="background:#f8fafc;border-top:1px solid #e3eaf1;padding:14px 28px;font-size:12px;color:#7b8794;line-height:1.5">Este mensaje fue enviado automáticamente desde el Portal de Servicios Digitales - Oficina de Estadística de la Escuela Naval de Cadetes “Almirante Padilla”. Por favor no responda a este correo.</td></tr>
</table></div>`;
}

/* Envía por correo los certificados emitidos y aún no enviados de un lote. */
async function enviarPendientesDelLote(loteId) {
  const { valor } = await leerJson('registros.json'); const regs = valor || [];
  const lista = regs.filter((r) => r.lote && r.lote.id === loteId && r.estado === 'emitido' && !r.enviado);
  if (!lista.length) return { enviados: 0 };
  const para = lista[0].lote.correo; if (!para) throw error('El lote no tiene correo de destino.', 400);
  const nMail = regs.filter((r) => r.lote && r.lote.id === loteId && r.enviado).map((r) => r.enviado.n || 1).reduce((a, b) => Math.max(a, b), 0) + 1;
  const archivos = [];
  for (const r of lista) { const b = await leerBin(`Certificados/${r.codigo}.pdf`); if (!b) throw error(`Falta el PDF ${r.codigo}.`, 500); archivos.push({ nombre: `Certificados de promedio/${r.archivo}`, datos: b }); }
  if (archivos.length <= 5) {   /* hasta 5 certificados: PDF sueltos, sin comprimir */
    const uno = archivos.length === 1;
    const cuerpo = `<p style="font-size:14.5px;color:#334155;margin:0 0 10px">${uno ? 'Se adjunta el certificado de promedio académico solicitado.' : 'Se adjuntan los certificados de promedio académico solicitados, uno por estudiante.'}</p>`;
    await enviarCorreo(para, uno ? 'Certificado de Promedio Académico' : 'Certificados de Promedio Académico', htmlCorreo({ titulo: uno ? 'Certificado de Promedio Académico' : 'Certificados de Promedio Académico', pre: uno ? 'Certificado de Promedio Académico' : 'Certificados de Promedio Académico', cuerpo }), archivos.map((x) => ({ nombre: x.nombre.split('/').pop(), datos: x.datos, tipo: 'application/pdf' })));
  } else {   /* más de 5: un ZIP */
    const z = zip(archivos);
    await enviarCorreo(para, 'Certificados de Promedio Académico', htmlCorreo({ pre: 'Certificados de Promedio Académico' }), { nombre: 'Certificados de promedio.zip', datos: z });
  }
  const codigos = new Set(lista.map((r) => r.codigo)), t = ahora();
  await mutar('registros.json', () => [], (rs) => { rs.forEach((r) => { if (codigos.has(r.codigo)) r.enviado = { fecha: t, a: para, n: nMail }; }); });
  return { enviados: lista.length, a: para };
}


/* ------------------------------ Copia en OneDrive de programacion.ditic ------------------------------
   Cada certificado emitido se copia también a "Promedios Académicos/<año>/<año-periodo>/<archivo>.pdf" en el OneDrive de
   programacion.ditic@enap.edu.co, en la misma carpeta donde están "Concesiones Especiales" y "Titulación" (se busca esa carpeta;
   si no se encuentra se usa PROMEDIOS_ONEDRIVE_RUTA o la raíz). Es una copia: si falla, la emisión no se detiene. */
const DUENO_COPIA = 'programacion.ditic@enap.edu.co', CARPETA_COPIA = 'Promedios Académicos';
let PADRE_COPIA = null;
const encRuta = (r) => r.split('/').filter(Boolean).map(encodeURIComponent).join('/');
async function carpetaPadreCopia() {
  if (PADRE_COPIA !== null) return PADRE_COPIA;
  if (process.env.PROMEDIOS_ONEDRIVE_RUTA) return (PADRE_COPIA = process.env.PROMEDIOS_ONEDRIVE_RUTA.replace(/^\/+|\/+$/g, ''));
  for (const q of ['Concesiones Especiales', 'Titulación', 'Titulacion']) {
    const r = await g(`/users/${encodeURIComponent(DUENO_COPIA)}/drive/root/search(q='${encodeURIComponent(q)}')?$select=name,folder,parentReference&$top=50`);
    if (!r.ok) continue;
    const it = ((await r.json()).value || []).find((x) => x.folder && x.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() === q.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase());
    if (it) { const pr = (it.parentReference && it.parentReference.path) || ''; return (PADRE_COPIA = decodeURIComponent(pr.replace(/^.*?root:/, '')).replace(/^\/+|\/+$/g, '')); }
  }
  return (PADRE_COPIA = '');
}
async function copiarAOneDrive(codigo, reg, buf) {
  try {
    const f = new Date(Date.now() - 5 * 3600 * 1000), anio = f.getUTCFullYear(), per = f.getUTCMonth() < 7 ? 1 : 2;   /* hora de Colombia; ene–jul = periodo 1 */
    const limpioNombre = (t) => String(t || '').replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim();
    const nombre = limpioNombre(`${reg.apellidos || ''} ${reg.nombres || ''}`) || 'SIN NOMBRE';
    const carpeta = [await carpetaPadreCopia(), CARPETA_COPIA, String(anio), `${anio}-${per}`, nombre].filter(Boolean).join('/');
    const subir = async (archivo, datos, tipo) => {
      const r = await g(`/users/${encodeURIComponent(DUENO_COPIA)}/drive/root:/${encRuta(carpeta + '/' + archivo)}:/content?@microsoft.graph.conflictBehavior=replace`, { method: 'PUT', body: datos, headers: { 'Content-Type': tipo } });
      if (!r.ok) throw new Error(`OneDrive ${r.status}: ${(await r.text()).slice(0, 160)}`);
    };
    /* 1) el promedio (certificado) con el nombre de siempre; 2) la cédula y 3) el balance cargados */
    await subir(limpioNombre(reg.archivo) || `${nombre}.pdf`, buf, 'application/pdf');
    const MIME = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' };
    for (const [tipo, etiqueta] of [['cedula', 'CÉDULA'], ['balance', 'BALANCE']]) {
      for (const ext of ['pdf', 'jpg', 'jpeg', 'png']) {
        const orig = await leerBin(`Originales/${codigo}/${tipo}.${ext}`).catch(() => null);
        if (orig) { await subir(`${etiqueta} - ${nombre}.${ext}`, orig, MIME[ext]); break; }
      }
    }
    await mutar('registros.json', () => [], (rs) => { const x = rs.find((y) => y.codigo === codigo); if (x) { x.copia = carpeta; delete x.copiaError; } }).catch(() => {});
  } catch (e) {
    console.error('Copia a OneDrive:', e.message);
    await mutar('registros.json', () => [], (rs) => { const x = rs.find((y) => y.codigo === codigo); if (x) x.copiaError = String(e.message).slice(0, 200); }).catch(() => {});
  }
}

/* Un certificado se guarda solo como imagen (no editable): se rechaza un PDF que traiga texto. */
function pdfTieneTexto(buf) {
  const zlib = require('zlib'), s = buf.toString('latin1'); let i = 0;
  while ((i = s.indexOf('stream', i)) >= 0) {
    let ini = i + 6; if (s[ini] === '\r') ini++; if (s[ini] === '\n') ini++;
    const fin = s.indexOf('endstream', ini); if (fin < 0) break;
    try { const t = zlib.inflateSync(buf.subarray(ini, fin)).toString('latin1'); if (/\bBT\b[\s\S]{0,4000}?\bT[jJ]\b/.test(t)) return true; } catch (e) { /* imagen u otro flujo no comprimido con Flate */ }
    i = fin + 9;
  }
  return false;
}
const ERR_PDF_TEXTO = 'El certificado debe generarse como imagen no editable. Recargue el Portal (Ctrl+F5) e intente de nuevo.';

/* ------------------------------ Validación ------------------------------ */
function datosRegistro(d, laxo) {
  const o = {
    cedula: cedKey(d.cedula), nombres: limpio(d.nombres, 80).toUpperCase(), apellidos: limpio(d.apellidos, 80).toUpperCase(), lugar: limpio(d.lugar, 80),
    programaId: limpio(d.programaId, 60), programa: limpio(d.programa, 160), sigla: limpio(d.sigla, 40), nivel: d.nivel === 'posgrado' ? 'posgrado' : 'pregrado',
    facultad: limpio(d.facultad, 120), promedio: Math.round(Number(d.promedio) * 1000) / 1000, periodoTerminacion: limpio(d.periodoTerminacion, 10), diplomado: limpio(d.diplomado, 10),
    fechaBalance: limpio(d.fechaBalance, 10), estadoVigencia: d.estadoVigencia === 'actualizado' ? 'actualizado' : 'vigente'
  };
  if (laxo) { if (!(o.promedio >= 0 && o.promedio <= 10)) o.promedio = null; return o; }
  const falta = ['cedula', 'nombres', 'apellidos', 'programaId', 'programa', 'sigla', 'facultad', 'periodoTerminacion', 'fechaBalance'].filter((k) => !o[k]);
  if (falta.length) throw error('Faltan datos: ' + falta.join(', ') + '.', 400);
  if (!(o.promedio >= 0 && o.promedio <= 10)) throw error('Promedio inválido.', 400);
  if (!/^\d{6,12}$/.test(o.cedula)) throw error('Cédula inválida.', 400);
  return o;
}
const archivoDe = (o) => (o.sigla + ' - ' + o.apellidos + ' ' + o.nombres).replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim() + '.pdf';
/* Solo un certificado ya EMITIDO bloquea. Lo pendiente (reservado o en revisión) se reemplaza por lo nuevo. */
const duplicado = (regs, o) => !o.cedula || !o.programaId ? null : regs.find((r) => r.estado === 'emitido' && r.cedula === o.cedula && r.programaId === o.programaId);
const nombreDe = (r) => sinTildes(`${r.apellidos || ''} ${r.nombres || ''}`);
const mismoPendiente = (r, o) => (r.estado === 'reservado' || r.estado === 'revision') && (o.cedula && r.programaId === o.programaId && (r.cedula === o.cedula || (nombreDe(r) && nombreDe(r) === nombreDe(o))));
const resumen = (r) => ({ codigo: r.codigo, estado: r.estado, cedula: r.cedula, nombres: r.nombres, apellidos: r.apellidos, sigla: r.sigla, programa: r.programa, promedio: r.promedio, fecha: r.fecha, motivoRevision: r.motivoRevision || null, enviado: r.enviado || null, lote: r.lote ? { id: r.lote.id, correo: r.lote.correo } : null, archivo: r.archivo });

/* ------------------------------ Identidad ------------------------------ */
async function identificar(accessToken) {
  const r = await fetch(`${GRAPH}/me`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!r.ok) throw error('La sesión de Microsoft no es válida o expiró. Vuelva a iniciar sesión en el Portal.', 401);
  const p = await r.json(); const correo = String(p.mail || p.userPrincipalName || '').trim().toLowerCase();
  return { correo, nombre: p.displayName || correo };
}

/* ------------------------------ Handler ------------------------------ */
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    /* ---- Verificación pública del QR ---- */
    if (req.method === 'GET') {
      const codigo = limpio((req.query || {}).verificar, 30).toUpperCase();
      if (!/^PA-\d{4}-\d{6}$/.test(codigo)) { res.status(400).json({ valido: false, error: 'Código con formato inválido.' }); return; }
      await ctx();
      const { valor } = await leerJson('registros.json'); const r = (valor || []).find((x) => x.codigo === codigo && x.estado === 'emitido');
      if (!r) { res.status(404).json({ valido: false }); return; }
      const c = r.cedula; const parcial = '*'.repeat(Math.max(0, c.length - 4)) + c.slice(-4);
      res.status(200).json({ valido: true, codigo: r.codigo, nombre: `${r.nombres} ${r.apellidos}`, cedula: parcial, programa: r.programa, promedio: r.promedio, fecha: r.fecha });
      return;
    }
    if (req.method !== 'POST') { res.status(405).json({ error: 'Use GET o POST.' }); return; }
    const body = typeof req.body === 'object' && req.body ? req.body : {};
    if (!body.accessToken || !body.accion) throw error('Faltan "accessToken" o "accion".', 400);
    const yo = await identificar(body.accessToken);
    await ctx();
    const ajustes = await leerAjustes();
    const esEst = ESTADISTICA.includes(yo.correo);
    let puede = esEst || (ajustes.usuarios || []).map((u) => String(u.correo).toLowerCase()).includes(yo.correo);
    /* Todo jefe de programa (rol JEFE_PROGRAMA activo en la lista de permisos del Portal) entra con su propio usuario del login. */
    if (!puede) {
      try {
        const t = await roles.getAppAccessToken(), sid = await roles.resolveSiteId(t), lid = await roles.resolveListId(t, sid);
        puede = roles.rolesActivosPara(await roles.leerFilas(t, sid, lid), yo.correo).includes('JEFE_PROGRAMA');
      } catch (e) { puede = false; }
    }
    if (!puede) throw error('No tiene acceso a Generación de Promedios Académicos.', 403);
    const soloEst = () => { if (!esEst) throw error('Esta acción es solo de la Oficina de Estadística.', 403); };
    const a = body.accion;

    if (a === 'sesion') { const cr = (await leerJson('correos.json')).valor || []; res.status(200).json({ correos: esEst ? cr.map((c) => c.correo) : [], correo: yo.correo, nombre: yo.nombre, estadistica: esEst, facultad: ((ajustes.usuarios || []).find((u) => String(u.correo).toLowerCase() === yo.correo) || {}).facultad || '', ajustes: { firmante: ajustes.firmante, programas: ajustes.programas, enlaceVerificacion: ajustes.enlaceVerificacion, usuarios: esEst ? ajustes.usuarios : undefined } }); return; }

    if (a === 'ajustes-guardar') {
      soloEst(); const n = body.ajustes || {}; const f = n.firmante || {};
      const nuevo = {
        firmante: { grado: limpio(f.grado, 20), nombre: limpio(f.nombre, 100), cargo: limpio(f.cargo, 160), firma: typeof f.firma === 'string' && /^data:image\/(png|jpeg);base64,/.test(f.firma) && f.firma.length < 900000 ? f.firma : null },
        programas: (n.programas || []).slice(0, 60).map((p) => ({ id: limpio(p.id, 60), nombre: limpio(p.nombre, 160), sigla: limpio(p.sigla, 40), nivel: p.nivel === 'posgrado' ? 'posgrado' : 'pregrado', facultad: limpio(p.facultad, 120) })).filter((p) => p.id && p.nombre),
        usuarios: (n.usuarios || []).slice(0, 80).map((u) => ({ correo: limpio(u.correo, 120).toLowerCase(), nombre: limpio(u.nombre, 100), correoEnvio: limpio(u.correoEnvio, 120).toLowerCase(), facultad: limpio(u.facultad, 120) })).filter((u) => /@enap\.edu\.co$/.test(u.correo)),
        enlaceVerificacion: ajustes.enlaceVerificacion
      };
      if (!nuevo.firmante.nombre) throw error('El firmante necesita nombre.', 400);
      await escribirJson('ajustes.json', nuevo, null); res.status(200).json({ ok: true }); return;
    }

    if (a === 'reservar') {                      /* revisa duplicado y reserva el código */
      const o = datosRegistro(body.datos || {}, !!body.revision); const y = new Date().getFullYear();
      const miUsuario = (ajustes.usuarios || []).find((u) => String(u.correo).toLowerCase() === yo.correo);
      const lote = { id: limpio(body.loteId, 40), correo: esEst ? limpio(body.correo, 120).toLowerCase() : ((miUsuario && miUsuario.correoEnvio) || yo.correo) };
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(lote.correo)) throw error('Indique el correo del jefe de programa.', 400);
      const reemplazados = [];
      const salida = await mutar('registros.json', () => [], (rs) => {
        reemplazados.length = 0;
        const d = duplicado(rs, o); if (d) return { duplicado: resumen(d) };
        for (let i = rs.length - 1; i >= 0; i--) if (mismoPendiente(rs[i], o)) { reemplazados.push([rs[i].codigo, rs[i].nImagenes || 0]); rs.splice(i, 1); }
        const sec = rs.filter((r) => r.codigo.startsWith(`PA-${y}-`)).reduce((m, r) => Math.max(m, parseInt(r.codigo.slice(-6), 10)), 0) + 1;
        const codigo = `PA-${y}-${String(sec).padStart(6, '0')}`;
        rs.push(Object.assign({ codigo, estado: 'reservado', fecha: ahora(), por: yo.correo, lote, archivo: o.sigla ? archivoDe(o) : '' }, o));
        return { codigo, archivo: o.sigla ? archivoDe(o) : '' };
      });
      for (const [c, n] of reemplazados) for (let i = 1; i <= n; i++) await borrar(`Revision/${c}/${i}.jpg`).catch(() => {});
      if (esEst && !salida.duplicado && lote.correo) await mutar('correos.json', () => [], (cs) => { const i = cs.findIndex((c) => c.correo === lote.correo); if (i >= 0) cs.splice(i, 1); cs.unshift({ correo: lote.correo, fecha: ahora() }); cs.length = Math.min(cs.length, 40); }).catch(() => {});
      res.status(salida.duplicado ? 409 : 200).json(salida.duplicado ? { error: 'Ya existe un certificado de promedio para esta cédula y programa. Una corrección solo la hace Estadística.', duplicado: salida.duplicado } : salida);
      return;
    }

    if (a === 'guardar-original') {              /* cédula y balance tal como los cargó quien solicita (para guardarlos junto al certificado) */
      const { codigo, tipo, ext, archivo } = body;
      if (!/^PA-\d{4}-\d{6}$/.test(codigo || '') || !['cedula', 'balance'].includes(tipo) || !['pdf', 'jpg', 'jpeg', 'png'].includes(ext) || typeof archivo !== 'string') throw error('Datos incompletos.', 400);
      const b = Buffer.from(archivo, 'base64'); if (b.length < 100 || b.length > 3.3 * 1024 * 1024) throw error('Archivo inválido.', 400);
      const reg = ((await leerJson('registros.json')).valor || []).find((x) => x.codigo === codigo); if (!reg || !['reservado', 'revision'].includes(reg.estado)) throw error('El código no está reservado.', 409);
      await escribirBin(`Originales/${codigo}/${tipo}.${ext}`, b, { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' }[ext]);
      res.status(200).json({ ok: true }); return;
    }

    if (a === 'emitir') {                        /* sube el PDF y deja el certificado emitido */
      const { codigo, pdf } = body; if (!/^PA-\d{4}-\d{6}$/.test(codigo || '') || typeof pdf !== 'string') throw error('Datos incompletos.', 400);
      const buf = Buffer.from(pdf, 'base64'); if (buf.length < 1000 || buf.length > 3.5 * 1024 * 1024 || buf.slice(0, 4).toString() !== '%PDF') throw error('PDF inválido.', 400);
      if (pdfTieneTexto(buf)) throw error(ERR_PDF_TEXTO, 409);
      await mutar('registros.json', () => [], (rs) => { const r = rs.find((x) => x.codigo === codigo); if (!r || r.estado !== 'reservado') throw error('El código no está reservado.', 409); r.estado = 'emitido'; r.emitido = ahora(); });
      await escribirBin(`Certificados/${codigo}.pdf`, buf, 'application/pdf');
      const regE = ((await leerJson('registros.json')).valor || []).find((x) => x.codigo === codigo); if (regE) await copiarAOneDrive(codigo, regE, buf);
      res.status(200).json({ ok: true }); return;
    }

    if (a === 'a-revision') {                    /* escaneado o con dudas: guarda imágenes y datos para que Estadística revise */
      const { codigo, motivo, imagenes } = body; if (!/^PA-\d{4}-\d{6}$/.test(codigo || '')) throw error('Código inválido.', 400);
      const imgs = (imagenes || []).slice(0, 8); let total = 0;
      for (let i = 0; i < imgs.length; i++) { const b = Buffer.from(String(imgs[i]).replace(/^data:image\/jpeg;base64,/, ''), 'base64'); total += b.length; if (total > 4 * 1024 * 1024) throw error('Las imágenes pesan demasiado.', 413); await escribirBin(`Revision/${codigo}/${i + 1}.jpg`, b, 'image/jpeg'); }
      await mutar('registros.json', () => [], (rs) => { const r = rs.find((x) => x.codigo === codigo); if (!r || r.estado !== 'reservado') throw error('El código no está reservado.', 409); r.estado = 'revision'; r.motivoRevision = limpio(motivo, 300); r.nImagenes = imgs.length; r.etiquetas = (body.etiquetas || []).slice(0, 8).map((x) => limpio(x, 30)); r.ocr = String(body.ocr || '').replace(/[\u0000-\u0008\u000b-\u001f]/g, ' ').slice(0, 2800); });
      res.status(200).json({ ok: true }); return;
    }

    if (a === 'a-revision-imagen') {             /* una imagen por petición (el límite de tamaño de la petición es bajo) */
      const codigo = body.codigo, n = parseInt(body.n, 10); if (!/^PA-\d{4}-\d{6}$/.test(codigo || '') || !(n >= 1 && n <= 8)) throw error('Datos inválidos.', 400);
      const b = Buffer.from(String(body.imagen || '').replace(/^data:image\/jpeg;base64,/, ''), 'base64'); if (!b.length || b.length > 3 * 1024 * 1024) throw error('La imagen está vacía o pesa demasiado.', 413);
      const { valor } = await leerJson('registros.json'); const r = (valor || []).find((x) => x.codigo === codigo);
      if (!r || r.estado !== 'revision' || (!esEst && r.por !== yo.correo)) throw error('No se puede agregar la imagen.', 409);
      await escribirBin(`Revision/${codigo}/${n}.jpg`, b, 'image/jpeg');
      await mutar('registros.json', () => [], (rs) => { const x = rs.find((y) => y.codigo === codigo); if (x) x.nImagenes = Math.max(x.nImagenes || 0, n); });
      res.status(200).json({ ok: true }); return;
    }

    if (a === 'liberar') {                       /* cancela una reserva que no llegó a emitirse */
      await mutar('registros.json', () => [], (rs) => { const i = rs.findIndex((x) => x.codigo === body.codigo && x.estado === 'reservado' && x.por === yo.correo); if (i >= 0) rs.splice(i, 1); });
      res.status(200).json({ ok: true }); return;
    }

    if (a === 'probar-correo') {                 /* prueba de envío: llega al correo de quien la pide y devuelve el error exacto si falla */
      soloEst();
      try { const de = await enviarCorreo(yo.correo, 'Prueba de correo del Portal', htmlCorreo({ titulo: 'Prueba de correo', cuerpo: '<p style="font-size:14.5px;color:#334155;margin:0 0 10px">Si usted ve este mensaje, los correos del módulo Generación de Promedios Académicos están saliendo bien.</p>' })); res.status(200).json({ ok: true, de, a: yo.correo }); }
      catch (e) { res.status(200).json({ ok: false, error: e.message }); }
      return;
    }

    if (a === 'avisar-lote') {                   /* avisa a Estadística que llegó un lote nuevo (una sola vez por lote) */
      const loteId = limpio(body.loteId, 40); let regs = [];
      await mutar('registros.json', () => [], (rs) => { regs = rs.filter((r) => r.lote && r.lote.id === loteId && !['reservado'].includes(r.estado) && !r.avisoEst); regs.forEach((r) => { r.avisoEst = true; }); });
      if (!regs.length) { res.status(200).json({ avisado: false }); return; }
      const cuenta = (e) => regs.filter((r) => r.estado === e).length;
      const nom = (r) => esc([r.sigla, r.apellidos, r.nombres].filter(Boolean).join(' ') || 'Estudiante');
      const rev = regs.filter((r) => r.estado === 'revision');
      const cuerpo = `<p style="font-size:14.5px;color:#334155;margin:0 0 10px">Hay un <b>nuevo lote</b> de certificados de promedio académico.</p>
<p style="font-size:14.5px;color:#334155;margin:0 0 6px"><b>Solicitado por:</b> ${esc(yo.nombre || yo.correo)} (${esc(yo.correo)})<br><b>Enviar a:</b> ${esc(regs[0].lote.correo)}<br><b>Estudiantes:</b> ${regs.length} · <b>Emitidos:</b> ${cuenta('emitido')} · <b>En revisión:</b> ${rev.length}</p>
${rev.length ? `<p style="font-size:14.5px;color:#334155;margin:10px 0 4px"><b>Por revisar:</b></p><ul style="font-size:14.5px;color:#062a4a;margin:0 0 12px;padding-left:20px">${rev.map((r) => `<li>${nom(r)}${r.programa ? ' — ' + esc(r.programa) : ''}</li>`).join('')}</ul><p style="font-size:14.5px;color:#334155;margin:0 0 10px">Ingrese a «Revisión de escaneados» en el módulo para validarlos.</p>` : ''}`;
      if (!rev.length) { res.status(200).json({ avisado: false }); return; }
      let aviso = true, detalle = ''; try { await enviarCorreo(DUENO, 'Nuevo lote de certificados de promedio', htmlCorreo({ titulo: 'Nuevo lote recibido', cuerpo })); } catch (e) { aviso = false; detalle = e.message; }
      res.status(200).json({ avisado: aviso, error: detalle }); return;
    }

    if (a === 'enviar-lote') { const r = await enviarPendientesDelLote(limpio(body.loteId, 40)); res.status(200).json(r); return; }

    if (a === 'lista') {
      const { valor } = await leerJson('registros.json'); let rs = valor || [];
      if (body.loteId) rs = rs.filter((r) => r.lote && r.lote.id === body.loteId);
      else if (!esEst) rs = rs.filter((r) => r.por === yo.correo);
      if (body.estado) rs = rs.filter((r) => r.estado === body.estado);
      res.status(200).json({ lista: rs.filter((r) => r.estado !== 'reservado').slice(-500).map(resumen) }); return;
    }

    if (a === 'revision-lista') { soloEst(); const { valor } = await leerJson('registros.json'); res.status(200).json({ lista: (valor || []).filter((r) => r.estado === 'revision').map((r) => Object.assign(resumen(r), { datos: { cedula: r.cedula, nombres: r.nombres, apellidos: r.apellidos, lugar: r.lugar, programaId: r.programaId, programa: r.programa, sigla: r.sigla, nivel: r.nivel, facultad: r.facultad, promedio: r.promedio, periodoTerminacion: r.periodoTerminacion, diplomado: r.diplomado, fechaBalance: r.fechaBalance, estadoVigencia: r.estadoVigencia }, nImagenes: r.nImagenes || 0, etiquetas: r.etiquetas || [], ocr: r.ocr || '' })) }); return; }

    if (a === 'revision-imagen') { soloEst(); const b = await leerBin(`Revision/${limpio(body.codigo, 20)}/${parseInt(body.n, 10) || 1}.jpg`); if (!b) throw error('Imagen no encontrada.', 404); res.status(200).json({ imagen: 'data:image/jpeg;base64,' + b.toString('base64') }); return; }

    if (a === 'revision-aprobar') {              /* Estadística corrigió/validó: el cliente ya generó el PDF con los datos finales */
      soloEst(); const { codigo, pdf } = body; const o = datosRegistro(body.datos || {});
      const buf = Buffer.from(String(pdf || ''), 'base64'); if (buf.length < 1000 || buf.slice(0, 4).toString() !== '%PDF') throw error('PDF inválido.', 400);
      if (pdfTieneTexto(buf)) throw error(ERR_PDF_TEXTO, 409);
      let loteId = null;
      await mutar('registros.json', () => [], (rs) => {
        const r = rs.find((x) => x.codigo === codigo); if (!r || r.estado !== 'revision') throw error('El certificado no está en revisión.', 409);
        const otro = rs.find((x) => x !== r && x.estado === 'emitido' && x.cedula === o.cedula && x.programaId === o.programaId); if (otro) throw error('Ya existe otro certificado con esa cédula y programa.', 409);
        Object.assign(r, o, { estado: 'emitido', emitido: ahora(), revisadoPor: yo.correo, archivo: archivoDe(o) }); delete r.motivoRevision; loteId = r.lote && r.lote.id;
      });
      await escribirBin(`Certificados/${codigo}.pdf`, buf, 'application/pdf');
      await copiarAOneDrive(codigo, { apellidos: o.apellidos, nombres: o.nombres, archivo: archivoDe(o) }, buf);
      for (let i = 1; i <= 8; i++) await borrar(`Revision/${codigo}/${i}.jpg`).catch(() => {});
      /* si ya no queda nada en revisión en el lote, sale el segundo correo con todos los aprobados juntos */
      let envio = null;
      if (loteId) { const { valor } = await leerJson('registros.json'); if (!(valor || []).some((r) => r.lote && r.lote.id === loteId && r.estado === 'revision')) envio = await enviarPendientesDelLote(loteId); }
      res.status(200).json({ ok: true, envio }); return;
    }

    if (a === 'revision-rechazar') {
      soloEst(); const { codigo } = body; let ok = false, reg = null;
      await mutar('registros.json', () => [], (rs) => { const r = rs.find((x) => x.codigo === codigo && x.estado === 'revision'); if (r) { r.estado = 'rechazado'; r.motivoRechazo = limpio(body.motivo, 300); r.revisadoPor = yo.correo; if (body.avisar === false) r.rechazoEnviado = { omitido: true, fecha: ahora() }; ok = true; reg = JSON.parse(JSON.stringify(r)); } });
      for (let i = 1; i <= 8; i++) await borrar(`Revision/${codigo}/${i}.jpg`).catch(() => {});
      let envio = null, avisoError = '';
      if (ok && reg && reg.lote && reg.lote.correo) {
        /* Cuando ya no queda nada en revisión del lote, el jefe de programa recibe UN correo con solo los estudiantes que faltaron, y luego el de los aprobados. */
        try {
          const { valor } = await leerJson('registros.json'); const todos = valor || [];
          if (!todos.some((r) => r.lote && r.lote.id === reg.lote.id && r.estado === 'revision')) {
            const faltan = todos.filter((r) => r.lote && r.lote.id === reg.lote.id && r.estado === 'rechazado' && !r.rechazoEnviado);
            if (faltan.length) {
              const items = faltan.map((r) => `<li style="margin:0 0 8px"><b>${esc([r.sigla, r.apellidos, r.nombres].filter(Boolean).join(' ') || 'Estudiante')}</b>${r.programa ? ' — ' + esc(r.programa) : ''}${r.motivoRechazo ? `<br><span style="color:#566370">Motivo: ${esc(r.motivoRechazo)}</span>` : ''}</li>`).join('');
              const cuerpo = `<p style="font-size:14.5px;color:#334155;margin:0 0 10px">Estadística no pudo generar el certificado de promedio académico de ${faltan.length === 1 ? 'el siguiente estudiante' : 'los siguientes estudiantes'}:</p>
<ul style="font-size:14.5px;color:#062a4a;margin:0 0 14px;padding-left:20px">${items}</ul>
<p style="font-size:14.5px;color:#334155;margin:0 0 10px">Para generarlos, vuelva a enviar la solicitud con los documentos corregidos.</p>`;
              await enviarCorreo(reg.lote.correo, 'Solicitud de certificados de promedio no procesada', htmlCorreo({ titulo: 'Solicitud no procesada', cuerpo }));
              const cods = new Set(faltan.map((r) => r.codigo)), t = ahora();
              await mutar('registros.json', () => [], (rs) => { rs.forEach((r) => { if (cods.has(r.codigo)) r.rechazoEnviado = { fecha: t, a: reg.lote.correo }; }); });
            }
            envio = await enviarPendientesDelLote(reg.lote.id);
          }
        } catch (e) { avisoError = e.message || 'No se pudo enviar el correo.'; }
      }
      res.status(200).json({ ok, envio, avisoError }); return;
    }

    if (a === 'descargar') {
      const { valor } = await leerJson('registros.json'); const r = (valor || []).find((x) => x.codigo === body.codigo && x.estado === 'emitido');
      if (!r || (!esEst && r.por !== yo.correo)) throw error('Certificado no encontrado.', 404);
      const b = await leerBin(`Certificados/${r.codigo}.pdf`); if (!b) throw error('El PDF no está disponible.', 404);
      res.status(200).json({ archivo: r.archivo, pdf: b.toString('base64') }); return;
    }

    if (a === 'consulta') {                      /* para Solicitud de Grado: promedio emitido por cédula (y programa) */
      const c = cedKey(body.cedula); const { valor } = await leerJson('registros.json');
      res.status(200).json({ lista: (valor || []).filter((r) => r.estado === 'emitido' && r.cedula === c && (!body.programaId || r.programaId === body.programaId)).map((r) => ({ codigo: r.codigo, cedula: r.cedula, nombres: r.nombres, apellidos: r.apellidos, programaId: r.programaId, programa: r.programa, promedio: r.promedio, fecha: r.fecha })) }); return;
    }

    throw error('Acción desconocida.', 400);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || 'Error interno.' });
  }
};
module.exports._test = { pdfTieneTexto, copiarAOneDrive, zip, crc32, datosRegistro, archivoDe };
