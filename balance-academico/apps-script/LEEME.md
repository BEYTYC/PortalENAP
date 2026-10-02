# Balance Académico · aplicación de Google Apps Script

Guardado **siempre en OneDrive** (Microsoft Graph). Los Excel de `balances/` siguen siendo la fuente de verdad.

## Archivos del proyecto Apps Script
| Archivo | Contenido |
|---|---|
| `Code.gs` | Servidor: sesión y roles, lectura de plantillas, guardado en OneDrive |
| `Index.html` | Pantalla completa (generada; no se edita a mano) |
| `appsscript.json` | Manifiesto (zona horaria Bogotá, acceso, permiso de `UrlFetchApp`) |

`Index.html` se regenera con `python3 construir-apps-script.py` (carpeta `balance-academico`) cada vez que cambie `index.html`, `motor.js`, `pdf.js`, `lector-excel.js` o `programas.js`.

## Propiedades (Configuración del proyecto → Propiedades de la secuencia de comandos)
Las tres primeras son las mismas credenciales de aplicación que ya usa el Portal (`GRAPH_*`).

| Propiedad | Valor |
|---|---|
| `GRAPH_TENANT_ID`, `GRAPH_CLIENT_ID`, `GRAPH_CLIENT_SECRET` | Aplicación de Azure con permiso de aplicación `Files.ReadWrite.All` (consentimiento de administrador) |
| `ONEDRIVE_USUARIO` | Correo de la cuenta dueña del OneDrive donde se guardan los balances (o `GRAPH_DRIVE_ID` para una biblioteca) |
| `ONEDRIVE_CARPETA` | Opcional. Por defecto `Balances Académicos ENAP` (se crea sola) |
| `PORTAL_URL` | Dirección del Portal, sin barra final. De allí se leen `/balances/*.xlsm` y `/api/roles` |
| `MODO_PRUEBA` | `true` mientras no esté dentro del Portal (permite elegir rol a mano). Poner `false` al integrarlo |

Si no hay `PORTAL_URL`, las plantillas se leen de OneDrive en `ONEDRIVE_PLANTILLAS` (por defecto `Balances Académicos ENAP/Plantillas`).

## Puesta en marcha
1. Cree el proyecto en script.google.com y pegue los tres archivos. En Configuración active “Mostrar el archivo de manifiesto appsscript.json”.
2. Cargue las propiedades de arriba.
3. Ejecute `configurar()` una vez: autoriza, comprueba la conexión con OneDrive y crea la carpeta.
4. Implementar → Nueva implementación → Aplicación web · Ejecutar como: yo · Acceso: cualquier persona.

## Integración con el Portal (después)
La pantalla pide la sesión igual que Titulación: envía `{type:'balance:token-request'}` a `window.top` y espera `{type:'balance:token', token}`.
En `index.html` del Portal basta con añadir `'balance:token-request'` a `tiposValidos` y responder con el mismo `tokenMicrosoft()`. Con token, el servidor lo valida con Graph `/me`, exige correo `@enap.edu.co` y toma el rol (`JEFE_PROGRAMA`, `DECANO`, `ADMIN`) de `/api/roles`. Sin token y con `MODO_PRUEBA=false` no deja entrar.

## Quién puede qué
- Jefe de Programa: crea, edita, firma, reabre y elimina.
- Decano: abre y firma. No edita.
- Las imágenes de firma nunca se guardan en OneDrive.
