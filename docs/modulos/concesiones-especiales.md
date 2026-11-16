# Concesiones Especiales — reglas de negocio

Reglas definidas por la Oficina de Estadística, vigentes al 2026-11-16.
El código vive en Google Apps Script, fuera de este repo; aquí solo está
`concesiones-config.js` y el protocolo en `protocolos/`.
Si el código difiere de este documento, preguntar antes de cambiar cualquiera de los dos.

## Qué hace
Recibe, valida y resuelve las solicitudes de descuento de matrícula según la
Resolución 0230 de 2025 y la 0010 de 2026 (fechas de cargue).
- Vista pública del estudiante, sin login: solicitar, y consultar o editar.
- Aprobación de Concesiones, dentro del Portal, con el login Microsoft del Portal.

## Almacenamiento
- Todo en SharePoint/OneDrive institucional, nada en Google Drive.
- Carpeta por periodo (2026-1, 2027-1…). Un solo PDF por concesión solicitada, llamado
  `SIGLA - APELLIDOS NOMBRES` en mayúscula y sin tildes.
  Siglas: ACT, RET, FALL, RES, SUF, AFR, IND.
- Orden dentro del PDF: certificado de actividad, resolución de retiro, resolución de
  fallecimiento, votaciones, reclutamiento, afro, indígena, núcleo familiar, otros.
- Archivos internos (.json) en una carpeta "Configuracion", aparte de los periodos.
- El histórico es Base Concesiones (OneDrive de Estadística); se lee directo.

## Convocatorias
- Dos por periodo: Batallón (estudiantes) y Aspirantes.
- Cierres: periodo 1 = Batallón 30 de noviembre, Aspirantes 10 de diciembre del año
  anterior; periodo 2 = Batallón 30 de mayo, Aspirantes 10 de junio. Editables.
- Si cae en fin de semana o festivo, pasa al día hábil siguiente.
- Abre sola 2 meses antes del cierre. Cerrada, el botón muestra la fecha de apertura.
- Pendiente de confirmar: la hora de cierre (regla original 22:00; el recordatorio
  del día de cierre dice 11:59 p. m.).

## Solicitud del estudiante
- Primero elige la concesión y luego escribe el documento; el sistema revisa en vivo
  si ya está en el histórico y qué debe cargar.
- Una sola concesión por cédula. Votaciones es la única adicional y solo se otorga si
  no cumple la principal. No son acumulables: se da la de mayor descuento.
- Editable con código al correo mientras la convocatoria esté abierta o si fue devuelta.
- Grados: Aspirante, Cadete, Guardiamarina, Alférez, Civil. Mercantes siempre Civil.
- Programas en singular: Naval, Infantería de Marina, Mercante, Mercante de Máquinas, Otros.
- Aspirantes: documento predeterminado Tarjeta de Identidad y declaración final de no
  haber recibido beneficios.
- Nombres y apellidos completos y en su orden; la Ñ es obligatoria, las demás tildes no.
- Radicado: `CE-añomesdíahoraminuto-sigla`.

## Documentos
- No se pide cédula. El número digitado debe coincidir con el del certificado anexo.
- Hijo(a) de militar activo: certificado de servicio activo (PDF original descargado).
- Parentesco: cualquier documento legible donde conste que es hijo(a) o hijastro(a) del
  militar. El registro civil no se acepta.
- Un certificado de la Caja de Retiro con núcleo familiar vale también como retiro.
- Fallecido o desaparecido: resolución de fallecimiento.
- Reservista de primera clase: certificado de la Dirección de Reclutamiento.
- Afro e indígena: certificado del Ministerio del Interior (PDF original descargado).
- Votaciones: se valida por la fecha de las elecciones vigentes.
- Certificados con vigencia: máximo 30 días de expedición; vencido se bloquea.
- Quien ya está en el histórico con una concesión que no se actualiza no carga
  documentos. Activos, afro, indígena y Votaciones siempre cargan.
- Bajo cada casilla va el enlace oficial para descargar el certificado. Los avisos solo
  aparecen cuando hay error.

## Validación
- Automática al radicar, documento por documento.
- Bloquea solo lo seguro (número que no coincide, nombre ausente, certificado vencido);
  avisa cuando la lectura de una foto o escaneo es dudosa.
- Verificación sin alertas ni errores: se aprueba sola. Lo demás lo decide Estadística.
- Devolver genera el motivo y lo envía por correo.
- Habilitación: Estadística puede autorizar a un estudiante a cargar un documento
  sustituto sin validación automática. La opción de pedirlo aparece solo después del aviso.
- Plazo de corrección: 5 días hábiles desde el correo de resultados, o desde la devolución.

## Concesiones que no se solicitan
- Alumno Distinguido, Excelencia Académica y Comandante de Curso las calcula el sistema.
- Estudiantes en comisión: intercambio del 100 %, prima sobre cualquier otra.
- Matrícula cero: aunque gane, no se aplica.

## Aprobación de Concesiones
- Pestañas: Resumen, Cargar notas, Detalle, Validación, Habilitación, Dashboard.
  Administración es un engranaje junto a Cerrar sesión, con barra de búsqueda de estudiante.
- Resumen: tarjetas que abren su listado; columna Curso como en Antigüedades.
- "No solicitadas": activos que recibieron concesión antes y no la han pedido. Excluye
  retirados sin reingreso, aplazados, escalafonados y en comisión. Recordatorio 5 días
  antes del cierre y el día del cierre, sin correos institucionales.
- Dashboard: gráficas profesionales y analíticas, las más relevantes para el mando.
  El programa se identifica por el curso (IM, MC, MM).
- Todas las Notas se carga aquí y alimenta Antigüedades y Trayectoria.
- Resoluciones en Word con el formato exacto de sus modelos; siempre preguntar firmantes
  y la resolución que faculta al Director.
- Móvil: sin Administración ni Cargar notas.

## Avisos al estudiante
- Los correos salen de la cuenta institucional de certificaciones.
- Siempre recordar que revise el correo no deseado.
- Para corregir: escuelanaval.edu.co/concesiones, "Consultar o editar Concesión Especial".
