/**
 * api/roles.js
 *
 * Por que existe: hasta ahora, para saber su rol al iniciar sesion, el
 * propio navegador de CADA persona le preguntaba directamente a SharePoint
 * (con su propia cuenta, permiso delegado Sites.ReadWrite.All) por la lista
 * "ENAP_Permisos_Usuarios". Eso significaba que, ademas de estar en esa
 * lista con un rol activo, la persona TAMBIEN tenia que ser miembro del
 * sitio de SharePoint "TitulacionENAP" -- si no, Graph le devolvia 403 antes
 * de siquiera llegar a leer la lista. Ese no es el diseño querido: la lista
 * de permisos deberia ser la UNICA puerta de entrada al Portal, no un
 * requisito extra encima de la membresia del sitio.
 *
 * Este endpoint corre en el servidor con credenciales de APLICACION
 * (client credentials -- las mismas GRAPH_TENANT_ID/GRAPH_CLIENT_ID/
 * GRAPH_CLIENT_SECRET que ya usa el proyecto hermano "titulacion"), que
 * SIEMPRE tienen acceso al sitio sin importar quien haya iniciado sesion en
 * el navegador. Asi, cualquier persona con cuenta institucional que este
 * agregada en ENAP_Permisos_Usuarios con Estado=Activo puede entrar al
 * Portal, sin que nadie tenga que agregarla ademas como miembro de ningun
 * sitio de SharePoint.
 *
 * Seguridad: como este endpoint no requiere membresia de sitio, para que no
 * cualquiera pueda preguntar "que rol tiene fulano@enap.edu.co" sin haber
 * iniciado sesion, el navegador manda tambien el token de acceso de
 * Microsoft (scope User.Read, el mismo que ya pedia para leer /me) que
 * recibio al iniciar sesion. Este endpoint valida ese token contra
 * Microsoft Graph (/me) y solo responde si el correo de esa cuenta
 * autenticada coincide con el correo por el que se pregunta -- nunca
 * devuelve el rol de otra persona.
 */

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const SITE_HOSTNAME = 'escuelanaval.sharepoint.com';
const DEFAULT_SITE_PATH = 'sites/TitulacionENAP';
const LISTA_PERMISOS = 'ENAP_Permisos_Usuarios';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function errorConEstado(mensaje, status, detail) {
  const error = new Error(mensaje);
  error.status = status || 500;
  if (detail !== undefined) error.detail = detail;
  return error;
}

/* ------------------------------ Autenticacion app-only -------------------- */

let cachedToken = null; // { value, expiresAt }

