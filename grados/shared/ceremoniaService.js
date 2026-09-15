// grados/shared/ceremoniaService.js

import { getListItems, createListItem, updateListItem, getListItemById } from "../../shared/graphClient.js";
import { LISTS } from "../../shared/spConfig.js";

function mapCeremonia(item) {
  const f = item.fields;
  return {
    id: item.id,
    nombre: f.Title,
    fechaCeremonia: f.FechaCeremonia,
    inicioRecepcion: f.InicioRecepcion,
    cierreRecepcion: f.CierreRecepcion,
    estado: f.Estado,
  };
}

export async function listarCeremonias() {
  // No usamos $orderby en la petición: Graph lo rechaza en columnas
  // no indexadas de SharePoint. Ordenamos aquí mismo, en JavaScript.
  const items = await getListItems(LISTS.CEREMONIAS);
  const ceremonias = items.map(mapCeremonia);
  ceremonias.sort((a, b) => new Date(b.fechaCeremonia) - new Date(a.fechaCeremonia));
  return ceremonias;
}

export async function listarCeremoniasVigentes() {
  const now = new Date().toISOString();
  const items = await getListItems(
    LISTS.CEREMONIAS,
    `&$filter=fields/InicioRecepcion le '${now}' and fields/CierreRecepcion ge '${now}' and fields/Estado eq 'Activa'`
  );
  return items.map(mapCeremonia);
}

export async function crearCeremonia(data, usuario) {
  const created = await createListItem(LISTS.CEREMONIAS, {
    Title: data.nombre,
    FechaCeremonia: data.fechaCeremonia,
    InicioRecepcion: data.inicioRecepcion,
    CierreRecepcion: data.cierreRecepcion,
    Estado: data.estado || "Activa",
  });

  await createListItem(LISTS.HISTORIAL_CEREMONIAS, {
    Title: `Creación - ${data.nombre}`,
    CeremoniaId: String(created.id),
    Accion: "CREACION",
    UsuarioResponsable: usuario,
    FechaCambio: new Date().toISOString(),
    Detalle: JSON.stringify(data),
  });

  return mapCeremonia(created);
}

export async function actualizarCeremonia(itemId, data, usuario) {
  const antes = await getListItemById(LISTS.CEREMONIAS, itemId);

  await updateListItem(LISTS.CEREMONIAS, itemId, {
    Title: data.nombre,
    FechaCeremonia: data.fechaCeremonia,
    InicioRecepcion: data.inicioRecepcion,
    CierreRecepcion: data.cierreRecepcion,
    Estado: data.estado,
  });

  await createListItem(LISTS.HISTORIAL_CEREMONIAS, {
    Title: `Modificación - ${data.nombre}`,
    CeremoniaId: String(itemId),
    Accion: "MODIFICACION",
    UsuarioResponsable: usuario,
    FechaCambio: new Date().toISOString(),
    Detalle: JSON.stringify({ antes: antes.fields, despues: data }),
  });

  const actualizado = await getListItemById(LISTS.CEREMONIAS, itemId);
  return mapCeremonia(actualizado);
}

export async function historialDeCeremonia(ceremoniaId) {
  const items = await getListItems(
    LISTS.HISTORIAL_CEREMONIAS,
    `&$filter=fields/CeremoniaId eq '${ceremoniaId}'`
  );
  const historial = items.map((i) => ({
    accion: i.fields.Accion,
    usuario: i.fields.UsuarioResponsable,
    fecha: i.fields.FechaCambio,
  }));
  historial.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  return historial;
}
