/**
 * services/authService.js
 *
 * Resuelve, a partir de una sesión MSAL ya iniciada, la lista de ROLES
 * activos del usuario autenticado, leyendo la lista de SharePoint
 * 'ENAP_Permisos_Usuarios' en el sitio raíz de la escuela.
 *
 * Este archivo NO decide qué puede hacer cada rol (eso vive en las
 * pantallas/backend que consumen el resultado) — solo responde a la
 * pregunta "¿quién es este usuario y qué roles activos tiene asignados?".
 */

import { PublicClientApplication, InteractionRequiredAuthError } from '@azure/msal-browser';
import { msalConfig, loginRequest, graphSharePointRequest } from '../auth/msalConfig';

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const SHAREPOINT_HOSTNAME = 'escuelanaval.sharepoint.com';
const LISTA_PERMISOS = 'ENAP_Permisos_Usuarios';

let msalInstance = null;

/** Instancia única de MSAL, inicializada una sola vez por sesión de navegador. */
export async function obtenerMsalInstance() {
  if (msalInstance) return msalInstance;
  msalInstance = new PublicClientApplication(msalConfig);
  await msalInstance.initialize();
  return msalInstance;
}

/** Cuenta actualmente en caché (si el usuario ya inició sesión antes). */
export async function obtenerCuentaActiva() {
  const instance = await obtenerMsalInstance();
  const cuentas = instance.getAllAccounts();
  return cuentas.length > 0 ? cuentas[0] : null;
}

/**
 * Adquiere un token para los scopes pedidos: primero en silencio (si ya
 * hay una sesión válida), y si eso falla por requerir interacción, abre
 * el popup de login.
 */
async function adquirirToken(scopes, cuenta) {
  const instance = await obtenerMsalInstance();
  const request = { scopes, account: cuenta };

  try {
    const resultado = await instance.acquireTokenSilent(request);
    return resultado.accessToken;
  } catch (error) {
    if (error instanceof InteractionRequiredAuthError) {
      const resultado = await instance.acquireTokenPopup(request);
      return resultado.accessToken;
    }
    throw new Error(`No se pudo obtener el token de acceso: ${error.message}`);
  }
}

/** Dispara el login interactivo (popup) y devuelve la cuenta autenticada. */
export async function iniciarSesion() {
  const instance = await obtenerMsalInstance();
  const resultado = await instance.loginPopup(loginRequest);
  return resultado.account;
}

export async function cerrarSesion() {
  const instance = await obtenerMsalInstance();
  const cuenta = await obtenerCuentaActiva();
  if (cuenta) {
    await instance.logoutPopup({ account: cuenta });
  }
}

/** Perfil del usuario autenticado vía Graph /me. */
async function obtenerPerfilGraph(cuenta) {
  const token = await adquirirToken(loginRequest.scopes, cuenta);
  const resp = await fetch(`${GRAPH_BASE}/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) {
    throw new Error(`No se pudo consultar el perfil en Microsoft Graph (${resp.status}).`);
  }
  return resp.json();
}

/** Resuelve dinámicamente el Site ID de SharePoint (no se hardcodea). */
async function resolverSiteId(cuenta) {
  const token = await adquirirToken(graphSharePointRequest.scopes, cuenta);
  const resp = await fetch(`${GRAPH_BASE}/sites/${SHAREPOINT_HOSTNAME}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) {
    throw new Error(`No se pudo resolver el sitio de SharePoint "${SHAREPOINT_HOSTNAME}" (${resp.status}).`);
  }
  const data = await resp.json();
  return data.id;
}

/** Resuelve dinámicamente el List ID de 'ENAP_Permisos_Usuarios' dentro del sitio. */
async function resolverListaId(siteId, cuenta) {
  const token = await adquirirToken(graphSharePointRequest.scopes, cuenta);
  const resp = await fetch(
    `${GRAPH_BASE}/sites/${siteId}/lists/${encodeURIComponent(LISTA_PERMISOS)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!resp.ok) {
    throw new Error(`No se pudo encontrar la lista "${LISTA_PERMISOS}" en el sitio (${resp.status}).`);
  }
  const data = await resp.json();
  return data.id;
}

/**
 * Lee TODOS los ítems de la lista de permisos (con sus valores de campo),
 * paginando si Graph devuelve @odata.nextLink.
 */
async function leerFilasPermisos(siteId, listaId, cuenta) {
  const token = await adquirirToken(graphSharePointRequest.scopes, cuenta);
  let url = `${GRAPH_BASE}/sites/${siteId}/lists/${listaId}/items?expand=fields`;
  const filas = [];

  while (url) {
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!resp.ok) {
      throw new Error(`No se pudo leer la lista "${LISTA_PERMISOS}" (${resp.status}).`);
    }
    const data = await resp.json();
    filas.push(...(data.value ?? []));
    url = data['@odata.nextLink'] ?? null;
  }

  return filas;
}

/**
 * Agrupa/normaliza los roles de las filas que correspondan al correo dado
 * y estén marcadas como activas. Ajustar los nombres de campo
 * (Correo/Email, Rol, Activo) a como estén realmente creados en la lista
 * de SharePoint — son mi mejor suposición, hay que confirmarlos contra la
 * lista real.
 */
function normalizarRoles(filas, correoUsuario) {
  const correoNormalizado = correoUsuario.trim().toLowerCase();

  const rolesActivos = filas
    .map((fila) => fila.fields ?? {})
    .filter((campos) => {
      const correoFila = String(campos.Correo ?? campos.Email ?? '').trim().toLowerCase();
      const activo = campos.Activo === true || campos.Activo === 'Sí' || campos.Activo === 1;
      return correoFila === correoNormalizado && activo;
    })
    .map((campos) => String(campos.Rol ?? campos.Role ?? '').trim().toUpperCase())
    .filter((rol) => rol.length > 0);

  return Array.from(new Set(rolesActivos));
}

/**
 * Punto de entrada principal: dado un usuario ya autenticado con MSAL,
 * devuelve { perfil, roles }. Lanza un error descriptivo si el usuario
 * no tiene roles activos asignados en la lista.
 */
export async function obtenerRolesUsuario(cuenta) {
  const perfil = await obtenerPerfilGraph(cuenta);
  const correo = perfil.mail || perfil.userPrincipalName;

  if (!correo) {
    throw new Error('El usuario autenticado no tiene un correo asociado en su perfil de Microsoft.');
  }

  const siteId = await resolverSiteId(cuenta);
  const listaId = await resolverListaId(siteId, cuenta);
  const filas = await leerFilasPermisos(siteId, listaId, cuenta);
  const roles = normalizarRoles(filas, correo);

  if (roles.length === 0) {
    throw new Error(
      `El usuario "${correo}" no tiene roles activos asignados en "${LISTA_PERMISOS}". ` +
      'Contacte al administrador del Portal para que le asigne un rol.',
    );
  }

  return { perfil, roles };
}

/**
 * Flujo completo: login interactivo + resolución de roles, en una sola
 * llamada, pensado para usarse directamente desde LoginAdmin.jsx.
 */
export async function iniciarSesionYObtenerRoles() {
  const cuenta = await iniciarSesion();
  return obtenerRolesUsuario(cuenta);
}

/**
 * Intento de retomar una sesión ya existente (por ejemplo al recargar la
 * página) sin abrir el popup: si hay una cuenta en caché, resuelve sus
 * roles en silencio; si no hay cuenta, devuelve null sin error.
 */
export async function retomarSesion() {
  const cuenta = await obtenerCuentaActiva();
  if (!cuenta) return null;
  return obtenerRolesUsuario(cuenta);
}
