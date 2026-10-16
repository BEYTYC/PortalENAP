# Antigüedades ENAP

Módulo del Portal (Estadística › Antigüedades ENAP). HTML/CSS/JS plano, sin compilación.

## Cómo funciona
- `antiguedades/index.html` se abre embebido desde `index.html` (iframe del mismo origen). Pide el token de Microsoft al Portal (`PortalENAP.tokenMicrosoft`).
- `api/antiguedades.js` valida ese token y decide el rol:
  - **ADMIN** (fijos en `ADMINS`): `sea@enap.edu.co`, `jestadisticaplen@enap.edu.co`. Ven todo, cargan datos y gestionan accesos.
  - **CONSULTA**: correos que un ADMIN da de alta en la pestaña Administración. Solo ven las antigüedades.
  - Cualquier otra cuenta: no ve nada y el intento queda en "Intentos de acceso sin permiso".
- Los datos NO están en el repositorio (es público). Viven en SharePoint, en la biblioteca de documentos del mismo sitio que ya usa el Portal, carpeta `Antiguedades/`:
  `datos.json`, `accesos.json`, `intentos.json`.
- Usa las mismas variables de entorno de Vercel que `api/roles.js` (`GRAPH_TENANT_ID`, `GRAPH_CLIENT_ID`, `GRAPH_CLIENT_SECRET`, opcional `GRAPH_SITE_ID`/`GRAPH_SITE_PATH`). La aplicación necesita permiso de aplicación para escribir archivos en el sitio (p. ej. `Sites.ReadWrite.All`).

## Primera puesta en marcha
1. Desplegar (Vercel) y abrir el Portal con `jestadisticaplen@enap.edu.co`.
2. Estadística › Antigüedades ENAP › **Administración** › "Datos cargados": elegir el JSON de datos, escribir el periodo y **Cargar datos**.
3. Dar acceso de consulta a quien corresponda.

## Pendiente
- Descarga del Excel "BD Antigüedades <fecha>".
- Carga de Todas las Notas, pérdidas, bajas, Conglomerado y novedades, y cálculo del siguiente semestre dentro del módulo.
