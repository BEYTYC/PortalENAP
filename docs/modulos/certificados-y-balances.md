# Certificados y Balances Académicos — reglas de negocio

Reglas definidas por la Oficina de Estadística, vigentes al 2026-11-16.
Si el código difiere de este documento, preguntar antes de cambiar cualquiera de los dos.

## Solicitudes de Certificados
Código en Google Apps Script, fuera de este repo. Público en
escuelanaval.edu.co/certificados; la Aprobación de Certificados se abre desde el Portal
con su login Microsoft.

- El inicio público se ve idéntico al de Concesiones: mismo fondo, mismo cuadro, mismo
  tamaño de tarjetas, encabezado "OFICINA DE ESTADÍSTICA" y botón Resoluciones.
- Pie solo en la pantalla de inicio: © 2026 Escuela Naval de Cadetes "Almirante Padilla"
  y debajo, en cursiva, "Desarrollado por la Oficina de Estadística | PD02 Beyty P. Camargo M.".
- Las tarjetas de comprobante de pago y formato de entrega aparecen solo después de
  agregar al menos un certificado. "Siguiente" en azul fuerte; gris si no hay certificado.
- La autorización de datos (Ley 1581) va en una tarjeta. "Volver al inicio" arriba a la
  izquierda.
- El valor del comprobante se compara con el total generado. Si no coincide: "revisar",
  y se puede marcar como correcto porque a veces pagan en varios pagos.
- Certificado con plazo de elaboración vencido: correo diario al responsable hasta que
  se elabore.
- Fuente Aptos Display.

## Generación de Balances Académicos
Código en `balance-academico/` (incluye su copia de Apps Script) y plantillas de pénsum
en `balances/`. Va en el menú Facultades, con el login del Portal y acceso restringido
(ver `api/roles.js`). Por enlace directo redirige al Portal.

- Habilitado para Especialización y Maestría en Gestión Logística.
- Cédula, nombres y notas salen del historial pegado del SMA. Se pueden pegar varios
  estudiantes. El programa lo elige el jefe de programa.
- Créditos y nombres completos de materias: los del Excel del pénsum, no los del SMA.
- Equivalencias: código exacto, luego equivalente 1, luego equivalente 2.
- El jefe de programa edita códigos, nombres y créditos; nunca notas. Cada cambio queda
  en el registro de auditoría. Una materia del SMA no se asigna dos veces.
- Aprobación: 6,000 en pregrado y 7,000 en posgrado.
- Promedio ponderado con la nota definitiva, no la de habilitación.
- Si perdió y habilitó: NOTA muestra la perdida y HAB. la habilitación.
- Semestre repetido completo: vale el último intento.
- Periodo de terminación: último periodo con notas en el SMA.
- Vigente si terminó hace menos de 3 años. Vencido: exige marcar balance previo pagado
  y requisitos del pénsum cumplidos antes de firmar.
- No se firma ni descarga un balance incompleto. Solo se descarga firmado.
- PDF en el formato oficial EDUCA-FT-009, Carta (Oficio si es muy grande). Fecha de
  elaboración = día en que se genera.
- Firma del jefe de programa fija sobre su línea; del Decano solo el nombre, editable y
  guardado en el servidor.
- Archivo: `BALANCE ESP LOGÍSTICA - APELLIDOS NOMBRES` o `BALANCE MSC LOGÍSTICA - …`.
- "Firmar todos" con barra de avance y descarga en ZIP, una carpeta por estudiante con
  balance y certificado.
- Certificado de la Sección de Estadística: "vigente de acuerdo con…" o "actualizado de
  acuerdo con…" según el caso. Fuente Aptos Display.
- El jefe de programa puede crear pénsum alternos ("Reforma Pénsum 2023") para
  estudiantes antiguos.
- Los balances se guardan siempre en OneDrive. No se envían correos.
