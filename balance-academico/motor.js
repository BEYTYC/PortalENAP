/* Balance Académico · motor de datos (sin interfaz).
   Funciona en el navegador (window.BalanceMotor) y en Node (module.exports) para pruebas. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BalanceMotor = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ───────── utilidades ───────── */
  function quitarTildes(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function normCode(s) { return String(s == null ? '' : s).toUpperCase().replace(/\s+/g, '').trim(); }
  function normTexto(s) { return quitarTildes(s).toUpperCase().replace(/[^A-Z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim(); }
  function soloDigitos(s) { return String(s == null ? '' : s).replace(/\D+/g, ''); }
  function titulo(s) {
    return String(s || '').toLowerCase().replace(/(^|[\s\-'(])([a-záéíóúüñ])/g, function (m, a, b) { return a + b.toUpperCase(); })
      .replace(/\b(De|Del|La|Las|Los|Y|E)\b/g, function (m, w, i) { return i === 0 ? w : w.toLowerCase(); }).replace(/\b(Ii|Iii|Iv|Vi|Vii|Viii|Ix)\b/g, function (m) { return m.toUpperCase(); });
  }
  /* Notas: siempre 3 decimales y coma (7,950 · 10,000). */
  function fmtNota(n) {
    if (n == null || n === '' || isNaN(n)) return '';
    return (Math.round(Number(n) * 1000) / 1000).toFixed(3).replace('.', ',');
  }
  function fmtFecha(d) { d = d || new Date(); return d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear(); }
  function numero(s) {
    if (typeof s === 'number') return s;
    var t = String(s == null ? '' : s).trim().replace(',', '.');
    var n = parseFloat(t);
    return isNaN(n) ? 0 : n;
  }
  function hash(str) { // FNV-1a, suficiente para detectar cambios
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h * 0x01000193) >>> 0; }
    return ('00000000' + h.toString(16)).slice(-8);
  }

  /* ───────── lector del SMA ───────── */
  var RE_PERIODO = /^\s*(\d{4})\s*-\s*(\d)\b/;

  function parseSMA(texto) {
    var lineas = String(texto || '').replace(/\r/g, '').split('\n');
    var ident = { codigo: '', documento: '', sexo: '', apellidos: '', nombres: '', programa: '', semestre: '' };
    var registros = [], periodos = [], periodoActual = null, avisos = [];
    var cont = {};
    lineas.forEach(function (ln) {
      var celdas = ln.split('\t').map(function (c) { return c.trim(); });
      var c0 = celdas[0] || '';
      var m;
      if (/^c[oó]digo$/i.test(c0) && celdas[1] && /ident/i.test(celdas[1])) {
        ident.codigo = (celdas[1].match(/^(\S+)/) || [])[1] || '';
        m = celdas[1].match(/Ident\.?\s+(\S+)/i); if (m) ident.documento = m[1];
        m = celdas[1].match(/Sexo\s+(\S+)/i); if (m) ident.sexo = m[1];
        return;
      }
      if (/^apellidos$/i.test(c0)) { ident.apellidos = celdas[1] || ''; return; }
      if (/^nombres?$/i.test(c0)) { ident.nombres = celdas[1] || ''; return; }
      if (/^programa$/i.test(c0)) {
        var p = celdas[1] || '';
        m = p.match(/Sem:\s*(\d+)/i); if (m) ident.semestre = m[1];
        ident.programa = p.replace(/\s*Sem:.*$/i, '').trim();
        return;
      }
      m = ln.match(RE_PERIODO);
      if (m && celdas.length === 1) {
        periodoActual = m[1] + ' - ' + m[2];
        if (periodos.indexOf(periodoActual) < 0) periodos.push(periodoActual);
        return;
      }
      // fila de materia: Item, Código, Materia, Crd, 1P..4P, Def, Hab, Final
      if (/^\d+$/.test(c0) && celdas.length >= 10 && periodoActual) {
        var cod = celdas[1];
        var k = periodoActual + '|' + normCode(cod);
        cont[k] = (cont[k] || 0) + 1;
        registros.push({
          key: k + '|' + cont[k], periodo: periodoActual, item: +c0,
          cod: cod, nombre: celdas[2], crd: numero(celdas[3]),
          p: [numero(celdas[4]), numero(celdas[5]), numero(celdas[6]), numero(celdas[7])],
          def: numero(celdas[8]), hab: numero(celdas[9]), final: numero(celdas[10])
        });
      }
    });
    return { identidad: ident, periodos: periodos, registros: registros, avisos: avisos };
  }

  function firmaRegistro(r) { return [r.periodo, normCode(r.cod), r.def, r.hab, r.p.join(',')].join('|'); }

  /* Une varios pegados; los grupos repetidos (mismo periodo, código y notas) se cuentan una vez. */
  function unirSMA(textos) {
    var vistos = {}, registros = [], periodos = [], ids = [], cont = {};
    (textos || []).forEach(function (t, idx) {
      var s = parseSMA(t);
      var estaVez = {};
      s.registros.forEach(function (r) {
        var f = firmaRegistro(r);
        if (vistos[f] != null && vistos[f] !== idx) return;      // repetido de un pegado anterior
        vistos[f] = idx; estaVez[f] = (estaVez[f] || 0) + 1;
        var base = r.periodo + '|' + normCode(r.cod);
        cont[base] = (cont[base] || 0) + 1;
        r.key = base + '|' + cont[base];
        registros.push(r);
      });
      s.periodos.forEach(function (p) { if (periodos.indexOf(p) < 0) periodos.push(p); });
      if (s.identidad.documento || s.identidad.nombres || s.identidad.apellidos) ids.push(s.identidad);
    });
    periodos.sort(compararPeriodo);
    return { identidades: ids, periodos: periodos, registros: registros };
  }

  function compararPeriodo(a, b) {
    var x = String(a).split(/\s*-\s*/), y = String(b).split(/\s*-\s*/);
    return (+x[0] - +y[0]) || (+x[1] - +y[1]);
  }

  /* Periodo de terminación: el último con notas. Como en la plantilla, 3 o más cuenta como 2. */
  function periodoTerminacion(registros) {
    var ult = null;
    registros.forEach(function (r) {
      if (!(r.def > 0 || r.hab > 0 || r.final > 0)) return;
      if (!ult || compararPeriodo(r.periodo, ult) > 0) ult = r.periodo;
    });
    if (!ult) return '';
    var p = ult.split(/\s*-\s*/);
    return p[0] + ' - ' + (+p[1] > 2 ? 2 : p[1]);
  }

  /* ───────── verificación de identidad ───────── */
  function fichaNombre(s) { return normTexto(s).split(' ').filter(Boolean).sort().join(' '); }

  /* est: {nombres, apellidos, tipoDoc: 'CC'|'PA'|'CE'..., documento}.
     Devuelve {ok, errores[], avisos[]}; los errores bloquean la creación. */
  function verificarEstudiante(smaUnido, est) {
    var errores = [], avisos = [];
    var ids = smaUnido.identidades || [];
    if (!ids.length) {
      errores.push('No se encontró el encabezado del estudiante en lo pegado. Copie el historial completo desde el SMA, con “Código … N° Ident.”, apellidos y nombre.');
      return { ok: false, errores: errores, avisos: avisos };
    }
    var docs = {};
    ids.forEach(function (i) { if (i.documento) docs[soloDigitos(i.documento)] = 1; });
    if (Object.keys(docs).length > 1) errores.push('Lo pegado trae más de un número de identificación. Pegue solo las notas de este estudiante.');
    var esCedula = /^(cc|c\.c|cedula|cédula|cedula de ciudadania)/i.test(String(est.tipoDoc || 'CC').trim());
    var nombreSolicitud = fichaNombre((est.nombres || '') + ' ' + (est.apellidos || ''));
    var nombresSMA = ids.map(function (i) { return fichaNombre((i.nombres || '') + ' ' + (i.apellidos || '')); });
    var coincideNombre = nombresSMA.every(function (n) { return n === nombreSolicitud; });
    if (esCedula) {
      var docSol = soloDigitos(est.documento);
      var iguales = Object.keys(docs).every(function (d) { return d === docSol; });
      if (!iguales) errores.push('La cédula del SMA no es la de la solicitud. Revise la cédula en la solicitud o en el SMA.');
      else if (!coincideNombre) avisos.push('La cédula coincide, pero el nombre del SMA es distinto al de la solicitud. Verifique que sea el mismo estudiante.');
    } else {
      if (!coincideNombre) errores.push('Los nombres del SMA no coinciden con los de la solicitud. Con pasaporte o cédula de extranjería solo se comparan los nombres.');
    }
    return { ok: errores.length === 0, errores: errores, avisos: avisos };
  }

  /* ───────── estado del balance ───────── */
  function nuevoEstado(programaId, estudiante, quien) {
    var e = {
      v: 1, programaId: programaId,
      estudiante: {
        nombres: estudiante.nombres || '', apellidos: estudiante.apellidos || '',
        tipoDoc: estudiante.tipoDoc || 'CC', documento: estudiante.documento || '', nivel: estudiante.nivel || ''
      },
      textos: [],          // notas pegadas tal cual salen del SMA
      ediciones: {},       // idFila -> {cod, nombre}  (solo código y nombre cursado, nunca notas)
      vinculos: {},        // idFila -> key de registro SMA (equivalencia aplicada por el jefe)
      optativas: [],       // [{bloque, reg, cod?, nombre?}]
      observaciones: '',   // texto libre del jefe que sale en el recuadro OBSERVACIONES del PDF
      creado: new Date().toISOString(),
      firmas: { jefe: null, decano: null },
      bitacora: []
    };
    registrar(e, quien, 'creó el balance');
    return e;
  }

  function registrar(e, quien, accion, detalle) {
    e.bitacora.push({ t: new Date().toISOString(), quien: quien || '', accion: accion, detalle: detalle || '' });
  }

  /* Lo que firman: si esto cambia, la firma deja de valer. */
  function huella(e) {
    return hash(JSON.stringify({
      p: e.programaId, s: e.estudiante, t: e.textos.map(function (x) { return hash(x); }),
      d: e.ediciones, v: e.vinculos, o: e.optativas,
      b: e.observaciones || undefined      // vacío no cambia la huella: los balances anteriores siguen válidos
    }));
  }

  var MAX_OBSERVACIONES = 400;
  function editarObservaciones(e, texto, quien) {
    var t = String(texto == null ? '' : texto).replace(/\s+/g, ' ').trim().slice(0, MAX_OBSERVACIONES);
    if (t === (e.observaciones || '')) return false;
    e.observaciones = t;
    registrar(e, quien, t ? 'editó las observaciones' : 'borró las observaciones', t ? t.slice(0, 80) + (t.length > 80 ? '…' : '') : '');
    return true;
  }

  function estadoFirmas(e) {
    var h = huella(e);
    function vig(f) { return !!(f && f.huella === h); }
    var j = vig(e.firmas.jefe), d = vig(e.firmas.decano);
    return { jefe: j, decano: d, huella: h,
      jefeObsoleta: !!(e.firmas.jefe && !j), decanoObsoleta: !!(e.firmas.decano && !d),
      fase: d ? 'firmado' : j ? 'cerrado_jefe' : 'borrador' };
  }

  function agregarNotas(e, texto, quien) {
    var t = String(texto || '').trim();
    if (!t) return { agregados: 0 };
    var antes = unirSMA(e.textos).registros.length;
    e.textos.push(t);
    var despues = unirSMA(e.textos).registros.length;
    var n = despues - antes;
    if (n <= 0) { e.textos.pop(); return { agregados: 0 }; }
    registrar(e, quien, 'pegó notas del SMA', n + ' asignaturas nuevas');
    return { agregados: n };
  }

  function editarCursado(e, fila, campo, valor, quien, etiqueta) {
    var ed = e.ediciones[fila.id] || (e.ediciones[fila.id] = {});
    var antes = ed[campo] != null ? ed[campo] : (campo === 'cod' ? fila.cod : fila.nombre);
    valor = String(valor || '').trim();
    if (valor === String(antes || '')) return false;
    if (valor === '') delete ed[campo]; else ed[campo] = valor;
    registrar(e, quien, 'cambió el ' + (campo === 'cod' ? 'código' : 'nombre') + ' de ' + (etiqueta || fila.nombreVig),
      '“' + (antes || '—') + '” → “' + (valor || '—') + '”');
    return true;
  }

  function aplicarEquivalencia(e, fila, reg, quien) {
    e.vinculos[fila.id] = reg.key;
    registrar(e, quien, 'aplicó equivalencia a ' + fila.nombreVig,
      reg.cod + ' ' + reg.nombre + ' (' + reg.periodo + ') → ' + (fila.codVig || 'espacio de electiva'));
  }
  function quitarEquivalencia(e, fila, quien) {
    delete e.vinculos[fila.id];
    registrar(e, quien, 'quitó la equivalencia de ' + fila.nombreVig);
  }
  function agregarOptativa(e, bloque, reg, quien) {
    e.optativas.push({ bloque: bloque.id, reg: reg.key });
    registrar(e, quien, 'agregó optativa a ' + bloque.label, reg.cod + ' ' + reg.nombre);
  }
  function quitarOptativa(e, regKey, quien, nombre) {
    e.optativas = e.optativas.filter(function (o) { return o.reg !== regKey; });
    registrar(e, quien, 'quitó una optativa', nombre || regKey);
  }
  function editarOptativa(e, regKey, campo, valor, quien, antes) {
    var o = e.optativas.filter(function (x) { return x.reg === regKey; })[0];
    if (!o) return false;
    valor = String(valor || '').trim();
    if (valor === String(antes || '')) return false;
    o[campo] = valor;
    registrar(e, quien, 'cambió el ' + (campo === 'cod' ? 'código' : 'nombre') + ' de una optativa', '“' + (antes || '—') + '” → “' + valor + '”');
    return true;
  }

  /* ───────── cruce con el pénsum ───────── */
  function aprobada(reg, minimo) { return reg.def >= minimo || reg.hab >= minimo; }
  function conNota(reg) { return reg.def > 0 || reg.hab > 0 || reg.final > 0; }

  function truncado(n) { return /\.\.\.|…/.test(String(n || '')); }
  function esMayusculas(n) { n = String(n || ''); return n === n.toUpperCase() && n !== n.toLowerCase(); }

  /* Índice de nombres completos del programa: pénsum, equivalencias (todas las columnas), optativas y electivas. */
  function indiceNombres(prog) {
    if (prog._indiceNombres) return prog._indiceNombres;
    var vistos = {}, lista = [];
    function add(cod, nombre) {
      nombre = String(nombre || '').trim();
      if (!nombre || truncado(nombre)) return;
      var k = normTexto(nombre) + '|' + normCode(cod);
      if (vistos[k]) return; vistos[k] = 1;
      lista.push({ cod: normCode(cod), nombre: nombre, tokens: normTexto(nombre).split(' ') });
    }
    Object.keys(prog.catalogo).forEach(function (k) { add(k, prog.catalogo[k].nombre); });
    Object.keys(prog.equivalencias).forEach(function (k) {
      var e = prog.equivalencias[k]; add(k, e.nombre);
      e.alts.forEach(function (a) { add(a.cod, a.nombre); });
    });
    prog._indiceNombres = lista;
    return lista;
  }
  /* “FUNDAMENTOS DE ...” o “PROCED. DISCIPL...” → el nombre completo si hay uno solo posible. */
  function completarTruncado(prog, cod, nombreSMA) {
    var base = String(nombreSMA || '').replace(/(\.\.\.|…).*$/, '');
    var pt = normTexto(base).split(' ').filter(Boolean);
    if (!pt.length) return null;
    var c = normCode(cod);
    var cand = indiceNombres(prog).filter(function (x) {
      if (x.tokens.length < pt.length) return false;
      for (var i = 0; i < pt.length; i++) if (x.tokens[i].indexOf(pt[i]) !== 0) return false;
      return true;
    });
    if (!cand.length) return null;
    var mismo = cand.filter(function (x) { return x.cod === c; });
    var pool = mismo.length ? mismo : cand;
    var nombres = {}; pool.forEach(function (x) { nombres[normTexto(x.nombre)] = x.nombre; });
    var ks = Object.keys(nombres);
    return ks.length === 1 ? nombres[ks[0]] : null;
  }
  /* Nombre completo con el que sale en el balance: Excel del programa primero; el SMA solo si no hay otro. */
  function nombreCompleto(prog, cod, nombreSMA) {
    var c = prog.catalogo[normCode(cod)];
    if (c && c.nombre) return c.nombre;
    if (truncado(nombreSMA)) return completarTruncado(prog, cod, nombreSMA) || nombreSMA;
    return esMayusculas(nombreSMA) ? titulo(nombreSMA) : nombreSMA;
  }

  function minimoAprobacion(prog, est) {
    var nivel = (est && est.nivel) || prog.nivel || 'pregrado';
    return /pos/i.test(nivel) ? 7 : 6;
  }

  /* prog: resultado de LectorExcel.parsePrograma · e: estado del balance */
  function calcular(prog, e) {
    var sma = unirSMA(e.textos);
    var registros = sma.registros;
    var minimo = minimoAprobacion(prog, e.estudiante);
    var porClave = {}, porCodigo = {};
    registros.forEach(function (r) {
      porClave[r.key] = r;
      var c = normCode(r.cod);
      (porCodigo[c] = porCodigo[c] || []).push(r);
    });
    function ultimo(lista) {  // la nota vale del último periodo cursado (repetición)
      var mejor = null;
      lista.forEach(function (r) {
        if (!mejor || compararPeriodo(r.periodo, mejor.periodo) > 0 || (r.periodo === mejor.periodo && r.item > mejor.item)) mejor = r;
      });
      return mejor;
    }

    var usados = {};            // códigos del SMA que ya sirvieron a una fila
    var regsUsados = {};
    var lineas = [], bloques = [], faltantes = [];
    var optPorBloque = {};
    e.optativas.forEach(function (o) { (optPorBloque[o.bloque] = optPorBloque[o.bloque] || []).push(o); });

    prog.items.forEach(function (it) {
      if (it.kind === 'mat' || it.kind === 'slot') {
        var ed = e.ediciones[it.id] || {};
        var reg = null, origen = '', via = '';
        if (e.vinculos[it.id] && porClave[e.vinculos[it.id]]) {
          reg = porClave[e.vinculos[it.id]]; origen = 'manual';
          var lm = porCodigo[normCode(reg.cod)];
          reg = ultimo(lm) || reg; // si repitió esa materia, vale la última
        } else if (it.kind === 'mat') {
          var cand = [];
          if (ed.cod) cand.push({ c: normCode(ed.cod), o: 'codigo-editado' });
          cand.push({ c: normCode(it.cod), o: 'codigo' });
          var eq = prog.equivalencias[normCode(it.cod)];
          if (eq) eq.alts.forEach(function (a, i) { cand.push({ c: normCode(a.cod), o: 'equiv' + (i + 1) }); });
          for (var i = 0; i < cand.length && !reg; i++) {
            var lista = porCodigo[cand[i].c];
            if (lista && lista.length) { reg = ultimo(lista); origen = cand[i].o; }
          }
        }
        var linea = {
          id: it.id, kind: it.kind, area: it.area, codVig: it.cod || '', nombreVig: it.nombre, cred: it.cred,
          estado: 'falta', cod: ed.cod || '', nombre: ed.nombre || '', nota: null, hab: null, periodo: '',
          origen: origen, regKey: reg ? reg.key : '', editado: !!(ed.cod || ed.nombre), nombreTruncado: false
        };
        if (reg) {
          usados[normCode(reg.cod)] = true; regsUsados[reg.key] = true;
          (porCodigo[normCode(reg.cod)] || []).forEach(function (r) { regsUsados[r.key] = true; });
          var sinCredito = !(it.cred > 0);
          var ok = sinCredito ? conNota(reg) : aprobada(reg, minimo);
          linea.estado = ok ? 'ok' : 'perdida';
          linea.nota = reg.def; linea.hab = reg.hab > 0 ? reg.hab : null; linea.periodo = reg.periodo;
          if (!linea.cod) linea.cod = reg.cod;
          if (!linea.nombre) {
            if (normCode(reg.cod) === normCode(it.cod)) linea.nombre = it.nombre;
            else {
              linea.nombre = nombreCompleto(prog, reg.cod, reg.nombre);
            }
          }
          linea.nombreTruncado = truncado(linea.nombre);
        }
        if (linea.estado !== 'ok') faltantes.push(linea);
        lineas.push(linea);
      } else if (it.kind === 'bloque') {
        var sel = optPorBloque[it.id] || [];
        var credSel = 0, filas = [];
        sel.forEach(function (o) {
          var r = porClave[o.reg];
          if (!r) return;
          regsUsados[r.key] = true; usados[normCode(r.cod)] = true;
          (porCodigo[normCode(r.cod)] || []).forEach(function (x) { regsUsados[x.key] = true; });
          var cat = prog.catalogo[normCode(r.cod)];
          var cred = cat && cat.cred > 0 ? cat.cred : r.crd;
          var okOpt = aprobada(r, minimo);
          var nombre = o.nombre || nombreCompleto(prog, r.cod, r.nombre);
          credSel += okOpt ? cred : 0;
          filas.push({
            id: it.id + ':' + r.key, kind: 'opt', bloque: it.id, area: it.area, codVig: '', nombreVig: '', cred: cred,
            estado: okOpt ? 'ok' : 'perdida', cod: o.cod || r.cod, nombre: nombre,
            nota: r.def, hab: r.hab > 0 ? r.hab : null, periodo: r.periodo, origen: 'optativa', regKey: r.key,
            nombreTruncado: truncado(nombre), editado: !!(o.cod || o.nombre)
          });
        });
        var satisfecho = credSel >= it.req && it.req > 0 ? true : (it.req === 0 ? filas.length > 0 : false);
        bloques.push({ id: it.id, label: it.label, area: it.area, req: it.req, sel: credSel, ok: satisfecho });
        if (!filas.length) {
          var vacia = { id: it.id + ':vacia', kind: 'optvacia', bloque: it.id, area: it.area, codVig: '', nombreVig: it.label, cred: 0, estado: 'falta', cod: '', nombre: '', nota: null, hab: null, periodo: '', origen: '', regKey: '' };
          lineas.push(vacia);
        } else filas.forEach(function (f, i) { f.etiqueta = i === 0 ? it.label : ''; lineas.push(f); });
        if (!satisfecho) faltantes.push({ id: it.id, kind: 'bloque', nombreVig: it.label + ' (' + credSel + ' de ' + it.req + ' créditos)' });
      }
    });

    // asignaturas del SMA que no entraron: candidatas para equivalencias u optativas (la más reciente de cada código)
    var sinUsar = [], vistoCod = {};
    registros.slice().sort(function (a, b) { return compararPeriodo(b.periodo, a.periodo) || b.item - a.item; }).forEach(function (r) {
      if (regsUsados[r.key]) return;
      var c = normCode(r.cod);
      if (usados[c] || vistoCod[c]) return;
      vistoCod[c] = true; sinUsar.push(r);
    });

    // totales
    var total = 0, suma = 0, aprobadas = 0, filasPensum = 0, ptos = 0;
    lineas.forEach(function (l) {
      if (l.kind === 'mat' || l.kind === 'slot') { filasPensum++; if (l.estado === 'ok') aprobadas++; }
      if (l.estado === 'ok') { total += l.cred; if (l.cred > 0 && l.nota != null) { suma += l.cred * l.nota; ptos += l.cred; } }
    });
    var promedio = ptos > 0 ? suma / ptos : 0;
    var avisosNombre = lineas.filter(function (l) { return l.nombreTruncado; }).length;   // con puntos suspensivos: el jefe debe completarlos
    return {
      lineas: lineas, bloques: bloques, sinUsar: sinUsar, minimo: minimo,
      totalCreditos: total, promedio: promedio, periodoTerm: periodoTerminacion(registros),
      cruzadas: aprobadas, totalFilas: filasPensum, faltantes: faltantes, avisosNombre: avisosNombre,
      completo: faltantes.length === 0 && avisosNombre === 0 && filasPensum > 0 && registros.length > 0,
      registros: registros, sma: sma
    };
  }

  return {
    normCode: normCode, normTexto: normTexto, titulo: titulo, fmtNota: fmtNota, fmtFecha: fmtFecha,
    parseSMA: parseSMA, unirSMA: unirSMA, periodoTerminacion: periodoTerminacion, compararPeriodo: compararPeriodo,
    verificarEstudiante: verificarEstudiante, nuevoEstado: nuevoEstado, registrar: registrar,
    agregarNotas: agregarNotas, editarCursado: editarCursado, aplicarEquivalencia: aplicarEquivalencia,
    quitarEquivalencia: quitarEquivalencia, agregarOptativa: agregarOptativa, quitarOptativa: quitarOptativa,
    editarOptativa: editarOptativa, huella: huella, estadoFirmas: estadoFirmas, editarObservaciones: editarObservaciones, MAX_OBSERVACIONES: MAX_OBSERVACIONES, calcular: calcular,
    minimoAprobacion: minimoAprobacion, hash: hash
  };
});
