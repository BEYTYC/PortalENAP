/**
 * auth/msalConfig.js
 *
 * Configuración de MSAL.js para el login delegado (interactivo) de
 * PortalENAP contra Microsoft Entra ID. Este es un App Registration
 * DISTINTO al que usan api/enviar-codigo.js y api/notificar.js (esos usan
 * client-credentials, sin usuario; este es un login real de persona).
 *
 * Nada en este archivo es secreto: el Client ID y el Tenant ID son
 * identificadores públicos, seguros de tener en el código del navegador.
 * Lo que NUNCA debe ir aquí (ni en ningún archivo de frontend) es un
 * client secret — ese tipo de credencial es exclusiva de flujos de
 * servidor (backend), como los que ya usan los endpoints de correo.
 */

export const msalConfig = {
  auth: {
    clientId: 'd0326150-ca40-47f0-87cb-201c9fc721cd',
    authority: 'https://login.microsoftonline.com/f53f66b3-ea23-461a-b6ff-01654042a799',
    // Debe coincidir EXACTAMENTE con un Redirect URI registrado en el App
    // Registration (Azure Portal → Autenticación → Redirect URIs, tipo SPA).
    // Cambiar por la URL real de producción antes de publicar.
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
  },
  cache: {
    // sessionStorage es preferible a localStorage para tokens: se limpia
    // al cerrar la pestaña y reduce la ventana de exposición si el equipo
    // es compartido. MSAL maneja aquí solo tokens/caché de sesión, nunca
    // roles ni permisos de negocio (esos siempre se resuelven contra
    // SharePoint en cada sesión, no se guardan como verdad local).
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
};

/**
 * Scopes mínimos necesarios:
 *  - User.Read: perfil básico del usuario autenticado (/me).
 *  - Sites.Selected: lectura de UN sitio de SharePoint específico,
 *    autorizado explícitamente en Azure Portal (Enterprise Applications →
 *    API permissions → conceder acceso a este sitio puntual). Es el
 *    permiso de MENOR privilegio para leer una lista de SharePoint.
 *
 * Si en el App Registration todavía no se ha configurado el acceso
 * granular de Sites.Selected para el sitio 'escuelanaval.sharepoint.com',
 * el respaldo temporal es 'Sites.Read.All' (delegado) — pero eso abre
 * lectura a TODOS los sitios del tenant a los que el usuario ya tenga
 * acceso, así que debe tratarse como algo a estrechar, no como el
 * destino final. No agregar 'Sites.ReadWrite.All' ni permisos de
 * aplicación aquí "por si acaso": cualquier permiso adicional debe
 * justificarse antes de pedirse.
 */
export const loginRequest = {
  scopes: ['User.Read', 'Sites.Selected'],
};

// Scope específico para llamadas a Graph sobre SharePoint (silent/adquisición
// puntual de token cuando ya se hizo login).
export const graphSharePointRequest = {
  scopes: ['Sites.Selected'],
};
