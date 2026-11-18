/*!
 * Portal de Servicios Digitales Estadística — Escuela Naval de Cadetes "Almirante Padilla"
 * Autora y desarrolladora: CAMARGO MARTÍNEZ BEYTY PATRICIA — Oficina de Estadística
 * Derechos morales de autor reservados (Ley 23 de 1982, art. 30). Este aviso de autoría no debe eliminarse ni alterarse.
 */
/* Lectura de documentos en el navegador: PDF digital (texto) o escaneado/imagen (OCR). Nada sale del equipo hasta que se guarda el resultado.
   Lector.leer(file, tipo) → { texto, escaneado, imagenes:[dataURL jpeg reducido], avisos:[] } */
(function (root) {
  'use strict';
  var BASE = (function () { var s = document.currentScript && document.currentScript.src; return s ? s.replace(/js\/lector\.js.*$/, '') : 'vendor/'.replace('vendor/', ''); })();
  var cargados = {};
  function script(src) {
    if (cargados[src]) return cargados[src];
    return (cargados[src] = new Promise(function (ok, no) { var s = document.createElement('script'); s.src = BASE + src; s.onload = ok; s.onerror = function () { no(new Error('No se pudo cargar ' + src)); }; document.head.appendChild(s); }));
  }
  var worker = null, workerP = null;
  function ocrWorker() {
    if (workerP) return workerP;
    workerP = script('vendor/tesseract.min.js').then(function () {
      return root.Tesseract.createWorker('spa', 1, { workerPath: BASE + 'vendor/worker.min.js', corePath: BASE + 'vendor/tesseract-core-simd-lstm.wasm.js', langPath: BASE + 'vendor/', gzip: true });
    }).then(function (w) { worker = w; return w; });
    return workerP;
  }

  function lienzo(w, h) { var c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
  function cargarImagen(file) {
    return new Promise(function (ok, no) { var u = URL.createObjectURL(file), i = new Image(); i.onload = function () { URL.revokeObjectURL(u); ok(i); }; i.onerror = function () { no(new Error('No se pudo abrir la imagen ' + file.name)); }; i.src = u; });
  }
  function rotar(src, grados) {
    if (!grados) return src;
    var w = src.width, h = src.height, q = grados % 180 !== 0, c = lienzo(q ? h : w, q ? w : h), x = c.getContext('2d');
    x.translate(c.width / 2, c.height / 2); x.rotate(grados * Math.PI / 180); x.drawImage(src, -w / 2, -h / 2); return c;
  }
  function escalar(src, ancho) {
    var f = Math.min(1, ancho / src.width), c = lienzo(src.width * f, src.height * f); c.getContext('2d').drawImage(src, 0, 0, c.width, c.height); return c;
  }
  function jpeg(src, ancho, q) { return escalar(src, ancho).toDataURL('image/jpeg', q || 0.72); }

  /* Texto con OCR de un lienzo; "palabras" para ubicar etiquetas */
  function reconocer(c, opciones) {
    return ocrWorker().then(function (w) {
      return w.setParameters(Object.assign({ tessedit_pageseg_mode: '3', tessedit_char_whitelist: '' }, opciones || {})).then(function () { return w.recognize(c, {}, { text: true, blocks: true }); });
    });
  }
  function palabrasDe(d) {
    var out = []; (d.blocks || []).forEach(function (b) { (b.paragraphs || []).forEach(function (p) { (p.lines || []).forEach(function (l) { (l.words || []).forEach(function (w) { out.push(w); }); }); }); });
    return out.length ? out : (d.words || []);
  }
  function puntaje(t, claves) { t = String(t || '').toUpperCase(); return claves.reduce(function (s, k) { return s + (t.indexOf(k) >= 0 ? 1 : 0); }, 0); }

  /* La orientación se decide por palabras clave (las fotos de cédula suelen venir giradas). */
  var CLAVES = { cedula: ['NUMERO', 'NÚMERO', 'APELLIDOS', 'NOMBRES', 'FECHA DE NACIMIENTO', 'LUGAR DE EXPEDICION', 'REPUBLICA', 'CEDULA'], balance: ['BALANCE', 'PROMEDIO', 'CRÉDITOS', 'CREDITOS', 'PROGRAMA', 'OBSERVACIONES'] };
  function mejorGiro(c, tipo) {
    var claves = CLAVES[tipo] || CLAVES.balance, mejor = null;
    var pequeno = escalar(c, 900), giros = [0, 90, 270, 180];
    return giros.reduce(function (p, g) {
      return p.then(function () {
        if (mejor && mejor.p >= 3) return;
        return reconocer(rotar(pequeno, g)).then(function (r) { var s = puntaje(r.data.text, claves); if (!mejor || s > mejor.p) mejor = { g: g, p: s }; });
      });
    }, Promise.resolve()).then(function () { return mejor ? mejor.g : 0; });
  }

  /* Recuadro sombreado de totales: se desenfoca, se amplía y se prueba con varios umbrales (el texto sobre fondo gris no se lee bien directo). */
  function leerTotales(c, palabras) {
    var ref = palabras.filter(function (w) { return /PROMEDIO/i.test(w.text); }).sort(function (a, b) { return b.bbox.y0 - a.bbox.y0; })[0];
    if (!ref) return Promise.resolve('');
    var y0 = Math.max(0, ref.bbox.y0 - 18), y1 = Math.min(c.height, ref.bbox.y1 + 60), banda = lienzo(c.width, y1 - y0);
    banda.getContext('2d').drawImage(c, 0, y0, c.width, y1 - y0, 0, 0, c.width, y1 - y0);
    var ampl = lienzo(banda.width * 2, banda.height * 2), x = ampl.getContext('2d'); x.filter = 'grayscale(1) blur(1.2px)'; x.drawImage(banda, 0, 0, ampl.width, ampl.height); x.filter = 'none';
    var datos = x.getImageData(0, 0, ampl.width, ampl.height), px = datos.data, suma = 0, n = 0; for (var i = 0; i < px.length; i += 16) { suma += px[i]; n++; }
    var media = suma / n, umbrales = [media * 0.78, media * 0.88, media * 0.95], textos = [];
    return umbrales.reduce(function (p, u) {
      return p.then(function () {
        var t = lienzo(ampl.width, ampl.height), tx = t.getContext('2d'), im = tx.createImageData(ampl.width, ampl.height);
        for (var k = 0; k < px.length; k += 4) { var v = px[k] < u ? 0 : 255; im.data[k] = im.data[k + 1] = im.data[k + 2] = v; im.data[k + 3] = 255; }
        tx.putImageData(im, 0, 0);
        return reconocer(t).then(function (r) { textos.push(r.data.text); });
      });
    }, Promise.resolve()).then(function () { return textos.join('\n'); });
  }

  /* PDF → texto (si hay capa de texto) y lienzos de las páginas */
  function pdfLibre() { return script('vendor/pdf.min.js').then(function () { root.pdfjsLib.GlobalWorkerOptions.workerSrc = BASE + 'vendor/pdf.worker.min.js'; return root.pdfjsLib; }); }
  function pdfTexto(pag) {
    return pag.getTextContent().then(function (tc) {
      var filas = [];
      tc.items.forEach(function (it) { if (!it.str || !it.str.trim()) return; var y = Math.round(it.transform[5] / 3); var f = filas.filter(function (r) { return Math.abs(r.y - y) <= 1; })[0]; if (!f) { f = { y: y, p: [] }; filas.push(f); } f.p.push({ x: it.transform[4], t: it.str }); });
      return filas.sort(function (a, b) { return b.y - a.y; }).map(function (f) { return f.p.sort(function (a, b) { return a.x - b.x; }).map(function (p) { return p.t; }).join(' '); }).join('\n');
    });
  }
  function pdfLienzo(pag, escala) { var v = pag.getViewport({ scale: escala }), c = lienzo(v.width, v.height); return pag.render({ canvasContext: c.getContext('2d'), viewport: v }).promise.then(function () { return c; }); }

  function leer(file, tipo, progreso) {
    progreso = progreso || function () {};
    var esPdf = /pdf$/i.test(file.type) || /\.pdf$/i.test(file.name);
    var res = { texto: '', escaneado: false, imagenes: [], avisos: [] };
    function ocrLienzos(lienzos) {
      res.escaneado = true; var textos = [];
      return lienzos.reduce(function (p, c, i) {
        return p.then(function () {
          progreso('Leyendo página ' + (i + 1) + ' de ' + lienzos.length + '…');
          return mejorGiro(c, tipo).then(function (g) {
            var r = rotar(c, g); res.imagenes.push(jpeg(r, 1500, 0.7));
            return reconocer(r).then(function (o) {
              var t = o.data.text;
              if (tipo !== 'balance') { textos.push(t); return; }
              return leerTotales(r, palabrasDe(o.data)).then(function (extra) { textos.push(t + '\n' + extra); });
            });
          });
        });
      }, Promise.resolve()).then(function () { res.texto = textos.join('\n'); return res; });
    }
    if (!esPdf) return cargarImagen(file).then(function (im) { var c = lienzo(im.width, im.height); c.getContext('2d').drawImage(im, 0, 0); return ocrLienzos([escalar(c, 2600)]); });
    return file.arrayBuffer().then(function (buf) {
      return pdfLibre().then(function (lib) { return lib.getDocument({ data: new Uint8Array(buf) }).promise; }).then(function (pdf) {
        var n = Math.min(pdf.numPages, 8), idx = []; for (var i = 1; i <= n; i++) idx.push(i);
        var textos = [], pags = [];
        return idx.reduce(function (p, i) { return p.then(function () { return pdf.getPage(i).then(function (pg) { pags.push(pg); return pdfTexto(pg).then(function (t) { textos.push(t); }); }); }); }, Promise.resolve()).then(function () {
          var t = textos.join('\n'), util = t.replace(/\s+/g, '').length;
          if (util >= 120 && (tipo !== 'cedula' || /NUMERO|N[ÚU]MERO|APELLIDOS/i.test(t))) {
            res.texto = t; return res;                      /* PDF digital: se lee directo, sin OCR */
          }
          progreso('Documento escaneado: preparando la lectura…');
          return pags.reduce(function (p, pg) { return p.then(function (arr) { return pdfLienzo(pg, 4).then(function (c) { arr.push(c); return arr; }); }); }, Promise.resolve([])).then(ocrLienzos);
        });
      });
    });
  }
  function terminar() { if (worker) { worker.terminate(); worker = null; workerP = null; } }
  root.Lector = { leer: leer, terminar: terminar, jpeg: jpeg };
})(window);
