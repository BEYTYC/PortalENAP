# Generación de Promedios Académicos — reglas de negocio

Autora: Oficina de Estadística. Módulo del Portal (Estadística › Generación de Promedios Académicos).

## Qué hace
Por cada estudiante se cargan **cédula (ambas caras)** y **balance académico** (PDF digital, escaneado o imagen). El módulo lee los documentos en el navegador, genera el **certificado de promedio** (mismo formato del modelo aprobado, con QR de verificación), lo guarda y lo envía por correo. El promedio queda guardado por **cédula + programa** para que Solicitud de Grado lo contraste al graduarse (acción `consulta` de `api/promedios.js`). No reemplaza ningún módulo existente.

## Reglas
- **Clave única: cédula + programa.** Dos programas = dos promedios. Si ya existe → error en esa fila, no se genera. Las correcciones las hace solo Estadística.
- **Cédula con una sola cara:** si el documento es digital se bloquea; si es escaneado lo decide una persona en revisión.
- **Vigencia por semestre:** posgrado 3 años y pregrado 5 desde el periodo de terminación (2023-1 vale hasta 2026-1). Un *Diplomado de Actualización* anotado en Observaciones del balance la renueva desde su periodo. Sin vigencia ni diplomado → «Balance desactualizado», no se genera.
- **Emisión inmediata** solo si pasan **todos** los controles: promedio recalculado = impreso (y créditos), número de cédula = línea de lectura del reverso, apellidos de la cédula = inicio del nombre del balance, lugar de expedición reconocido, programa con sigla y facultad. Si algo falla o no se identifica → revisión de Estadística («se validará manualmente»). Un promedio que coincide **no** valida por sí solo cédula, nombre ni lugar.
- **Facultad** sale de la equivalencia programa → facultad (Ajustes). Programa sin facultad o sigla → validación manual. Nunca se inventa un dato.
- **Firmante** (grado, nombre, cargo, firma): configurable en Ajustes, solo Estadística. Los certificados ya emitidos conservan el firmante con el que se emitieron.
- **Código** `PA-AAAA-NNNNNN`; QR y enlace a `/verificar` (página pública: código, nombre, cédula parcial `*****7890`, programa, promedio, fecha; «Certificado auténtico»).

## Correo
Sale de **certificaciones@enap.edu.co**, **uno por lote** al «Enviar el correo a» (solo Estadística lo cambia), con un ZIP (carpeta, un PDF por estudiante, `SIGLA - APELLIDOS NOMBRES.pdf`). Los escaneados aprobados después salen juntos en un **segundo correo** cuando ya no queda ninguno en revisión en ese lote. En pantalla solo dice «Enviado al correo electrónico».

## Siglas
NAV, IM, MC, MM, CCPAD, CCPAM, CCPEL, CCPIN, CCPOF, ESP LOGÍSTICA, ESP POLÍTICA, MSC LOGÍSTICA, MSC INGENIERÍA NAVAL, MSC OCEANOGRAFÍA, PHD (editables en Ajustes).

## Acceso y rechazos
- Entran Estadística, los usuarios autorizados en Ajustes y **todo usuario con rol JEFE_PROGRAMA** activo en la lista de permisos del Portal (el servidor lo verifica). Cada uno entra con su propio usuario del login; el jefe de programa recibe los certificados en su correo de sesión y solo ve lo que él generó.
- Al rechazar un escaneado, cuando ya no queda nada en revisión del lote, el jefe de programa recibe **un solo correo con únicamente los estudiantes que faltaron** (con el motivo) y, después, el de los aprobados.

## Ajustes de noviembre
- El **periodo de terminación** puede venir como fecha (dd/mm/aaaa): de agosto en adelante es periodo 2 (2026-2) y hasta julio es periodo 1.
- El nombre del balance puede venir «apellidos nombres» o «nombres apellidos»: se prueban ambos órdenes contra la cédula.
- Cada lote nuevo avisa por correo a Estadística (quién lo envió, cuántos y cuáles quedan por revisar).
- En la revisión de escaneados el documento se puede acercar (+ / − / Ajustar o clic sobre la imagen).
- Las vistas van arriba, sin centrar; se quitó «Copiar resumen».

## Lugar de expedición
El lugar de expedición de la cédula **no se usa**: no sale en el certificado, no se pide en la revisión y no cuenta en los cruces. El certificado dice «cédula de ciudadanía No. X» sin lugar.

## Copia en OneDrive de programacion.ditic
Cada certificado emitido se copia además a `Promedios Académicos/<año>/<año-periodo>/<SIGLA - APELLIDOS NOMBRES>.pdf` en el OneDrive de programacion.ditic@enap.edu.co, dentro de la carpeta donde están "Concesiones Especiales" y "Titulación" (el servidor busca esa carpeta; alternativa: variable `PROMEDIOS_ONEDRIVE_RUTA`, o la raíz). Año y periodo salen de la fecha de emisión (enero a julio = 1, agosto a diciembre = 2, hora de Colombia). Si la copia falla, la emisión sigue y el registro guarda `copiaError`. La copia principal (verificación QR y consulta) sigue en `Promedios/` del sitio de SharePoint.
