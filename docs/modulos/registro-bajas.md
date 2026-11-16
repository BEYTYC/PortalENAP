# Registro de bajas — reglas de negocio

Reglas definidas por la Oficina de Estadística, vigentes al 2026-11-16.
Si el código difiere de este documento, preguntar antes de cambiar cualquiera de los dos.
Funcionamiento técnico: `bajas/LEEME.md`.

## Qué hace
Registra retiros de estudiantes uno por uno y los escribe en el Excel Bajas y Ascensos
(OneDrive de Estadística), hoja "Bajas desde 1935".

## Reglas
- La escritura la hace la identidad de aplicación del Portal en el servidor. Quien
  registra no necesita permiso de edición sobre el archivo.
- Vigentes = estudiantes de todos los periodos de Antigüedades más los que entraron al
  Conglomerado y aún no están en Antigüedades. Cruce por cédula, con salvedad si no coincide.
- Un estudiante deja de salir en la búsqueda solo cuando ya está en la base de bajas.
- Datos automáticos y siempre editables: nombre, cédula, sigla, contingente, sexo,
  nacionalidad e ingreso (Conglomerado); curso (Antigüedades).
- Grado: ASP, CD, GM o ALF.
- Primera causal de retiro (obligatoria): CONSEJO ACADÉMICO, CONSEJO DISCIPLINARIO,
  APTITUD NAVAL, SOLICITUD PROPIA, APTITUD PSICOFÍSICA.
- Todos los campos son obligatorios menos la observación.
- Fecha y documento de la resolución se cargan después. Semestre y año de retiro se
  calculan con la fecha de la resolución.
- "Pendientes de resolución" incluye retiros del Excel sin resolución aunque no se hayan
  registrado por el Portal, solo desde 2026-2.
- Recordatorio diario por correo desde los 5 días del registro hasta que se cargue la
  resolución (cron en `vercel.json`).
- Deshacer una baja borra la fila tras verificar nombre y cédula, y deja auditoría.
- CURSO SIN LETRA se escribe como texto (p. ej. "3.1"), nunca como número.
- Registrado por = usuario del login Microsoft.

## Validación final de escalafonamiento (en Antigüedades)
- Botón habilitado solo cuando nadie está "En riesgo".
- Escribe el listado en la hoja Ascensos una vez por periodo.
- CIENCIAS = sí/no según Graduados. El contingente siempre sale del Conglomerado.
- Las columnas se ubican por encabezado, no por posición.
- Recordatorio mensual mientras falten fecha y resolución de ascenso.

## Diseño
Sin crédito dentro del módulo. Avisos en dorado/ámbar, no en rojo. Confirmación con
ventana "Registrando baja…" y errores con bloque de diagnóstico copiable.
