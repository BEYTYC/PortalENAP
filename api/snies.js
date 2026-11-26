/*!
 * Portal de Servicios Digitales Estadística — Escuela Naval de Cadetes "Almirante Padilla"
 * Autora y desarrolladora: CAMARGO MARTÍNEZ BEYTY PATRICIA — Oficina de Estadística
 * Derechos morales de autor reservados (Ley 23 de 1982, art. 30). Este aviso de autoría no debe eliminarse ni alterarse.
 */
/**
 * api/snies.js — servidor del módulo "Plantillas SNIES" (gestión, seguimiento y control de reportes SNIES).
 *
 * Reglas de negocio: docs/modulos/plantillas-snies.md. Cómo funciona: snies/LEEME.md.
 *
 * Datos (nunca en el repo):
 *   SharePoint del Portal, carpeta SNIES/
 *     config.json               periodo activo, responsables por plantilla, prórrogas, usuarios (nombres del login), versiones de oficiales
 *     estado-<periodo>.json     estado de cada plantilla en el periodo (p. ej. estado-2026-2.json)
 *     oficiales/<id>.xlsx       plantilla oficial vigente (el sistema nunca la modifica)
 *     oficiales/<id>-v<n>.xlsx  versiones anteriores
 *   OneDrive de programacion.ditic@enap.edu.co, carpeta "Plantillas SNIES"
 *     <periodo>/<nombre>.xlsx   cada entrega, tal como la cargó el responsable (sin modificar)
 *
 * Quién entra: cualquier cuenta institucional con sesión válida, pero cada persona solo ve las plantillas en las que
 * figura como responsable de la entrega o del diligenciamiento. Los administradores son jestadisticaplen@ y programacion.ditic@.
 * Todo se verifica en el servidor con el token de Microsoft.
 * Correos: salen de jestadisticaplen@enap.edu.co y siempre dicen quién es el responsable de la entrega.
 */

const roles = require('./roles.js');
const { abrir } = require('./_xlsx.js');
const MAESTRO = require('./_snies-maestro.json');

const GRAPH = 'https://graph.microsoft.com/v1.0';
const ADMINS = ['jestadisticaplen@enap.edu.co', 'programacion.ditic@enap.edu.co'];
const REMITENTE = 'jestadisticaplen@enap.edu.co';
const PORTAL_URL = process.env.PORTAL_URL || 'https://enap.vercel.app/SNIES';
const CARPETA = 'SNIES';
const DUENO_COPIA = 'programacion.ditic@enap.edu.co';
const CARPETA_COPIA = 'Plantillas SNIES';
/* Fecha límite inicial de todas las plantillas en un periodo (pedido de la autora); una prórroga por plantilla la reemplaza. */
const LIMITE_INICIAL = { '2026-2': '2026-11-27' };
const MAX_BYTES = 4 * 1024 * 1024;

const CARGOS = {
  JSEA: 'Estadística', PINO: 'Planeación Académica', PECA: 'Planeación Académica', DSCH: 'División Ciencias Sociales',
  PAPEN: 'Oficina Autoevaluación', DIFEN: 'Informática', RELINT: 'Relaciones Internacionales', CICEN: 'Investigación',
  OCOMES: 'Oficina Comunicaciones', 'DPEN-PINO': 'Personal', DPEN: 'Personal', BIEN: 'Bienestar', POSGRADOS: 'Posgrados', ADMIN: 'Administración',
};
const cargoTexto = (c) => (c === 'NA' || c === 'NO APLICA') ? 'Sin responsable' : String(c).split('-').map((p) => CARGOS[p] || p).join(' · ');
/* Orden de cargue: una plantilla no se entrega antes de la que la antecede (solo cuando esa también se carga en el aplicativo). */
const DEPENDE = { 'materias-matriculado': 'matriculados', 'apoyos-financieros-academicos-u-otros': 'matriculados' };
const ESTADOS = ['pendiente', 'devuelta', 'revision', 'validada'];
/* Plantillas que ofrecen al responsable su entrega del semestre anterior como base (pedido de la autora: solo estas). */
const CON_ANTERIOR = new Set(['cupos-proyectados-y-matricula-esperada', 'informacion-complementaria-de-la-ies', 'recursos-historico', 'unidad-organizacional', 'autoridades', 'directivos', 'docentes-universidad-publica', 'integrantes-maximo-organo-de-gobierno']);
const ofreceAnterior = (t) => CON_ANTERIOR.has(t.id) || ['INTERNACIONALIZACIÓN', 'INVESTIGACIÓN', 'EXTENSIÓN'].includes(t.grupo);

const CUPOS = 'cupos-proyectados-y-matricula-esperada';
/* Cupos proyectados siempre va adelantado: el ciclo 2026-2 reporta 2027-2 (lo pendiente a la fecha; el 2027-1 ya se reportó el 12 de septiembre) y el ciclo 2027-1 reporta 2027-2 (12 de marzo). */
/* Periodo que se reporta: el mismo del ciclo (ciclo 2026-2 → 2026-2); Cupos proyectados va adelantado (ciclo 2026-2 → 2027-2). */
const periodoReporte = (t, periodo) => { if (t.id !== CUPOS) return periodo; const [a, s] = periodo.split('-').map(Number); return s === 2 ? `${a + 1}-2` : `${a}-2`; };
const TEMPLATES = MAESTRO.map((t) => {
  const sin = t.cargo === 'NA' || t.cargo === 'NO APLICA';
  const modo = sin ? 'sin' : t.cargo === 'PINO' ? 'directo' : 'carga';  /* directo = sube al SNIES con su propio usuario; solo recibe notificaciones */
  const posgrados = t.id === 'educacion-continua' || t.id === 'cursos';
  return Object.assign({}, t, { modo, posgrados, cargoTexto: cargoTexto(t.cargo) });
});
/* Las plantillas que el Documento Maestro deja sin responsable no se cargan en el aplicativo (la autora, 24/11/2026). */
for (let i = TEMPLATES.length - 1; i >= 0; i--) if (TEMPLATES[i].modo === 'sin') TEMPLATES.splice(i, 1);
const POR_ID = Object.fromEntries(TEMPLATES.map((t) => [t.id, t]));

function error(m, s) { const e = new Error(m); e.status = s || 500; return e; }
const ahora = () => new Date().toISOString();
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const limpio = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max || 200);
const correoOk = (c) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c);

