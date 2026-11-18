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
    var p = /Periodo\s+de\s+terminaci[oó]n\s*:?\s*[^\d]{0,6}(\d{4}\s*[-–]\s*[12])(?!\s*\d)/i.exec(t); r.periodoTerminacion = p ? p[1].replace(/\s+/g, '').replace('–', '-') : '';
    /* Si el balance trae una fecha (dd/mm/aaaa) en vez del periodo: de agosto en adelante es periodo 2; hasta julio, periodo 1. */
    if (!r.periodoTerminacion) {
      var fp = /Periodo\s+de\s+terminaci[oó]n\s*:?\s*[^\d]{0,6}(\d{1,2})\s*[\/\-.]\s*(\d{1,2})\s*[\/\-.]\s*(\d{4})/i.exec(t), fi = /Periodo\s+de\s+terminaci[oó]n\s*:?\s*[^\d]{0,6}(\d{4})\s*[\/\-.]\s*(\d{1,2})\s*[\/\-.]\s*(\d{1,2})/i.exec(t);
      var anio = fp ? +fp[3] : (fi ? +fi[1] : 0), mes = fp ? +fp[2] : (fi ? +fi[2] : 0);
      if (anio && mes >= 1 && mes <= 12) { r.periodoTerminacion = anio + '-' + (mes > 7 ? 2 : 1); r.periodoDesdeFecha = true; }
    }
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
    'OCANA': 'Ocaña', 'PAMPLONA': 'Pamplona', 'DUITAMA': 'Duitama', 'SOGAMOSO': 'Sogamoso', 'TUMACO': 'Tumaco', 'IPIALES': 'Ipiales', 'ACACIAS': 'Acacías', 'GRANADA': 'Granada',
    'PITALITO': 'Pitalito', 'GARZON': 'Garzón', 'LA PLATA': 'La Plata', 'CAMPOALEGRE': 'Campoalegre', 'AIPE': 'Aipe', 'HOBO': 'Hobo', 'SAN AGUSTIN': 'San Agustín', 'ESPINAL': 'Espinal', 'MELGAR': 'Melgar', 'HONDA': 'Honda', 'LIBANO': 'Líbano',
    'CHAPARRAL': 'Chaparral', 'PLANADAS': 'Planadas', 'LA DORADA': 'La Dorada', 'CHINCHINA': 'Chinchiná', 'VILLAMARIA': 'Villamaría', 'CALARCA': 'Calarcá', 'LA TEBAIDA': 'La Tebaida', 'MONTENEGRO': 'Montenegro', 'QUIMBAYA': 'Quimbaya',
    'SANTA ROSA DE CABAL': 'Santa Rosa de Cabal', 'LA VIRGINIA': 'La Virginia', 'SEVILLA': 'Sevilla', 'BUGA': 'Buga', 'GUADALAJARA DE BUGA': 'Guadalajara de Buga', 'JAMUNDI': 'Jamundí', 'YUMBO': 'Yumbo', 'CANDELARIA': 'Candelaria',
    'FLORIDA': 'Florida', 'PRADERA': 'Pradera', 'ROLDANILLO': 'Roldanillo', 'SANTANDER DE QUILICHAO': 'Santander de Quilichao', 'PUERTO TEJADA': 'Puerto Tejada', 'TIMBIO': 'Timbío', 'EL BORDO': 'El Bordo',
    'LA UNION': 'La Unión', 'TUQUERRES': 'Túquerres', 'SAMANIEGO': 'Samaniego', 'BARBACOAS': 'Barbacoas', 'PUERTO ASIS': 'Puerto Asís', 'SIBUNDOY': 'Sibundoy', 'LA HORMIGA': 'La Hormiga', 'SAN VICENTE DEL CAGUAN': 'San Vicente del Caguán',
    'PUERTO LOPEZ': 'Puerto López', 'PUERTO GAITAN': 'Puerto Gaitán', 'RESTREPO': 'Restrepo', 'CUMARAL': 'Cumaral', 'TAURAMENA': 'Tauramena', 'AGUAZUL': 'Aguazul', 'PAZ DE ARIPORO': 'Paz de Ariporo', 'ARAUCA': 'Arauca', 'SARAVENA': 'Saravena',
    'TAME': 'Tame', 'PUERTO CARRENO': 'Puerto Carreño', 'INIRIDA': 'Inírida', 'SAN JOSE DEL GUAVIARE': 'San José del Guaviare', 'MITU': 'Mitú', 'PUERTO LEGUIZAMO': 'Puerto Leguízamo', 'VILLA DEL ROSARIO': 'Villa del Rosario', 'TIBU': 'Tibú',
    'SOCORRO': 'Socorro', 'SAN GIL': 'San Gil', 'BARBOSA': 'Barbosa', 'VELEZ': 'Vélez', 'MALAGA': 'Málaga', 'LEBRIJA': 'Lebrija', 'SAN VICENTE DE CHUCURI': 'San Vicente de Chucurí', 'SABANA DE TORRES': 'Sabana de Torres', 'PUERTO WILCHES': 'Puerto Wilches',
    'CHIQUINQUIRA': 'Chiquinquirá', 'PAIPA': 'Paipa', 'SAMACA': 'Samacá', 'MONIQUIRA': 'Moniquirá', 'GARAGOA': 'Garagoa', 'PUERTO BOYACA': 'Puerto Boyacá', 'CAJICA': 'Cajicá', 'MOSQUERA': 'Mosquera', 'FUNZA': 'Funza', 'MADRID': 'Madrid',
    'LA MESA': 'La Mesa', 'UBATE': 'Ubaté', 'VILLETA': 'Villeta', 'SIBATE': 'Sibaté', 'TOCANCIPA': 'Tocancipá', 'SOPO': 'Sopó', 'CHOCONTA': 'Chocontá', 'GACHETA': 'Gachetá', 'GUADUAS': 'Guaduas', 'SAN FRANCISCO': 'San Francisco',
    'RIONEGRO': 'Rionegro', 'LA CEJA': 'La Ceja', 'MARINILLA': 'Marinilla', 'SABANETA': 'Sabaneta', 'COPACABANA': 'Copacabana', 'CALDAS': 'Caldas', 'GIRARDOTA': 'Girardota', 'CAUCASIA': 'Caucasia', 'YARUMAL': 'Yarumal', 'SANTA ROSA DE OSOS': 'Santa Rosa de Osos',
    'PUERTO BERRIO': 'Puerto Berrío', 'ANDES': 'Andes', 'JARDIN': 'Jardín', 'SANTA FE DE ANTIOQUIA': 'Santa Fe de Antioquia', 'CHIGORODO': 'Chigorodó', 'NECOCLI': 'Necoclí', 'EL BAGRE': 'El Bagre', 'TADO': 'Tadó', 'ISTMINA': 'Istmina',
    'MONTELIBANO': 'Montelíbano', 'PLANETA RICA': 'Planeta Rica', 'TIERRALTA': 'Tierralta', 'AYAPEL': 'Ayapel', 'COROZAL': 'Corozal', 'SAMPUES': 'Sampués', 'TOLU': 'Tolú', 'SAN MARCOS': 'San Marcos', 'SAN ONOFRE': 'San Onofre', 'MAJAGUAL': 'Majagual',
    'EL BANCO': 'El Banco', 'PLATO': 'Plato', 'ZONA BANANERA': 'Zona Bananera', 'ARACATACA': 'Aracataca', 'SANTA ANA': 'Santa Ana', 'MAICAO': 'Maicao', 'URIBIA': 'Uribia', 'FONSECA': 'Fonseca', 'SAN JUAN DEL CESAR': 'San Juan del Cesar',
    'MANAURE': 'Manaure', 'BOSCONIA': 'Bosconia', 'CODAZZI': 'Codazzi', 'AGUSTIN CODAZZI': 'Agustín Codazzi', 'CURUMANI': 'Curumaní', 'BECERRIL': 'Becerril', 'GAMARRA': 'Gamarra', 'PUERTO COLOMBIA': 'Puerto Colombia', 'GALAPA': 'Galapa',
    'BARANOA': 'Baranoa', 'SANTO TOMAS': 'Santo Tomás', 'CAMPO DE LA CRUZ': 'Campo de la Cruz', 'LURUACO': 'Luruaco', 'REPELON': 'Repelón', 'CALAMAR': 'Calamar', 'MAHATES': 'Mahates', 'TURBANA': 'Turbaná', 'CLEMENCIA': 'Clemencia',
    'SANTA CATALINA': 'Santa Catalina', 'SAN JACINTO': 'San Jacinto', 'CARMEN DE BOLIVAR': 'El Carmen de Bolívar', 'SIMITI': 'Simití', 'SANTA ROSA DEL SUR': 'Santa Rosa del Sur', 'PINILLOS': 'Pinillos', 'MOMIL': 'Momil', 'CHINU': 'Chinú'
  };
  /* Los 1.100+ municipios de Colombia (con sus tildes), para escribir el lugar de expedición como corresponde. */
  var MUNICIPIOS_CO = 'Abejorral|Abriaquí|Acacías|Acandí|Acevedo|Achí|Agrado|Agua de Dios|Aguachica|Aguada|Aguadas|Aguazul|Agustín Codazzi|Aipe|Albania|Albán|Alcalá|Aldana|Alejandría|Algarrobo|Algeciras|Almaguer|Almeida|Alpujarra|Altamira|Alto Baudó|Altos del Rosario|Alvarado|Amagá|Amalfi|Ambalema|Anapoima|Ancuyá|Andalucía|Andes|Angelópolis|Angostura|Anolaima|Anorí|Anserma|Ansermanuevo|Anzoátegui|Anzá|Apartadó|Apulo|Apía|Aquitania|Aracataca|Aranzazu|Aratoca|Arauca|Arauquita|Arbeláez|Arboleda|Arboledas|Arboletes|Arcabuco|Arenal|Argelia|Ariguaní|Arjona|Armenia|Armero|Arroyohondo|Astrea|Ataco|Ayapel|Bagadó|Bahía Solano|Bajo Baudó|Balboa|Baranoa|Baraya|Barbacoas|Barbosa|Barichara|Barranca de Upía|Barrancabermeja|Barrancas|Barranco de Loba|Barranquilla|Becerril|Belalcázar|Bello|Belmira|Beltrán|Belén|Belén de Umbría|Belén de los Andaquíes|Berbeo|Betania|Betulia|Betéitiva|Bituima|Boavita|Bochalema|Bogotá|Bojacá|Bojayá|Bolívar|Bosconia|Boyacá|Brazuelo de Papayal|Briceño|Bucaramanga|Bucarasica|Buenaventura|Buenavista|Buenos Aires|Buesaco|Buga|Bugalagrande|Buriticá|Busbanzá|Cabrera|Cabuyaro|Cachipay|Caicedo|Caicedonia|Caimito|Cajamarca|Cajibío|Cajicá|Calamar|Calarcá|Caldas|Caldono|Cali|California|Calima|Caloto|Campamento|Campo de la Cruz|Campoalegre|Campohermoso|Canalete|Candelaria|Cantagallo|Cantón de San Pablo|Caparrapí|Capitanejo|Caracolí|Caramanta|Carcasí|Carepa|Carmen de Apicalá|Carmen de Carupa|Carolina del Príncipe|Cartagena de Indias|Cartagena del Chairá|Cartago|Carurú|Casabianca|Castilla la Nueva|Caucasia|Cañasgordas|Cepitá|Cereté|Cerinza|Cerrito|Cerro de San Antonio|Chachagüí|Chaguaní|Chalán|Chaparral|Charalá|Charta|Chibolo|Chigorodó|Chima|Chimichagua|Chimá|Chinavita|Chinchiná|Chinácota|Chinú|Chipaque|Chipatá|Chiquinquirá|Chiriguaná|Chiscas|Chita|Chitagá|Chitaraque|Chivatá|Chivor|Choachí|Chocontá|Chámeza|Chía|Chíquiza|Cicuco|Cimitarra|Circasia|Cisneros|Ciudad Bolívar|Ciénaga|Ciénaga de Oro|Ciénega|Clemencia|Cocorná|Coello|Cogua|Colombia|Colosó|Colón|Concepción|Concordia|Condoto|Confines|Consacá|Contadero|Contratación|Convención|Copacabana|Coper|Corinto|Coromoro|Corozal|Corrales|Cota|Cotorra|Covarachía|Coveñas|Coyaima|Cravo Norte|Cuaspud|Cubarral|Cubará|Cucaita|Cucunubá|Cucutilla|Cumaral|Cumaribo|Cumbal|Cumbitara|Cunday|Curillo|Curití|Curumaní|Cuítiva|Cáceres|Cáchira|Cácota|Cáqueza|Cértegui|Cómbita|Córdoba|Cúcuta|Dabeiba|Dagua|Dibulla|Distracción|Dolores|Donmatías|Dosquebradas|Duitama|Duranía|Ebéjico|El Atrato|El Bagre|El Banco|El Cairo|El Calvario|El Carmen|El Carmen de Atrato|El Carmen de Bolívar|El Carmen de Chucurí|El Carmen de Viboral|El Carmen del Darién|El Castillo|El Cerrito|El Charco|El Cocuy|El Colegio|El Copey|El Doncello|El Dorado|El Dovio|El Espinal|El Espino|El Guacamayo|El Guamo|El Molino|El Paso|El Paujil|El Peñol|El Peñón|El Pital|El Piñón|El Playón|El Retiro|El Retorno|El Retén|El Roble|El Rosal|El Rosario|El Santuario|El Socorro|El Tablón|El Tambo|El Tarra|El Zulia|El Águila|Elías|Encino|Enciso|Entrerríos|Envigado|Facatativá|Falán|Filadelfia|Filandia|Firavitoba|Flandes|Florencia|Floresta|Florida|Floridablanca|Florián|Fonseca|Fortul|Fosca|Francisco Pizarro|Fredonia|Fresno|Frontino|Fuente de Oro|Fundación|Funes|Funza|Fusagasugá|Fómeque|Fúquene|Gachalá|Gachancipá|Gachantivá|Gachetá|Galapa|Galeras|Galán|Gama|Gamarra|Garagoa|Garzón|Gigante|Ginebra|Giraldo|Girardot|Girardota|Girón|González|Gramalote|Granada|Guaca|Guacamayas|Guacarí|Guachené|Guachetá|Guachucal|Guadalupe|Guaduas|Guaitarilla|Gualmatán|Guamal|Guamo|Guapotá|Guapí|Guaranda|Guarne|Guasca|Guatapé|Guataquí|Guatavita|Guateque|Guavatá|Guayabal de Síquima|Guayabetal|Guayatá|Gutiérrez|Guática|Gámbita|Gámeza|Génova|Gómez Plata|Güepsa|Güicán|Hacarí|Hatillo de Loba|Hato|Hato Corozal|Hatonuevo|Heliconia|Herrán|Herveo|Hispania|Hobo|Honda|Ibagué|Icononzo|Iles|Imués|Inzá|Inírida|Ipiales|Isnos|Istmina|Itagüí|Ituango|Iza|Jambaló|Jamundí|Jardín|Jenesano|Jericó|Jerusalén|Jesús María|Jordán|Juan de Acosta|Junín|Juradó|La Apartada|La Argentina|La Belleza|La Calera|La Capilla|La Ceja|La Celia|La Cruz|La Cumbre|La Dorada|La Esperanza|La Estrella|La Florida|La Gloria (Cesar)|La Jagua de Ibirico|La Jagua del Pilar|La Llanada|La Macarena|La Merced|La Mesa|La Montañita|La Palma|La Paz|La Peña|La Pintada|La Plata|La Playa de Belén|La Primavera|La Salina|La Sierra|La Tebaida|La Tola|La Unión|La Uribe|La Uvita|La Vega|La Victoria|La Virginia|Labateca|Labranzagrande|Landázuri|Lebrija|Leiva|Lejanías|Lenguazaque|Leticia|Liborina|Linares|Litoral de San Juan|Lloró|Lorica|Los Andes|Los Córdobas|Los Palmitos|Los Patios|Los Santos|Lourdes|Luruaco|Lérida|Líbano|López de Micay|Macanal|Macaravita|Maceo|Machetá|Madrid|Magangué|Magüí Payán|Mahates|Maicao|Majagual|Malambo|Mallama|Manatí|Manaure|Manaure Balcón del Cesar|Manizales|Manta|Manzanares|Maní|Mapiripán|Margarita|Marinilla|Maripí|Mariquita|Marmato|Marquetalia|Marsella|Marulanda|María la Baja|Matanza|Medellín|Medina|Medio Atrato|Medio Baudó|Medio San Juan|Melgar|Mercaderes|Mesetas|Milán|Miraflores|Miranda|Mistrató|Mitú|Mocoa|Mogotes|Molagavita|Momil|Mompós|Mongua|Monguí|Moniquirá|Montebello|Montecristo|Montelíbano|Montenegro|Monterrey|Montería|Morales|Morelia|Morroa|Mosquera|Motavita|Moñitos|Murillo|Murindó|Mutatá|Mutiscua|Muzo|Málaga|Nariño|Natagaima|Nechí|Necoclí|Neira|Neiva|Nemocón|Nilo|Nimaima|Nobsa|Nocaima|Norcasia|Norosí|Nueva Granada|Nuevo Colón|Nunchía|Nuquí|Nátaga|Nóvita|Obando|Ocamonte|Ocaña|Oiba|Oicatá|Olaya|Olaya Herrera|Onzaga|Oporapa|Orito|Orocué|Ortega|Ospina|Otanche|Ovejas|Pachavita|Pacho|Padilla|Paicol|Pailitas|Paime|Paipa|Pajarito|Palermo|Palestina|Palmar|Palmar de Varela|Palmas del Socorro|Palmira|Palocabildo|Pamplona|Pamplonita|Pandi|Panqueba|Paratebueno|Pasca|Pasto|Patía|Pauna|Paya|Paz de Ariporo|Paz del Río|Pedraza|Pelaya|Pensilvania|Peque|Pereira|Pesca|Piamonte|Piedecuesta|Piedras|Piendamó|Pijao|Pijiño del Carmen|Pinchote|Pinillos|Piojó|Pisba|Pitalito|Pivijay|Planadas|Planeta Rica|Plato|Policarpa|Polonuevo|Ponedera|Popayán|Pore|Potosí|Pradera|Prado|Providencia|Providencia y Santa Catalina Islas|Pueblo Bello|Pueblo Nuevo|Pueblo Rico|Pueblo Viejo|Pueblorrico|Puente Nacional|Puerres|Puerto Asís|Puerto Berrío|Puerto Boyacá|Puerto Caicedo|Puerto Carreño|Puerto Colombia|Puerto Concordia|Puerto Escondido|Puerto Gaitán|Puerto Guzmán|Puerto Leguízamo|Puerto Libertador|Puerto Lleras|Puerto López|Puerto Nare|Puerto Nariño|Puerto Parra|Puerto Rico|Puerto Rondón|Puerto Salgar|Puerto Santander|Puerto Tejada|Puerto Triunfo|Puerto Wilches|Pulí|Pupiales|Puracé|Purificación|Purísima|Pácora|Páez|Páramo|Quebradanegra|Quetame|Quibdó|Quimbaya|Quinchía|Quipile|Quípama|Ragonvalia|Ramiriquí|Recetor|Regidor|Remedios|Remolino|Repelón|Restrepo|Ricaurte|Rioblanco|Riofrío|Riohacha|Rionegro|Riosucio|Risaralda|Rivera|Roberto Payán|Roldanillo|Roncesvalles|Rondón|Rosas|Rovira|Ráquira|Río Iró|Río Quito|Río Viejo|Río de Oro|Sabana de Torres|Sabanagrande|Sabanalarga|Sabanas de San Ángel|Sabaneta|Saboyá|Sahagún|Saladoblanco|Salamina|Salazar de Las Palmas|Saldaña|Salento|Salgar|Samacá|Samaniego|Samaná|Sampués|San Agustín|San Alberto|San Andrés|San Andrés de Cuerquia|San Andrés de Sotavento|San Antero|San Antonio|San Antonio de Palmito|San Antonio del Tequendama|San Benito|San Benito Abad|San Bernardo|San Bernardo del Viento|San Calixto|San Carlos|San Carlos de Guaroa|San Cayetano|San Cristóbal|San Diego|San Eduardo|San Estanislao|San Fernando|San Francisco|San Gil|San Jacinto|San Jacinto del Cauca|San Jerónimo|San Joaquín|San José|San José de Albán|San José de Miranda|San José de Pare|San José de Uré|San José de la Montaña|San José del Fragua|San José del Guaviare|San José del Palmar|San Juan Nepomuceno|San Juan de Arama|San Juan de Betulia|San Juan de Rioseco|San Juan de Urabá|San Juan del Cesar|San Juanito|San Lorenzo|San Luis|San Luis de Gaceno|San Luis de Palenque|San Marcos|San Martín|San Martín de Loba|San Mateo|San Miguel|San Miguel de Sema|San Onofre|San Pablo|San Pablo de Borbur|San Pedro|San Pedro de Cartago|San Pedro de Urabá|San Pedro de los Milagros|San Pelayo|San Rafael|San Roque|San Sebastián|San Sebastián de Buenavista|San Vicente|San Vicente de Chucurí|San Vicente del Caguán|San Zenón|Sandoná|Santa Ana|Santa Bárbara|Santa Bárbara de Pinto|Santa Catalina|Santa Fe de Antioquia|Santa Helena del Opón|Santa Isabel|Santa Lucía|Santa Marta|Santa María|Santa Rosa|Santa Rosa de Cabal|Santa Rosa de Osos|Santa Rosa de Viterbo|Santa Rosa del Sur|Santa Rosalía|Santa Sofía|Santacruz|Santana|Santander de Quilichao|Santiago|Santo Domingo|Santo Domingo de Silos|Santo Tomás|Santuario|Sapuyes|Saravena|Sardinata|Sasaima|Sativanorte|Sativasur|Segovia|Sesquilé|Sevilla|Siachoque|Sibaté|Sibundoy|Silvania|Silvia|Simacota|Simijaca|Simití|Sincelejo|Sincé|Sipí|Sitionuevo|Soacha|Soatá|Socha|Socotá|Sogamoso|Solano|Soledad|Solita|Somondoco|Sonsón|Sopetrán|Soplaviento|Sopó|Sora|Soracá|Sotaquirá|Sotará|Suaita|Suaza|Subachoque|Sucre|Suesca|Supatá|Supía|Suratá|Susa|Susacón|Sutamarchán|Sutatausa|Sutatenza|Suán|Suárez|Sácama|Sáchica|Tabio|Tadó|Talaigua Nuevo|Tamalameque|Tame|Taminango|Tangua|Taraira|Tarazá|Tarqui|Tarso|Tasco|Tauramena|Tausa|Tello|Tena|Tenerife|Tenjo|Tenza|Teorama|Teruel|Tesalia|Tibacuy|Tibaná|Tibasosa|Tibirita|Tibú|Tierralta|Timaná|Timbiquí|Timbío|Tinjacá|Tipacoque|Tiquisio|Titiribí|Toca|Tocaima|Tocancipá|Togüí|Toledo|Tolú|Tolú Viejo|Tona|Topaipí|Toribío|Toro|Tota|Totoró|Trinidad|Trujillo|Tubará|Tuchín|Tuluá|Tumaco|Tunja|Tununguá|Turbaco|Turbaná|Turbo|Turmequé|Tuta|Tutazá|Támara|Támesis|Tópaga|Túquerres|Ubalá|Ubaque|Ubaté|Ulloa|Une|Unguía|Unión Panamericana|Uramita|Uribia|Urrao|Urumita|Usiacurí|Valdivia|Valencia|Valle de San José|Valle de San Juan|Valle del Guamuez|Valledupar|Valparaíso|Vegachí|Venadillo|Venecia|Ventaquemada|Vergara|Versalles|Vetas|Vianí|Victoria|Vigía del Fuerte|Vijes|Villa Caro|Villa Rica|Villa de Leyva|Villa del Rosario|Villagarzón|Villagómez|Villahermosa|Villamaría|Villanueva|Villapinzón|Villarrica|Villavicencio|Villavieja|Villeta|Viotá|Viracachá|Vista Hermosa|Viterbo|Vélez|Yacopí|Yacuanquer|Yaguará|Yalí|Yarumal|Yolombó|Yondó|Yopal|Yotoco|Yumbo|Zambrano|Zapatoca|Zapayán|Zaragoza|Zarzal|Zetaquira|Zipacón|Zipaquirá|Zona Bananera|Ábrego|Íquira|Úmbita|Útica';
  MUNICIPIOS_CO.split('|').forEach(function (m) { var k = norm(m); if (k && !LUGARES[k]) LUGARES[k] = m; var k2 = k.replace(/Ñ/g, 'N'); if (k2 !== k && !LUGARES[k2]) LUGARES[k2] = m; });
  LUGARES['SANTA CRUZ DE MOMPOX'] = 'Mompós'; LUGARES['MOMPOX'] = 'Mompós'; LUGARES['SAN ANDRES ISLAS'] = 'San Andrés'; LUGARES['SAN ANDRES PROVIDENCIA'] = 'San Andrés';
  function lugarConTildes(raw) {
    var k = norm(String(raw || '').replace(/\./g, ' ')).replace(/\bD C\b/, 'D C');
    if (LUGARES[k]) return { texto: LUGARES[k], conocido: true };
    if (LUGARES[k.replace(/Ñ/g, 'N')]) return { texto: LUGARES[k.replace(/Ñ/g, 'N')], conocido: true };
    k = k.replace(/\s+(D C|D T Y C|D T)$/, ''); if (LUGARES[k]) return { texto: LUGARES[k], conocido: true };
    /* Municipio fuera de la lista: se escribe tal como lo dice la cédula, en formato título. */
    var peq = { DE: 1, DEL: 1, LA: 1, LAS: 1, LOS: 1, EL: 1, Y: 1 };
    var tit = String(raw || '').trim().toLowerCase().split(/\s+/).map(function (w, i) { return i > 0 && peq[w.toUpperCase()] ? w : w.charAt(0).toUpperCase() + w.slice(1); }).join(' ');
    return { texto: tit, conocido: false };
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
    else {
      /* Respaldo: la línea que va justo antes de «FECHA Y LUGAR DE EXPEDICIÓN»; el municipio es todo lo que sale después de la fecha (año de 4 cifras). */
      var ie = -1; for (var q = 0; q < L.length; q++) if (/FECHA\s+Y\s+LUGAR|LUGAR\s+DE\s+EXPEDICI/i.test(L[q])) { ie = q; break; }
      for (var q2 = ie - 1; q2 >= 0 && q2 >= ie - 2 && !r.lugarRaw; q2--) { var m3 = /(?:19|20)\d{2}\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ .()]+?)\s*$/i.exec(L[q2]); if (m3) r.lugarRaw = m3[1].trim(); }
      if (!r.lugarRaw) { var l2 = /LUGAR\s+DE\s+EXPEDICI[OÓ]N\s*:?\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ .]+)/i.exec(t); if (l2 && !/^FECHA|^LUGAR/i.test(l2[1].trim())) r.lugarRaw = l2[1].trim(); }
    }
    r.lugarRaw = String(r.lugarRaw || '').replace(/\(.*?\)/g, ' ').replace(/^\W*(?:\d{1,2}[\s\-/.]+\w{3,5}[\s\-/.]+\d{4})\s*/, '').replace(/\s+/g, ' ').trim();
    /* quita ruido de OCR al inicio ("SAS BARRANCABERMEJA"): si no es conocido, prueba sin la primera palabra corta */
    var lg = lugarConTildes(r.lugarRaw);
    if (!lg.conocido) { var ws = r.lugarRaw.split(' '); while (ws.length > 1 && !lg.conocido) { ws.shift(); lg = lugarConTildes(ws.join(' ')); } if (!lg.conocido) lg = lugarConTildes(r.lugarRaw); } r.lugar = lg.texto; r.lugarConocido = lg.conocido;
    /* Municipio fuera de la lista: se acepta tal como sale solo si se lee totalmente claro (palabras completas, sin símbolos ni restos del OCR). */
    if (!lg.conocido) {
      var limpio = norm(String(r.lugarRaw || '').replace(/\./g, ' ')), ws2 = limpio.split(' ').filter(Boolean);
      var claro = ws2.length >= 1 && ws2.length <= 5 && ws2.every(function (w) { return /^(DE|DEL|LA|LAS|LOS|EL|Y)$/.test(w) || /^[A-Z]{3,}$/.test(w); }) && ws2.some(function (w) { return w.length >= 4; }) && !/FECHA|LUGAR|EXPEDICION|NACIMIENTO|ESTATURA|SEXO|REGISTRADOR|INDICE/.test(limpio);
      if (!claro) r.lugar = '';
    }
    r.cara.frente = /N[UÚ]MERO/i.test(t) && /APELLIDOS/i.test(t) && /(NOMBRES|OMBRES)/i.test(t);
    r.cara.reverso = /FECHA\s+DE\s+NACIMIENTO/i.test(t) || /LUGAR\s+DE\s+EXPEDICI/i.test(t) || /FECHA\s+Y\s+LUGAR/i.test(t);
    r.puntaje = (r.cara.frente ? 1 : 0) + (r.cara.reverso ? 1 : 0) + (/REPUBLICA|REPÚBLICA/i.test(t) ? 1 : 0) + (/CEDULA|CÉDULA/i.test(t) ? 1 : 0);
    return r;
  }

  /* Reparte "MARTÍNEZ ROJAS JOSÉ JOHAN" en apellidos y nombres usando los apellidos de la cédula (aunque vengan sin tildes u OCR con errores). */
  var NOMBRES_PILA = {}; ('JOSE JUAN LUIS CARLOS JORGE MIGUEL ANGEL ANDRES FELIPE DAVID DANIEL CAMILO SEBASTIAN SANTIAGO NICOLAS ALEJANDRO FERNANDO CHRISTIAN CRISTIAN KEVIN BRAYAN BRYAN JHON JOHN JOHAN JHONATAN JONATHAN YEISON EDWIN WILSON WILLIAM OSCAR EDGAR CESAR ALEXANDER ALEXIS ALBERTO ALFREDO ALVARO ANTONIO ARTURO BRAULIO CAMPO CLAUDIO DARIO DIEGO DIDIER EDUARDO EDISON ELKIN EMILIO ENRIQUE ERIK ERICK ESTEBAN FABIAN FABIO FRANCISCO GABRIEL GERMAN GILBERTO GUILLERMO GUSTAVO HAROLD HECTOR HERNAN HUGO HUMBERTO IVAN JAIME JAIRO JAVIER JEFFERSON JESUS JHOAN JULIAN JULIO LEONARDO LUCAS MANUEL MARCO MARCOS MARIO MARTIN MATEO MAURICIO NELSON NESTOR OMAR ORLANDO PABLO PEDRO RAFAEL RAMON REINALDO RICARDO ROBERTO RODRIGO ROGER RUBEN SAMUEL SERGIO STEVEN TOMAS VICTOR VICENTE YEFERSON YESID MARIA ANA LAURA PAOLA ANDREA CAROLINA CATALINA CLAUDIA DANIELA DIANA ELIZABETH ELSA ESTEFANIA GLORIA ISABEL JESSICA JOHANA JULIANA JULIETH KAREN KATHERINE LILIANA LINA LORENA LUZ MARCELA MARGARITA MARTHA MAYERLI MELISA MONICA NATALIA NANCY PATRICIA PAULA ROSA SANDRA SARA SOFIA STEPHANIE TATIANA VALENTINA VANESSA VERONICA VIVIANA YENNY YULIETH YESENIA LEIDY LUCIA ALEJANDRA ADRIANA ALEXANDRA AMPARO ANGELA ANGIE BEATRIZ BIBIANA BLANCA CAMILA CARMEN CLARA CRISTINA DAYANA DEISY DORIS EDITH ELENA ERIKA FLOR GINA GISELA INGRID IRENE JENNIFER JOHANNA KATHERIN LEONOR LETICIA LILIA LISETH LIZETH LUISA MABEL MARIANA MARISOL MARLENY MAYRA MILENA NIDIA NORA OLGA PILAR RAQUEL ROCIO SILVIA SONIA SUSANA TERESA YOLANDA YULI ADOLFO AGUSTIN AMADOR ARMANDO AUGUSTO BERNARDO CRISTOBAL DARWIN DEIVID DEIBY DUVAN EFRAIN ELIAS EMERSON EMMANUEL ERNESTO EVER FABRICIO FIDEL FRANK FREDY FREDDY GEOVANNY GIOVANNY GONZALO HELMER HENRY HERBERT HERNANDO IGNACIO ISAAC ISMAEL JAVIER JHOANN LEONEL LIBARDO LORENZO MARLON MAYCOL MICHAEL NOEL OSWALDO OTONIEL RAUL REINEL RENE RIGOBERTO ROBINSON RONALD SAUL SIMON TEODORO WALTER WILMER YAIR YHON ZAIR').split(' ').forEach(function (w) { NOMBRES_PILA[w] = 1; });
  function fraccionNombres(txt) { var w = norm(txt).split(' ').filter(Boolean); if (!w.length) return 0; return w.filter(function (x) { return NOMBRES_PILA[x]; }).length / w.length; }
  function repartirNombre(nombreBalance, apellidosCedula, nombresCedula) {
    var palabras = mayus(nombreBalance).split(' ').filter(Boolean);
    if (palabras.length < 2) return null;
    var mejor = null;
    /* Sin pista de la cédula, lo más común en Colombia es dos apellidos (si hay 3 o más palabras); también se usa la cantidad de palabras que la cédula traiga en apellidos. */
    var kCed = String(apellidosCedula || '').trim().split(/\s+/).filter(function (w) { return w.length > 1; }).length;
    var kBase = palabras.length >= 3 ? 2 : 1, hayCed = !!(apellidosCedula || nombresCedula);
    /* Hay balances con "APELLIDOS NOMBRES" y otros con "NOMBRES APELLIDOS": se prueban los dos órdenes contra la cédula. */
    [false, true].forEach(function (inv) {
      for (var k = 1; k <= Math.min(4, palabras.length - 1); k++) {
        var ap = inv ? palabras.slice(palabras.length - k).join(' ') : palabras.slice(0, k).join(' ');
        var no = inv ? palabras.slice(0, palabras.length - k).join(' ') : palabras.slice(k).join(' ');
        var s = similitud(ap, apellidosCedula || '') * 0.6 + similitud(no, nombresCedula || '') * 0.4 + (k === kBase ? 0.05 : 0) + (kCed && k === kCed ? 0.1 : 0) + (hayCed ? 0 : 0.5 * (fraccionNombres(no) - fraccionNombres(ap)) - (inv ? 0.05 : 0));
        if (!mejor || s > mejor.s) mejor = { apellidos: ap, nombres: no, s: s, k: k, invertido: inv };
      }
    });
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
