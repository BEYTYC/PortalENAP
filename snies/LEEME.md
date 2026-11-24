# Plantillas SNIES

Reglas de negocio: `docs/modulos/plantillas-snies.md`. Autora: Oficina de Estadística.

## Cómo funciona
- `index.html`: una sola página (HTML/CSS/JS plano). Pide el token al Portal (`PortalENAP.tokenMicrosoft()`) y llama a `/api/snies`. Vista del responsable («Mis plantillas») y, solo para el administrador, Panel de Estadística, Responsables y Plantillas oficiales.
- `api/snies.js`: identifica a la persona con el token, calcula fechas, revisa el archivo (`api/_xlsx.js`), guarda en SharePoint `SNIES/` y en el OneDrive de programacion.ditic, y envía los correos desde jestadisticaplen@enap.edu.co.
- `api/_snies-maestro.json`: Documento Maestro (grupos, cargos, códigos de plantilla y fechas). Sin datos de personas.
- Cron diario (`vercel.json`): recordatorios 7 días, 1 día y vencida.
- Acceso directo: `enap.vercel.app/SNIES` (rewrite en `vercel.json`; el Portal abre el módulo al tener sesión).

## Seguridad
Ningún correo de responsable, archivo entregado ni plantilla oficial entra al repo. El administrador es solo `programacion.ditic@enap.edu.co`; se verifica en el servidor.
