/*!
 * Portal de Servicios Digitales Estadística — Escuela Naval de Cadetes "Almirante Padilla"
 * Autora y desarrolladora: CAMARGO MARTÍNEZ BEYTY PATRICIA — Oficina de Estadística
 * Derechos morales de autor reservados (Ley 23 de 1982, art. 30). Este aviso de autoría no debe eliminarse ni alterarse.
 */
/**
 * api/egresados.js
 *
 * Lista NOMINAL de egresados no graduados (Centro de Datos).
 * El repositorio es público: los nombres y cédulas NO pueden estar en el código ni en el navegador.
 * Viven en SharePoint (carpeta "Egresados" del sitio del Portal) y este endpoint solo los entrega a:
 *   - ADMIN (ADMINS): siempre.
 *   - AUTORIZADOS: cuentas autorizadas de forma permanente.
 *   - cuentas @enap.edu.co cuya solicitud fue APROBADA por un ADMIN (queda anotada cada descarga).
 *
 * Archivos en SharePoint (carpeta Egresados/):
 *   lista.json        { meta:{actualizado, por}, cab:[...], filas:[[...]] }   (la sube un ADMIN)
 *   solicitudes.json  [ { id, correo, nombre, fecha, estado:'pendiente'|'aprobada'|'rechazada', resuelto, por } ]
 *   descargas.json    [ { correo, fecha } ]
 *
 * Acciones (POST { accessToken, accion, ... }):
 *   sesion, solicitar, descargar            -> cualquier cuenta @enap.edu.co
 *   solicitudes, resolver, revocar, guardar-lista -> solo ADMIN
 */
const roles = require('./roles.js');

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const DOMINIO = '@enap.edu.co';
const ADMINS = ['sea@enap.edu.co', 'jestadisticaplen@enap.edu.co'];
// Cuentas autorizadas de forma permanente para descargar la lista con nombres (sin pasar por solicitud).
const AUTORIZADOS = ['jpcna@enap.edu.co', 'dfcn@enap.edu.co'];
const REMITENTE = 'jestadisticaplen@enap.edu.co';
const AVISAR_A = 'jestadisticaplen@enap.edu.co';
const PORTAL_URL = process.env.PORTAL_URL || 'https://enap.vercel.app/';
const CARPETA = 'Egresados';
const MAX_BYTES = 3 * 1024 * 1024;

function error(mensaje, status) { const e = new Error(mensaje); e.status = status || 500; return e; }
const ahora = () => new Date().toISOString();
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function identificar(accessToken) {
  const resp = await fetch(`${GRAPH_BASE}/me`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!resp.ok) throw error('La sesión de Microsoft no es válida o expiró. Vuelva a iniciar sesión en el Portal.', 401);
  const p = await resp.json();
  const correo = String(p.mail || p.userPrincipalName || '').trim().toLowerCase();
  if (!correo) throw error('La cuenta no tiene un correo asociado.', 403);
  return { correo, nombre: p.displayName || correo };
}

