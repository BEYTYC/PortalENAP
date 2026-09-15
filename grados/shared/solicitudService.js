// grados/shared/solicitudService.js

import { getListItems, createListItem } from "../../shared/graphClient.js";
import { LISTS } from "../../shared/spConfig.js";

async function generarRadicado(ceremoniaId) {
  const year = new Date().getFullYear();
  const existentes = await getListItems(
    LISTS.SOLICITUDES,
    `&$filter=fields/CeremoniaId eq '${ceremoniaId}'`
  );
  const consecutivo = String(existentes.length + 1).padStart(4, "0");
  return `GR-${year}-${ceremoniaId}-${consecutivo}`;
}

export async function crearSolicitud(data) {
  const radicado = await generarRadicado(data.ceremoniaId);

  await createListItem(LISTS.SOLICITUDES, {
    Title: radicado,
    CeremoniaId: String(data.ceremoniaId),
    NombreCompleto: data.nombreCompleto,
    Documento: data.documento,
    Correo: data.correo,
    Telefono: data.telefono,
    Programa: data.programa,
    AceptaTratamientoDatos: data.aceptaTratamientoDatos,
    FirmaNombre: data.firmaNombre,
    FechaAceptacion: data.fechaAceptacion,
    Estado: "Radicada",
    FechaRadicacion: new Date().toISOString(),
  });

  return radicado;
}
