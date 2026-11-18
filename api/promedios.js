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
async function enviarCorreo(para, asunto, html, adjunto) {
  const mensaje = { subject: asunto, body: { contentType: 'HTML', content: html }, toRecipients: [{ emailAddress: { address: para } }] };
  const base = `/users/${encodeURIComponent(REMITENTE)}`;
  if (!adjunto || adjunto.datos.length <= 2.5 * 1024 * 1024) {
    if (adjunto) mensaje.attachments = [{ '@odata.type': '#microsoft.graph.fileAttachment', name: adjunto.nombre, contentType: 'application/zip', contentBytes: adjunto.datos.toString('base64') }];
    const r = await g(base + '/sendMail', { method: 'POST', body: { message: mensaje, saveToSentItems: true } });
    if (!r.ok) throw error(`No se pudo enviar el correo (${r.status}): ${(await r.text()).slice(0, 200)}`, 502);
    return;
  }
  /* adjunto grande: borrador + sesión de carga */
  const b = await g(base + '/messages', { method: 'POST', body: mensaje }); if (!b.ok) throw error(`No se pudo crear el correo (${b.status}).`, 502);
  const id = (await b.json()).id;
  const s = await g(`${base}/messages/${id}/attachments/createUploadSession`, { method: 'POST', body: { AttachmentItem: { attachmentType: 'file', name: adjunto.nombre, size: adjunto.datos.length, contentType: 'application/zip' } } });
  if (!s.ok) throw error(`No se pudo preparar el adjunto (${s.status}).`, 502);
  const url = (await s.json()).uploadUrl, T = 320 * 1024 * 12;
  for (let ini = 0; ini < adjunto.datos.length; ini += T) {
    const trozo = adjunto.datos.subarray(ini, Math.min(ini + T, adjunto.datos.length));
    const u = await fetch(url, { method: 'PUT', headers: { 'Content-Length': String(trozo.length), 'Content-Range': `bytes ${ini}-${ini + trozo.length - 1}/${adjunto.datos.length}`, 'Content-Type': 'application/octet-stream' }, body: trozo });
    if (!u.ok) throw error(`No se pudo subir el adjunto (${u.status}).`, 502);
  }
  const e = await g(`${base}/messages/${id}/send`, { method: 'POST' }); if (!e.ok) throw error(`No se pudo enviar el correo (${e.status}).`, 502);
}
function htmlCorreo(n) {
  const logo = PORTAL_URL.replace(/\/?$/, '/') + 'assets/escudo.png';
  return `<div style="background:#f4f6f8;padding:24px 0;font-family:Aptos,'Segoe UI',Arial,sans-serif;color:#212529">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #d9e2ec;border-radius:14px;overflow:hidden">
<tr><td style="background:#0b3d66;border-bottom:3px solid #c9a227;padding:16px 24px"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="padding-right:14px"><img src="${esc(logo)}" alt="ENAP" height="42" style="display:block;height:42px"></td><td style="color:#ffffff"><div style="font-size:16px;font-weight:600;line-height:1.25">Portal de servicios digitales Estadística</div><div style="font-size:12px;opacity:.85">Escuela Naval de Cadetes “Almirante Padilla”</div></td></tr></table></td></tr>
<tr><td style="padding:26px 28px 8px">
<div style="font-size:12px;letter-spacing:.2em;color:#8a6d0b;font-weight:700">GENERACIÓN DE PROMEDIOS ACADÉMICOS</div>
<h2 style="margin:8px 0 14px;font-size:21px;color:#062a4a;font-weight:600">Certificados de promedio académico</h2>
<p style="font-size:14.5px;color:#334155;margin:0 0 10px">Cordial saludo.</p>
<p style="font-size:14.5px;color:#334155;margin:0 0 10px">Se adjunta un archivo comprimido con los certificados de promedio académico solicitados, uno por estudiante.</p>
<p style="font-size:14.5px;color:#334155;margin:0 0 18px">Si desea generar más certificados, ingrese al módulo Generación de Promedios Académicos del Portal de servicios digitales Estadística.</p>
<p style="margin:0 0 22px"><a href="${esc(PORTAL_URL)}" style="display:inline-block;background:#0b3d66;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:9px;font-size:14.5px;font-weight:600">Abrir el Portal</a></p>
</td></tr>
<tr><td style="background:#f8fafc;border-top:1px solid #e3eaf1;padding:14px 28px;font-size:12px;color:#7b8794;line-height:1.5">Este mensaje fue enviado automáticamente desde el Portal de servicios digitales Estadística de la Escuela Naval de Cadetes “Almirante Padilla”. Por favor no responda a este correo.</td></tr>
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
  const z = zip(archivos);
  await enviarCorreo(para, 'Certificados de promedio académico', htmlCorreo(), { nombre: 'Certificados de promedio.zip', datos: z });
  const codigos = new Set(lista.map((r) => r.codigo)), t = ahora();
  await mutar('registros.json', () => [], (rs) => { rs.forEach((r) => { if (codigos.has(r.codigo)) r.enviado = { fecha: t, a: para, n: nMail }; }); });
  return { enviados: lista.length, a: para };
}

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
const duplicado = (regs, o) => !o.cedula || !o.programaId ? null : regs.find((r) => r.estado !== 'rechazado' && r.cedula === o.cedula && r.programaId === o.programaId);
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
    const puede = esEst || (ajustes.usuarios || []).map((u) => String(u.correo).toLowerCase()).includes(yo.correo);
    if (!puede) throw error('No tiene acceso a Generación de Promedios Académicos.', 403);
    const soloEst = () => { if (!esEst) throw error('Esta acción es solo de la Oficina de Estadística.', 403); };
    const a = body.accion;

    if (a === 'sesion') { res.status(200).json({ correo: yo.correo, nombre: yo.nombre, estadistica: esEst, ajustes: { firmante: ajustes.firmante, programas: ajustes.programas, enlaceVerificacion: ajustes.enlaceVerificacion, usuarios: esEst ? ajustes.usuarios : undefined } }); return; }

    if (a === 'ajustes-guardar') {
      soloEst(); const n = body.ajustes || {}; const f = n.firmante || {};
      const nuevo = {
        firmante: { grado: limpio(f.grado, 20), nombre: limpio(f.nombre, 100), cargo: limpio(f.cargo, 160), firma: typeof f.firma === 'string' && /^data:image\/(png|jpeg);base64,/.test(f.firma) && f.firma.length < 900000 ? f.firma : null },
        programas: (n.programas || []).slice(0, 60).map((p) => ({ id: limpio(p.id, 60), nombre: limpio(p.nombre, 160), sigla: limpio(p.sigla, 40), nivel: p.nivel === 'posgrado' ? 'posgrado' : 'pregrado', facultad: limpio(p.facultad, 120) })).filter((p) => p.id && p.nombre),
        usuarios: (n.usuarios || []).slice(0, 80).map((u) => ({ correo: limpio(u.correo, 120).toLowerCase(), nombre: limpio(u.nombre, 100), correoEnvio: limpio(u.correoEnvio, 120).toLowerCase() })).filter((u) => /@enap\.edu\.co$/.test(u.correo)),
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
      const salida = await mutar('registros.json', () => [], (rs) => {
        const d = duplicado(rs, o); if (d) return { duplicado: resumen(d) };
        const sec = rs.filter((r) => r.codigo.startsWith(`PA-${y}-`)).reduce((m, r) => Math.max(m, parseInt(r.codigo.slice(-6), 10)), 0) + 1;
        const codigo = `PA-${y}-${String(sec).padStart(6, '0')}`;
        rs.push(Object.assign({ codigo, estado: 'reservado', fecha: ahora(), por: yo.correo, lote, archivo: o.sigla ? archivoDe(o) : '' }, o));
        return { codigo, archivo: o.sigla ? archivoDe(o) : '' };
      });
      res.status(salida.duplicado ? 409 : 200).json(salida.duplicado ? { error: 'Ya existe un certificado de promedio para esta cédula y programa. Una corrección solo la hace Estadística.', duplicado: salida.duplicado } : salida);
      return;
    }

    if (a === 'emitir') {                        /* sube el PDF y deja el certificado emitido */
      const { codigo, pdf } = body; if (!/^PA-\d{4}-\d{6}$/.test(codigo || '') || typeof pdf !== 'string') throw error('Datos incompletos.', 400);
      const buf = Buffer.from(pdf, 'base64'); if (buf.length < 1000 || buf.length > 3.5 * 1024 * 1024 || buf.slice(0, 4).toString() !== '%PDF') throw error('PDF inválido.', 400);
      await mutar('registros.json', () => [], (rs) => { const r = rs.find((x) => x.codigo === codigo); if (!r || r.estado !== 'reservado') throw error('El código no está reservado.', 409); r.estado = 'emitido'; r.emitido = ahora(); });
      await escribirBin(`Certificados/${codigo}.pdf`, buf, 'application/pdf');
      res.status(200).json({ ok: true }); return;
    }

    if (a === 'a-revision') {                    /* escaneado o con dudas: guarda imágenes y datos para que Estadística revise */
      const { codigo, motivo, imagenes } = body; if (!/^PA-\d{4}-\d{6}$/.test(codigo || '')) throw error('Código inválido.', 400);
      const imgs = (imagenes || []).slice(0, 8); let total = 0;
      for (let i = 0; i < imgs.length; i++) { const b = Buffer.from(String(imgs[i]).replace(/^data:image\/jpeg;base64,/, ''), 'base64'); total += b.length; if (total > 4 * 1024 * 1024) throw error('Las imágenes pesan demasiado.', 413); await escribirBin(`Revision/${codigo}/${i + 1}.jpg`, b, 'image/jpeg'); }
      await mutar('registros.json', () => [], (rs) => { const r = rs.find((x) => x.codigo === codigo); if (!r || r.estado !== 'reservado') throw error('El código no está reservado.', 409); r.estado = 'revision'; r.motivoRevision = limpio(motivo, 300); r.nImagenes = imgs.length; r.etiquetas = (body.etiquetas || []).slice(0, 8).map((x) => limpio(x, 30)); });
      res.status(200).json({ ok: true }); return;
    }

    if (a === 'liberar') {                       /* cancela una reserva que no llegó a emitirse */
      await mutar('registros.json', () => [], (rs) => { const i = rs.findIndex((x) => x.codigo === body.codigo && x.estado === 'reservado' && x.por === yo.correo); if (i >= 0) rs.splice(i, 1); });
      res.status(200).json({ ok: true }); return;
    }

    if (a === 'enviar-lote') { const r = await enviarPendientesDelLote(limpio(body.loteId, 40)); res.status(200).json(r); return; }

    if (a === 'lista') {
      const { valor } = await leerJson('registros.json'); let rs = valor || [];
      if (body.loteId) rs = rs.filter((r) => r.lote && r.lote.id === body.loteId);
      else if (!esEst) rs = rs.filter((r) => r.por === yo.correo);
      if (body.estado) rs = rs.filter((r) => r.estado === body.estado);
      res.status(200).json({ lista: rs.filter((r) => r.estado !== 'reservado').slice(-500).map(resumen) }); return;
    }

    if (a === 'revision-lista') { soloEst(); const { valor } = await leerJson('registros.json'); res.status(200).json({ lista: (valor || []).filter((r) => r.estado === 'revision').map((r) => Object.assign(resumen(r), { datos: { cedula: r.cedula, nombres: r.nombres, apellidos: r.apellidos, lugar: r.lugar, programaId: r.programaId, programa: r.programa, sigla: r.sigla, nivel: r.nivel, facultad: r.facultad, promedio: r.promedio, periodoTerminacion: r.periodoTerminacion, diplomado: r.diplomado, fechaBalance: r.fechaBalance, estadoVigencia: r.estadoVigencia }, nImagenes: r.nImagenes || 0, etiquetas: r.etiquetas || [] })) }); return; }

    if (a === 'revision-imagen') { soloEst(); const b = await leerBin(`Revision/${limpio(body.codigo, 20)}/${parseInt(body.n, 10) || 1}.jpg`); if (!b) throw error('Imagen no encontrada.', 404); res.status(200).json({ imagen: 'data:image/jpeg;base64,' + b.toString('base64') }); return; }

    if (a === 'revision-aprobar') {              /* Estadística corrigió/validó: el cliente ya generó el PDF con los datos finales */
      soloEst(); const { codigo, pdf } = body; const o = datosRegistro(body.datos || {});
      const buf = Buffer.from(String(pdf || ''), 'base64'); if (buf.length < 1000 || buf.slice(0, 4).toString() !== '%PDF') throw error('PDF inválido.', 400);
      let loteId = null;
      await mutar('registros.json', () => [], (rs) => {
        const r = rs.find((x) => x.codigo === codigo); if (!r || r.estado !== 'revision') throw error('El certificado no está en revisión.', 409);
        const otro = rs.find((x) => x !== r && x.estado !== 'rechazado' && x.cedula === o.cedula && x.programaId === o.programaId); if (otro) throw error('Ya existe otro certificado con esa cédula y programa.', 409);
        Object.assign(r, o, { estado: 'emitido', emitido: ahora(), revisadoPor: yo.correo, archivo: archivoDe(o) }); delete r.motivoRevision; loteId = r.lote && r.lote.id;
      });
      await escribirBin(`Certificados/${codigo}.pdf`, buf, 'application/pdf');
      for (let i = 1; i <= 8; i++) await borrar(`Revision/${codigo}/${i}.jpg`).catch(() => {});
      /* si ya no queda nada en revisión en el lote, sale el segundo correo con todos los aprobados juntos */
      let envio = null;
      if (loteId) { const { valor } = await leerJson('registros.json'); if (!(valor || []).some((r) => r.lote && r.lote.id === loteId && r.estado === 'revision')) envio = await enviarPendientesDelLote(loteId); }
      res.status(200).json({ ok: true, envio }); return;
    }

    if (a === 'revision-rechazar') {
      soloEst(); const { codigo } = body; let ok = false;
      await mutar('registros.json', () => [], (rs) => { const r = rs.find((x) => x.codigo === codigo && x.estado === 'revision'); if (r) { r.estado = 'rechazado'; r.motivoRechazo = limpio(body.motivo, 300); r.revisadoPor = yo.correo; ok = true; } });
      for (let i = 1; i <= 8; i++) await borrar(`Revision/${codigo}/${i}.jpg`).catch(() => {});
      res.status(200).json({ ok }); return;
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
module.exports._test = { zip, crc32, datosRegistro, archivoDe };
