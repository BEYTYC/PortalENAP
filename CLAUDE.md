# Portal de Servicios Digitales Estadística (ENAP)

Autora y desarrolladora: CAMARGO MARTÍNEZ BEYTY PATRICIA — Oficina de Estadística.
Los avisos de autoría de archivos y páginas no se eliminan ni se alteran (Ley 23 de 1982, art. 30).

## Proyecto
- Repo público. Se despliega solo en Vercel (enap.vercel.app) con cada cambio en `main`.
- HTML/CSS/JS plano, módulos nativos del navegador. Sin React, sin Node, sin bundler.
- Una carpeta por módulo con su `index.html`; funciones de servidor en `api/`.
- Cada módulo tiene su `LEEME.md` (cómo funciona) y sus reglas de negocio en `docs/modulos/`.
  Leer ambos antes de tocar un módulo.
- Varios módulos viven en Google Apps Script, fuera de este repo: Concesiones Especiales,
  Solicitudes de Certificados, Portal Solicitud de Grado, Registro Cursos de Extensión,
  Asistente de búsqueda. No se pueden cambiar desde aquí; pedir el código a la autora.

## Publicación
- El sistema está en uso. Un cambio en `main` llega a los usuarios.
- Vercel (plan gratuito) tiene límite diario de despliegues: agrupar cambios y publicar
  una sola vez por tanda. No abrir una PR por cada ajuste pequeño.
- Claude crea la PR y la fusiona. Siempre entregar el enlace de lo publicado.
- Verificar antes de publicar: abrir el módulo en vista previa, en escritorio y en móvil,
  y mostrar la captura.

## Diseño
- Referencia visual: módulo Solicitud de Grado. Fuente Aptos Display en todo.
- Azules claros y suaves, fondo gris claro con tarjetas blancas. Con profundidad y
  transiciones, pero profesional y sin recargar.
- Rojo solo para errores y notas menores a 6. Nunca tarjetas ni chips rojos para contenido normal.
- Todo debe caber en pantalla; scroll solo si es necesario.
- Escudo ENAP en todo, también como marca de agua tenue.
- Cursor de flecha sobre texto; mano solo en lo que se puede pulsar.
- Créditos del Portal (decisión de la autora, 25/11/2026): solo `Desarrollado por la Oficina de Estadística | PD02 Beyty P. Camargo M.`, en la barra del menú al lado de los módulos. Sin copyright y sin créditos abajo a la derecha.
- "Fuente: Oficina de Estadística" una sola vez por vista, no en cada tarjeta.

## Texto y datos
- Nombres de personas en MAYÚSCULA, apellidos primero, con tildes y Ñ, en una sola línea.
- Estudiantes siempre con sigla de grado antes del nombre (ASP, CD, GM, ALF; mercantes PLT).
- Notas con 3 decimales. Mínimo aprobatorio 6 en pregrado y 7 en posgrado.
- Títulos de tarjetas y nombres de cursos en Title Case, con todas sus tildes.
- Todo el texto del Portal lleva tildes correctas.
- Lo que no exista en las bases no se muestra. Nunca inventar un dato.
- Nombres, cédulas y lugares de expedición se contrastan con la cédula original antes
  de entregarlos. Lo que no esté 100 % confirmado se dice.
- Búsquedas por cédula normalizada y por nombre. Un cruce hecho solo por nombre se trata
  como "por verificar".
- Criterio de validación de cargues (autora, 26/11/2026): ante la duda se acepta. Un cargue solo se bloquea por las reglas que la autora ha pedido puntualmente; hojas o columnas de más, otro orden o cualquier cosa no pedida no bloquean. Prefiere aceptar posibles errores a impedir que los usuarios carguen.
- Las descargas Excel del Portal comparten un mismo formato (escudo, encabezados azul
  marino, fila de fuente). Copiar el de un módulo existente.

## Seguridad
- Ninguna base de datos, listado de personas, foto de cédula ni credencial entra al repo.
- Los datos viven en OneDrive y SharePoint de la Oficina de Estadística y se leen desde
  `api/` con credenciales de aplicación guardadas en Vercel, nunca en el código.
- Los permisos se verifican en el servidor contra el token, no solo ocultando en pantalla.
- Roles y accesos: ver `api/roles.js`. No tocar permisos sin pedido expreso.
