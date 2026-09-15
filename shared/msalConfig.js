// shared/msalConfig.js
// Requiere que en el <head> del HTML ya esté cargado:
// <script src="https://cdn.jsdelivr.net/npm/@azure/msal-browser@3/lib/msal-browser.min.js"></script>

export const msalConfig = {
  auth: {
    clientId: "be68b5b7-e7eb-45e2-98f4-e5ffd8888ce6",
    authority: "https://login.microsoftonline.com/common",
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
// Este "promise" se exporta para que authService.js y graphClient.js
// esperen a que termine antes de hacer nada más.
export const msalReady = msalInstance.initialize();
