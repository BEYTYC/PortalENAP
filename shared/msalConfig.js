// shared/msalConfig.js
// Requiere que en el <head> del HTML ya esté cargado:
// <script src="https://cdn.jsdelivr.net/npm/@azure/msal-browser@3/lib/msal-browser.min.js"></script>

export const msalConfig = {
  auth: {
    clientId: "d0326150-ca40-47f0-87cb-201c9fc721cd",
    // Apunta directo al tenant de la ENAP
    authority: "https://login.microsoftonline.com/f53f66b3-ea23-461a-b6ff-01654042a799",
    redirectUri: window.location.origin + "/",
  },
  cache: {
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: false,
  },
};

export const loginScopes = ["User.Read", "Sites.ReadWrite.All"];

// window.msal viene del script CDN cargado en el HTML
export const msalInstance = new window.msal.PublicClientApplication(msalConfig);

// A partir de la versión 3 de MSAL.js hay que inicializar antes de usar
// cualquier otro método (loginPopup, acquireTokenSilent, etc.).
export const msalReady = msalInstance.initialize();
