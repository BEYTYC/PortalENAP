# Plantillas SNIES — reglas de negocio

Módulo: `snies/` (pantalla) y `api/snies.js` (servidor). Autora: Oficina de Estadística. Se abre en Facultades › Plantillas SNIES o directo en `enap.vercel.app/SNIES`.

## Para qué sirve
Gestión, seguimiento y control de la entrega de las plantillas de los reportes SNIES por parte de los responsables de la ENAP.

## Quién ve qué
- Cada persona entra con su login del Portal y ve solo las plantillas en las que figura como responsable de la entrega o del diligenciamiento. Los nombres salen del login.
- Administradores: `jestadisticaplen@enap.edu.co` y `programacion.ditic@enap.edu.co` (constante `ADMINS` de `api/snies.js`). Todo se verifica en el servidor con el token.
- Cada plantilla tiene **un responsable de la entrega** (quien carga) y **varios responsables del diligenciamiento**. Todos reciben los correos; en todos los correos aparece el responsable de la entrega.
- `PINO` (Planeación Académica) reporta directo al SNIES con su propio usuario: en el aplicativo solo recibe notificaciones. `DPEN-PINO`: Personal carga en el aplicativo y Planeación solo recibe notificaciones. Apoyos financieros, académicos u otros: la entrega la hace la Oficina de Estadística; PECA y DSCH diligencian.
- Educación continua y Cursos: las facultades envían su parte a posgrados@enap.edu.co y Posgrados centraliza y entrega (aviso en la tarjeta y en los correos).

## Estados
Pendiente (gris; si está vencida, rojo), Devuelta (rojo), En revisión (amarillo), Validada (verde). «No aplica» es una marca aparte (el responsable declara que no hubo registros; la plantilla pasa a En revisión). «Vencida» es una alerta, no un estado. Solo Estadística pasa a Validada o Devuelta; al devolver debe escribir las novedades y el responsable las ve en la app y por correo.

## Fechas
- Fecha oficial SNIES por plantilla y semestre: las cuatro fechas del Documento Maestro (`api/_snies-maestro.json`); 1.er semestre usa la 2.ª fecha, 2.º semestre la 4.ª. Se repiten cada año, automáticamente. **Pendiente de confirmar contra la Resolución 9573 del MEN.**
- Fecha límite interna = oficial − 1 mes calendario (si el mes anterior es más corto, el último día de ese mes). El administrador puede dar una prórroga por plantilla.
- Periodo 2026-2: la fecha límite inicial de todas las plantillas es el **27/11/2026** (constante `LIMITE_INICIAL` de `api/snies.js`); una prórroga por plantilla la reemplaza.
- El responsable nunca ve la fecha oficial, solo su fecha límite.
- Plantillas «cuando se presente la novedad» no tienen fecha ni recordatorios.

## Correos (salen de jestadisticaplen@enap.edu.co)
Apertura del ciclo (botón del administrador), recordatorio 7 días antes, 1 día antes, 1 día después (vencida, puede generar hallazgos en la Auditoría), confirmación al entregar o marcar No aplica, plantilla devuelta (con novedades) y plantilla validada. Los recordatorios los envía el cron diario `/api/snies?cron=diario` (13:00 UTC = 8:00 a. m. Colombia) y no se repiten.

## Archivos
- La plantilla oficial **nunca se modifica**: se guarda y se entrega tal como se sube. El administrador la reemplaza cuando el Ministerio la cambia; la versión anterior queda guardada.
- Cada entrega se guarda **sin modificar** en el OneDrive de programacion.ditic@enap.edu.co, carpeta «Plantillas SNIES/<periodo>/», al lado de «Promedios Académicos».
- Estado y configuración en SharePoint del Portal, carpeta `SNIES/` (nunca en el repo). El repo solo trae el Documento Maestro sin datos de personas (`api/_snies-maestro.json`).
- Semestre anterior: «Plantilla diligenciada AAAA-S» solo para Cupos proyectados, Información complementaria IES, Recurso histórico, Unidad organizacional, Autoridades, Directivos, Docentes, Integrantes del máximo órgano de gobierno y todas las de Internacionalización, Investigación y Extensión. Sale cuando existe una entrega del semestre anterior (desde el próximo semestre).