/* ------------------------------ Fechas ------------------------------ */
const ymd = (d) => d.toISOString().slice(0, 10);
function periodoPorDefecto() { const h = new Date(Date.now() - 5 * 3600e3); return `${h.getUTCFullYear()}-${h.getUTCMonth() >= 6 ? 2 : 1}`; }
/* Fecha oficial SNIES (dd/mm del Documento Maestro) del periodo "AAAA-S": 1.er semestre usa la 2.ª fecha, 2.º semestre la 4.ª. */
function fechaOficial(t, periodo) {
  const [a, s] = periodo.split('-').map(Number);
  if (t.id === CUPOS) return s === 2 ? `${a}-09-12` : `${a}-03-12`;
  const txt = (t.fechas || [])[s === 1 ? 1 : 3] || (t.fechas || [])[s === 1 ? 0 : 2];
  const m = /^(\d{1,2})\/(\d{1,2})$/.exec(txt || '');
  if (!m) return null;
  const mes = +m[2], dia = +m[1];
  return `${s === 2 && mes <= 3 ? a + 1 : a}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}
/* Fecha límite interna = fecha oficial − 1 mes calendario (si el mes anterior es más corto, el último día de ese mes). */
function menosUnMes(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  const ult = new Date(Date.UTC(a, m - 1, 0)).getUTCDate();
  return ymd(new Date(Date.UTC(a, m - 2, Math.min(d, ult))));
}
const hoyIso = () => ymd(new Date(Date.now() - 5 * 3600e3));
const dias = (aIso, bIso) => Math.round((Date.parse(bIso) - Date.parse(aIso)) / 86400000);

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
const encRuta = (n) => n.split('/').map(encodeURIComponent).join('/');
const rutaSp = (n) => `/sites/${SITE}/drive/root:/${CARPETA}/${encRuta(n)}`;
const rutaOd = (n) => `/users/${encodeURIComponent(DUENO_COPIA)}/drive/root:/${encRuta(CARPETA_COPIA + '/' + n)}`;
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
async function leerBin(ruta) { const r = await g(ruta + ':/content'); if (r.status === 404) return null; if (!r.ok) throw error(`No se pudo leer el archivo (${r.status}).`, 502); return Buffer.from(await r.arrayBuffer()); }
async function escribirBin(ruta, buf) {
  const r = await g(ruta + ':/content?@microsoft.graph.conflictBehavior=replace', { method: 'PUT', body: buf, headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' } });
  if (!r.ok) throw error(`No se pudo guardar el archivo (${r.status}).`, 502);
}
async function mutar(nombre, porDefecto, fn) {
  for (let i = 0; i < 5; i++) {
    const { valor, eTag } = await leerJson(nombre); const v = valor == null ? porDefecto() : valor;
    const salida = await fn(v);
    try { await escribirJson(nombre, v, eTag); return salida; } catch (e) { if (!e.conflicto || i === 4) throw e; await new Promise((ok) => setTimeout(ok, 400 * (i + 1))); }
  }
}
const configBase = () => ({ periodo: periodoPorDefecto(), responsables: {}, prorrogas: {}, usuarios: {}, oficiales: {}, abierto: {} });
async function leerConfig() { const { valor } = await leerJson('config.json'); return Object.assign(configBase(), valor || {}); }
async function leerEstado(periodo) { const { valor } = await leerJson(`estado-${periodo}.json`); return valor || {}; }

/* ------------------------------ Responsables ------------------------------ */
const listaCorreos = (a) => Array.from(new Set((Array.isArray(a) ? a : []).map((c) => limpio(c, 120).toLowerCase()).filter(correoOk)));
const respDe = (cfg, id) => { const r = cfg.responsables[id] || {}; return { entrega: r.entrega || [], diligencia: r.diligencia || [] }; };
/* Nombres con mayúscula inicial, salvo artículos y preposiciones (de, del, la, y…). */
const { tildarNombre } = require('../balance-academico/motor.js');
/* Siglas de grado: CC, CF, CN, TN, TF, TK, CT, CR, TC, MY, TE, ST y las de Infantería de Marina (con CIM: CTCIM, TCCIM…) van en mayúscula. */
const SIGLA_GRADO = /^(cc|cf|cn|tn|tf|tk|ct|cr|tc|my|te|st)(cim)?$/;
const bonito = (n) => tildarNombre(String(n || '').trim().split(/\s+/).filter(Boolean).map((w, i) => { const m = w.toLowerCase(); if (SIGLA_GRADO.test(m)) return m.toUpperCase(); return i > 0 && /^(de|del|la|las|los|el|y|e)$/.test(m) ? m : m.charAt(0).toUpperCase() + m.slice(1); }).join(' '));
const nombreDe = (cfg, c) => (cfg.usuarios[c] && cfg.usuarios[c].nombre) ? bonito(cfg.usuarios[c].nombre) : c;
/* Destinatario = responsable de la entrega; con copia los responsables del diligenciamiento. Si la plantilla no tiene responsable de entrega, los avisos van directo a quien diligencia. */
const destinosDe = (cfg, id) => { const r = respDe(cfg, id); return r.entrega.length ? { para: r.entrega, cc: r.diligencia.filter((c) => !r.entrega.includes(c)) } : { para: r.diligencia, cc: [] }; };
const textoEntrega = (cfg, id) => { const e = respDe(cfg, id).entrega; return e.length ? e.map((c) => nombreDe(cfg, c)).join(', ') : 'Por asignar'; };

/* El Documento Maestro marca algunas plantillas como «NA / NO APLICA» (sin responsable); si el administrador les asigna responsables, se gestionan como cualquier otra. */
const modoDe = (t, cfg) => (t.modo === 'sin' && (respDe(cfg, t.id).entrega.length || respDe(cfg, t.id).diligencia.length)) ? 'carga' : t.modo;

/* ------------------------------ Vista de una plantilla ------------------------------ */
function vista(t, cfg, est, periodo, yo, admin) {
  const e = est[t.id] || {};
  const r = respDe(cfg, t.id);
  const modo = modoDe(t, cfg);
  const oficial = fechaOficial(t, periodo);
  const limite = cfg.prorrogas[t.id] || LIMITE_INICIAL[periodo] || (oficial ? menosUnMes(oficial) : null);
  const estado = e.estado || 'pendiente';
  const dif = limite ? dias(hoyIso(), limite) : null;
  const dep = DEPENDE[t.id] && POR_ID[DEPENDE[t.id]] && modoDe(POR_ID[DEPENDE[t.id]], cfg) === 'carga' ? DEPENDE[t.id] : null;
  const depOk = !dep || ['revision', 'validada'].includes((est[dep] || {}).estado);
  const entrega = r.entrega.includes(yo), dil = r.diligencia.includes(yo);
  const o = {
    id: t.id, nombre: t.nombre, grupo: t.grupo, modo, periodoReporte: periodoReporte(t, periodo), maestroSin: t.modo === 'sin', posgrados: t.posgrados,
    estado, noAplica: !!e.noAplica, novedades: !!e.novedades, motivo: e.motivo || '', archivo: e.archivo || '', fechaCarga: e.fecha || '',
    limite, dias: dif, vencida: ['pendiente', 'devuelta'].includes(estado) && dif != null && dif < 0,
    sinFecha: !limite, textoFecha: !limite ? (t.fechas[0] || '') : '',
    entregaTexto: textoEntrega(cfg, t.id),
    diligenciaTexto: (() => { const d = respDe(cfg, t.id).diligencia; return d.length ? d.map((c) => nombreDe(cfg, c)).join(', ') : ''; })(),
    puedeCargar: modo === 'carga' && (entrega || dil) && depOk, soyEntrega: entrega, soyDiligencia: dil,
    bloqueo: dep && !depOk ? `Primero se entrega ${POR_ID[dep].nombre}.` : '',
    tieneOficial: !!cfg.oficiales[t.id], versionOficial: ((cfg.oficiales[t.id] || [])[0] || {}).version || 0,
    puedeVerAnterior: !!(e.anterior),
  };
  if (admin) Object.assign(o, { cargo: t.cargo, cargoTexto: t.cargoTexto, codigo: t.codigo, oficial, entrega: r.entrega, diligencia: r.diligencia, prorroga: cfg.prorrogas[t.id] || '', fechas: t.fechas, historial: (e.historial || []).slice(-8) });
  return o;
}

/* ------------------------------ Correo ------------------------------ */
async function enviarCorreo(para, asunto, html, cc) {
  const mensaje = { subject: asunto, body: { contentType: 'HTML', content: html }, toRecipients: para.map((a) => ({ emailAddress: { address: a } })) };
  if (cc && cc.length) mensaje.ccRecipients = cc.map((a) => ({ emailAddress: { address: a } }));
  const r = await g(`/users/${encodeURIComponent(REMITENTE)}/sendMail`, { method: 'POST', body: { message: mensaje, saveToSentItems: true } });
  if (!r.ok) throw error(`No se pudo enviar el correo (${r.status}): ${(await r.text()).slice(0, 200)}`, 502);
}
/* Aviso a la Oficina de Estadística cuando un responsable carga una plantilla (o declara «No aplica»). Si falla, no impide la entrega. */
async function avisarEstadistica(cfg, t, v, periodo, quien, noAplica) {
  const hecho = noAplica ? 'declaró que <b>no hay registros</b> (No aplica) en' : 'cargó';
  const cuerpo = `<b>${esc(quien.nombre)}</b> (${esc(quien.correo)}) ${hecho} la plantilla <b>${esc(t.nombre)}</b>, periodo ${esc(periodoReporte(t, periodo))}. Queda en revisión para que la Oficina de Estadística la valide.`;
  await enviarCorreo([REMITENTE], `${noAplica ? 'Plantilla en No aplica' : 'Plantilla cargada'} · ${t.nombre}`, htmlCorreo({ titulo: noAplica ? 'Plantilla declarada como No aplica' : 'Plantilla cargada', cuerpo, entrega: textoEntrega(cfg, t.id), plantillas: [t.nombre], ids: [t.id], fecha: v.limite ? fechaLarga(v.limite) : '', periodo: periodoReporte(t, periodo) }));
}
/* Mismo diseño del correo de Generación de Promedios Académicos (api/promedios.js): franja azul con escudo, rótulo dorado, título, botón y pie. */
function htmlCorreo({ titulo, cuerpo, entrega, plantillas, ids, fecha, filas: items, colDias, periodo, urlAbrir, textoAbrir }) {
  /* items = [{ nombre, fecha, entrega }]; si solo viene una plantilla se arma con plantillas/fecha/entrega. */
  items = items || (plantillas || []).map((n, k) => ({ nombre: n, id: (ids || [])[k], fecha, entrega, periodo }));
  const base = (process.env.PORTAL_URL ? new URL(process.env.PORTAL_URL).origin : 'https://enap.vercel.app') + '/';
  const logo = base + 'assets/escudo.png', boton = base + 'assets/boton-abrir-portal.png';
  const P = (t) => `<p style="font-size:14.5px;color:#334155;margin:0 0 10px">${t}</p>`;
  const th = 'padding:9px 12px;background:#eef3f9;border-bottom:1px solid #d6e0ec;font-size:13px;color:#0b3d66;font-weight:700;text-align:left';
  const td = 'padding:10px 12px;border-bottom:1px solid #e3eaf1;font-size:14.5px;color:#334155';
  const entregas = Array.from(new Set(items.map((i) => i.entrega || 'Por asignar')));
  const conPeriodo = items.some((i) => i.periodo);
  const variasEntregas = entregas.length > 1;   /* si todas comparten responsable de la entrega, va en una línea; si no, en una columna */
  const filas = items.map((i) => `<tr><td style="${td}">${esc(i.nombre)}${i.id ? `<br><a href="${esc(base)}snies/instructivo.html?p=${esc(i.id)}" target="_blank" style="font-size:12.5px;color:#1b4c92">Instructivo de diligenciamiento</a>` : ''}</td><td style="${td};white-space:nowrap">${esc(i.fecha || '—')}</td>${conPeriodo ? `<td style="${td};white-space:nowrap">${esc(i.periodo || '')}</td>` : ''}${colDias ? `<td style="${td};white-space:nowrap">${esc(i.dias || '')}</td>` : ''}${variasEntregas ? `<td style="${td}">${esc(i.entrega || 'Por asignar')}</td>` : ''}</tr>`).join('');
  const datos = (filas ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #d6e0ec;border-radius:10px;border-collapse:separate;overflow:hidden;margin:4px 0 14px"><tr><td style="${th}">Nombre de la plantilla</td><td style="${th}">Fecha límite</td>${conPeriodo ? `<td style="${th}">Periodo que se reporta</td>` : ''}${colDias ? `<td style="${th}">${esc(colDias)}</td>` : ''}${variasEntregas ? `<td style="${th}">Responsable de la entrega</td>` : ''}</tr>${filas}</table>` : '')
    + (variasEntregas ? '' : P(`<b>Responsable de la entrega:</b> ${esc(entregas[0] || 'Por asignar')}`));
  return `<div style="background:#f4f6f8;padding:24px 0;font-family:'Aptos Display',Aptos,'Segoe UI',Arial,sans-serif;color:#212529">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #d9e2ec;border-radius:14px;overflow:hidden">
<tr><td style="background:#0b3d66;border-bottom:3px solid #c9a227;padding:16px 24px"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="padding-right:14px"><img src="${esc(logo)}" alt="" height="42" style="display:block;height:42px"></td><td style="color:#ffffff"><div style="font-size:16px;font-weight:600;line-height:1.25">Portal de Servicios Digitales - Oficina de Estadística</div><div style="font-size:12px;opacity:.85">Escuela Naval de Cadetes “Almirante Padilla”</div></td></tr></table></td></tr>
<tr><td style="padding:26px 28px 8px">
<div style="font-size:12px;letter-spacing:.2em;color:#8a6d0b;font-weight:700">PLANTILLAS SNIES</div>
<h2 style="margin:8px 0 14px;font-size:21px;color:#062a4a;font-weight:600">${titulo}</h2>
<p style="font-size:14.5px;color:#334155;margin:0 0 10px">Cordial saludo.</p>
${P(cuerpo)}
${datos}
${urlAbrir ? `<p style="font-size:15px;margin:0 0 16px"><a href="${esc(urlAbrir)}" target="_blank" style="color:#1b4c92;font-weight:700">▶ ${esc(textoAbrir || 'Abrir')}</a></p>` : ''}
<p style="font-size:14.5px;color:#334155;margin:0 0 18px">Para gestionar sus plantillas, ingrese al módulo Plantillas SNIES del Portal de Servicios Digitales - Oficina de Estadística.</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px"><tr><td>
<a href="${esc(urlAbrir || PORTAL_URL)}" target="_blank" style="text-decoration:none"><img src="${esc(boton)}" width="176" height="36" alt="${esc(textoAbrir || 'Abrir el Portal')}" style="display:block;border:0;width:176px;height:36px;border-radius:18px;background:#0b3d66;color:#ffffff;font-family:'Segoe UI',Arial,sans-serif;font-size:14px;font-weight:600;line-height:36px;text-align:center"></a>
</td></tr></table>
</td></tr>
<tr><td style="background:#f8fafc;border-top:1px solid #e3eaf1;padding:14px 28px;font-size:12px;color:#7b8794;line-height:1.5">Este mensaje fue generado automáticamente desde el Portal de Servicios Digitales - Oficina de Estadística de la Escuela Naval de Cadetes “Almirante Padilla”.</td></tr>
</table></div>`;
}
const fechaLarga = (iso) => iso ? iso.split('-').reverse().join('/') : '';


