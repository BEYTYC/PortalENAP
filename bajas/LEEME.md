# Registro de bajas

Módulo del Portal (Estadística › Registro de bajas). HTML/CSS/JS plano, embebido desde `index.html` (iframe del mismo origen). Solo lo usan **sea@enap.edu.co** y **jestadisticaplen@enap.edu.co**.

## Cómo funciona
- `bajas/index.html` pide el token de Microsoft al Portal y llama a `api/bajas.js`.
- Estudiantes activos = los del último periodo de Antigüedades (SharePoint `Antiguedades/`) que no estén retirados, más los recién ingresados de CONGLOMERADO (último año) que aún no están en Antigüedades ni en Bajas.
- Datos que se traen (todos editables): nombre, cédula, sexo, sigla, contingente, año y fecha de ingreso y nacionalidad de **CONGLOMERADO**; curso y grado de **Antigüedades**. Programa y curso sin letra salen de la Hoja8 de Bajas y Ascensos.
- Al registrar: se agrega una fila a la tabla `Tabla2` de la hoja "Bajas desde 1935" y se guarda el registro en SharePoint `Bajas/registros.json` (fecha, quién registró, estado).
- La fecha y el documento de retiro se añaden después en "Pendientes de resolución". El semestre (1 o 2) y el año de retiro se calculan con la fecha de la resolución.
- La escritura en el Excel la hace la aplicación del Portal, no la cuenta de quien entra.

## Recordatorios (Vercel Cron, diario 8:00 a. m. Colombia)
`GET /api/bajas?cron=recordatorios` (ver `vercel.json`):
- Retiros sin fecha o documento a los 5 días → correo diario a sea@enap.edu.co hasta que se carguen (se revisa el Excel, también cuenta si se escriben directo en el archivo).
- Ascensos validados sin fecha o resolución al mes → correo diario a sea@.
- Reintenta escribir en el Excel las bajas que no se pudieron escribir (archivo bloqueado, etc.).

## Validación final de Ascensos
En Antigüedades › Administración, tarjeta "Validación final de escalafonamiento": se habilita cuando nadie está "En riesgo" y agrega los escalafonados del periodo a la hoja "Ascensos" (una sola vez por periodo; queda en `Bajas/ascensos.json`). CIENCIAS = SÍ si la cédula aparece en Graduados en la ENAP con el programa de ciencias de su especialidad; si no, NO.

## Requisitos de configuración
- **Bajas y Ascensos debe estar en .xlsx** (`Estadística/Bases de Datos/B.D Retiros y Ascensos/Bajas y Ascensos.xlsx`): Microsoft Graph no escribe en .xlsm. Mientras siga en .xlsm, el módulo lee pero no escribe (los registros quedan guardados y se escriben solos cuando aparezca el .xlsx).
- Permisos de aplicación (Azure, con consentimiento de administrador) del registro que usa `GRAPH_CLIENT_ID`: `Sites.ReadWrite.All` (ya lo usa el Portal; cubre los OneDrive) y **`Mail.Send`** para los recordatorios.
- Variable opcional `CRON_SECRET` en Vercel (si se define, el cron la envía y el endpoint la exige). `PORTAL_URL` opcional para el enlace del correo.