## Validación del archivo al cargar (versión actual)
1. Es un Excel .xlsx de máximo 4 MB.
2. El código de la hoja INFO corresponde a esa plantilla (si se sube la de otra, se rechaza).
3. Las columnas coinciden con la plantilla oficial vigente (si el administrador la cargó).
4. Tiene filas diligenciadas (si no hubo registros, se usa «No aplica»).
5. Orden de cargue: Materias Matriculado y Apoyos esperan a Matriculados cuando esta se entrega en el aplicativo.

## Pendiente (siguientes tandas)
Validación celda por celda (reglas de la matriz V2.2 y el Manual V9.1), corrección en pantalla sobre el Excel con «Faltan N errores», cruces con Participante / programas / correos y teléfonos bloqueados / datos repetidos / códigos ICFES, Excel con errores marcados, precarga de Materias Matriculado y Apoyos desde Matriculados, instrucciones por plantilla, informe de cumplimiento y reabrir tras rechazo del SNIES.


## Ajustes del 24/11/2026
- Las plantillas que el Documento Maestro deja sin responsable (NA / NO APLICA) no se cargan en el aplicativo: no salen en el Panel, ni en Responsables, ni en Plantillas oficiales. Se quedan solo las que tienen cargo (incluida Unidad Organizacional). Para volver a habilitar una, quitar el bloque que las elimina de `TEMPLATES` en `api/snies.js`.
- Periodo que se reporta: en todas las plantillas es el del ciclo (ciclo 2026-2 → 2026-2), salvo Cupos proyectados. La validación exige que AÑO y SEMESTRE sean ese periodo.
- Cupos proyectados y matrícula esperada va siempre adelantado: el ciclo 2026-2 reporta el periodo 2027-2 (lo que está pendiente; el 2027-1 se reportó el 12 de septiembre), y el ciclo 2027-1 reporta 2027-2 con fecha oficial 12 de marzo. La tarjeta muestra «Periodo que se reporta».

## Copia a quien diligencia (24/11/2026)
- Los correos de solicitud, recordatorio y vencidas van al responsable de la **entrega**, con copia (CC) a los responsables del **diligenciamiento** de las plantillas que ese correo incluye.
- Solo se copia a quien tiene plantillas pendientes o devueltas: si la plantilla ya fue cargada (En revisión o Validada) o marcada «No aplica», no se le copia.
- Si una plantilla no tiene responsable de entrega, el aviso va directo a quien diligencia. En los correos de una sola plantilla solo «Devuelta» lleva copia.

## Quién carga (24/11/2026)
- La plantilla la puede cargar (o marcar «No aplica») tanto el responsable de la **entrega** como el del **diligenciamiento**; cualquiera de los dos. El permiso se verifica en el servidor.
- El correo «Plantilla recibida» (sin «está al día») se envía solo cuando la Oficina de Estadística **valida** la plantilla; al cargarla y quedar En revisión no se envía ningún correo al responsable (decisión de la autora, 26/11/2026). El de «No aplica» sí sale al registrarlo. Ambos van al responsable de la entrega con copia a quien diligencia.

