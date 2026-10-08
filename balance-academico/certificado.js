/* Certificado de la Sección de Estadística (formato carta). Se emite a partir de un Balance Académico firmado.
   Mismo estilo del certificado institucional, sin la ciudad de expedición de la cédula. */
(function (root) {
  'use strict';

  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var UNI = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince',
    'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis',
    'veintisiete', 'veintiocho', 'veintinueve'];
  var DEC = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];

  function palabras99(n) {
    if (n < 30) return UNI[n];
    var d = Math.floor(n / 10), u = n % 10;
    return DEC[d] + (u ? ' y ' + UNI[u] : '');
  }
  function añoEnLetras(a) {
    if (a >= 2000 && a < 2100) return 'dos mil' + (a === 2000 ? '' : ' ' + palabras99(a - 2000));
    return String(a);
  }
  function puntosEnLetras(p) {            // 7.612 → "SIETE PUNTO SEIS UNO DOS"
    var s = p.toFixed(3), partes = s.split('.');
    var ent = parseInt(partes[0], 10), entL = ent <= 29 ? UNI[ent] : (ent === 30 ? 'treinta' : String(ent));
    var dec = partes[1].split('').map(function (c) { return UNI[parseInt(c, 10)]; }).join(' ');
    return (entL + ' punto ' + dec).toUpperCase();
  }
  function cedula(doc) {                  // 1005311481 → 1.005.311.481
    var d = String(doc || '').replace(/\D/g, '');
    return d.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }
  function fechaCorta(f) { return f.getDate() + ' de ' + MESES[f.getMonth()] + ' de ' + f.getFullYear(); }
  function fechaLarga(f) {
    return 'el día ' + palabras99(f.getDate()) + ' (' + f.getDate() + ') del mes de ' + MESES[f.getMonth()] + ' del año ' + añoEnLetras(f.getFullYear()) + ' (' + f.getFullYear() + ')';
  }

  function generar(JsPDF, d) {
    var doc = new JsPDF({ unit: 'pt', format: 'letter', orientation: 'portrait', compress: true });
    doc.setProperties({ title: 'Certificado - ' + d.nombre, creator: 'Portal ENAP' });
    var CX = 306, X0 = 54, ANCHO = 504;
    function img(src, tipo, x, y, w, h) { if (!src) return; try { doc.addImage(src, tipo, x, y, w, h, undefined, 'FAST'); } catch (e) {} }
    function txt(t, x, y, size, estilo, opts, fuente) {
      doc.setFont(fuente || 'times', estilo || 'normal'); doc.setFontSize(size); doc.setTextColor(0, 0, 0);
      doc.text(t, x, y, opts || {});
    }

    img(d.marca, 'JPEG', 153.2, 118.4, 305.6, 551.2);                     // marca de agua
    txt('FUERZAS MILITARES DE COLOMBIA', CX, 95.7, 11, 'bold', { align: 'center' });
    txt('ARMADA DE COLOMBIA', CX, 109.8, 11, 'bold', { align: 'center' });
    img(d.escudo, 'PNG', CX - 21, 112, 42, 51.8);   // proporción real del escudo (171 x 211): antes se veía aplastado
    txt('ESCUELA NAVAL DE CADETES “ALMIRANTE PADILLA”', CX, 176.1, 11, 'bold', { align: 'center' });
    txt('NIT 800.141.648-9', CX, 188.6, 10.6, 'bold', { align: 'center' });
    txt('Reconocida como Universidad mediante Resolución No. 11893 de octubre 20 de 1977 y acreditada en Alta calidad mediante', CX, 226.1, 8.3, 'italic', { align: 'center' });
    txt('Resolución No. 007469 de mayo 15 de 2024- Ministerio de Educación Nacional', CX, 237.4, 8.5, 'italic', { align: 'center' });
    txt('LA SECCIÓN DE ESTADÍSTICA', CX, 278.7, 11, 'bold', { align: 'center' });
    txt('C E R T I F I C A:', CX, 307.2, 10.8, 'bold', { align: 'center' });

    /* párrafo justificado con tramos en negrilla */
    var FS = 9.9, LINEA = 11.28;
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

    var p1 = [
      { t: 'Que' }, { t: d.nombre.toUpperCase() + ',', b: true },
      { t: 'identificado con No. ' + cedula(d.documento) + ', obtuvo promedio ponderado acumulado de ' + d.promedio.toFixed(3) + ' (' + puntosEnLetras(d.promedio) +
        ') en el programa de ' + d.programa + ', que culminó académicamente en el periodo ' + d.periodo + ', de acuerdo con el Balance Académico emitido el ' + fechaCorta(d.fechaBalance) +
        ' por la facultad de ' + d.facultad + '. Este balance académico se encuentra ' + (d.vencido ? 'actualizado' : 'vigente') + ' de acuerdo con la fecha de finalización de estudios plasmada en el balance.' }
    ];
    var fin1 = parrafo(p1, 334.8);
    var yN = fin1 + 11.1;
    txt('NINGUNA ANOTACIÓN POSTERIOR TIENE VALIDEZ.', X0, yN, 10.4, 'bold');
    txt('ESTE CERTIFICADO FUE GENERADO DIGITALMENTE.', X0, yN + 12.5, 10.4, 'bold');
    parrafo([{ t: 'Este certificado se expide a solicitud de la Facultad de ' + d.facultad + '. Dado en Cartagena de Indias D. T. y C., ' + fechaLarga(d.fecha) }], yN + 35);

    img(d.firma, 'PNG', CX - 55, 458, 110, 90.2);                         // firma de la Jefe de Estadística
    txt('PD02 BEYTY PATRICIA CAMARGO MARTÍNEZ', CX, 537, 9.9, 'bold', { align: 'center' });
    txt('Jefe de Estadística Escuela Naval de Cadetes “Almirante Padilla”', CX, 548.5, 9.6, 'normal', { align: 'center' });

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

  var API = { generar: generar, puntosEnLetras: puntosEnLetras, fechaLarga: fechaLarga, cedula: cedula };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.CERT = API;
})(typeof window !== 'undefined' ? window : this);