async function getAppAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }
  const { GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET } = process.env;
  if (!GRAPH_TENANT_ID || !GRAPH_CLIENT_ID || !GRAPH_CLIENT_SECRET) {
    throw errorConEstado(
      'Faltan GRAPH_TENANT_ID, GRAPH_CLIENT_ID o GRAPH_CLIENT_SECRET en las variables de entorno de este proyecto de Vercel.',
      500,
    );
  }
  const body = new URLSearchParams({
    client_id: GRAPH_CLIENT_ID,
    client_secret: GRAPH_CLIENT_SECRET,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });
  const resp = await fetch(`https://login.microsoftonline.com/${GRAPH_TENANT_ID}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!resp.ok) {
    throw errorConEstado(`No se pudo autenticar con Microsoft Graph (${resp.status}): ${await resp.text()}`, 502);
  }
  const data = await resp.json();
  cachedToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.value;
}

/* -------------------------- Validacion de identidad ------------------------ */

/** Confirma que el token de USUARIO recibido corresponde de verdad al correo por el que se pregunta. */
async function validarCorreoAutenticado(userAccessToken, correoEsperado) {
  const resp = await fetch(`${GRAPH_BASE}/me`, { headers: { Authorization: `Bearer ${userAccessToken}` } });
  if (!resp.ok) {
    throw errorConEstado('El token de sesión de Microsoft no es válido o expiró. Vuelva a iniciar sesión.', 401);
  }
  const perfil = await resp.json();
  const correoReal = String(perfil.mail || perfil.userPrincipalName || '').trim().toLowerCase();
  if (!correoReal || correoReal !== String(correoEsperado || '').trim().toLowerCase()) {
    throw errorConEstado('El correo autenticado no coincide con el correo consultado.', 403);
  }
}

/* ------------------------------ Sitio / lista ------------------------------ */

let cachedSiteId = null;

async function resolveSiteId(token) {
  if (cachedSiteId) return cachedSiteId;
  const { GRAPH_SITE_ID, GRAPH_SITE_PATH } = process.env;
  if (GRAPH_SITE_ID) {
    cachedSiteId = GRAPH_SITE_ID.trim();
    return cachedSiteId;
  }
  const ruta = (GRAPH_SITE_PATH && GRAPH_SITE_PATH.trim()) || DEFAULT_SITE_PATH;
  const resp = await fetch(`${GRAPH_BASE}/sites/${SITE_HOSTNAME}:/${ruta.replace(/^\/+|\/+$/g, '')}:`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) {
    throw errorConEstado(`No se pudo resolver el sitio de SharePoint "${ruta}" (${resp.status}).`, 502, await resp.text());
  }
  const data = await resp.json();
  cachedSiteId = data.id;
  return cachedSiteId;
}

let cachedListId = null;

function normalizar(texto) {
  return String(texto || '').trim().toLowerCase();
}

/**
 * OJO: una busqueda directa por nombre (GET /sites/{id}/lists/{nombre}) exige
 * una coincidencia EXACTA contra el campo interno "name" de la lista, que en
 * SharePoint puede ser distinto de su "displayName" visible (por ejemplo si
 * la lista se creo con un nombre y luego se le cambio el titulo, o si se
 * genero un sufijo interno al moverla/copiarla de sitio). Eso fue lo que
 * causaba el error real reportado: "No se encontro la lista
 * ENAP_Permisos_Usuarios en el sitio (404)" aunque la lista sí existiera con
 * ese titulo visible. En su lugar, se enumeran TODAS las listas del sitio y
 * se busca coincidencia por "name" O "displayName" (normalizados), igual que
 * ya hace de forma probada el proyecto hermano "titulacion" en
 * api/_lib/graphSharePoint.js.
 */
async function resolveListId(token, siteId) {
  if (cachedListId) return cachedListId;
  const objetivo = normalizar(LISTA_PERMISOS);
  const listas = [];
  let url = `${GRAPH_BASE}/sites/${siteId}/lists?$select=id,name,displayName&$top=200`;
  while (url) {
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!resp.ok) {
      throw errorConEstado(`No se pudieron listar las listas del sitio (${resp.status}).`, 502, await resp.text());
    }
    const data = await resp.json();
    listas.push(...(data.value || []));
    url = data['@odata.nextLink'] || null;
  }
  const encontrada = listas.find(
    (l) => normalizar(l.name) === objetivo || normalizar(l.displayName) === objetivo,
  );
  if (!encontrada) {
    const disponibles = listas.map((l) => l.displayName || l.name).filter(Boolean).join(', ') || '(el sitio no tiene listas visibles con estas credenciales)';
    throw errorConEstado(
      `No se encontró la lista "${LISTA_PERMISOS}" en el sitio. Listas disponibles: ${disponibles}.`,
      502,
    );
  }
  cachedListId = encontrada.id;
  return cachedListId;
}

async function leerFilas(token, siteId, listaId) {
  const filas = [];
  let url = `${GRAPH_BASE}/sites/${siteId}/lists/${listaId}/items?expand=fields&$top=200`;
  while (url) {
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!resp.ok) {
      throw errorConEstado(`No se pudo leer la lista "${LISTA_PERMISOS}" (${resp.status}).`, 502, await resp.text());
    }
    const data = await resp.json();
    filas.push(...(data.value || []));
    url = data['@odata.nextLink'] || null;
  }
  return filas;
}

/** Mismo esquema real que ya usa el resto del Portal: Title=correo, Rol, Estado="Activo"/"Inactivo". */
function rolesActivosPara(filas, correo) {
  const objetivo = correo.trim().toLowerCase();
  const roles = filas
    .map((f) => f.fields || {})
    .filter((c) => {
      const correoFila = String(c.Title || '').trim().toLowerCase();
      const estado = String(c.Estado || '').trim().toLowerCase();
      return correoFila === objetivo && estado === 'activo';
    })
    .map((c) => String(c.Rol || c.Role || '').trim().toUpperCase())
    .filter(Boolean);
  return Array.from(new Set(roles));
}

/* --------------------------------- Handler --------------------------------- */

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido: use POST.' });
    return;
  }

  const payload = typeof req.body === 'object' && req.body ? req.body : {};
  const correo = payload.correo;
  const userAccessToken = payload.accessToken;

  if (!correo || !userAccessToken) {
    res.status(400).json({ error: 'Faltan "correo" o "accessToken" en la solicitud.' });
    return;
  }

  try {
    await validarCorreoAutenticado(userAccessToken, correo);
    const appToken = await getAppAccessToken();
    const siteId = await resolveSiteId(appToken);
    const listaId = await resolveListId(appToken, siteId);
    const filas = await leerFilas(appToken, siteId, listaId);
    const roles = rolesActivosPara(filas, correo);
    res.status(200).json({ roles });
  } catch (error) {
    const status = error && error.status ? error.status : 500;
    res.status(status).json({
      error: error instanceof Error ? error.message : String(error),
      detail: error && error.detail ? error.detail : undefined,
    });
  }
}
