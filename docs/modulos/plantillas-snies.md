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
Pendiente (rojo), Devuelta (rojo), En revisión (amarillo), Validada (verde). «No aplica» es una marca aparte (el responsable declara que no hubo registros; la plantilla pasa a En revisión). «Vencida» es una alerta, no un estado. Solo Estadística pasa a Validada o Devuelta; al devolver debe escribir las novedades y el responsable las ve en la app y por correo.

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
- Cupos proyectados y matrícula esperada va siempre adelantado: el ciclo 2026-2 reporta el periodo 2027-1 con fecha oficial 12 de septiembre, y el ciclo 2027-1 reporta 2027-2 con fecha oficial 12 de marzo. La tarjeta muestra «Periodo que se reporta».

## Copia a quien diligencia (24/11/2026)
- Los correos de solicitud, recordatorio y vencidas van al responsable de la **entrega**, con copia (CC) a los responsables del **diligenciamiento** de las plantillas que ese correo incluye.
- Solo se copia a quien tiene plantillas pendientes o devueltas: si la plantilla ya fue cargada (En revisión o Validada) o marcada «No aplica», no se le copia.
- Si una plantilla no tiene responsable de entrega, el aviso va directo a quien diligencia. En los correos de una sola plantilla solo «Devuelta» lleva copia.

## Quién carga (24/11/2026)
- La plantilla la puede cargar (o marcar «No aplica») tanto el responsable de la **entrega** como el del **diligenciamiento**; cualquiera de los dos. El permiso se verifica en el servidor.
- Los correos de recepción («recibida» y «No aplica») van al responsable de la entrega con copia a quien diligencia.

## Validación del contenido (24/11/2026)
- Al cargar, además de la estructura se revisa el contenido celda por celda con las reglas del Manual de Validaciones por Plantilla V9.1 (`api/_snies-reglas.json`, generado del manual y de las plantillas oficiales).
- Reglas que se aplican (solo las que no dependen de otros campos): campo obligatorio sin condición, tipo numérico, fecha dd/mm/aaaa, longitud máxima, valores permitidos cuando el manual los lista completos y números no negativos.
- El mensaje dice hoja, columna y filas (por ejemplo «columna NUM_DOCUMENTO está vacía (filas 3, 9)»). Si hay errores, el archivo no entra y el responsable corrige y vuelve a cargar; si lo carga Estadística, queda Devuelta y el responsable recibe el detalle por correo.
- Segunda tanda (25/11/2026), en `api/_snies-validar.js`: longitud de la cédula (CC: 3 a 8 o 10 dígitos; TI: 10 u 11; los documentos de extranjeros no se validan), teléfono (10 dígitos que empiezan por 3 y no repetido en personas distintas; extranjeros exentos), formato de correo, AÑO y SEMESTRE iguales al periodo que se reporta, filas duplicadas (iguales, misma clave de persona o mismo código), relación entre hojas de la misma plantilla (lo de las hojas hijas debe existir en la principal y lo cargado en la principal debe ir también en las hojas que se exigen, p. ej. cursos ↔ docentes y beneficiarios), fechas (final posterior a ingreso, Saber PRO anterior al grado y posterior al 14/10/2009, Saber 11 anterior al periodo), cupos totales ≥ nuevos, áreas, porcentajes de dedicación que suman 100 y obligatorios condicionales (convenio, fuentes de financiación, reintegro anterior a 1998, título).
- No se valida el sexo ni se cruza con Participante (decisión de la Oficina).
- Corrección en pantalla: si el archivo tiene errores, el aplicativo abre un visor con solo las filas con error, las celdas con error en amarillo, edición de cada celda y «Eliminar fila». Al pulsar «Revisar y entregar» el servidor aplica los cambios sobre el Excel original (`api/_xlsx-editar.js`), vuelve a validar y, si queda limpio, lo guarda corregido y lo anota en el historial.
- Tablas de referencia (`api/_snies-catalogos.json`, solo códigos públicos): DIVIPOLA dic. 2018 (municipios y departamentos), ISO 3166 de países, CINE campo específico (el código detallado debe pertenecer a un campo específico existente) y los 14 programas de la ENAP (código SNIES, para PRO_CONSECUTIVO). Si se crea un municipio o programa nuevo, hay que actualizar el JSON.
- Pendiente: cruce Grupos ↔ Productos de investigación (entre plantillas), otras listas (IES, entidades, tipos), y las sumas entre cuentas de Apoyos/Matriculados.
