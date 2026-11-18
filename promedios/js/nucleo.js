/*!
 * Portal de Servicios Digitales Estadística — Escuela Naval de Cadetes "Almirante Padilla"
 * Autora y desarrolladora: CAMARGO MARTÍNEZ BEYTY PATRICIA — Oficina de Estadística
 * Derechos morales de autor reservados (Ley 23 de 1982, art. 30). Este aviso de autoría no debe eliminarse ni alterarse.
 */
/* Núcleo de Generación de Promedios Académicos: reglas y lectura de texto, sin pantalla.
   Funciona igual en el navegador y en Node (para probarlo). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PromediosNucleo = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ------------------------------ Texto ------------------------------ */
  /* Quita tildes y pasa a mayúscula, pero conserva la Ñ (CASTANO ≠ CASTAÑO). */
  function sinTildes(s) {
    return String(s == null ? '' : s).replace(/ñ/g, '\u0001').replace(/Ñ/g, '\u0002').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/\u0001/g, 'Ñ').replace(/\u0002/g, 'Ñ').toUpperCase();
  }
  function norm(s) { return sinTildes(s).replace(/[^A-Z0-9Ñ]+/g, ' ').trim(); }
  function mayus(s) { return String(s || '').replace(/\s+/g, ' ').trim().toUpperCase(); }
  function lev(a, b) {
    var m = a.length, n = b.length; if (!m) return n; if (!n) return m;
    var d = []; for (var i = 0; i <= m; i++) { d[i] = [i]; } for (var j = 1; j <= n; j++) d[0][j] = j;
    for (i = 1; i <= m; i++) for (j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[m][n];
  }
  function similitud(a, b) { a = norm(a); b = norm(b); var L = Math.max(a.length, b.length); return L ? 1 - lev(a, b) / L : 1; }

  /* ------------------------------ Programas ------------------------------ */
  /* Equivalencia programa → sigla → nivel. La facultad la completa Estadística en Ajustes
     (lo que no se sabe queda vacío: nunca se inventa). */
  var PROGRAMAS = [
    { id: 'cn-navales', nombre: 'Ciencias Navales para Oficiales Navales', sigla: 'NAV', nivel: 'pregrado', facultad: 'Ciencias Navales', alias: ['Ciencias Navales Oficiales Navales', 'Ciencias Navales'] },
    { id: 'cn-infanteria', nombre: 'Ciencias Navales para Oficiales de Infantería de Marina', sigla: 'IM', nivel: 'pregrado', facultad: 'Infantería de Marina', alias: ['Ciencias Navales Infantería de Marina', 'Ciencias Navales Oficiales de Infantería de Marina'] },
    { id: 'cn-puente', nombre: 'Ciencias Náuticas para Oficiales Mercantes de Puente', sigla: 'MC', nivel: 'pregrado', facultad: '', alias: ['Ciencias Náuticas Oficiales Mercantes', 'Ciencias Náuticas para Oficiales Mercantes', 'Ciencias Náuticas Mercantes de Puente', 'Mercante'] },
    { id: 'cn-maquinas', nombre: 'Ciencias Náuticas para Oficiales Mercantes de Máquinas', sigla: 'MM', nivel: 'pregrado', facultad: '', alias: ['Ciencias Náuticas Mercantes de Máquinas', 'Ciencias Náuticas Oficiales Mercantes de Máquinas', 'Mercante de Máquinas'] },
    { id: 'administracion', nombre: 'Administración', sigla: 'CCPAD', nivel: 'pregrado', facultad: '', alias: [] },
    { id: 'administracion-maritima', nombre: 'Administración Marítima', sigla: 'CCPAM', nivel: 'pregrado', facultad: '', alias: [] },
    { id: 'ing-electronica', nombre: 'Ingeniería Electrónica', sigla: 'CCPEL', nivel: 'pregrado', facultad: '', alias: [] },
    { id: 'ing-naval', nombre: 'Ingeniería Naval', sigla: 'CCPIN', nivel: 'pregrado', facultad: '', alias: [] },
    { id: 'oceanografia-fisica', nombre: 'Oceanografía Física', sigla: 'CCPOF', nivel: 'pregrado', facultad: '', alias: [] },
    { id: 'esp-logistica', nombre: 'Especialización en Gestión Logística', sigla: 'ESP LOGÍSTICA', nivel: 'posgrado', facultad: '', alias: ['Especialización en Logística', 'Especialización en Gestión Logistica'] },
    { id: 'esp-politica', nombre: 'Especialización en Política y Estrategia Marítima', sigla: 'ESP POLÍTICA', nivel: 'posgrado', facultad: '', alias: ['Especialización en Política y Estrategia Maritima'] },
    { id: 'mae-logistica', nombre: 'Maestría en Gestión Logística', sigla: 'MSC LOGÍSTICA', nivel: 'posgrado', facultad: '', alias: ['Maestría en Logística'] },
    { id: 'mae-ing-naval', nombre: 'Maestría en Ingeniería Naval', sigla: 'MSC INGENIERÍA NAVAL', nivel: 'posgrado', facultad: '', alias: [] },
    { id: 'mae-oceanografia', nombre: 'Maestría en Oceanografía', sigla: 'MSC OCEANOGRAFÍA', nivel: 'posgrado', facultad: 'Oceanografía Física', alias: [] },
    { id: 'doctorado-mar', nombre: 'Doctorado en Ciencias del Mar', sigla: 'PHD', nivel: 'posgrado', facultad: '', alias: [] }
  ];

  /* Texto de programa del balance → programa. Quita cohorte, paréntesis y guiones finales. */
  function limpiarPrograma(t) {
    return String(t || '').replace(/\(.*?\)/g, ' ').replace(/[-–—]\s*COHORTE.*$/i, ' ').replace(/\bCOHORTE\b.*$/i, ' ').replace(/[-–—\s]+$/g, '').replace(/\s+/g, ' ').trim();
  }
  function programaDe(texto, lista) {
    lista = lista || PROGRAMAS;
    var x = norm(limpiarPrograma(texto)); if (!x) return null;
    var i, j;
    for (i = 0; i < lista.length; i++) {
      if (norm(lista[i].nombre) === x) return lista[i];
      var al = lista[i].alias || [];
      for (j = 0; j < al.length; j++) if (norm(al[j]) === x) return lista[i];
    }
    /* parecido (por si el balance o el OCR traen una letra distinta) */
    var mejor = null, mejorS = 0, empate = false;
    lista.forEach(function (p) { var s = similitud(p.nombre, x); if (s > mejorS + 1e-9) { mejor = p; mejorS = s; empate = false; } else if (Math.abs(s - mejorS) < 1e-9) empate = true; });
    return (mejorS >= 0.88 && !empate) ? mejor : null;
  }

  /* ------------------------------ Periodos y vigencia ------------------------------ */
  function parsePeriodo(p) { var m = /(\d{4})\s*[-–/]\s*([12])/.exec(String(p || '')); return m ? { a: +m[1], s: +m[2] } : null; }
  function textoPeriodo(x) { return x.a + '-' + x.s; }
  function cmpPeriodo(x, y) { return x.a !== y.a ? x.a - y.a : x.s - y.s; }
  function periodoDeFecha(f) { return { a: f.getFullYear(), s: f.getMonth() < 6 ? 1 : 2 }; }
  /* Vigencia por semestre: posgrado 3 años y pregrado 5 desde el periodo de terminación;
     el Diplomado de Actualización (observaciones del balance) la actualiza desde su periodo. */
  function vigencia(o) {
    var T = parsePeriodo(o.terminacion), D = parsePeriodo(o.diplomado), hoy = periodoDeFecha(o.hoy || new Date());
    var anios = o.nivel === 'posgrado' ? 3 : 5;
    if (!T) return { estado: 'sin-dato', anios: anios };
    var limT = { a: T.a + anios, s: T.s };
    if (cmpPeriodo(hoy, limT) <= 0) return { estado: 'vigente', anios: anios, limite: textoPeriodo(limT), hoy: textoPeriodo(hoy) };
    if (D) {
      var limD = { a: D.a + anios, s: D.s };
      if (cmpPeriodo(hoy, limD) <= 0) return { estado: 'actualizado', anios: anios, diplomado: textoPeriodo(D), limite: textoPeriodo(limD), hoy: textoPeriodo(hoy) };
    }
    return { estado: 'vencido', anios: anios, limite: textoPeriodo(D && cmpPeriodo(D, T) > 0 ? { a: D.a + anios, s: D.s } : limT), hoy: textoPeriodo(hoy) };
  }

  /* ------------------------------ Números y fechas ------------------------------ */
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var UNI = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
  var DEC = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
  function palabras99(n) { if (n < 30) return UNI[n]; var d = Math.floor(n / 10), u = n % 10; return DEC[d] + (u ? ' y ' + UNI[u] : ''); }
  function anioEnLetras(a) { return (a >= 2000 && a < 2100) ? 'dos mil' + (a === 2000 ? '' : ' ' + palabras99(a - 2000)) : String(a); }
  function promedioEnLetras(p) { var s = p.toFixed(3).split('.'); return (palabras99(parseInt(s[0], 10)) + ' punto ' + s[1].split('').map(function (c) { return UNI[+c]; }).join(' ')).toUpperCase(); }
  function cedulaPuntos(d) { return String(d || '').replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function fechaCorta(f) { return f.getDate() + ' de ' + MESES[f.getMonth()] + ' de ' + f.getFullYear(); }
  function fechaLarga(f) { return 'el día ' + palabras99(f.getDate()) + ' (' + f.getDate() + ') del mes de ' + MESES[f.getMonth()] + ' del año ' + anioEnLetras(f.getFullYear()) + ' (' + f.getFullYear() + ')'; }
  function parseFecha(t) {
    var m = /(\d{1,2})\s*[\/\-.]\s*(\d{1,2})\s*[\/\-.]\s*(\d{4})/.exec(String(t || ''));
    if (!m) return null; var d = new Date(+m[3], +m[2] - 1, +m[1]); return (d.getMonth() === +m[2] - 1) ? d : null;
  }

  /* ------------------------------ Promedio ------------------------------ */
  function promedioPonderado(filas) {
    var c = 0, s = 0; filas.forEach(function (f) { c += f.creditos; s += f.creditos * f.nota; });
    return c ? { promedio: Math.round(s / c * 1000) / 1000, creditos: c } : null;
  }
  /* "8,13" "8.13" "9" "10" — y del OCR: "76" → 7,6 (se perdió la coma) */
  function numNota(t, reparar) {
    t = String(t).trim().replace(',', '.');
    if (/^\d{1,2}(\.\d{1,3})?$/.test(t)) { var v = parseFloat(t); if (v <= 10) return v; if (reparar && /^\d{2}$/.test(t)) return parseFloat(t[0] + '.' + t[1]); return null; }
    return null;
  }
  /* Filas de materias del balance: "… 4 8,13" (créditos y nota al final de la línea). */
  function filasDelBalance(texto) {
    var filas = [];
    texto.split(/\r?\n/).forEach(function (ln) {
      if (/PROMEDIO|TOTAL|CR[ÉE]DITOS APROBADOS|OBSERVACIONES/i.test(ln)) return;
      if (!/\b[A-Z]{1,3}\s?\d{3}\b/.test(ln)) return;
      var toks = ln.replace(/[|¡!]/g, ' ').trim().split(/\s+/);
      var nums = []; for (var k = toks.length - 1; k >= 0 && nums.length < 3; k--) { if (/^\d{1,3}([.,]\d{1,3})?$/.test(toks[k])) nums.unshift(toks[k]); else break; }
      if (nums.length < 2) return;
      var nota = numNota(nums[nums.length - 1], true), cred = parseInt(nums[nums.length - 2], 10);
      if (nota == null || !(cred >= 1 && cred <= 20)) return;
      filas.push({ creditos: cred, nota: nota, linea: ln.trim() });
    });
    return filas;
  }

  /* ------------------------------ Balance ------------------------------ */
  function valorDespues(texto, etiqueta, hasta) {
    var re = new RegExp(etiqueta + '\\s*:?\\s*(.+?)' + (hasta ? '(?=' + hasta + '|\\n|$)' : '(?=\\n|$)'), 'i');
    var m = re.exec(texto); return m ? m[1].replace(/[|_—–]+/g, ' ').replace(/\s+/g, ' ').trim() : '';
  }
  function parseBalance(texto, opciones) {
    opciones = opciones || {};
    var t = String(texto || '').replace(/ /g, ' ');
    var r = { campos: {}, avisos: [] };
    r.nombreCompleto = valorDespues(t, 'NOMBRES\\s+Y\\s+APELLIDOS', 'Fecha\\s+elaboraci[oó]n');
    r.programaTexto = valorDespues(t, 'PROGRAMA\\s+ACAD[ÉE]MICO', 'Periodo\\s+de\\s+terminaci[oó]n');
    var f = /Fecha\s+elaboraci[oó]n\s*:?\s*(\d{1,2}\s*[\/\-.]\s*\d{1,2}\s*[\/\-.]\s*\d{4})/i.exec(t); r.fechaElaboracion = f ? parseFecha(f[1]) : null;
    var p = /Periodo\s+de\s+terminaci[oó]n\s*:?\s*[^\d]{0,6}(\d{4}\s*[-–]\s*[12])/i.exec(t); r.periodoTerminacion = p ? p[1].replace(/\s+/g, '').replace('–', '-') : '';
    var d = /Diplomado\s+de\s+Actualizaci[oó]n\s*(?:del?\s+)?(?:periodo\s+)?(\d{4}\s*[-–]\s*[12])/i.exec(t) || /Diplomado[^\n]{0,60}?(\d{4}\s*[-–:.]\s*[12])\b/i.exec(t); r.diplomado = d ? d[1].replace(/\s+/g, '').replace(/[–:.]/, '-') : '';
    /* Respaldo si el OCR deformó la etiqueta: primer periodo (AAAA-1/2) que aparece antes de la tabla de materias */
    if (!r.periodoTerminacion) {
      var antes = t.split(/\r?\n/); var corte = antes.findIndex(function (l) { return /\b[A-Z]{1,3}\s?\d{3}\b.*\d[.,]?\d*\s*$/.test(l) && !/PERIODO|DIPLOMADO/i.test(l); });
      var cab = (corte > 0 ? antes.slice(0, corte) : antes.slice(0, 14)).join('\n').replace(/Fecha\s+elaboraci[oó]n[^\n]*/ig, '');
      var pp = /\b(20\d{2})\s*[-–]\s*([12])\b/.exec(cab); if (pp) { r.periodoTerminacion = pp[1] + '-' + pp[2]; r.periodoPorRespaldo = true; }
    }
    var cr = /TOTAL\s+CR[ÉE]DITOS\s+APROBADOS[^\d]{0,12}(\d{1,3})\b/i.exec(t); r.creditosImpresos = cr ? parseInt(cr[1], 10) : null;
    var pm = /PROMEDIO\s+PONDERADO\s+ACUMULADO[^\d]{0,12}(\d{1,2}[.,]\d{1,3})/i.exec(t); r.promedioImpreso = pm ? parseFloat(pm[1].replace(',', '.')) : null;
    r.filas = filasDelBalance(t);
    var calc = promedioPonderado(r.filas); r.promedioCalculado = calc ? calc.promedio : null; r.creditosCalculados = calc ? calc.creditos : null;
    return r;
  }

  /* ------------------------------ Cédula ------------------------------ */
  var LUGARES = {
    'BOGOTA D C': 'Bogotá D.C.', 'BOGOTA': 'Bogotá D.C.', 'CARTAGENA': 'Cartagena de Indias D.T. y C.', 'CARTAGENA DE INDIAS': 'Cartagena de Indias D.T. y C.',
    'MEDELLIN': 'Medellín', 'CALI': 'Cali', 'BARRANQUILLA': 'Barranquilla', 'BUCARAMANGA': 'Bucaramanga', 'CUCUTA': 'Cúcuta', 'PEREIRA': 'Pereira', 'MANIZALES': 'Manizales',
    'IBAGUE': 'Ibagué', 'SANTA MARTA': 'Santa Marta', 'VILLAVICENCIO': 'Villavicencio', 'PASTO': 'Pasto', 'MONTERIA': 'Montería', 'NEIVA': 'Neiva', 'ARMENIA': 'Armenia',
    'POPAYAN': 'Popayán', 'VALLEDUPAR': 'Valledupar', 'SINCELEJO': 'Sincelejo', 'TUNJA': 'Tunja', 'FLORENCIA': 'Florencia', 'RIOHACHA': 'Riohacha', 'QUIBDO': 'Quibdó',
    'YOPAL': 'Yopal', 'MOCOA': 'Mocoa', 'LETICIA': 'Leticia', 'SOACHA': 'Soacha', 'BELLO': 'Bello', 'ITAGUI': 'Itagüí', 'ENVIGADO': 'Envigado', 'PALMIRA': 'Palmira',
    'BUENAVENTURA': 'Buenaventura', 'TULUA': 'Tuluá', 'CARTAGO': 'Cartago', 'MAGANGUE': 'Magangué', 'BARRANCABERMEJA': 'Barrancabermeja', 'FLORIDABLANCA': 'Floridablanca',
    'GIRON': 'Girón', 'PIEDECUESTA': 'Piedecuesta', 'DOSQUEBRADAS': 'Dosquebradas', 'ZIPAQUIRA': 'Zipaquirá', 'FUSAGASUGA': 'Fusagasugá', 'CHIA': 'Chía', 'FACATATIVA': 'Facatativá',
    'GIRARDOT': 'Girardot', 'TURBACO': 'Turbaco', 'MALAMBO': 'Malambo', 'SOLEDAD': 'Soledad', 'SABANALARGA': 'Sabanalarga', 'LORICA': 'Lorica', 'CERETE': 'Cereté',
    'SAHAGUN': 'Sahagún', 'APARTADO': 'Apartadó', 'TURBO': 'Turbo', 'SAN ANDRES': 'San Andrés', 'ARJONA': 'Arjona', 'EL CARMEN DE BOLIVAR': 'El Carmen de Bolívar',
    'MOMPOS': 'Mompós', 'SAN JUAN NEPOMUCENO': 'San Juan Nepomuceno', 'MARIA LA BAJA': 'María la Baja', 'CIENAGA': 'Ciénaga', 'FUNDACION': 'Fundación', 'AGUACHICA': 'Aguachica',
    'OCANA': 'Ocaña', 'PAMPLONA': 'Pamplona', 'DUITAMA': 'Duitama', 'SOGAMOSO': 'Sogamoso', 'TUMACO': 'Tumaco', 'IPIALES': 'Ipiales', 'ACACIAS': 'Acacías', 'GRANADA': 'Granada'
  };
  function lugarConTildes(raw) {
    var k = norm(String(raw || '').replace(/\./g, ' ')).replace(/\bD C\b/, 'D C');
    if (LUGARES[k]) return { texto: LUGARES[k], conocido: true };
    k = k.replace(/\s+(D C|D T Y C|D T)$/, ''); if (LUGARES[k]) return { texto: LUGARES[k], conocido: true };
    return { texto: String(raw || '').trim(), conocido: false };
  }
  var MES3 = '(?:ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|SEPT|OCT|NOV|DIC)';
  function parseCedula(texto) {
    var t = String(texto || '').replace(/ /g, ' ');
    var r = { numero: '', numeroLinea: '', apellidos: '', nombres: '', lugar: '', lugarRaw: '', cara: { frente: false, reverso: false } };
    var n = /N[UÚ]MERO\s*:?\s*([\d.\s]{6,14})/i.exec(t); if (n) r.numero = n[1].replace(/\D/g, '');
    /* línea de la banda del reverso: …-00XXXXXXXX- (documento con ceros a la izquierda) */
    var b = /-M?F?-?(\d{9,11})-\d{8}/.exec(t) || /-[MF]-(\d{9,11})-/.exec(t); if (b) r.numeroLinea = b[1].replace(/^0+/, '');
    var L = t.split(/\r?\n/).map(function (x) { return x.replace(/[|_¡]/g, ' ').replace(/\s+/g, ' ').trim(); }).filter(Boolean);
    function previa(re) { for (var i = 0; i < L.length; i++) if (re.test(L[i])) { for (var j = i - 1; j >= 0; j--) { var c = L[j].replace(/[^A-ZÁÉÍÓÚÑ ]/gi, ' ').replace(/\s+/g, ' ').trim(); if (c.length >= 3) return c; } } return ''; }
    r.apellidos = previa(/^APELLIDOS\b/i); r.nombres = previa(/^N[O0]MBRES\b|OMBRES\b|N\s?OMBRES/i);
    /* lugar: "08-NOV-2002 BOGOTA D.C." */
    var l = new RegExp('(\\d{1,2})[\\s\\-/.]+' + MES3 + '[A-Z]*[\\s\\-/.]+(\\d{4})\\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ .]+?)\\s*(?:$|\\n|FECHA|LUGAR)', 'im').exec(t);
    if (l) r.lugarRaw = l[3].replace(/\s+/g, ' ').trim();
    else { var l2 = /LUGAR\s+DE\s+EXPEDICI[OÓ]N\s*:?\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ .]+)/i.exec(t); if (l2) r.lugarRaw = l2[1].trim(); }
    /* quita ruido de OCR al inicio ("SAS BARRANCABERMEJA"): si no es conocido, prueba sin la primera palabra corta */
    var lg = lugarConTildes(r.lugarRaw);
    if (!lg.conocido) { var ws = r.lugarRaw.split(' '); while (ws.length > 1 && !lg.conocido) { ws.shift(); lg = lugarConTildes(ws.join(' ')); } if (!lg.conocido) lg = lugarConTildes(r.lugarRaw); } r.lugar = lg.texto; r.lugarConocido = lg.conocido;
    r.cara.frente = /N[UÚ]MERO/i.test(t) && /APELLIDOS/i.test(t) && /(NOMBRES|OMBRES)/i.test(t);
    r.cara.reverso = /FECHA\s+DE\s+NACIMIENTO/i.test(t) || /LUGAR\s+DE\s+EXPEDICI/i.test(t) || /FECHA\s+Y\s+LUGAR/i.test(t);
    r.puntaje = (r.cara.frente ? 1 : 0) + (r.cara.reverso ? 1 : 0) + (/REPUBLICA|REPÚBLICA/i.test(t) ? 1 : 0) + (/CEDULA|CÉDULA/i.test(t) ? 1 : 0);
    return r;
  }

  /* Reparte "MARTÍNEZ ROJAS JOSÉ JOHAN" en apellidos y nombres usando los apellidos de la cédula (aunque vengan sin tildes u OCR con errores). */
  function repartirNombre(nombreBalance, apellidosCedula, nombresCedula) {
    var palabras = mayus(nombreBalance).split(' ').filter(Boolean);
    if (palabras.length < 2) return null;
    var mejor = null;
    /* Sin pista de la cédula, lo más común en Colombia es dos apellidos (si hay 3 o más palabras); también se usa la cantidad de palabras que la cédula traiga en apellidos. */
    var kCed = String(apellidosCedula || '').trim().split(/\s+/).filter(function (w) { return w.length > 1; }).length;
    var kBase = palabras.length >= 3 ? 2 : 1;
    for (var k = 1; k <= Math.min(4, palabras.length - 1); k++) {
      var ap = palabras.slice(0, k).join(' '), no = palabras.slice(k).join(' ');
      var s = similitud(ap, apellidosCedula || '') * 0.6 + similitud(no, nombresCedula || '') * 0.4 + (k === kBase ? 0.05 : 0) + (kCed && k === kCed ? 0.1 : 0);
      if (!mejor || s > mejor.s) mejor = { apellidos: ap, nombres: no, s: s, k: k };
    }
    return mejor;
  }

  /* ------------------------------ Archivo ------------------------------ */
  function nombreArchivo(sigla, apellidos, nombres) { return (sigla + ' - ' + mayus(apellidos) + ' ' + mayus(nombres)).replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim() + '.pdf'; }

  return {
    PROGRAMAS: PROGRAMAS, sinTildes: sinTildes, norm: norm, mayus: mayus, similitud: similitud, limpiarPrograma: limpiarPrograma, programaDe: programaDe,
    parsePeriodo: parsePeriodo, periodoDeFecha: periodoDeFecha, textoPeriodo: textoPeriodo, vigencia: vigencia,
    promedioEnLetras: promedioEnLetras, cedulaPuntos: cedulaPuntos, fechaCorta: fechaCorta, fechaLarga: fechaLarga, palabras99: palabras99, parseFecha: parseFecha,
    promedioPonderado: promedioPonderado, filasDelBalance: filasDelBalance, parseBalance: parseBalance, parseCedula: parseCedula, lugarConTildes: lugarConTildes,
    repartirNombre: repartirNombre, nombreArchivo: nombreArchivo, numNota: numNota
  };
});
