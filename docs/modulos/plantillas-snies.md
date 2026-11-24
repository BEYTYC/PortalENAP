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