/* Si todavía no se conoce el nombre de un responsable (aún no ha entrado al aplicativo), se busca en el directorio de la organización.
   Si la aplicación no tiene permiso de lectura del directorio, no pasa nada: se queda el correo hasta que la persona entre. */
async function conocerNombres(cfg, correos) {
  const faltan = Array.from(new Set(correos)).filter((c) => c && !(cfg.usuarios[c] && cfg.usuarios[c].nombre)).slice(0, 40);
  if (!faltan.length) return;
  const hallados = {};
  await Promise.all(faltan.map(async (c) => {
    try { const r = await g(`/users/${encodeURIComponent(c)}?$select=displayName`); if (r.ok) { const n = ((await r.json()) || {}).displayName; if (n) hallados[c] = n; } } catch (e) { /* sin permiso o sin cuenta */ }
  }));
  const claves = Object.keys(hallados); if (!claves.length) return;
  claves.forEach((c) => { cfg.usuarios[c] = { nombre: hallados[c] }; });
  try { await mutar('config.json', configBase, (x) => { x.usuarios = x.usuarios || {}; claves.forEach((c) => { if (!(x.usuarios[c] && x.usuarios[c].nombre)) x.usuarios[c] = { nombre: hallados[c] }; }); return x; }); } catch (e) { /* se vuelve a intentar en el próximo envío */ }
}

