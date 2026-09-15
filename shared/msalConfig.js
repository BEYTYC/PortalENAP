// shared/msalConfig.js
// Requiere que en el <head> del HTML ya esté cargado:
// <script src="https://alcdn.msauth.net/browser/3.7.0/js/msal-browser.min.js"></script>

export const msalConfig = {
  auth: {
    clientId: "be68b5b7-e7eb-45e2-98f4-e5ffd8888ce6",
    authority: "https://login.microsoftonline.com/common",
    // Redirección fija que coincide EXACTO con la ya registrada en Azure AD.
    // Como el login es tipo popup, no importa desde qué página lo inicies:
    // siempre "aterriza" aquí y el popup se cierra solo.
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
