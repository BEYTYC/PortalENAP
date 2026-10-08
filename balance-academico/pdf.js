/* Balance Académico · PDF con la geometría del formato oficial (EDUCA-FT-009-JINEN).
   Página 612 pt de ancho; alto Carta (792) u Oficio (936) según lo que ocupe el balance. Arial (Helvetica en jsPDF), notas con coma y 3 decimales.
   Uso: BalancePDF.generar(jsPDF, {prog, estado, res, logo, marca, firmas}) → doc jsPDF */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BalancePDF = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var X = { area0: 36.6, area1: 50.2, cod0: 50.4, cod1: 80.5, vig0: 81.2, vig1: 251.0, ccod0: 251.7, ccod1: 281.8,
            cnom0: 282.5, cnom1: 453.9, cre0: 454.7, cre1: 494.0, not0: 494.7, not1: 534.1, hab0: 534.8, hab1: 574.2 };
  var LEFT = 36.6, RIGHT = 574.9, G = 9, TOP = 113.4 + G, PITCH = 10.44, PITCH_MAX = 15.6, LINEA = [115, 115, 115];   // LINEA: gris de líneas y bordes   // G: espacio en blanco entre el título y el bloque de datos
  var CARTA = 792, OFICIO = 936, BAJO = 140;   // BAJO: del fin de la tabla al borde de la hoja (totales, observaciones, firmas y margen)
  var AZUL = [226, 238, 250], AZUL2 = [218, 233, 248], GRIS = [242, 242, 242];

  function fmt(n) { return (Math.round(Number(n) * 1000) / 1000).toFixed(3).replace('.', ','); }
  function fmtCred(c) { return c > 0 ? String(c).replace('.', ',') : ''; }

  function partirEtiqueta(t) {
    t = String(t || '');
    var i = t.indexOf('(');
    if (i > 0) return [t.slice(0, i).trim(), t.slice(i)];
    i = t.indexOf(':');
    if (i > 0) return [t.slice(0, i + 1), t.slice(i + 1).trim()];
    var m = t.match(/\s\d+\s*cr[eé]ditos/i);
    if (m) return [t.slice(0, m.index), t.slice(m.index + 1)];
    return [t, ''];
  }

  function generar(JsPDF, o) {
    var prog = o.prog, e = o.estado, res = o.res;
    // los renglones del encabezado (nombre, programa y títulos de columnas) miden lo mismo que los de materias
    function topDe(hr) { return 113.4 + G + 2 * (hr - 11) + (hr - 12.4) + (G - 4.1); }   // el hueco sobre la tabla es igual al hueco sobre el bloque de datos
    var lineasPre = res.lineas.filter(function (l) { return l.kind !== 'optvacia'; }).length;
    // Carta si cabe; si no, Oficio. Solo si ni así cabe, se aprietan los renglones.
    var H = topDe(PITCH) + lineasPre * PITCH + BAJO <= CARTA ? CARTA : OFICIO;
    var doc = new JsPDF({ unit: 'pt', format: [612, H], orientation: 'portrait', compress: true });
    doc.setProperties({ title: 'Balance Académico - ' + (e.estudiante.nombres + ' ' + e.estudiante.apellidos).trim(), creator: 'Portal ENAP' });
    var lineas = res.lineas.filter(function (l) { return l.kind !== 'optvacia'; });
    var N = lineas.length;
    var HR = PITCH_MAX, pitch = PITCH_MAX;
    for (var it0 = 0; it0 < 6; it0++) { pitch = Math.min(PITCH_MAX, (H - BAJO - (2 * pitch - 19.7) - topDe(HR)) / Math.max(N, 1)); HR = pitch; }
    var E1 = HR - 11, GB = G + 2 * E1, GC = GB + (G - 0.8 - 3.3), GT = GC + (HR - 12.4), TOP = topDe(HR);
    var T = TOP + N * pitch;                   // fin de la tabla
    var fs = 6.1 * Math.min(1.1, pitch / PITCH * 1.04);

    function negro(x0, y0, x1, y1) { doc.setFillColor(LINEA[0], LINEA[1], LINEA[2]); doc.rect(x0, y0, x1 - x0, y1 - y0, 'F'); }
    function gris(x0, y0, x1, y1) { doc.setFillColor(GRIS[0], GRIS[1], GRIS[2]); doc.rect(x0, y0, x1 - x0, y1 - y0, 'F'); }
    function fondo(c, x0, y0, x1, y1) { doc.setFillColor(c[0], c[1], c[2]); doc.rect(x0, y0, x1 - x0, y1 - y0, 'F'); }
    function texto(s, x, y, size, bold, align, maxW) {
      s = String(s == null ? '' : s); if (!s) return;
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      var z = size; doc.setFontSize(z);
      if (maxW) { var w = doc.getTextWidth(s); if (w > maxW) { z = size * maxW / w; doc.setFontSize(z); } }
      doc.setTextColor(0, 0, 0);
      doc.text(s, x, y, { align: align || 'left', baseline: 'alphabetic' });
      doc.setFontSize(size);
    }


    /* marca de agua */
    if (o.marca) {
      try {
        doc.saveGraphicsState();
        doc.setGState(new doc.GState({ opacity: o.opacidadMarca || 1 }));
        doc.addImage(o.marca, 'PNG', 297.45 - 342 / 2, 202.4 + (H - 972) / 2, 342, 503.2);   // más angosta: antes se veía estirada a lo ancho
        doc.restoreGraphicsState();
      } catch (err) { /* sin marca de agua */ }
    }

    /* franjas azules (encabezado de tabla, columna de áreas, totales) */
    fondo(AZUL, LEFT, 100.0 + GC, 574.7, 113.2 + GT);       // entre el bloque de datos y la tabla queda un espacio en blanco de 4 pt
    var finPensum = T, iOpt = -1;
    lineas.forEach(function (l, i) { if (iOpt < 0 && l.kind === 'opt') iOpt = i; });
    if (iOpt >= 0) finPensum = TOP + iOpt * pitch;
    fondo(AZUL, LEFT, TOP - 0.3, X.area1, finPensum + 0.3);
    if (iOpt >= 0) fondo(AZUL2, LEFT, finPensum - 0.4, X.area1, T - 0.3);

    /* encabezado */
    negro(37.0, 36.1, 574.9, 36.8); negro(37.0, 72.1, 574.9, 72.9);
    negro(37.0, 72.1 + G, 574.9, 72.9 + G); negro(37.0, 95.6 + GB, 574.9, 96.3 + GB);                  // cierra el bloque de datos
    negro(37.0, 99.6 + GC, 574.9, 100.3 + GC); negro(37.0, 112.7 + GT, 574.9, 113.4 + GT);   // encabezado de la tabla
    negro(36.2, 36.1, 37.0, 72.9); negro(80.5, 36.8, 81.2, 72.9); negro(453.9, 36.8, 454.7, 72.9); negro(574.2, 36.8, 574.9, 72.9);
    negro(36.2, 72.1 + G, 37.0, 96.3 + GB); negro(453.9, 72.1 + G, 454.7, 96.3 + GB); negro(574.2, 72.1 + G, 574.9, 96.3 + GB);
    gris(81.2, 54.1, 453.9, 54.9); gris(454.7, 54.1, 574.2, 54.9); gris(534.1, 54.9, 534.8, 72.1);
    gris(37.0, 83.9 + G + E1, 453.9, 84.6 + G + E1); gris(454.7, 83.9 + G + E1, 574.2, 84.6 + G + E1);

    if (o.logo) { try { doc.addImage(o.logo, 'PNG', 48.0, 38.1, 20.1, 31.1); } catch (err) {} }

    var h = prog.encabezado;
    texto(h.titulo || 'BALANCE ACADÉMICO', 267.2, 49.0, 10.7, true, 'center');
    // “Proceso: Educación” y “Código: …” con la etiqueta en negrilla
    function etiquetaValor(linea, cx, y, size) {
      var i = linea.indexOf(':');
      var a = i > 0 ? linea.slice(0, i + 1) : '', b = i > 0 ? linea.slice(i + 1).trim() : linea;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(size); var wa = doc.getTextWidth(a + ' ');
      doc.setFont('helvetica', 'normal'); var wb = doc.getTextWidth(b);
      var x0 = cx - (wa + wb) / 2;
      texto(a, x0, y, size, true); texto(b, x0 + wa, y, size, false);
    }
    etiquetaValor(h.proceso || 'Proceso: Educación', 267.2, 60.8, 6.1);
    etiquetaValor(h.codigo || 'Código: EDUCA-FT-009-JINEN', 267.2, 69.8, 6.1);
    etiquetaValor(h.autoridad || 'Autoridad: JINEN', 514.5, 47.5, 6.8);
    texto('Rige a partir de:', 495.3, 61.4, 6.1, true, 'center');
    texto(h.rige || '', 495.3, 69.3, 6.1, false, 'center');
    texto('Página', 555.5, 61.3, 6.1, false, 'center');
    (function () {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(6.1); var a = doc.getTextWidth('1');
      doc.setFont('helvetica', 'normal'); var b = doc.getTextWidth(' de ');
      var tot = a + b + a, x0 = 555.5 - tot / 2;
      texto('1', x0, 69.2, 6.1, true); texto(' de ', x0 + a, 69.2, 6.1, false); texto('1', x0 + a + b, 69.2, 6.1, true);
    })();

    var nombreCompleto = (e.estudiante.nombres + ' ' + e.estudiante.apellidos).replace(/\s+/g, ' ').trim().toUpperCase();
    // las dos filas del bloque de datos van centradas verticalmente en su celda (72,9–83,9 y 84,6–95,6)
    var Y1 = 72.9 + G + HR / 2 + 2.3, Y2 = 84.6 + G + E1 + HR / 2 + 2.3;
    texto('NOMBRES Y APELLIDOS:', 47.4, Y1, 6.5, true);
    texto(nombreCompleto, 135.9, Y1, 6.5, false, 'left', 310);
    texto('PROGRAMA ACADÉMICO:', 47.4, Y2, 6.5, true);
    texto(String(prog.nombre || '').toUpperCase(), 135.9, Y2, 6.5, false, 'left', 310);
    texto('Fecha elaboración:', 458.0, Y1, 6.1, true);
    var hoy = new Date();                      // la fecha de elaboración es siempre la del día en que se genera el PDF
    texto(hoy.getDate() + '/' + (hoy.getMonth() + 1) + '/' + hoy.getFullYear(), 536.0, Y1, 6.1, false);
    texto('Periodo de terminación:', 458.0, Y2, 6.1, true);
    texto(res.periodoTerm, 536.0, Y2, 6.1, false);

    /* títulos de columnas */
    var by = 100.3 + GC + HR / 2 + 1.7;
    texto('COD.', 65.5, by, 6.1, true, 'center'); texto('PÉNSUM VIGENTE', 82.2, by, 6.1, true);
    texto('COD.', 266.7, by, 6.1, true, 'center'); texto('PÉNSUM CURSADO', 283.5, by, 6.1, true);
    texto('CRÉDITOS', 474.8, by, 6.1, true, 'center'); texto('NOTA', 514.9, by, 6.1, true, 'center'); texto('HAB.', 555.0, by, 6.1, true, 'center');

    /* separadores finos entre filas */
    var segs = [[X.cod0, X.cod1], [X.vig0, X.vig1], [X.ccod0, X.ccod1], [X.cnom0, X.cnom1], [X.cre0, X.cre1], [X.not0, X.not1], [X.hab0, X.hab1]];
    lineas.forEach(function (l, i) {
      var y = TOP + (i + 1) * pitch - 0.3;
      var desde = l.kind === 'opt' ? 2 : 0;
      for (var s = desde; s < segs.length; s++) gris(segs[s][0], y - 0.7, segs[s][1], y);
    });

    /* filas */
    var gruposOpt = {};
    lineas.forEach(function (l, i) {
      var y = TOP + i * pitch + 7.0 * pitch / PITCH;
      if (l.kind !== 'opt') {
        texto(l.codVig, 65.5, y, fs, false, 'center');
        texto(l.nombreVig, 82.2, y, fs, false, 'left', X.vig1 - 82.2 - 2);
      } else (gruposOpt[l.bloque] = gruposOpt[l.bloque] || []).push(i);
      texto(l.cod, 266.7, y, fs, false, 'center', 29);
      texto(l.nombre, 283.5, y, fs, false, 'left', X.cnom1 - 283.5 - 2);
      texto(fmtCred(l.cred), 474.3, y, fs, false, 'center');
      texto(l.nota != null ? fmt(l.nota) : '', 514.4, y, fs, false, 'center');
      texto(l.hab != null ? fmt(l.hab) : '', 554.5, y, fs, false, 'center');
    });

    /* rótulo de cada bloque de electivas / optativas, centrado en las filas del bloque */
    Object.keys(gruposOpt).forEach(function (k) {
      var idx = gruposOpt[k], a = TOP + idx[0] * pitch, b = TOP + (idx[idx.length - 1] + 1) * pitch;
      var bl = (prog.items.filter(function (it) { return it.id === k; })[0]) || {};
      var p = partirEtiqueta(bl.label || ''), cy = (a + b) / 2 + 2.3;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(fs); var w1 = doc.getTextWidth(p[0] + (p[1] ? ' ' : ''));
      doc.setFont('helvetica', 'normal'); var w2 = doc.getTextWidth(p[1]);
      var x0 = (X.cod0 + X.vig1) / 2 - (w1 + w2) / 2;
      texto(p[0], x0, cy, fs, true); texto(p[1], x0 + w1, cy, fs, false);
    });

    /* rótulos verticales de área (agrupando filas consecutivas) */
    var i = 0;
    while (i < N) {
      var j = i, esOpt = lineas[i].kind === 'opt';
      while (j + 1 < N && lineas[j + 1].area === lineas[i].area && (lineas[j + 1].kind === 'opt') === esOpt) j++;
      var a = TOP + i * pitch, b = TOP + (j + 1) * pitch;
      var t = lineas[i].area, size = esOpt ? 5.3 : 6.1;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(size);
      var w = doc.getTextWidth(t), disp = (b - a) - 3;
      if (w > disp) { size = size * disp / w; doc.setFontSize(size); w = doc.getTextWidth(t); }
      doc.setTextColor(0, 0, 0);
      doc.text(t, (X.area0 + X.area1) / 2 + 0.36 * size + 0.4, (a + b) / 2 + w / 2, { angle: 90 });
      if (b < T - 0.5) negro(37.0, b - 0.6, 574.9, b + 0.1);          // límite entre áreas
      i = j + 1;
    }

    /* líneas verticales y de contorno de la tabla */
    negro(36.2, 99.6 + GC, 37.0, T + 0.0);
    negro(574.2, 100.3 + GC, 574.9, T);
    negro(49.7, TOP, 50.4, T);
    negro(80.5, 100.3 + GC, 81.2, finPensum + 0.4);
    [251.0, 281.8, 453.9, 494.0, 534.1].forEach(function (x) { negro(x, 100.3 + GC, x + 0.7, T); });
    negro(37.0, T - 0.8, 574.9, T);

    /* totales y observaciones: cajas contiguas, una sola línea entre cada una. Los dos renglones de totales miden lo mismo que los de materias. */
    var HB = 2 * pitch, TS = T + HB - 19.7;      // TS: lo que va debajo de los totales se corre lo que crecieron
    fondo(AZUL, LEFT, T, 574.7, T + HB);
    negro(37.0, T + HB - 0.7, 574.9, T + HB);
    negro(36.2, T, 37.0, T + HB); negro(453.9, T, 454.7, T + HB); negro(574.2, T, 574.9, T + HB);
    gris(37.0, T + HB / 2 - 0.35, 453.9, T + HB / 2 + 0.35); gris(454.7, T + HB / 2 - 0.35, 574.2, T + HB / 2 + 0.35);
    texto('TOTAL CRÉDITOS APROBADOS', 443.4, T + HB / 4 + 2.6, 6.1, true, 'right');
    texto(String(res.totalCreditos).replace('.', ','), 514.85, T + HB / 4 + 2.8, 6.8, true, 'center');
    texto('PROMEDIO PONDERADO ACUMULADO', 443.4, T + 3 * HB / 4 + 2.6, 6.1, true, 'right');
    texto(fmt(res.promedio), 514.85, T + 3 * HB / 4 + 2.8, 6.8, true, 'center');
    negro(37.0, TS + 47.9, 574.9, TS + 48.6);
    negro(36.2, TS + 19.7, 37.0, TS + 48.6); negro(574.2, TS + 19.7, 574.9, TS + 48.6);
    texto('OBSERVACIONES:', 47.3, TS + 27.1, 6.1, true);
    (function () {                             // texto libre del jefe: hasta 3 renglones alineados después de la etiqueta
      var obs = String(e.observaciones || '').replace(/\s+/g, ' ').trim();
      if (!obs) return;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(6.1);
      var x0 = 47.3 + doc.getTextWidth('OBSERVACIONES:') + 4, ancho = 570.5 - x0;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.1);
      var ls = doc.splitTextToSize(obs, ancho);
      if (ls.length > 3) { ls = ls.slice(0, 3); var u = ls[2]; while (u.length > 1 && doc.getTextWidth(u + '…') > ancho) u = u.slice(0, -1); ls[2] = u.replace(/\s+$/, '') + '…'; }
      ls.forEach(function (l, i) { texto(l, x0, TS + 27.1 + i * 7.4, 6.1, false); });
    })();

    /* firmas */
    var f = o.firmas || {};
    function bloqueFirma(rol, f1, cx, x0, x1) {
      if (f1 && f1.img) {
        if (!f1.oculta) {                       // “oculta”: la vista previa la dibuja el usuario encima, con el mouse
          var g = geometriaFirma(rol, f1.w, f1.h, f1.pos);
          try { doc.addImage(f1.img, f1.tipo || 'PNG', g.cx - g.w / 2, TS + g.top, g.w, g.h, undefined, 'FAST'); } catch (err) {}
        }
      }
      else if (!(f1 && f1.soloLinea)) {           // soloLinea: el Decano firma aparte, solo queda su línea y su cargo
        doc.setFont('helvetica', 'italic'); doc.setFontSize(7.6); doc.setTextColor(150, 150, 150);
        doc.text('Pendiente de firma', cx, TS + 87.8, { align: 'center' }); doc.setTextColor(0, 0, 0);
      }
      negro(x0, TS + 96.2, x1, TS + 96.9);
      texto(((f1 && f1.nombre) || '').toUpperCase(), cx, TS + 103.5, 7.6, true, 'center', x1 - x0 + 20);
      texto((f1 && f1.cargo) || '', cx, TS + 112.7, 7.6, false, 'center', x1 - x0 + 40);
    }
    bloqueFirma('jefe', f.jefe, 181.6, 80.9, 282.3);
    bloqueFirma('decano', f.decano, 442.1, 349.6, 534.6);
    doc.balanceT = TS;                           // la pantalla lo necesita para ubicar la firma sobre la vista previa
    return doc;
  }

  /* Lugar de la firma: centro horizontal (cx), borde superior (top, desde el inicio del cuadro de firmas) y ancho (w), en puntos.
     Sin posición guardada va donde la plantilla la pone: abajo y centrada sobre la línea de firma. */
  var FIRMA_BASE = { jefe: { cx: 181.6, bw: 137.1 }, decano: { cx: 442.1, bw: 41.0 } }, FIRMA_ALTO = 40, FIRMA_ARRIBA = 65.8;   // la cola de la “g” baja hasta el nombre
  function geometriaFirma(rol, w0, h0, pos) {
    var b = FIRMA_BASE[rol], ratio = w0 && h0 ? h0 / w0 : null, w, h;
    if (ratio) { var k = Math.min(b.bw / w0, FIRMA_ALTO / h0); w = w0 * k; h = h0 * k; } else { w = b.bw; h = FIRMA_ALTO; ratio = h / w; }
    var g = { cx: b.cx, top: FIRMA_ARRIBA + (FIRMA_ALTO - h), w: w, h: h, ratio: ratio };
    if (pos && pos.w > 0) { g.cx = pos.cx; g.top = pos.top; g.w = pos.w; g.h = pos.w * ratio; }
    return g;
  }

  return { generar: generar, geometriaFirma: geometriaFirma };
});
