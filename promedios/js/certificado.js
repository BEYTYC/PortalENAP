/*!
 * Portal de Servicios Digitales Estadística — Escuela Naval de Cadetes "Almirante Padilla"
 * Autora y desarrolladora: CAMARGO MARTÍNEZ BEYTY PATRICIA — Oficina de Estadística
 * Derechos morales de autor reservados (Ley 23 de 1982, art. 30). Este aviso de autoría no debe eliminarse ni alterarse.
 */
/* Certificado de promedio académico (carta) — idéntico al modelo aprobado, con código QR de verificación.
   generar(JsPDF, QR, d) devuelve el documento jsPDF. d = { nombres, apellidos, documento, lugar, programa, promedio, periodo,
   fechaBalance, facultad, estado ('vigente'|'actualizado'), diplomado, fecha, codigo, enlace, firmante:{grado,nombre,cargo}, escudo, marca, firma } */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./nucleo.js'));
  else root.PromediosCertificado = factory(root.PromediosNucleo);
})(typeof self !== 'undefined' ? self : this, function (N) {
  'use strict';

  function generar(JsPDF, QR, d) {
    var nombreCompleto = N.mayus(d.nombres + ' ' + d.apellidos);
    var doc = new JsPDF({ unit: 'pt', format: 'letter', orientation: 'portrait', compress: true });
    doc.setProperties({ title: 'Certificado de promedio - ' + nombreCompleto, creator: 'Portal de servicios digitales Estadística' });
    var CX = 306, X0 = 54, ANCHO = 504;
    function img(src, tipo, x, y, w, h) { if (!src) return; try { doc.addImage(src, tipo, x, y, w, h, undefined, 'FAST'); } catch (e) {} }
    function txt(t, x, y, size, estilo, opts, fuente) {
      doc.setFont(fuente || 'times', estilo || 'normal'); doc.setFontSize(size); doc.setTextColor(0, 0, 0); doc.text(t, x, y, opts || {});
    }

    img(d.marca, 'JPEG', 153.2, 118.4, 305.6, 551.2);
    txt('FUERZAS MILITARES DE COLOMBIA', CX, 95.7, 11, 'bold', { align: 'center' });
    txt('ARMADA DE COLOMBIA', CX, 109.8, 11, 'bold', { align: 'center' });
    img(d.escudo, 'PNG', CX - 21, 112, 42, 51.8);
    txt('ESCUELA NAVAL DE CADETES “ALMIRANTE PADILLA”', CX, 176.1, 11, 'bold', { align: 'center' });
    txt('NIT 800.141.648-9', CX, 188.6, 10.6, 'bold', { align: 'center' });
    txt('Vigilada MinEducación y reconocida como Universidad mediante Resolución No. 11893 de octubre 20 de 1977 y acreditada', CX, 226.1, 8.3, 'italic', { align: 'center' });
    txt('en Alta calidad mediante Resolución No. 007469 de mayo 15 de 2024- Ministerio de Educación Nacional', CX, 235.4, 8.5, 'italic', { align: 'center' });
    txt('LA SECCIÓN DE ESTADÍSTICA', CX, 278.7, 11, 'bold', { align: 'center' });
    txt('C E R T I F I C A:', CX, 307.2, 10.8, 'bold', { align: 'center' });

    var FS = 9.9, LINEA = 12.6;
    function parrafo(tramos, y0) {
      var pal = [];
      tramos.forEach(function (tr) { tr.t.split(/\s+/).filter(Boolean).forEach(function (w) { pal.push({ w: w, b: !!tr.b }); }); });
      pal.forEach(function (p) { doc.setFont('times', p.b ? 'bold' : 'normal'); doc.setFontSize(FS); p.ancho = doc.getTextWidth(p.w); });
      doc.setFont('times', 'normal'); doc.setFontSize(FS); var esp = doc.getTextWidth(' ');
      var lineas = [], act = [], usado = 0;
      pal.forEach(function (p) {
        var nuevo = act.length ? usado + esp + p.ancho : p.ancho;
        if (nuevo > ANCHO && act.length) { lineas.push(act); act = [p]; usado = p.ancho; } else { act.push(p); usado = nuevo; }
      });
      if (act.length) lineas.push(act);
      lineas.forEach(function (l, i) {
        var suma = l.reduce(function (s, p) { return s + p.ancho; }, 0);
        var gap = (i < lineas.length - 1 && l.length > 1) ? (ANCHO - suma) / (l.length - 1) : esp;
        var x = X0, y = y0 + i * LINEA;
        l.forEach(function (p) { txt(p.w, x, y, FS, p.b ? 'bold' : 'normal'); x += p.ancho + gap; });
      });
      return y0 + lineas.length * LINEA;
    }

    var cierre = d.estado === 'actualizado'
      ? 'Este balance académico se encuentra actualizado de acuerdo con el Diplomado de Actualización de ' + d.diplomado + '.'
      : 'Este balance académico se encuentra vigente de acuerdo con la fecha de finalización de estudios plasmada en el balance.';
    var fin1 = parrafo([
      { t: 'Que' }, { t: nombreCompleto + ',', b: true },
      { t: 'identificado(a) con cédula de ciudadanía No. ' + N.cedulaPuntos(d.documento) + (d.lugar ? ' de ' + d.lugar : '') + ', obtuvo promedio ponderado acumulado de ' + d.promedio.toFixed(3) +
        ' (' + N.promedioEnLetras(d.promedio) + ') en el programa de ' + d.programa + ', que culminó académicamente en el periodo ' + d.periodo +
        ', de acuerdo con el Balance Académico emitido el ' + N.fechaCorta(d.fechaBalance) + ' por la facultad de ' + d.facultad + '. ' + cierre }
    ], 324.8);
    var fin2 = parrafo([{ t: 'Este certificado se expide a solicitud de la Facultad de ' + d.facultad + '. Dado en Cartagena de Indias D. T. y C., ' + N.fechaLarga(d.fecha) + '.' }], fin1 + 11.1);
    var yA = fin2 + 11.3;
    txt('ESTE CERTIFICADO FUE GENERADO AUTOMÁTICAMENTE EN EL PORTAL ESTADÍSTICO.', X0, yA, 10.4, 'bold');
    txt('NINGUNA ANOTACIÓN POSTERIOR TIENE VALIDEZ.', X0, yA + 23.8, 10.4, 'bold');

    var f = d.firmante || {};
    img(d.firma, 'PNG', CX - 55, 466, 110, 90.2);
    txt(N.mayus(((f.grado || '') + ' ' + (f.nombre || '')).trim()), CX, 537, 9.9, 'bold', { align: 'center' });
    txt(f.cargo || 'Jefe de Estadística Escuela Naval de Cadetes “Almirante Padilla”', CX, 548.5, 9.6, 'normal', { align: 'center' });

    /* QR de verificación: pequeño, abajo a la derecha; leyenda centrada debajo */
    if (QR && d.codigo) {
      var url = (d.enlace || 'https://enap.vercel.app/verificar') + '?codigo=' + encodeURIComponent(d.codigo);
      var qr = QR(0, 'M'); qr.addData(url); qr.make();
      var n = qr.getModuleCount(), T = 54, cel = T / n, qx = 612 - 10 - 128 + (128 - T) / 2 - 0, qy = 586;
      qx = 612 - 14 - 128 / 2 - T / 2;
      doc.setFillColor(255, 255, 255); doc.rect(qx - 3, qy - 3, T + 6, T + 6, 'F');
      doc.setFillColor(0, 0, 0);
      for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (qr.isDark(r, c)) doc.rect(qx + c * cel, qy + r * cel, cel + 0.15, cel + 0.15, 'F');
      var cx = qx + T / 2;
      txt('Verifique este certificado', cx, qy + T + 11, 7.5, 'bold', { align: 'center' }, 'helvetica');
      txt('Código ' + d.codigo, cx, qy + T + 20, 7.5, 'normal', { align: 'center' }, 'helvetica');
      txt((d.enlace || 'https://enap.vercel.app/verificar').replace(/^https?:\/\//, ''), cx, qy + T + 29, 6.5, 'normal', { align: 'center' }, 'helvetica');
    }

    txt('“Protegemos el azul de la Bandera”', X0, 716.8, 6.05, 'normal', null, 'helvetica');
    txt('Línea anticorrupción Armada Nacional 01 8000 11 69 69 – 24 Horas', X0, 723.7, 6.05, 'normal', null, 'helvetica');
    txt('Barrio Manzanillo, Avenida El Bosque – Conmutador 5-6724610 Ext 143 - Cartagena, Colombia', X0, 730.6, 6.05, 'normal', null, 'helvetica');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.05);
    var enl = ['www.armada.mil.co', ' , ', 'jsea@enap.edu.co'], x = X0, y = 737.5;
    enl.forEach(function (t, i) {
      var w = doc.getTextWidth(t);
      if (i !== 1) { doc.setTextColor(5, 99, 193); doc.text(t, x, y); doc.setDrawColor(5, 99, 193); doc.setLineWidth(0.4); doc.line(x, y + 0.9, x + w, y + 0.9); }
      else { doc.setTextColor(0, 0, 0); doc.text(t, x, y); }
      x += w;
    });
    doc.setTextColor(0, 0, 0);
    return doc;
  }
  return { generar: generar };
});
