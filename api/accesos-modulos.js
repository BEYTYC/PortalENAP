/*!
 * Portal de Servicios Digitales Estadística — Escuela Naval de Cadetes "Almirante Padilla"
 * Autora y desarrolladora: CAMARGO MARTÍNEZ BEYTY PATRICIA — Oficina de Estadística
 * Derechos morales de autor reservados (Ley 23 de 1982, art. 30). Este aviso de autoría no debe eliminarse ni alterarse.
 */
/**
 * api/accesos-modulos.js
 *
 * Módulos que un administrador habilita, uno por uno, a cada correo. Se SUMAN a lo que ya da el rol
 * (ENAP_Permisos_Usuarios). Las descargas de Excel no se manejan aquí: siguen controladas aparte.
 * La lista vive en SharePoint (Accesos/accesos-modulos.json), nunca en el repositorio.
 *
 *   POST { accessToken, accion: 'mios' }                          -> { modulos: [...] } del que consulta
 *   POST { accessToken, accion: 'listar' }                        -> solo admin: catálogo y usuarios
 *   POST { accessToken, accion: 'guardar', objetivo, modulos }    -> solo admin
 */
const roles = require('./roles.js');

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const RUTA = 'Accesos/accesos-modulos.json';
const SUPERADMINS = ['jestadisticaplen@enap.edu.co'];
/* Módulos del menú que se pueden habilitar por correo (mismos nombres que el menú del Portal). */
const MODULOS = [
  'Aprobación de Grados',
  'Generación de Balances Académicos',
  'Generación de Promedios Académicos',
  'Registro Cursos de Extensión',
  'Registro de bajas',
  'Aprobación de Concesiones',
  'Aprobación de Certificados',
  'Centro de Datos ENAP',
  'Antigüedades ENAP',
  'Trayectoria del Estudiante',
];

function error(m, status) { const e = new Error(m); e.status = status || 500; return e; }

let cache = null; // { t, data }
async function leer(forzar) {
  if (!forzar && cache && Date.now() - cache.t < 30000) return cache.data;
  const t = await roles.getAppAccessToken(), sid = await roles.resolveSiteId(t);
  const r = await fetch(`${GRAPH_BASE}/sites/${sid}/drive/root:/${RUTA}:/content`, { headers: { Authorization: `Bearer ${t}` } });
  let data = { usuarios: {} };
  if (r.status !== 404) {
    if (!r.ok) throw error(`No se pudo leer los accesos por módulo (${r.status}).`, 502);
    data = await r.json();
    if (!data || typeof data.usuarios !== 'object' || !data.usuarios) data = { usuarios: {} };
  }
  cache = { t: Date.now(), data };
  return data;
}
async function escribir(data) {
  const t = await roles.getAppAccessToken(), sid = await roles.resolveSiteId(t);
  const r = await fetch(`${GRAPH_BASE}/sites/${sid}/drive/root:/${RUTA}:/content`, { method: 'PUT', headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  if (!r.ok) throw error(`No se pudo guardar los accesos por módulo (${r.status}). ${(await r.text()).slice(0, 200)}`, 502);
  cache = { t: Date.now(), data };
}

/** Módulos habilitados a un correo (vacío si falla la lectura: nunca bloquea el ingreso por rol). */
async function modulosDe(correo) {
  try { const d = await leer(false); const u = d.usuarios[String(correo || '').trim().toLowerCase()]; return Array.isArray(u && u.modulos) ? u.modulos.filter((m) => MODULOS.includes(m)) : []; }
  catch (e) { return []; }
}
const tieneModulo = async (correo, nombre) => (await modulosDe(correo)).includes(nombre);

async function identificar(accessToken) {
  const r = await fetch(`${GRAPH_BASE}/me`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!r.ok) throw error('La sesión de Microsoft no es válida o expiró. Vuelva a iniciar sesión en el Portal.', 401);
  const p = await r.json();
  const correo = String(p.mail || p.userPrincipalName || '').trim().toLowerCase();
  if (!correo) throw error('La cuenta no tiene un correo asociado.', 403);
  return { correo, nombre: p.displayName || correo };
}
async function esAdmin(correo) {
  if (SUPERADMINS.includes(correo)) return true;
  const t = await roles.getAppAccessToken(), sid = await roles.resolveSiteId(t), lid = await roles.resolveListId(t, sid);
  return roles.rolesActivosPara(await roles.leerFilas(t, sid, lid), correo).includes('ADMIN');
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  try {
    if (req.method !== 'POST') throw error('Use POST.', 405);
    const b = typeof req.body === 'object' && req.body ? req.body : {};
    if (!b.accessToken || !b.accion) throw error('Faltan "accessToken" o "accion".', 400);
    const yo = await identificar(b.accessToken);
    if (!yo.correo.endsWith('@enap.edu.co') || roles.CORREOS_BLOQUEADOS.includes(yo.correo)) throw error('Esta cuenta no puede usar el Portal.', 403);
    if (b.accion === 'mios') { res.status(200).json({ modulos: await modulosDe(yo.correo) }); return; }
    if (!(await esAdmin(yo.correo))) throw error('Solo un administrador puede gestionar los módulos de cada usuario.', 403);
    if (b.accion === 'listar') { const d = await leer(true); res.status(200).json({ catalogo: MODULOS, usuarios: d.usuarios }); return; }
    if (b.accion === 'guardar') {
      const objetivo = String(b.objetivo || '').trim().toLowerCase();
      if (!/^[^@\s]+@enap\.edu\.co$/.test(objetivo)) throw error('El correo debe ser institucional (@enap.edu.co).', 400);
      const mods = Array.from(new Set((Array.isArray(b.modulos) ? b.modulos : []).filter((m) => MODULOS.includes(m))));
      const d = await leer(true);
      if (mods.length) d.usuarios[objetivo] = { modulos: mods, actualizado: new Date().toISOString(), por: yo.correo };
      else delete d.usuarios[objetivo];
      await escribir(d);
      res.status(200).json({ ok: true, objetivo, modulos: mods });
      return;
    }
    throw error('Acción desconocida.', 400);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || String(e) });
  }
};
module.exports.modulosDe = modulosDe;
module.exports.tieneModulo = tieneModulo;
module.exports.MODULOS = MODULOS;