## Validación del contenido (24/11/2026)
- Al cargar, además de la estructura se revisa el contenido celda por celda con las reglas del Manual de Validaciones por Plantilla V9.1 (`api/_snies-reglas.json`, generado del manual y de las plantillas oficiales).
- Reglas que se aplican (solo las que no dependen de otros campos): campo obligatorio sin condición, tipo numérico, fecha dd/mm/aaaa, longitud máxima, valores permitidos cuando el manual los lista completos y números no negativos.
- El mensaje dice hoja, columna y filas (por ejemplo «columna NUM_DOCUMENTO está vacía (filas 3, 9)»). Si hay errores, el archivo no entra y el responsable corrige y vuelve a cargar; si lo carga Estadística, queda Devuelta y el responsable recibe el detalle por correo.
- Segunda tanda (25/11/2026), en `api/_snies-validar.js`: longitud de la cédula (CC: 3 a 8 o 10 dígitos; TI: 10 u 11; los documentos de extranjeros no se validan), teléfono (10 dígitos que empiezan por 3 y no repetido en personas distintas; extranjeros exentos), formato de correo, AÑO y SEMESTRE iguales al periodo que se reporta, filas duplicadas (iguales, misma clave de persona o mismo código), relación entre hojas de la misma plantilla (lo de las hojas hijas debe existir en la principal y lo cargado en la principal debe ir también en las hojas que se exigen, p. ej. cursos ↔ docentes y beneficiarios), fechas (final posterior a ingreso, Saber PRO anterior al grado y posterior al 14/10/2009, Saber 11 anterior al periodo), cupos totales ≥ nuevos, áreas, porcentajes de dedicación que suman 100 y obligatorios condicionales (convenio, fuentes de financiación, reintegro anterior a 1998, título).
- No se valida el sexo ni se cruza con Participante (decisión de la Oficina).
- Corrección en pantalla: si el archivo tiene errores, el aplicativo abre un visor con solo las filas con error, las celdas con error en amarillo, edición de cada celda y «Eliminar fila». Al pulsar «Revisar y entregar» el servidor aplica los cambios sobre el Excel original (`api/_xlsx-editar.js`), vuelve a validar y, si queda limpio, lo guarda corregido y lo anota en el historial.
- Tablas de referencia (`api/_snies-catalogos.json`, solo códigos públicos): DIVIPOLA dic. 2018 (municipios y departamentos), ISO 3166 de países, CINE campo específico (el código detallado debe pertenecer a un campo específico existente) y los 14 programas de la ENAP (código SNIES, para PRO_CONSECUTIVO). Si se crea un municipio o programa nuevo, hay que actualizar el JSON.
- Pendiente: cruce Grupos ↔ Productos de investigación (entre plantillas), otras listas (IES, entidades, tipos), y las sumas entre cuentas de Apoyos/Matriculados.

- Versión de la plantilla: al cargar se compara el archivo con las hojas y encabezados oficiales vigentes (`api/_snies-columnas.json`, sacado de las plantillas oficiales; solo encabezados). Si no coinciden, o es de otra plantilla, el mensaje pide descargar la plantilla oficial desde la tarjeta. Cuando el Ministerio cambie una plantilla hay que regenerar ese JSON.

- Instructivo de diligenciamiento: página dinámica `snies/instructivo.html?p=<id>` (ya no son PDF). Muestra los encabezados reales de la plantilla; al tocar una columna explica qué escribir, si es obligatoria y los valores permitidos. Los datos están en `snies/instructivos/datos.json`, generado con `docs/modulos/snies-generar-instructivos.py` a partir de los encabezados oficiales, las reglas del Manual de Validaciones V9.1 y los recortes del Manual del Usuario SNIES v2.11 (los PDF ya no se guardan en el repo; el script los pide en una carpeta). Donde el manual no trae el campo, el texto es genérico a partir del tipo y la longitud. Enlaces: tarjetas, correos y ventanas de error.
- Aviso a Estadística: cuando un responsable (no administrador) carga una plantilla o declara «No aplica», el sistema envía un correo a jestadisticaplen@enap.edu.co con quién la cargó, la plantilla y el periodo. No se envía si carga el administrador, en el modo «Ver como» ni cuando Estadística carga una entrega recibida por correo; si el envío falla, la entrega no se bloquea.

