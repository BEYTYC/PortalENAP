/* Lee un Excel de Balance (hoja Balance + Equivalencia + Optativas/Electivas) y lo convierte en el pénsum vigente.
   Navegador: LectorExcel.cargarPrograma(meta) · Node: parsePrograma(XLSX, wb, meta). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LectorExcel = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function txt(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); }
  function nCod(s) { return String(s == null ? '' : s).toUpperCase().replace(/\s+/g, '').trim(); }
  function esNum(v) { return typeof v === 'number' && !isNaN(v); }
  var RE_CODIGO = /^[A-Za-z]{1,5}\s?\d[\d.]*[A-Za-z]?$/;
  function pareceCodigo(s) {
    s = txt(s);
    return RE_CODIGO.test(s) && (s.match(/\d/g) || []).length >= 2;
  }
  var RE_BLOQUE = /electiv|optativ|obligatori/i;

  function filas(XLSX, wb, nombre) {
    var h = wb.Sheets[nombre];
    if (!h) return [];
    return XLSX.utils.sheet_to_json(h, { header: 1, defval: '', raw: true });
  }

  function parsePrograma(XLSX, wb, meta) {
    var rows = filas(XLSX, wb, 'Balance');
    if (!rows.length) throw new Error('El archivo ' + meta.archivo + ' no tiene la hoja “Balance”.');
    var c = function (r, i) { return rows[r] ? txt(rows[r][i]) : ''; };

    var encabezado = {
      titulo: c(2, 4) || 'BALANCE ACADÉMICO', autoridad: c(2, 9),
      proceso: c(4, 4), rige: c(4, 9).replace(/^Rige a partir de:?\s*/i, ''), codigo: c(5, 4)
    };

    var ini = -1, fin = rows.length;
    for (var i = 0; i < rows.length; i++) {
      if (ini < 0 && /^COD\.?$/i.test(txt(rows[i][2]))) { ini = i; continue; }
      if (ini >= 0 && /^TOTA/i.test(txt(rows[i][2]))) { fin = i; break; }
    }
    if (ini < 0) throw new Error('No se encontró la tabla del pénsum en ' + meta.archivo);

    var items = [], area = '', bloque = null, cuentaSlots = 0, usados = {};
    function idUnico(base) {
      var k = base, n = 1;
      while (usados[k]) { n++; k = base + '#' + n; }
      usados[k] = true; return k;
    }
    for (var r = ini + 1; r < fin; r++) {
      var row = rows[r];
      var C = txt(row[2]), D = txt(row[3]), E = txt(row[4]), J = row[9];
      if (!C && !D && !E && !row[6] && !row[7] && J === '') continue;
      // en algunas plantillas el rótulo “Optativas: 8 créditos” está en la columna del código
      if (D && !E && RE_BLOQUE.test(D) && !pareceCodigo(D)) { E = D; D = ''; }

      if (D && E) {                                   // asignatura del pénsum vigente
        if (C) area = C;
        bloque = null;
        items.push({ kind: 'mat', id: idUnico(nCod(D)), area: area, cod: D, nombre: E, cred: esNum(J) ? J : 0 });
        continue;
      }
      var etiqueta = C + ' ' + E;
      if (!D && RE_BLOQUE.test(etiqueta)) {           // arranca un bloque de electivas / optativas
        var conCred = /cr[eé]ditos/i.test(E) ? E : (/cr[eé]ditos/i.test(C) ? C : '');
        var req = 0, m = (C + ' ' + E).match(/(\d+)\s*cr[eé]ditos?/i);
        if (m) req = +m[1];
        var areaB = C.replace(/[:\s]*\d+\s*cr[eé]ditos?.*$/i, '').trim() || 'Electivas';
        var slotAqui = E && !/cr[eé]ditos/i.test(E) && esNum(J);
        if (slotAqui) {                               // Maestría Gestión Logística: “Electiva I… III” fijas
          cuentaSlots++;
          items.push({ kind: 'slot', id: 'slot' + cuentaSlots, area: areaB, cod: '', nombre: E, cred: J });
          bloque = { slots: true, area: areaB };
        } else {
          var etq = conCred || C || E;
          bloque = { slots: false, area: areaB };
          items.push({ kind: 'bloque', id: idUnico('bloque' + (items.length + 1)), area: areaB, label: etq, req: req });
        }
        continue;
      }
      if (bloque && !D && E && !/cr[eé]ditos/i.test(E) && esNum(J) && bloque.slots) {
        cuentaSlots++;
        items.push({ kind: 'slot', id: 'slot' + cuentaSlots, area: bloque.area, cod: '', nombre: E, cred: J });
        continue;
      }
      if (!D && !E && C && !bloque) { area = C; continue; }   // rótulo de área suelto
      // el resto son filas de ejemplo del bloque (códigos cursados de otro estudiante): se ignoran
    }

    // Maestría Gestión Logística: el último bloque de slots no lleva etiqueta de créditos
    items.forEach(function (it) {
      if (it.kind === 'bloque' && it.req === 0) {
        // sin créditos exigidos en la plantilla: se pide al menos una asignatura
      }
    });

    // firmantes
    var jefe = '', decano = '';
    for (var k = fin; k < rows.length; k++) {
      rows[k].forEach(function (v) {
        var t = txt(v);
        if (/^jefe/i.test(t) && !jefe) jefe = t;
        if (/^decano/i.test(t) && !decano) decano = t;
      });
    }

    // equivalencias y catálogo de nombres
    var eq = {}, catalogo = {};
    function aCat(cod, nombre, cred) {
      var k = nCod(cod);
      if (!k || !pareceCodigo(cod)) return;
      var cur = catalogo[k] || (catalogo[k] = { cod: txt(cod), nombre: '', cred: 0 });
      if (!cur.nombre && txt(nombre)) cur.nombre = txt(nombre);
      if (!(cur.cred > 0) && esNum(cred) && cred > 0) cur.cred = cred;
    }
    var eqRows = filas(XLSX, wb, 'Equivalencia');
    for (var q = 1; q < eqRows.length; q++) {
      var er = eqRows[q];
      var v = nCod(er[0]);
      if (!v) continue;
      aCat(er[0], er[1], er[2]);
      var alts = [];
      [[4, 5], [7, 8]].forEach(function (p) {
        if (nCod(er[p[0]])) { alts.push({ cod: txt(er[p[0]]), nombre: txt(er[p[1]]) }); aCat(er[p[0]], er[p[1]]); }
      });
      var cur = eq[v] || (eq[v] = { nombre: txt(er[1]), alts: [] });
      alts.forEach(function (a) { if (!cur.alts.some(function (x) { return nCod(x.cod) === nCod(a.cod); })) cur.alts.push(a); });
    }
    ['Optativas', 'Electivas'].forEach(function (hoja) {
      filas(XLSX, wb, hoja).forEach(function (fr) {
        for (var j = 0; j < fr.length - 1; j++) {
          if (pareceCodigo(fr[j]) && txt(fr[j + 1]) && !pareceCodigo(fr[j + 1])) aCat(fr[j], fr[j + 1], fr[j + 2]);
        }
      });
    });
    // el pénsum vigente manda sobre cualquier otro nombre
    items.forEach(function (it) { if (it.kind === 'mat') { var k = nCod(it.cod); catalogo[k] = { cod: it.cod, nombre: it.nombre, cred: it.cred || (catalogo[k] && catalogo[k].cred) || 0 }; } });

    return {
      meta: meta, id: meta.id, nombre: meta.nombre, nivel: meta.nivel,
      encabezado: encabezado, items: items, equivalencias: eq, catalogo: catalogo,
      firmantes: { jefe: jefe || 'Jefe de Programa', decano: decano || 'Decano de Facultad' }
    };
  }

  /* Navegador: obtiene el Excel y lo lee con SheetJS.
     `proveedor(meta)` devuelve una promesa con un ArrayBuffer (Apps Script lo trae de Drive);
     sin proveedor se descarga de ../balances/ (misma carpeta que usa el portal). */
  var cache = {};
  function cargarPrograma(meta, base, proveedor) {
    if (cache[meta.id]) return Promise.resolve(cache[meta.id]);
    var obtener = proveedor ? proveedor(meta) : fetch((base || '../balances/') + encodeURIComponent(meta.archivo)).then(function (r) {
      if (!r.ok) throw new Error('No se pudo abrir ' + meta.archivo + ' (' + r.status + ').');
      return r.arrayBuffer();
    });
    return Promise.resolve(obtener).then(function (buf) {
      var wb = XLSX.read(buf, { type: 'array' });
      var p = parsePrograma(XLSX, wb, meta);
      cache[meta.id] = p;
      return p;
    });
  }

  return { parsePrograma: parsePrograma, cargarPrograma: cargarPrograma, pareceCodigo: pareceCodigo };
});