/* Un solo correo por responsable con todas sus plantillas (tabla de plantilla y fecha límite). tipo: apertura | r7 | r1 | venc.
   soloIds limita las plantillas consideradas; soloCorreos limita los destinatarios. Devuelve { correos, plantillas } (ids de plantillas avisadas). */
async function avisarPorResponsable(cfg, est, periodo, tipo, opc) {
  opc = opc || {};
  const porCorreo = new Map(), usadas = new Set(), copiados = new Set();
  await conocerNombres(cfg, TEMPLATES.flatMap((t) => { const r = respDe(cfg, t.id); return r.entrega.concat(r.diligencia); }));
  for (const t of TEMPLATES) {
    if (opc.soloIds && !opc.soloIds.includes(t.id)) continue;
    const v = vista(t, cfg, est, periodo, '', false);
    if (v.modo === 'sin' || v.noAplica || !['pendiente', 'devuelta'].includes(v.estado)) continue;
    if (tipo !== 'apertura' && !v.limite) continue;
    const d = destinosDe(cfg, t.id);
    for (const c of d.para) {
      if (opc.soloCorreos && !opc.soloCorreos.includes(c)) continue;
      if (!porCorreo.has(c)) porCorreo.set(c, []);
      porCorreo.get(c).push({ t, cc: d.cc, fila: { nombre: t.nombre, id: t.id, periodo: periodoReporte(t, periodo), fecha: v.limite ? fechaLarga(v.limite) : '', entrega: textoEntrega(cfg, t.id), dias: v.dias == null ? '' : v.dias < 0 ? `Venció hace ${-v.dias} ${v.dias === -1 ? 'día' : 'días'}` : v.dias === 0 ? 'Vence hoy' : `${v.dias} ${v.dias === 1 ? 'día' : 'días'}` }, posgrados: t.posgrados });
    }
  }
  let correos = 0, fallos = 0;
  for (const [c, lista] of porCorreo) {
    const n = lista.length, uno = n === 1;
    const nota = lista.some((x) => x.posgrados) ? ' Las facultades envían su parte a posgrados@enap.edu.co; Posgrados centraliza y entrega las plantillas de Educación Continua y Cursos.' : '';
    const M = {
      apertura: ['Solicitud de información SNIES', `Siguiendo instrucciones del señor Decano Académico, me permito solicitar el envío de las plantillas SNIES asignadas a su responsabilidad, relacionadas a continuación.${nota}`],
      r7: ['Recordatorio SNIES · faltan 7 días', `Le recordamos amablemente que faltan 7 días para la fecha límite de entrega de ${uno ? 'la siguiente plantilla' : 'las siguientes plantillas'}.${nota}`],
      r1: ['Mañana vence el plazo SNIES', `Le recordamos amablemente que mañana vence el plazo de entrega de ${uno ? 'la siguiente plantilla' : 'las siguientes plantillas'}.${nota}`],
      venc: ['Plantillas SNIES vencidas', `El plazo de entrega de ${uno ? 'la siguiente plantilla ya venció' : 'las siguientes plantillas ya venció'}. Le agradecemos enviar${uno ? 'la' : 'las'} lo antes posible para evitar hallazgos en la Auditoría.`],
    }[tipo];
    const cc = Array.from(new Set(lista.flatMap((x) => x.cc))).filter((x) => x !== c);
    try {
      await enviarCorreo([c], uno ? `${M[0]} · ${lista[0].t.nombre}` : `${M[0]} · ${n} plantillas`, htmlCorreo({ titulo: M[0], cuerpo: M[1], filas: lista.map((x) => x.fila), colDias: tipo === 'venc' ? 'Estado del plazo' : 'Días faltantes' }), cc);
      correos++; cc.forEach((x) => copiados.add(x)); lista.forEach((x) => usadas.add(x.t.id));
    } catch (e) { fallos++; }
  }
  return { correos, fallos, plantillas: Array.from(usadas), para: Array.from(porCorreo.keys()), cc: Array.from(copiados) };
}
async function avisar(cfg, t, tipo, extra) {
  const d = destinosDe(cfg, t.id), para = d.para, cc = ['dev', 'ok', 'na'].includes(tipo) ? d.cc : [];
  if (!para.length) return false;
  await conocerNombres(cfg, para.concat(cc));
  const est = extra && extra.limite;
  const nota = t.posgrados ? ' Las facultades envían su parte a posgrados@enap.edu.co; Posgrados centraliza y entrega la plantilla.' : '';
  const M = {
    apertura: ['Solicitud de información SNIES', `Siguiendo instrucciones del señor Decano Académico, me permito solicitar el envío de las plantillas SNIES asignadas a su responsabilidad, relacionadas a continuación.${nota}`],
    r7: ['Recordatorio SNIES · faltan 7 días', `Le recordamos amablemente que faltan 7 días para la fecha límite de entrega de la siguiente plantilla.${nota}`],
    r1: ['Mañana vence el plazo SNIES', `Le recordamos amablemente que mañana vence el plazo de entrega de la siguiente plantilla.${nota}`],
    venc: ['Plantilla SNIES vencida', 'El plazo de entrega de la siguiente plantilla ya venció. Le agradecemos enviarla lo antes posible para evitar hallazgos en la Auditoría.'],
    ok: ['Plantilla recibida', 'Hemos recibido su plantilla y la Oficina de Estadística la validó. ¡Muchas gracias! No debe hacer nada más.'],
    na: ['Plantilla marcada como No aplica', 'Hemos registrado que no se generaron registros en este semestre. Gracias por informarlo; la plantilla pasa a En revisión.'],
    dev: extra && extra.novedades
      ? ['Hay novedades en su plantilla', `La Oficina de Estadística revisó la información de su plantilla y encontró novedades: <b>${esc(extra.motivo || '')}</b>. Ábralas desde el botón de abajo, corríjalas en pantalla y entregue de nuevo.`]
      : ['Plantilla devuelta', `La Oficina de Estadística devolvió la plantilla con las siguientes novedades: <b>${esc(extra.motivo || '')}</b>. Le agradecemos corregirla y volver a cargarla.`],
    val: ['Plantilla validada', 'La Oficina de Estadística validó su plantilla. ¡Muchas gracias! No debe hacer nada más.'],
  }[tipo];
  await enviarCorreo(para, `${M[0]} · ${t.nombre}`, htmlCorreo({ titulo: M[0], cuerpo: M[1], entrega: textoEntrega(cfg, t.id), plantillas: [t.nombre], ids: [t.id], fecha: est ? fechaLarga(est) : '', periodo: periodoReporte(t, (extra && extra.periodo) || cfg.periodo), urlAbrir: extra && extra.novedades ? PORTAL_URL.split('?')[0] + '?novedades=' + encodeURIComponent(t.id) : '', textoAbrir: 'Abrir las novedades' }), cc);
  return true;
}