## Cargue de Estadística con novedades (26/11/2026)
- Cuando la Oficina de Estadística carga una entrega en nombre del responsable («Cargar entrega») y el archivo tiene novedades, **el archivo se guarda**, la plantilla queda **Devuelta** (con `novedades: true` en el estado) y **no se envía correo**. Aparece un cuadro con las novedades y el botón «Enviar correo de novedades al responsable» (también se puede enviar después con «Enviar correo» de la tarjeta).
- El correo se titula «Hay novedades en su plantilla» e incluye el enlace `…/SNIES?novedades=<plantilla>`. Al abrirlo (el Portal recuerda el parámetro durante el inicio de sesión) se abre de una el visor de corrección en pantalla sobre el archivo guardado (acción `novedades` de `api/snies.js`, solo para el responsable de esa plantilla o el administrador). La tarjeta del responsable también muestra el botón «Abrir novedades».
- Al corregir y entregar, el flujo normal deja la plantilla En revisión y apaga la marca de novedades.

## Devolver con documento adjunto (26/11/2026)
- Al «Devolver» una plantilla, la Oficina puede adjuntar un documento (hasta 3 MB; por ejemplo, un Excel con los errores marcados). Se guarda en OneDrive en `<periodo>/devoluciones/`, va anexo al correo de devolución y el responsable lo descarga desde su tarjeta («Descargar documento adjunto»). La acción `adjunto-descargar` verifica en el servidor que sea responsable de esa plantilla o administrador.
- El responsable corrige y vuelve a cargar con «Cargar plantilla»: el flujo normal deja la plantilla otra vez En revisión y limpia el adjunto de la tarjeta.

## Validaciones añadidas (26/11/2026, caso Evento Cultural)
Bloquean la entrega: `CODIGO_UNIDAD_ORGANIZACIONAL` distinto de 0101010104 (red de seguridad: al cargar, el Portal reemplaza automáticamente ese código por 0101010104, como texto, en todas las plantillas salvo Unidad organizacional); fechas escritas como texto; fechas que son números sueltos sin formato de fecha (la corrección en pantalla ahora escribe la fecha con formato dd/mm/aaaa); fechas fuera del semestre en Evento Cultural, Actividad Cultural y Actividad de Bienestar; `VLR_FINANCIACION_*` positivo menor de $1.000; y palabras mal escritas en las columnas `DESCRIPCION_*` (corrector con `api/_snies-palabras.json`, solo sugiere palabras comunes que empiecen por la misma letra). Los nombres propios que el corrector marque por error se agregan a `PALABRAS_OK` en `api/_snies-validar.js`.

## Deshacer cargue (26/11/2026)
- Solo el administrador. En la fila de cada plantilla con entrega registrada aparece «Deshacer cargue» (con confirmación): la plantilla vuelve a Pendiente y se limpian archivo, fecha, responsable, motivo, novedades y adjunto. Queda una línea en el historial. Sirve para deshacer cargues de prueba. No retira correos ya enviados ni borra el archivo de OneDrive. Acción `deshacer-cargue` en `api/snies.js`.

