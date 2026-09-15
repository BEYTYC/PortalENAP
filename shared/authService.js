// shared/authService.js

import { msalInstance, loginScopes, msalReady } from "./msalConfig.js";
import { getListItems } from "./graphClient.js";
import { LISTS } from "./spConfig.js";

export async function login() {
  await msalReady;

  const loginResponse = await msalInstance.loginPopup({ scopes: loginScopes });
  msalInstance.setActiveAccount(loginResponse.account);

  const graphMe = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${loginResponse.accessToken}` },
  }).then((r) => r.json());

  const email = graphMe.mail || graphMe.userPrincipalName;
  const roles = await obtenerRoles(email);

  return {
    user: { displayName: graphMe.displayName, email },
    roles,
  };
}

export async function obtenerRoles(email) {
  const normalizado = email.trim().toLowerCase();
  const items = await getListItems(
    LISTS.PERMISOS,
    `&$filter=fields/Estado eq 'Activo'`
  );

  const roles = items
    .filter((i) => (i.fields.Title || "").trim().toLowerCase() === normalizado)
    .map((i) => (i.fields.Rol || "").trim().toUpperCase())
    .filter(Boolean);

  return [...new Set(roles)];
}

export function hasRole(userRoles, requiredRoles) {
  return requiredRoles.some((r) => userRoles.includes(r));
}

export async function logout() {
  await msalReady;
  const account = msalInstance.getAllAccounts()[0];
  return msalInstance.logoutPopup({ account });
}
