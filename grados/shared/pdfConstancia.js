// grados/shared/pdfConstancia.js
// Requiere en el HTML:
// <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>

export function generarConstanciaPDF({ nombreCompleto, documento, programa, radicado, firmaNombre, fechaAceptacion }) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "letter" });

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 612, 70, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text('Escuela Naval de Cadetes "Almirante Padilla"', 40, 30);
  doc.setFontSize(11);
  doc.text("Constancia de Aceptación - Tratamiento de Datos Personales", 40, 50);

  doc.setTextColor(15, 23, 42);
  let y = 110;
  const linea = (label, value) => {
    doc.setFont(undefined, "bold");
    doc.text(`${label}:`, 40, y);
    doc.setFont(undefined, "normal");
    doc.text(String(value), 200, y);
    y += 22;
  };

  linea("Radicado", radicado);
  linea("Nombre completo", nombreCompleto);
  linea("Documento", documento);
  linea("Programa académico", programa);
  linea("Fecha de aceptación", new Date(fechaAceptacion).toLocaleString("es-CO"));

  y += 20;
  doc.text(
    "El estudiante declara haber leído y aceptado la Política de Tratamiento de Datos " +
      "Personales de la ENAP, autorizando el uso de su información para el trámite de solicitud de grado.",
    40,
    y,
    { maxWidth: 520, lineHeightFactor: 1.4 }
  );

  y += 90;
  doc.line(40, y, 260, y);
  doc.setFontSize(9);
  doc.text("Firma del estudiante", 40, y + 15);
  doc.setFontSize(13);
  doc.setFont(undefined, "italic");
  doc.text(firmaNombre, 40, y - 8);

  return doc;
}