## Cruce informativo con Participantes (27/11/2026)
- Solo lo ve Estadística; no bloquea nada ni llega al responsable. En el Panel, botón «Cruce con Participante» en cada plantilla con archivo: lista hoja, fila, tipo y número de los documentos que no están en Participantes (acción `cruce-participantes`, solo administrador, función `cruceParticipantes` de `api/snies.js`).
- Se compara solo el número de documento, sin puntos, espacios ni ceros a la izquierda. Participantes = base del SNIES cargada con «Base de Participantes» (CSV UnoAUno; solo se guardan los números en `SNIES/participantes-base.json` de SharePoint, nunca en el repo) y, si existe, la entrega de Participante del periodo. Si no hay ninguna de las dos, el botón avisa qué falta.
- Plantillas que no se cruzan con Participante: Inscritos, Inscrito Programa y Admitidos (27/11/2026; constante `SIN_CRUCE`).
- Al «Devolver», la vista previa de Estadística muestra las cédulas que no están en Participantes como candidatas (casilla). Estadística marca cuáles aplican (marcar una cédula marca todas sus filas) y solo esas le salen al responsable en amarillo con «El número de cédula no aparece registrado en la base de datos de la institución». Se guardan en `cruceNov` del estado y se limpian cuando el responsable vuelve a entregar. No bloquea la entrega.
- Cruce por documento, tipo y nombre (27/11/2026): la base del SNIES guarda documento, tipo y una clave del nombre (sin orden ni tildes). Cada documento de la entrega se clasifica: **tipo distinto** (el número está pero con otro tipo), **nombre registrado con otro documento** (solo si la plantilla trae PRIMER_NOMBRE… y el nombre coincide) o **no aparece**. En «Devolver», Estadística elige UN caso para toda la plantilla (no cédula por cédula): «Verificar número y tipo de documento» (cada fila muestra qué no coincide; para plantillas como Docentes) o «La persona no aparece registrada» (para plantillas como Actividad Cultural). Hay botón «Descargar listado» (CSV). Se guarda en `cruceModo` del estado.

## Filas en blanco (autora, 27/11/2026)
- Una fila vacía dentro de los datos, o justo después de ellos, es error: «fila en blanco: elimínela (los registros deben ir seguidos, sin filas vacías)». El SNIES también las rechaza.
- Solo se revisan en hojas que tienen al menos un registro (si no hay ninguno, ya sale «la plantilla no tiene filas diligenciadas»). Máximo 200 filas en blanco por hoja.
- En el visor de corrección se eliminan con «Eliminar fila». Los archivos ya cargados se revisan con esta regla cuando Estadística los abre o los devuelve.

## Correos al responsable (autora, 27/11/2026)
- Solo recibe dos correos: (1) cuando se le **devuelve** una plantilla con novedades (un solo correo con el botón «Abrir las novedades») y (2) cuando la **última** de sus plantillas queda **validada**: «Entrega completa y validada», en tono formal.
- No hay correo al cargar, ni al validar una plantilla si aún le quedan otras por validar.
- Los recordatorios automáticos (7 días, 1 día, vencida) están apagados (`RECORDATORIOS_AUTOMATICOS = false` en `api/snies.js`). El envío manual desde el icono de carta de Estadística sigue disponible.

## Filas de más encima del encabezado (27/11/2026)
- El visor muestra «Eliminar fila» en cada fila (antes la columna «Fila» lo tapaba). La fila de encabezados no aparece como fila y el servidor nunca la elimina, aunque se le pida.
- Con filas de más encima del encabezado (por ejemplo «2026 2»), las correcciones de celdas también se aplican bien: el encabezado se ubica igual que al revisar.

## Retiro anterior al periodo (27/11/2026)
- Si FECHA_RETIRO es anterior al primer día del periodo que se reporta (01/01 en el semestre 1, 01/07 en el 2), la fila es error: esa persona no debe reportarse y se elimina la fila. Aplica a toda hoja con columna FECHA_RETIRO (grupos, redes, proyectos, centros). Un retiro dentro del periodo es válido.

## Cambios del 27/11/2026 (2)
- El visor no muestra la fila del encabezado cuando hay filas de más encima: la regla de filas en blanco ya no cuenta esa posición.
- Botón «↻ Actualizar» arriba a la derecha (todas las vistas): vuelve a leer los datos sin reiniciar el Portal.

## Eliminar filas desde «Devolver» (27/11/2026)
- La vista previa de Devolver (administradora) también tiene «Eliminar fila» en cada fila y el botón «Guardar eliminación de filas»: guarda el archivo sin esas filas y lo revisa de nuevo. La fila de encabezados no se puede eliminar.

## Códigos con espacios (27/11/2026)
- Todo valor de una columna CODIGO_* (o terminada en _CODIGO) con un espacio al inicio, al final o en medio es error: «el código no puede tener espacios…».