let appToken = null;
let siteId = null;
async function contexto() {
  appToken = await roles.getAppAccessToken();
  siteId = await roles.resolveSiteId(appToken);
}
const ruta = (n) => `${GRAPH_BASE}/sites/${siteId}/drive/root:/${CARPETA}/${n}:/content`;
async function leerJson(n) {
  const r = await fetch(ruta(n), { headers: { Authorization: `Bearer ${appToken}` } });
  if (r.status === 404) return null;
  if (!r.ok) throw error(`No se pudo leer ${n} en SharePoint (${r.status}).`, 502);
  return r.json();
}
async function escribirJson(n, v) {
  const r = await fetch(ruta(n), { method: 'PUT', headers: { Authorization: `Bearer ${appToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(v) });
  if (!r.ok) throw error(`No se pudo guardar ${n} en SharePoint (${r.status}). ${(await r.text()).slice(0, 300)}`, 502);
}

async function avisar(solicitud) {
  const html = `<div style="font-family:Aptos,'Segoe UI',Arial,sans-serif;max-width:640px;color:#071C3C">
<div style="font-size:12px;letter-spacing:.16em;color:#A8861D;font-weight:600">OFICINA DE ESTADÍSTICA · ENAP</div>
<h2 style="margin:6px 0 10px;font-size:20px">Solicitud de descarga: egresados no graduados</h2>
<p style="font-size:14px;color:#334155"><b>${esc(solicitud.nombre)}</b> (${esc(solicitud.correo)}) pide autorización para descargar la lista con nombres y cédulas de los egresados no graduados.</p>
<p style="font-size:14px;color:#334155">Para aprobarla o rechazarla, entre al Centro de Datos, vista "Egresados no graduados": en la parte inferior aparece el panel de solicitudes.</p>
<p><a href="${esc(PORTAL_URL)}" style="display:inline-block;background:#0B2A5B;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px">Abrir el Portal</a></p>
<p style="font-size:12px;color:#94A3B8">Mensaje automático del Portal de servicios digitales Estadística.</p></div>`;
  const r = await fetch(`${GRAPH_BASE}/users/${encodeURIComponent(REMITENTE)}/sendMail`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${appToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: { subject: 'Solicitud de descarga: egresados no graduados', body: { contentType: 'HTML', content: html }, toRecipients: [{ emailAddress: { address: AVISAR_A } }] }, saveToSentItems: true }),
  });
  return r.ok;
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
    if (!yo.correo.endsWith(DOMINIO) || roles.CORREOS_BLOQUEADOS.includes(yo.correo)) throw error('Esta cuenta no puede usar el Portal.', 403);
    await contexto();
    const admin = ADMINS.includes(yo.correo);
    const sols = (await leerJson('solicitudes.json')) || [];
    const mias = sols.filter((s) => s.correo === yo.correo).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
    const autorizado = AUTORIZADOS.includes(yo.correo);
    // Misma autorización para las dos listas nominales: egresados no graduados (lista.json) y extranjeros (lista-extranjeros.json).
    const LISTA = body.tipo === 'extranjeros' ? 'lista-extranjeros.json' : 'lista.json';
    const aprobada = admin || autorizado || (mias[0] && mias[0].estado === 'aprobada');

    if (accion === 'sesion') {
      const lista = await leerJson(LISTA);
      res.status(200).json({ correo: yo.correo, admin, puede: !!aprobada, estado: admin ? 'admin' : autorizado ? 'aprobada' : (mias[0] ? mias[0].estado : null), lista: lista ? { actualizado: lista.meta && lista.meta.actualizado, filas: (lista.filas || []).length } : null });
      return;
    }

    if (accion === 'solicitar') {
      if (aprobada) { res.status(200).json({ ok: true, estado: admin ? 'admin' : 'aprobada' }); return; }
      if (mias[0] && mias[0].estado === 'pendiente') { res.status(200).json({ ok: true, estado: 'pendiente' }); return; }
      const s = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), correo: yo.correo, nombre: yo.nombre, fecha: ahora(), estado: 'pendiente' };
      sols.push(s);
      await escribirJson('solicitudes.json', sols.slice(-500));
      let correoOk = false;
      try { correoOk = await avisar(s); } catch (e) { correoOk = false; }
      res.status(200).json({ ok: true, estado: 'pendiente', correo: correoOk });
      return;
    }

    if (accion === 'descargar') {
      if (!aprobada) throw error('No tiene autorización para descargar la lista con nombres.', 403);
      const lista = await leerJson(LISTA);
      if (!lista) throw error('Todavía no se ha cargado la lista nominal. Un administrador debe subirla.', 404);
      const d = (await leerJson('descargas.json')) || [];
      d.push({ correo: yo.correo, fecha: ahora() });
      await escribirJson('descargas.json', d.slice(-500));
      res.status(200).json({ cab: lista.cab, filas: lista.filas, ids: lista.ids || null });
      return;
    }

    if (!admin) throw error('Solo un administrador puede hacer esto.', 403);

    if (accion === 'solicitudes') {
      res.status(200).json({ solicitudes: sols.slice().reverse(), descargas: ((await leerJson('descargas.json')) || []).slice(-15).reverse() });
      return;
    }
    if (accion === 'resolver' || accion === 'revocar') {
      const s = sols.find((x) => x.id === body.id);
      if (!s) throw error('Solicitud no encontrada.', 404);
      s.estado = accion === 'revocar' ? 'rechazada' : (body.aprobar === true ? 'aprobada' : 'rechazada');
      s.resuelto = ahora(); s.por = yo.correo;
      await escribirJson('solicitudes.json', sols);
      res.status(200).json({ ok: true });
      return;
    }
    if (accion === 'guardar-lista') {
      const l = body.lista;
      if (!l || !Array.isArray(l.cab) || !Array.isArray(l.filas)) throw error('El archivo no tiene el formato esperado (faltan "cab" y "filas").', 400);
      if (JSON.stringify(l).length > MAX_BYTES) throw error('La lista es demasiado grande.', 413);
      await escribirJson(LISTA, { meta: { actualizado: ahora(), por: yo.correo }, cab: l.cab, filas: l.filas, ids: Array.isArray(l.ids) ? l.ids : undefined });
      res.status(200).json({ ok: true, filas: l.filas.length });
      return;
    }
    throw error(`Acción desconocida: ${accion}`, 400);
  } catch (e) {
    res.status(e.status || 500).json({ error: e instanceof Error ? e.message : String(e) });
  }
};
