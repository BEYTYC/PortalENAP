// src/auth/msalConfig.js

export const msalConfig = {
  auth: {
    clientId: "be68b5b7-e7eb-45e2-98f4-e5ffd8888ce6",
    authority: "https://login.microsoftonline.com/common",
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
    navigateToLoginRequestUrl: true,
  },
  cache: {
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      loggerCallback: () => {},
      logLevel: "Error",
    },
  },
};

export const loginRequest = {
  scopes: ["User.Read", "Sites.Read.All"],
};

export const graphConfig = {
  graphMeEndpoint: "https://graph.microsoft.com/v1.0/me",
};
