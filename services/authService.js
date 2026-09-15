// src/services/authService.js

import { PublicClientApplication } from "@azure/msal-browser";
import { msalConfig, loginRequest, graphConfig } from "../auth/msalConfig";

export const msalInstance = new PublicClientApplication(msalConfig);

const SHAREPOINT_SITE = "https://escuelanaval.sharepoint.com";
const LIST_NAME = "ENAP_Permisos_Usuarios";

async function callGraphApi(endpoint, accessToken) {
  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Graph API error (${response.status}): ${errorBody}`);
  }

  return response.json();
}

async function getAccessToken(scopes) {
  const account = msalInstance.getAllAccounts()[0];
  if (!account) {
    throw new Error("No hay una cuenta autenticada activa.");
  }

  try {
    const result = await msalInstance.acquireTokenSilent({
      scopes,
      account,
    });
    return result.accessToken;
  } catch (silentError) {
    const result = await msalInstance.acquireTokenPopup({
      scopes,
      account,
    });
    return result.accessToken;
  }
}

async function getAuthenticatedUser() {
  const accessToken = await getAccessToken(loginRequest.scopes);
  const profile = await callGraphApi(graphConfig.graphMeEndpoint, accessToken);
  return {
    profile,
    accessToken,
  };
}

async function getSiteId(accessToken, siteUrl) {
  const url = new URL(siteUrl);
  const hostname = url.hostname;
  const sitePath = url.pathname;

  const endpoint = `https://graph.microsoft.com/v1.0/sites/${hostname}:${sitePath}`;
  const site = await callGraphApi(endpoint, accessToken);
  return site.id;
}

async function getUserRolesFromSharePoint(userEmail, accessToken) {
  const siteId = await getSiteId(accessToken, SHAREPOINT_SITE);

  const endpoint =
    `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${LIST_NAME}/items` +
    `?expand=fields&$top=999`;

  const data = await callGraphApi(endpoint, accessToken);
  const items = data.value || [];

  const normalizedEmail = userEmail.trim().toLowerCase();

  const activeRoleRows = items.filter((item) => {
    const fields = item.fields || {};
    const rowEmail = (fields.Title || "").trim().toLowerCase();
    const rowEstado = (fields.Estado || "").trim().toLowerCase();
    return rowEmail === normalizedEmail && rowEstado === "activo";
  });

  const roles = activeRoleRows
    .map((row) => row.fields.Rol)
    .filter((rol) => Boolean(rol))
    .map((rol) => rol.trim().toUpperCase());

  const uniqueRoles = [...new Set(roles)];

  return uniqueRoles;
}

export async function login() {
  const loginResponse = await msalInstance.loginPopup(loginRequest);
  msalInstance.setActiveAccount(loginResponse.account);

  const { profile, accessToken } = await getAuthenticatedUser();
  const userEmail = profile.mail || profile.userPrincipalName;

  const roles = await getUserRolesFromSharePoint(userEmail, accessToken);

  if (roles.length === 0) {
    throw new Error(
      "Su cuenta no tiene roles activos asignados en el Portal ENAP. Contacte al administrador."
    );
  }

  return {
    user: {
      displayName: profile.displayName,
      email: userEmail,
      jobTitle: profile.jobTitle || null,
    },
    roles,
  };
}

export function logout() {
  const account = msalInstance.getAllAccounts()[0];
  return msalInstance.logoutPopup({ account });
}

export function hasRole(userRoles, requiredRoles) {
  if (!Array.isArray(userRoles)) return false;
  return requiredRoles.some((role) => userRoles.includes(role));
}
