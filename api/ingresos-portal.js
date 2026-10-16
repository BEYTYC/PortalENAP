/**
 * api/ingresos-portal.js
 *
 * Bitácora de ingresos al Portal ENAP: quién entró o intentó entrar y a qué hora.
 *
 *   accion "registrar"  Cualquier cuenta con sesión de Microsoft válida. El Portal
 *                       la llama al iniciar sesión (o al restaurarla). La identidad
 *                       sale del token, nunca de lo que diga el navegador; el
 *                       resultado se calcula aquí (Ingresó / Bloqueada / Cuenta no
 *                       institucional).
 *   accion "listar"     Solo los administradores fijos (ADMINS). Devuelve los eventos.
 *
 * Se guarda en SharePoint (carpeta PortalAccesos/ingresos.json), nunca en el repo.
 * Un mismo resultado de la misma cuenta se registra una sola vez cada 10 minutos
 * para que recargar la página no llene la bitácora. Se conservan los últimos 5000.
 */

const roles = require('./roles.js');

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const DOMINIO = '@enap.edu.co';
const ADMINS = ['sea@enap.edu.co', 'jestadisticaplen@enap.edu.co'];
const RUTA = 'PortalAccesos/ingresos.json';
const MAX_EVENTOS = 5000;
const VENTANA_MS = 10 * 60 * 1000;

function error(mensaje, status) {
  const e = new Error(mensaje);
  e.status = status || 500;
  return e;
}

async function identificar(accessToken) {
  const resp = await fetch(`${GRAPH_BASE}/me`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!resp.ok) throw error('La sesión de Microsoft no es válida o expiró.', 401);
  const p = await resp.json();
  const correo = String(p.mail || p.userPrincipalName || '').trim().toLowerCase();
  if (!correo) throw error('La cuenta no tiene un correo asociado.', 403);
  return { correo, nombre: p.displayName || correo };
}

async function leer(token, siteId) {
  const r = await fetch(`${GRAPH_BASE}/sites/${siteId}/drive/root:/${RUTA}:/content`, { headers: { Authorization: `Bearer ${token}` } });
  if (r.status === 404) return [];
  if (!r.ok) throw error(`No se pudo leer la bitácora (${r.status}).`, 502);
  const j = await r.json();
  return Array.isArray(j.eventos) ? j.eventos : [];
}

async function escribir(token, siteId, eventos) {
  const r = await fetch(`${GRAPH_BASE}/sites/${siteId}/drive/root:/${RUTA}:/content`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventos }),
  });
  if (!r.ok) throw error(`No se pudo guardar la bitácora (${r.status}).`, 502);
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Use POST.' }); return; }

  const { accessToken, accion } = typeof req.body === 'object' && req.body ? req.body : {};
  try {
    if (!accessToken || !accion) throw error('Faltan "accessToken" o "accion".', 400);
    const yo = await identificar(accessToken);
    const token = await roles.getAppAccessToken();
    const siteId = await roles.resolveSiteId(token);

    if (accion === 'registrar') {
      let resultado = 'Ingresó';
      if (roles.CORREOS_BLOQUEADOS.includes(yo.correo)) resultado = 'Bloqueada';
      else if (!yo.correo.endsWith(DOMINIO)) resultado = 'Cuenta no institucional';
      const eventos = await leer(token, siteId);
      const ahora = Date.now();
      const repetido = eventos.some((e) => e.correo === yo.correo && e.resultado === resultado && ahora - Date.parse(e.fecha) < VENTANA_MS);
      if (!repetido) {
        eventos.push({ fecha: new Date(ahora).toISOString(), correo: yo.correo, nombre: yo.nombre, resultado });
        await escribir(token, siteId, eventos.slice(-MAX_EVENTOS));
      }
      res.status(200).json({ ok: true });
      return;
    }

    if (accion === 'listar') {
      if (!ADMINS.includes(yo.correo)) throw error('Solo los administradores pueden ver la bitácora.', 403);
      const eventos = await leer(token, siteId);
      res.status(200).json({ eventos: eventos.slice().reverse() });
      return;
    }

    throw error(`Acción desconocida: ${accion}`, 400);
  } catch (e) {
    res.status(e.status || 500).json({ error: e instanceof Error ? e.message : String(e) });
  }
};