/* ------------------------------ Validación del contenido ------------------------------ */
/* Las reglas viven en api/_snies-validar.js (manual V9.1 + reglas de la Oficina de Estadística). Aquí solo se conecta con el periodo del ciclo. */
const VALIDAR = require('./_snies-validar');
function revisarContenido(wb, t, periodo) {
  const res = VALIDAR.revisarContenido(wb, t, { periodoRep: periodoReporte(t, periodo || CICLO_DEFECTO), hoy: Math.floor(Date.now() / 86400000) + 25569 });
  const textos = VALIDAR.resumenTextos(res.errores);
  textos.detalle = res.errores.length ? VALIDAR.detalleVisor(res) : null;
  return textos;
}
const CICLO_DEFECTO = '2026-2';

/* ------------------------------ Validación del archivo (estructura) ------------------------------ */
const vacio = (v) => v == null || (typeof v === 'string' && v.trim() === '');
function codigoInfo(wb) {
  if (!wb.hojas.includes('INFO')) return null;
  const f = wb.leer('INFO', { maxRows: 30 }).find((x) => /c[oó]digo de la plantilla/i.test(String(x[0] || '')));
  return f && f[1] != null ? Number(f[1]) : null;
}
const { aplicar: aplicarXlsx } = require('./_xlsx-editar');
/* Correcciones hechas en pantalla: cambios [{h,f,c,v}] y filas eliminadas [{h,f}] sobre el archivo original; devuelve el .xlsx corregido. */
function aplicarCorrecciones(buf, t, cambios, borrar) {
  cambios = Array.isArray(cambios) ? cambios.slice(0, 5000) : []; borrar = Array.isArray(borrar) ? borrar.slice(0, 5000) : [];
  if (!cambios.length && !borrar.length) return null;
  const wb = abrir(buf), ops = [], del = {};
  const cache = {};
  const enc = (h) => cache[h] || (cache[h] = (wb.leer(h, { maxCols: 120, maxRows: 1 })[0] || []).map((x) => limpio(x, 80).toUpperCase()));
  for (const c of cambios) {
    const h = String(c.h || ''); if (!wb.hojas.includes(h) || h === 'INFO') continue;
    const ci = enc(h).indexOf(String(c.c || '').toUpperCase()), fila = Math.floor(+c.f); if (ci < 0 || !(fila >= 2)) continue;
    const R = ((REGLAS_COL[t.id] || {})[h] || {})[String(c.c).toUpperCase()] || {};
    let valor = String(c.v == null ? '' : c.v).trim(), numero = null;
    if (R.t === 'n' && /^-?\d+([.,]\d+)?$/.test(valor)) numero = valor.replace(',', '.');
    else if (R.t === 'f') { const f = VALIDAR.fechaNum(valor); if (f != null && !/^\d+$/.test(valor)) { if (c.num) numero = String(f); } }
    ops.push({ hoja: h, fila, col: ci, valor, numero });
  }
  for (const d of borrar) { const h = String(d.h || ''); const fila = Math.floor(+d.f); if (wb.hojas.includes(h) && h !== 'INFO' && fila >= 2) (del[h] = del[h] || []).push(fila); }
  return aplicarXlsx(buf, { cambios: ops, borrar: del });
}
const REGLAS_COL = (() => { try { return require('./_snies-reglas.json'); } catch (e) { return {}; } })();
const COLUMNAS = (() => { try { return require('./_snies-columnas.json'); } catch (e) { return {}; } })();
function revisarArchivo(buf, t, oficial, periodo) {
  const errores = [];
  if (buf.length < 4 || buf.readUInt32LE(0) !== 0x04034b50) return ['El archivo no es un Excel (.xlsx).'];
  let wb;
  try { wb = abrir(buf); } catch (e) { return ['No se pudo abrir el Excel: ' + e.message]; }
  const cod = codigoInfo(wb);
  if (t.codigo != null && cod !== t.codigo) errores.push(cod == null ? 'El archivo no trae la hoja INFO con el código de la plantilla; use la plantilla oficial.' : `Este archivo es de otra plantilla (código ${cod}); esta es la ${t.nombre} (código ${t.codigo}). Descargue la plantilla oficial desde la tarjeta («Plantilla oficial vacía») y diligencie los datos allí.`);
  const datos = wb.hojas.filter((h) => h !== 'INFO');
  if (!datos.length) errores.push('El archivo no tiene hojas de datos.');
  else {
    const filas = wb.leer(datos[0], { maxCols: 80 });
    const enc = (filas[0] || []).map((x) => limpio(x, 80).toUpperCase());
    /* Estructura contra la plantilla oficial vigente (hojas y encabezados), para detectar archivos viejos o de otra versión. */
    const esperado = COLUMNAS[String(t.codigo)];
    if (esperado && !errores.length) {
      const AVISO = ' Descargue la plantilla oficial vigente desde la tarjeta («Plantilla oficial vacía») y copie sus datos en ella sin cambiar el encabezado.';
      const faltan = Object.keys(esperado).filter((h) => !datos.includes(h)), sobran = datos.filter((h) => !esperado[h]);
      if (faltan.length || sobran.length) errores.push(`Las hojas del archivo no coinciden con la plantilla oficial vigente${faltan.length ? ` (faltan: ${faltan.join(', ')})` : ''}${sobran.length ? ` (sobran: ${sobran.join(', ')})` : ''}.` + AVISO);
      else {
        for (const h of datos) {
          const real = (wb.leer(h, { maxCols: 200, maxRows: 1 })[0] || []).map((x) => limpio(x, 80).toUpperCase()).filter((x) => x);
          const ok = esperado[h], f = ok.filter((c) => !real.includes(c)), e = real.filter((c) => !ok.includes(c));
          if (f.length || e.length) errores.push(`La hoja ${h} no coincide con la plantilla oficial vigente${f.length ? `: faltan las columnas ${f.slice(0, 8).join(', ')}` : ''}${e.length ? `${f.length ? ';' : ':'} sobran ${e.slice(0, 8).join(', ')}` : ''}.` + AVISO);
          else if (JSON.stringify(real) !== JSON.stringify(ok)) errores.push(`La hoja ${h} tiene las columnas en otro orden que la plantilla oficial vigente.` + AVISO);
        }
      }
    }
    if (oficial && !esperado) {
      try {
        const wo = abrir(oficial), ho = wo.hojas.filter((h) => h !== 'INFO');
        const eo = (wo.leer(ho[0], { maxCols: 80 })[0] || []).map((x) => limpio(x, 80).toUpperCase());
        if (JSON.stringify(eo) !== JSON.stringify(enc)) errores.push('Las columnas no coinciden con la plantilla oficial vigente. Descargue la oficial y no cambie el encabezado.');
      } catch (e) { /* si la oficial no se puede leer, no se compara */ }
    }
    const conDatos = filas.slice(1).filter((f) => f.some((c) => !vacio(c)));
    if (!conDatos.length) errores.push('La plantilla no tiene filas diligenciadas. Si no hay registros en el semestre, use «No aplica».');
    else if (!errores.length) { try { const r = revisarContenido(wb, t, periodo); errores.push(...r); errores.detalle = r.detalle; } catch (e) { /* si una regla falla por un formato inesperado, no se bloquea la entrega por eso */ } }
  }
  return errores;
}

