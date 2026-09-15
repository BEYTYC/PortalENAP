// shared/graphClient.js

import { msalInstance, loginScopes, msalReady } from "./msalConfig.js";
import { SHAREPOINT_SITE } from "./spConfig.js";

let cachedSiteId = null;

export async function getAccessToken() {
  await msalReady;

  const account = msalInstance.getAllAccounts()[0];
  if (!account) throw new Error("No hay una sesión activa.");

  try {
    const result = await msalInstance.acquireTokenSilent({
      scopes: loginScopes,
      account,
    });
    return result.accessToken;
  } catch {
    const result = await msalInstance.acquireTokenPopup({ scopes: loginScopes });
    return result.accessToken;
  }
}

async function graphFetch(endpoint, options = {}) {
  const token = await getAccessToken();
  const response = await fetch(`https://graph.microsoft.com/v1.0${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      // Necesario para poder filtrar ($filter) por columnas de SharePoint
      // que no están indexadas (como "Estado" o "Rol"). Sin esto, Graph
      // responde 400 Bad Request en cualquier consulta con $filter.
      "Prefer": "HonorNonIndexedQueriesWarningMayFailRandomly",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Error de SharePoint (${response.status}): ${body}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

async function getSiteId() {
  if (cachedSiteId) return cachedSiteId;
  const site = await graphFetch(`/sites/${SHAREPOINT_SITE}`);
  cachedSiteId = site.id;
  return cachedSiteId;
}

export async function getListItems(listName, query = "") {
  const siteId = await getSiteId();
  const data = await graphFetch(
    `/sites/${siteId}/lists/${listName}/items?expand=fields${query}`
  );
  return data.value || [];
}

export async function createListItem(listName, fields) {
  const siteId = await getSiteId();
  return graphFetch(`/sites/${siteId}/lists/${listName}/items`, {
    method: "POST",
    body: JSON.stringify({ fields }),
  });
}

export async function updateListItem(listName, itemId, fields) {
  const siteId = await getSiteId();
  return graphFetch(`/sites/${siteId}/lists/${listName}/items/${itemId}/fields`, {
    method: "PATCH",
    body: JSON.stringify(fields),
  });
}

export async function getListItemById(listName, itemId) {
  const siteId = await getSiteId();
  return graphFetch(`/sites/${siteId}/lists/${listName}/items/${itemId}?expand=fields`);
}
