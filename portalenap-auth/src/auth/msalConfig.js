/**
 * auth/msalConfig.js
 *
 * Configuración de MSAL.js para el login delegado (interactivo) de
 * PortalENAP contra Microsoft Entra ID. Este es un App Registration
 * DISTINTO al que usan las funciones de envío de correo (esas usan
 * client-credentials, sin usuario; este es un login real de persona).
 *
 * Nada en este archivo es secreto: el Client ID y el Tenant ID son
 * identificadores públicos, seguros de tener en el código del navegador.
 * Lo que NUNCA debe ir aquí (ni en ningún archivo de frontend) es un
 * client secret — eso es exclusivo de flujos de servidor (backend).
 */

export const msalConfig = {
  auth: {
    clientId: 'd0326150-ca40-47f0-87cb-201c9fc721cd',
    authority: 'https://login.microsoftonline.com/f53f66b3-ea23-461a-b6ff-01654042a799',
    // Debe coincidir EXACTAMENTE con un Redirect URI registrado en el App
    // Registration (Azure Portal → Autenticación → Redirect URIs, tipo SPA).
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
};

/**
 * Scopes mínimos necesarios:
 *  - User.Read: perfil básico del usuario autenticado (/me).
 *  - Sites.Selected: lectura de UN sitio de SharePoint específico,
 *    autorizado explícitamente en Azure Portal. Es el permiso de MENOR
 *    privilegio para leer una lista de SharePoint.
 *
 * Si en el App Registration todavía no se ha configurado el acceso
 * granular de Sites.Selected para 'escuelanaval.sharepoint.com', el
 * respaldo temporal es 'Sites.Read.All' (delegado) — pero eso abre
 * lectura a TODOS los sitios del tenant, así que debe tratarse como algo
 * a estrechar, no como destino final.
 */
export const loginRequest = {
  scopes: ['User.Read', 'Sites.Selected'],
};

export const graphSharePointRequest = {
  scopes: ['Sites.Selected'],
};