/* ------------------------------ Identidad ------------------------------ */
async function identificar(accessToken) {
  const r = await fetch(`${GRAPH}/me`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!r.ok) throw error('La sesión de Microsoft no es válida o expiró. Vuelva a iniciar sesión en el Portal.', 401);
  const p = await r.json(); const correo = String(p.mail || p.userPrincipalName || '').trim().toLowerCase();
  return { correo, nombre: p.displayName || correo };
}

/* ------------------------------ Cron diario ------------------------------ */
async function cronDiario() {
  const cfg = await leerConfig(), periodo = cfg.periodo, enviados = [];
  const est = await leerEstado(periodo);
  /* Se agrupan por tipo de aviso (7 días, 1 día, vencida): un correo por responsable con todas sus plantillas de ese aviso. */
  const grupos = { r7: [], r1: [], venc: [] };
  for (const t of TEMPLATES) {
    const v = vista(t, cfg, est, periodo, '', false);
    if (v.modo === 'sin') continue;
    if (!v.limite || !['pendiente', 'devuelta'].includes(v.estado) || v.noAplica) continue;
    const tipo = v.dias === 7 ? 'r7' : v.dias === 1 ? 'r1' : v.dias < 0 ? 'venc' : null;   /* vencidas: un correo cada día hasta que entreguen */
    if (!tipo) continue;
    const marca = tipo === 'venc' ? `venc-${hoyIso()}` : `${tipo}-${v.limite}`;
    if (((est[t.id] || {}).avisos || []).includes(marca)) continue;
    grupos[tipo].push({ id: t.id, marca });
  }
  for (const tipo of Object.keys(grupos)) {
    if (!grupos[tipo].length) continue;
    const ids = grupos[tipo].map((x) => x.id);
    try {
      const r = await avisarPorResponsable(cfg, est, periodo, tipo, { soloIds: ids });
      for (const x of grupos[tipo]) if (r.plantillas.includes(x.id)) {
        enviados.push(`${x.id}:${tipo}`);
        await mutar(`estado-${periodo}.json`, () => ({}), (s) => { s[x.id] = s[x.id] || {}; (s[x.id].avisos = s[x.id].avisos || []).push(x.marca); });
      }
    } catch (e) { /* se reintenta mañana */ }
  }
  return { ok: true, periodo, enviados };
}

/* ------------------------------ Handler ------------------------------ */
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'GET') {
      if ((req.query || {}).cron !== 'diario') { res.status(405).json({ error: 'Use POST.' }); return; }
      const secreto = process.env.CRON_SECRET;
      if (secreto && req.headers.authorization !== `Bearer ${secreto}`) throw error('No autorizado.', 401);
      await ctx(); res.status(200).json(await cronDiario()); return;
    }
    if (req.method !== 'POST') { res.status(405).json({ error: 'Use GET o POST.' }); return; }
    const body = typeof req.body === 'object' && req.body ? req.body : {};
    if (!body.accessToken || !body.accion) throw error('Faltan "accessToken" o "accion".', 400);
    const yo = await identificar(body.accessToken);
    if (!/@enap\.edu\.co$/.test(yo.correo)) throw error('Use su cuenta institucional @enap.edu.co.', 403);
    await ctx();
    const admin = ADMINS.includes(yo.correo);
    const soloAdmin = () => { if (!admin) throw error('Esta acción es solo del administrador del módulo.', 403); };
    const a = body.accion;
    let cfg = await leerConfig();
    /* El nombre sale del login; se guarda para mostrarlo en los correos. */
    if (!cfg.usuarios[yo.correo] || cfg.usuarios[yo.correo].nombre !== yo.nombre) {
      cfg = await mutar('config.json', configBase, (c) => { c.usuarios = c.usuarios || {}; c.usuarios[yo.correo] = { nombre: yo.nombre }; return c; }).then(() => leerConfig());
    }
    const periodo = /^\d{4}-[12]$/.test(body.periodo || '') && admin ? body.periodo : cfg.periodo;
    const est = await leerEstado(periodo);
    const mias = (c) => TEMPLATES.filter((t) => { const r = respDe(cfg, t.id); return r.entrega.includes(c || yo.correo) || r.diligencia.includes(c || yo.correo); });
    const buscar = (id) => { const t = POR_ID[id]; if (!t) throw error('Plantilla desconocida.', 400); return t; };

    if (a === 'sesion') {
      const pAnt = anterior(cfg.periodo), estAnt = await leerEstado(pAnt);
      /* Modo súper admin: el administrador puede ver el aplicativo como lo ve cualquier responsable (solo lectura: no puede cargar ni actuar como esa persona). */
      const como = admin ? String(body.verComo || '').trim().toLowerCase() : '';
      const quien = como ? { correo: como, nombre: nombreDe(cfg, como) } : yo;
      const usuarios = admin ? Array.from(new Set(Object.values(cfg.responsables || {}).flatMap((r) => (r.entrega || []).concat(r.diligencia || [])))).map((c) => ({ correo: c, nombre: nombreDe(cfg, c) })).sort((x, y) => x.nombre.localeCompare(y.nombre, 'es')) : undefined;
      res.status(200).json({ correo: quien.correo, nombre: quien.nombre, admin, verComo: como, usuarios, periodo: cfg.periodo, periodoAnterior: pAnt, plantillas: mias(como || '').map((t) => { const o = Object.assign(vista(t, cfg, est, periodo, quien.correo, false), { anterior: ofreceAnterior(t) && estAnt[t.id] && estAnt[t.id].archivo ? pAnt : '' }); if (como) { o.puedeCargar = o.modo === 'carga' && !o.bloqueo; } return o; }) });
      return;
    }

    /* Modo «Ver como»: el administrador actúa en nombre de otro responsable; lo que carga queda a su nombre y NO se envía ningún correo. */
    const comoCorreo = admin ? String(body.verComo || '').trim().toLowerCase() : '';
    if (a === 'cargar') {
      const t = buscar(body.id), v = vista(t, cfg, est, periodo, comoCorreo || yo.correo, false), porEstadistica = !!(admin && body.porEstadistica) && !comoCorreo, sinCorreo = !!comoCorreo || porEstadistica;
      if (!v.soyEntrega && !v.soyDiligencia && !admin) throw error('Usted no es responsable de la entrega ni del diligenciamiento de esta plantilla.', 403);
      if (v.modo !== 'carga') throw error('Esta plantilla no se carga en el aplicativo.', 400);
      if (v.bloqueo && !admin) throw error(v.bloqueo, 409);
      let buf = Buffer.from(String(body.datos || ''), 'base64');
      if (!buf.length || buf.length > MAX_BYTES) throw error('El archivo está vacío o pesa más de 4 MB.', 400);
      const oficial = cfg.oficiales[t.id] ? await leerBin(rutaSp(`oficiales/${t.id}.xlsx`)) : null;
      const corregido = aplicarCorrecciones(buf, t, body.cambios, body.borrar);
      if (corregido) buf = corregido;
      const nota = corregido ? ' Corrigió el archivo en pantalla antes de entregarlo.' : '';
      const errores = revisarArchivo(buf, t, oficial, periodo);
      if (errores.length && porEstadistica) {
        /* Cargada por la Oficina de Estadística en nombre del responsable y con novedades: el archivo SE GUARDA, la plantilla queda Devuelta y NO se envía correo;
           la administradora decide cuándo avisar (botón «Enviar correo»); el correo lleva un enlace que abre las novedades de una. */
        const motivo = limpio(errores.join(' · '), 800), nombreN = `${t.nombre.replace(/[\\/:*?"<>|]/g, '')} - ${periodo}.xlsx`;
        await escribirBin(rutaOd(`${periodo}/${nombreN}`), buf);
        await mutar(`estado-${periodo}.json`, () => ({}), (st) => { const x = st[t.id] = st[t.id] || {}; x.estado = 'devuelta'; x.noAplica = false; x.novedades = true; x.archivo = nombreN; x.fecha = ahora(); x.por = yo.correo; x.motivo = motivo; (x.historial = x.historial || []).push({ f: ahora(), por: yo.nombre, t: 'Cargó el archivo en nombre del responsable; tiene novedades y quedó Devuelta (sin correo todavía). ' + motivo }); });
        res.status(200).json({ ok: false, errores, devuelta: true, guardada: true }); return;
      }
      if (errores.length) { res.status(200).json({ ok: false, errores, detalle: errores.detalle || null, datos: corregido && buf.length < 2800000 ? buf.toString('base64') : undefined }); return; }
      const nombre = `${t.nombre.replace(/[\\/:*?"<>|]/g, '')} - ${periodo}.xlsx`;
      await escribirBin(rutaOd(`${periodo}/${nombre}`), buf);
      /* El estado y el correo de confirmación van al mismo tiempo (antes uno esperaba al otro). */
      const [, correo] = await Promise.all([
        mutar(`estado-${periodo}.json`, () => ({}), (s) => { const x = s[t.id] = s[t.id] || {}; x.estado = 'revision'; x.noAplica = false; x.novedades = false; x.archivo = nombre; x.fecha = ahora(); x.por = comoCorreo || yo.correo; x.motivo = ''; (x.historial = x.historial || []).push({ f: ahora(), por: yo.nombre, t: comoCorreo ? `Estadística cargó la plantilla en nombre de ${nombreDe(cfg, comoCorreo)} (entregada por correo). Pasa a En revisión.` : porEstadistica ? 'Estadística cargó la plantilla que el responsable entregó por correo. Pasa a En revisión.' : 'Entregó la plantilla.' + nota + ' Pasa a En revisión.' }); }),
        Promise.resolve(false),   /* al cargar no se envía correo al responsable: «Plantilla recibida» sale solo cuando se valida (decisión de la autora, 26/11/2026) */
        admin ? Promise.resolve() : avisarEstadistica(cfg, t, v, periodo, yo, false).catch(() => {}),
      ]);
      res.status(200).json({ ok: true, correo }); return;
    }

    if (a === 'novedades') {   /* abre el archivo guardado con novedades para corregirlo en pantalla (responsable de la plantilla o administrador) */
      const t = buscar(body.id);
      if (!admin && !mias().some((x) => x.id === t.id)) throw error('No tiene acceso a esta plantilla.', 403);
      const e = est[t.id];
      if (!e || !e.novedades || !e.archivo) throw error('Esta plantilla no tiene novedades por abrir.', 404);
      const buf = await leerBin(rutaOd(`${periodo}/${e.archivo}`));
      if (!buf) throw error('No se encontró el archivo en OneDrive.', 404);
      const oficial = cfg.oficiales[t.id] ? await leerBin(rutaSp(`oficiales/${t.id}.xlsx`)) : null;
      const errores = revisarArchivo(buf, t, oficial, periodo);
      res.status(200).json({ ok: true, nombre: e.archivo, errores, detalle: errores.detalle || null, datos: buf.length < 2800000 ? buf.toString('base64') : undefined }); return;
    }
    if (a === 'no-aplica') {
      const t = buscar(body.id), v = vista(t, cfg, est, periodo, comoCorreo || yo.correo, false);
      if (!v.soyEntrega && !v.soyDiligencia && !admin) throw error('Usted no es responsable de la entrega ni del diligenciamiento de esta plantilla.', 403);
      if (v.modo !== 'carga') throw error('Esta plantilla no se gestiona en el aplicativo.', 400);
      const [, correo] = await Promise.all([
        mutar(`estado-${periodo}.json`, () => ({}), (s) => { const x = s[t.id] = s[t.id] || {}; x.estado = 'revision'; x.noAplica = true; x.archivo = ''; x.fecha = ahora(); x.por = comoCorreo || yo.correo; x.motivo = ''; (x.historial = x.historial || []).push({ f: ahora(), por: yo.nombre, t: (comoCorreo ? `Estadística, en nombre de ${nombreDe(cfg, comoCorreo)}: ` : '') + 'Marcó la plantilla como No aplica: no se generaron registros. Pasa a En revisión.' }); }),
        comoCorreo ? Promise.resolve(false) : avisar(cfg, t, 'na', { limite: v.limite, periodo }).then(() => true, () => false),
        admin ? Promise.resolve() : avisarEstadistica(cfg, t, v, periodo, yo, true).catch(() => {}),
      ]);
      res.status(200).json({ ok: true, correo }); return;
    }

    if (a === 'oficial-descargar') {   /* la plantilla oficial vigente, sin cambios; la ven los responsables de esa plantilla */
      const t = buscar(body.id);
      if (!admin && !mias().some((x) => x.id === t.id)) throw error('No tiene acceso a esta plantilla.', 403);
      const buf = await leerBin(rutaSp(`oficiales/${t.id}.xlsx`));
      if (!buf) throw error('Todavía no se ha cargado la plantilla oficial.', 404);
      res.status(200).json({ nombre: `${t.nombre} - plantilla oficial.xlsx`, datos: buf.toString('base64') }); return;
    }

    if (a === 'entrega-descargar') {   /* la entrega hecha en el periodo indicado (semestre anterior) */
      const t = buscar(body.id), p = /^\d{4}-[12]$/.test(body.periodoEntrega || '') ? body.periodoEntrega : anterior(cfg.periodo);
      if (!admin && !mias().some((x) => x.id === t.id)) throw error('No tiene acceso a esta plantilla.', 403);
      const e = (await leerEstado(p))[t.id];
      if (!e || !e.archivo) throw error('No hay un archivo entregado en ese periodo.', 404);
      const buf = await leerBin(rutaOd(`${p}/${e.archivo}`));
      if (!buf) throw error('No se encontró el archivo en OneDrive.', 404);
      res.status(200).json({ nombre: e.archivo, datos: buf.toString('base64') }); return;
    }

    /* ---------- Administración ---------- */
    if (a === 'admin') {
      soloAdmin();
      const lista = TEMPLATES.map((t) => vista(t, cfg, est, periodo, '', true));
      res.status(200).json({ periodo, periodoActivo: cfg.periodo, plantillas: lista, cargos: CARGOS }); return;
    }
    if (a === 'responsables') {
      soloAdmin(); const t = buscar(body.id);
      const f = limpio(body.fecha, 10);
      if (f && !/^\d{4}-\d{2}-\d{2}$/.test(f)) throw error('Fecha inválida.', 400);
      const ent = listaCorreos(body.entrega).slice(0, 3), dil = listaCorreos(body.diligencia).slice(0, 12);
      /* Responsables y prórroga se guardan juntos, en una sola escritura. */
      await mutar('config.json', configBase, (c) => { c.responsables = c.responsables || {}; c.responsables[t.id] = { entrega: ent, diligencia: dil }; c.prorrogas = c.prorrogas || {}; if (f) c.prorrogas[t.id] = f; else delete c.prorrogas[t.id]; });
      res.status(200).json({ ok: true, entrega: ent, diligencia: dil }); return;
    }
    if (a === 'prorroga') {
      soloAdmin(); const t = buscar(body.id), f = limpio(body.fecha, 10);
      if (f && !/^\d{4}-\d{2}-\d{2}$/.test(f)) throw error('Fecha inválida.', 400);
      await mutar('config.json', configBase, (c) => { c.prorrogas = c.prorrogas || {}; if (f) c.prorrogas[t.id] = f; else delete c.prorrogas[t.id]; });
      res.status(200).json({ ok: true }); return;
    }
    if (a === 'estado') {
      soloAdmin(); const t = buscar(body.id), nuevo = body.estado;
      if (!ESTADOS.includes(nuevo)) throw error('Estado inválido.', 400);
      const motivo = limpio(body.motivo, 800);
      if (nuevo === 'devuelta' && !motivo) throw error('Escriba qué debe corregir el responsable.', 400);
      await mutar(`estado-${periodo}.json`, () => ({}), (s) => { const x = s[t.id] = s[t.id] || {}; x.estado = nuevo; x.motivo = nuevo === 'devuelta' ? motivo : ''; if (nuevo === 'pendiente') { x.noAplica = false; } (x.historial = x.historial || []).push({ f: ahora(), por: yo.nombre, t: nuevo === 'devuelta' ? 'Devolvió la plantilla: ' + motivo : 'Cambió el estado a ' + nuevo + '.' }); });
      let correo = true;
      try {
        const lim = vista(t, cfg, est, periodo, '', false).limite;
        if (nuevo === 'devuelta') await avisar(cfg, t, 'dev', { motivo, limite: lim });
        else if (nuevo === 'validada') await avisar(cfg, t, 'ok', { limite: lim, periodo });   /* «Plantilla recibida»: solo al validar (decisión de la autora, 26/11/2026) */
      } catch (e) { correo = false; }
      res.status(200).json({ ok: true, correo }); return;
    }
    if (a === 'enviar-correo') {   /* envío individual: solicitud (o recordatorio / vencida / devuelta) a los responsables de una plantilla */
      soloAdmin(); const t = buscar(body.id);
      const v = vista(t, cfg, est, periodo, '', true);
      if (!['pendiente', 'devuelta'].includes(v.estado)) throw error('Esa plantilla ya fue entregada; no necesita solicitud.', 400);
      const r = respDe(cfg, t.id), para = destinosDe(cfg, t.id).para;
      if (!para.length) throw error('La plantilla no tiene responsables con correo. Asígnalos en la pestaña Responsables.', 400);
      if (v.estado === 'devuelta') { await avisar(cfg, t, 'dev', { motivo: v.motivo, limite: v.limite, periodo, novedades: !!(est[t.id] && est[t.id].novedades) }); res.status(200).json({ ok: true, para }); return; }
      /* Cada responsable de la plantilla recibe un solo correo con todas sus plantillas pendientes. */
      const g = await avisarPorResponsable(cfg, est, periodo, v.vencida ? 'venc' : 'apertura', { soloCorreos: para });
      if (!g.correos) throw error('No se pudo enviar el correo.', 502);
      res.status(200).json({ ok: true, para: g.para, cc: g.cc }); return;
    }
    if (a === 'oficial-subir') {
      soloAdmin(); const t = buscar(body.id);
      const buf = Buffer.from(String(body.datos || ''), 'base64');
      if (!buf.length || buf.length > MAX_BYTES) throw error('El archivo está vacío o pesa más de 4 MB.', 400);
      if (buf.readUInt32LE(0) !== 0x04034b50) throw error('El archivo no es un Excel (.xlsx).', 400);
      const wb = abrir(buf), cod = codigoInfo(wb);
      if (t.codigo != null && cod !== t.codigo && !body.forzar) { res.status(200).json({ ok: false, aviso: cod == null ? 'El archivo no tiene el código de la plantilla en la hoja INFO.' : `El código del archivo (${cod}) no coincide con el de ${t.nombre} (${t.codigo}).` }); return; }
      const vers = (cfg.oficiales[t.id] || []);
      const n = (vers[0] ? vers[0].version : 0) + 1;
      const previa = await leerBin(rutaSp(`oficiales/${t.id}.xlsx`));
      if (previa) await escribirBin(rutaSp(`oficiales/${t.id}-v${vers[0] ? vers[0].version : 1}.xlsx`), previa);
      await escribirBin(rutaSp(`oficiales/${t.id}.xlsx`), buf);   /* se guarda tal como se sube */
      await mutar('config.json', configBase, (c) => { c.oficiales = c.oficiales || {}; c.oficiales[t.id] = [{ version: n, nombre: limpio(body.nombre, 160), fecha: ahora(), por: yo.correo }].concat(c.oficiales[t.id] || []).slice(0, 20); });
      res.status(200).json({ ok: true, version: n }); return;
    }
    if (a === 'periodo') {
      soloAdmin(); const p = limpio(body.nuevo, 8);
      if (!/^\d{4}-[12]$/.test(p)) throw error('Periodo inválido (use AAAA-1 o AAAA-2).', 400);
      await mutar('config.json', configBase, (c) => { c.periodo = p; });
      res.status(200).json({ ok: true }); return;
    }
    if (a === 'abrir-ciclo') {   /* solicitud de información: un solo correo por responsable con todas sus plantillas */
      soloAdmin();
      const r = await avisarPorResponsable(cfg, est, periodo, 'apertura');
      res.status(200).json({ ok: true, enviados: r.correos, fallos: r.fallos }); return;
    }
    throw error('Acción desconocida.', 400);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || 'Error inesperado.', conflicto: !!e.conflicto });
  }
};
function anterior(p) { const [a, s] = p.split('-').map(Number); return s === 2 ? `${a}-1` : `${a - 1}-2`; }
module.exports._interno = {htmlCorreo,  fechaOficial, menosUnMes, anterior, revisarArchivo, revisarContenido, TEMPLATES };
