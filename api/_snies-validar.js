/*!
 * Portal de Servicios Digitales Estadística — Escuela Naval de Cadetes "Almirante Padilla"
 * Autora y desarrolladora: CAMARGO MARTÍNEZ BEYTY PATRICIA — Oficina de Estadística
 * Derechos morales de autor reservados (Ley 23 de 1982, art. 30). Este aviso de autoría no debe eliminarse ni alterarse.
 */
/**
 * api/_snies-validar.js — validación del contenido de las plantillas SNIES.
 *
 * Reglas por columna (api/_snies-reglas.json, sacadas del Manual de Validaciones por Plantilla V9.1) más las reglas
 * pedidas por la Oficina de Estadística: documento, teléfono, correo, año y semestre, duplicados, relación entre hojas,
 * fechas, totales y obligatorios condicionales. No se cruza con Participante.
 * Devuelve errores por celda: { h: hoja, f: fila de Excel, c: columna, m: mensaje }.
 */
let CAT = {};
try { CAT = require('./_snies-catalogos.json'); } catch (e) { CAT = {}; }
const CONJ = {};
const conj = (k) => CONJ[k] || (CONJ[k] = new Set(Array.isArray(CAT[k]) ? CAT[k] : Object.keys(CAT[k] || {})));
let REGLAS = {};
try { REGLAS = require('./_snies-reglas.json'); } catch (e) { REGLAS = {}; }

const vacia = (v) => v == null || (typeof v === 'string' && v.trim() === '');
const txt = (v) => (v == null ? '' : typeof v === 'number' ? String(v) : String(v).trim());
const up = (v) => txt(v).toUpperCase();
const esNum = (v) => typeof v === 'number' || /^-?\d+([.,]\d+)?$/.test(txt(v));
const aNum = (v) => (typeof v === 'number' ? v : Number(txt(v).replace(',', '.')));

/* Fecha → número comparable (días desde 1899-12-30, como Excel). Acepta serial de Excel o texto dd/mm/aaaa. */
function fechaNum(v) {
  if (typeof v === 'number') return v >= 1 && v < 2958466 ? v : null;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(txt(v));
  if (!m) return null;
  const d = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
  if (d.getUTCFullYear() !== +m[3] || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[1]) return null;
  return d.getTime() / 86400000 + 25569;
}
const serialDe = (y, m, d) => Date.UTC(y, m - 1, d) / 86400000 + 25569;
const fechaTxt = (n) => { const d = new Date(Math.round((n - 25569) * 86400000)); return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`; };

/* Documentos de extranjeros: no se les exige la longitud de la cédula ni el teléfono de 10 dígitos. Solo CC y TI se validan. */
const LONG_CC = [3, 4, 5, 6, 7, 8, 10];

/* Comparaciones entre columnas de una misma fila: [a, operador, b]. Solo se aplican si la hoja trae ambas columnas. */
const COMPARACIONES = [
  ['FECHA_FINAL', '>=', 'FECHA_INICIO'], ['FECHA_FIN', '>=', 'FECHA_INICIO'], ['FECHA_VIGENCIA', '>=', 'FECHA_INICIO'],
  ['FECHA_RETIRO', '>=', 'FECHA_INGRESO'], ['FECHA_RETIRO', '>=', 'FECHA_ADMISION'],
  ['FECHA_FINAL', '>', 'FECHA_INGRESO'], ['FECHA_EXPIRACION', '>', 'FECHA_INGRESO'],
  ['FECHA_SNP_SABER_PRO', '<', 'FECHA_GRADO'],
  ['CUPOS_TOTALES_PROYECTADOS', '>=', 'CUPOS_NUEVOS_PROYECTADOS'],
  ['M2_AREA_UTIL', '<', 'M2_AREA_TOTAL_CONSTRUIDA'], ['M2_AREA_AULAS', '<', 'M2_AREA_UTIL'], ['M2_AREA_LABORATORIOS', '<', 'M2_AREA_UTIL'],
];
const OPS = { '>=': ['no puede ser anterior a', (a, b) => a >= b], '>': ['debe ser posterior a', (a, b) => a > b], '<': ['debe ser anterior a', (a, b) => a < b], '<=': ['no puede ser posterior a', (a, b) => a <= b] };

/* Claves de duplicado por plantilla (hoja principal). Además, en toda hoja se detectan filas completamente iguales. */
const CLAVES_DUP = {
  'inscritos-relacion-de-inscritos': ['AÑO', 'SEMESTRE', 'ID_TIPO_DOCUMENTO', 'NUM_DOCUMENTO'],
  'inscrito-programa': ['AÑO', 'SEMESTRE', 'ID_TIPO_DOCUMENTO', 'NUM_DOCUMENTO', 'PRO_CONSECUTIVO'],
  admitidos: ['AÑO', 'SEMESTRE', 'ID_TIPO_DOCUMENTO', 'NUM_DOCUMENTO', 'PRO_CONSECUTIVO'],
  'estudiantes-de-primer-curso': ['AÑO', 'SEMESTRE', 'ID_TIPO_DOCUMENTO', 'NUM_DOCUMENTO', 'PRO_CONSECUTIVO'],
  matriculados: ['AÑO', 'SEMESTRE', 'ID_TIPO_DOCUMENTO', 'NUM_DOCUMENTO', 'PRO_CONSECUTIVO'],
  graduados: ['AÑO', 'SEMESTRE', 'ID_TIPO_DOCUMENTO', 'NUM_DOCUMENTO', 'PRO_CONSECUTIVO'],
  'retiros-estudiantiles': ['AÑO', 'SEMESTRE', 'ID_TIPO_DOCUMENTO', 'NUM_DOCUMENTO', 'PRO_CONSECUTIVO'],
  'materias-matriculado': ['AÑO', 'SEMESTRE', 'ID_TIPO_DOCUMENTO', 'NUM_DOCUMENTO', 'PRO_CONSECUTIVO'],
  'apoyos-financieros-academicos-u-otros': ['AÑO', 'SEMESTRE', 'ID_TIPO_DOCUMENTO', 'NUM_DOCUMENTO', 'PRO_CONSECUTIVO'],
};

/* Relación entre hojas de una misma plantilla. La hoja principal es la primera. 'todas' = la hoja hija debe traer registros de cada
   fila principal; 'alguna' = al menos una de las hojas del grupo. Siempre se exige que lo de las hojas hijas exista en la principal. */
const RELACIONES = {
  'educacion-continua': { todas: ['EDUCACION_CONTINUA_DOCENTES', 'EDUCAC_CONTINUA_BENEFICIARIOS'] },
  'evento-cultural': { todas: ['EVENTO_CULT_REC_HUMANO', 'EVENTO_CULT_BENEFICIARIOS'] },
  'actividad-cultural': { todas: ['ACT_CULTURAL_REC_HUMANO'] },
  'actividad-de-bienestar': { todas: ['ACT_BIENESTAR_BENEFICIARIOS', 'ACT_BIENESTAR_REC_HUMANO'] },
  'grupos-de-investigacion': { alguna: ['GRUPO_INVESTIGAD_INTERNOS_IES', 'GRUPO_INVESTIGAD_EXTERNOS_IES'] },
  'centros-de-investigacion': { todas: ['CENTRO_GRUPO'] },
  'redes-de-investigacion': { alguna: ['RED_IES', 'RED_INTEGRANTES'] },
  'convenios-internacionales': { todas: ['CONVENIOS_INTERNAC_INSTUCIONES'] },
  'proyectos-de-investigacion': { alguna: ['PROY_INVESTIGAD_INTERNOS_IES', 'PROY_INVESTIGAD_EXTERNOS_IES'] },
  'docentes-universidad-publica': { todas: [] },
};

/* Si el encabezado no está en la fila 1 (hay un título o filas en blanco encima, como «2026 2»), lo busca entre las primeras 8 filas
   (la que más columnas oficiales tenga) y lo deja en la fila 0; las filas de arriba quedan vacías y la numeración no cambia. */
function ubicarEncabezado(filas, cols) {
  if (!cols || !cols.length) return filas;
  const L = new Set(cols.map((c) => up(c).replace(/\s+/g, ' ')));
  const pts = (f) => (f || []).reduce((n, x) => n + (L.has(up(x).replace(/\s+/g, ' ')) ? 1 : 0), 0);
  let mejor = 0, mp = pts(filas[0]);
  for (let i = 1; i < Math.min(8, filas.length); i++) { const p = pts(filas[i]); if (p > mp) { mp = p; mejor = i; } }
  if (!mejor) return filas;
  const out = filas.slice(); out[0] = filas[mejor];
  for (let i = 1; i <= mejor; i++) out[i] = [];
  return out;
}
function leerHoja(wb, nombre, cols) {
  const filas = ubicarEncabezado(wb.leer(nombre, { maxCols: 120 }), cols);
  const enc = (filas[0] || []).map((x) => up(x).replace(/\s+/g, ' '));
  const idx = {};
  enc.forEach((c, i) => { if (c && idx[c] == null) idx[c] = i; });
  return { nombre, filas, enc, idx };
}


/* Corrector ortográfico sencillo: diccionario de palabras comunes (api/_snies-palabras.json, ordenado por frecuencia) + palabras de los catálogos. */
const sinTilde = (w) => String(w).toLowerCase().replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e').replace(/[íìï]/g, 'i').replace(/[óòö]/g, 'o').replace(/[úùü]/g, 'u');
const PALABRAS_OK = new Set(['funaser', 'aspaen', 'ceadi', 'imetam', 'neuro', 'contry', 'carmelo', 'nuñez', 'nariño', 'calcuta', 'salle']);
let _dic = null;
function diccionario() {
  if (_dic) return _dic;
  _dic = new Map();
  try { require('./_snies-palabras.json').forEach((w, i) => _dic.set(w, i)); } catch (e) { return _dic; }
  try {
    const cat = require('./_snies-catalogos.json');
    const rec = (x) => { if (typeof x === 'string') { for (const w of x.match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+/g) || []) { const n = sinTilde(w); if (n.length >= 4 && !_dic.has(n)) _dic.set(n, 1e9); } } else if (x && typeof x === 'object') Object.values(x).forEach(rec); };
    rec(cat);
  } catch (e) { /* sin catálogos */ }
  return _dic;
}
function sugerencia(n) {
  const D = diccionario(); if (!D.size || PALABRAS_OK.has(n) || D.has(n)) return null;
  /* plurales y femeninos: «américas», «gaviotas», «barbacoas» no son errores si la forma base existe */
  if (/s$/.test(n) && D.has(n.slice(0, -1))) return null;
  if (/es$/.test(n) && D.has(n.slice(0, -2))) return null;
  if (/a$/.test(n) && D.has(n.slice(0, -1) + 'o')) return null;
  const AB = 'abcdefghijklmnñopqrstuvwxyz'; let mejor = null, mi = 1e10;
  /* Solo se sugiere una palabra COMÚN (primeras 20 000 del diccionario) que empiece por la misma letra: así los nombres propios casi nunca se marcan. */
  const prueba = (c) => { const i = D.get(c); if (i != null && i < 20000 && i < mi && c[0] === n[0]) { mi = i; mejor = c; } };
  for (let i = 0; i <= n.length; i++) {
    if (i < n.length) { prueba(n.slice(0, i) + n.slice(i + 1)); if (i < n.length - 1) prueba(n.slice(0, i) + n[i + 1] + n[i] + n.slice(i + 2)); for (const a of AB) prueba(n.slice(0, i) + a + n.slice(i + 1)); }
    for (const a of AB) prueba(n.slice(0, i) + a + n.slice(i));
  }
  return mejor;
}

/** wb: libro abierto (api/_xlsx.js). t: plantilla. ctx: { periodoRep: 'AAAA-S', hoy: serial }.
 *  Devuelve { errores: [{h,f,c,m}], hojas: { nombre: { cols, nFilas } } } */
function revisarContenido(wb, t, ctx) {
  ctx = ctx || {};
  const reglas = REGLAS[t.id] || {};
  const nombres = wb.hojas.filter((h) => h !== 'INFO' && (!ctx.hojas || ctx.hojas.includes(h)));   /* hojas de más no se revisan */
  const hojas = {};
  nombres.forEach((n) => { try { hojas[n] = leerHoja(wb, n, ctx.columnas && ctx.columnas[n]); } catch (e) { /* hoja ilegible */ } });
  const errores = [];
  const err = (h, f, c, m) => { if (errores.length < 3000) errores.push({ h, f, c, m }); };
  const [anioRep, semRep] = String(ctx.periodoRep || '').split('-').map(Number);

  for (const nombre of Object.keys(hojas)) {
    const H = hojas[nombre], { filas, idx } = H, R = reglas[nombre] || {};
    const col = (c) => idx[c];
    const val = (f, c) => (idx[c] == null ? null : f[idx[c]]);
    const filasDatos = [];
    for (let r = 1; r < filas.length; r++) { const f = filas[r] || []; if (f.some((c) => !vacia(c))) filasDatos.push(r); }
    H.datos = filasDatos;

    /* 1. Reglas del manual por columna */
    for (const r of filasDatos) {
      const f = filas[r];
      for (const c of Object.keys(R)) {
        const i = idx[c.toUpperCase()]; if (i == null) continue;
        const K = R[c], v = f[i], n = r + 1;
        if (vacia(v)) { if (K.o) err(nombre, n, c, 'está vacía'); continue; }
        const tx = txt(v);
        if (K.t === 'n' && !esNum(v)) { err(nombre, n, c, 'debe ser un número'); continue; }
        if (K.t === 'f' && fechaNum(v) == null) { err(nombre, n, c, 'debe ser una fecha con formato dd/mm/aaaa'); continue; }
        if (K.min0 && aNum(v) < 0) { err(nombre, n, c, 'no puede ser negativo'); continue; }
        if (K.l && K.t !== 'f' && !(K.t === 'n' && /[.,]/.test(tx)) && tx.replace(/^-/, '').length > K.l) { err(nombre, n, c, `supera la longitud máxima de ${K.l} ${K.t === 'n' ? 'dígitos' : 'caracteres'}`); continue; }
        if (K.v && !K.v.includes(tx.toUpperCase())) err(nombre, n, c, `tiene un valor no permitido (valores válidos: ${K.v.join(', ')})`);
      }
    }

    /* 2. Año y semestre = periodo que se reporta */
    if (anioRep && semRep && idx['AÑO'] != null && idx['SEMESTRE'] != null) {
      for (const r of filasDatos) {
        const f = filas[r], a = val(f, 'AÑO'), s = val(f, 'SEMESTRE');
        if (!vacia(a) && esNum(a) && aNum(a) !== anioRep) err(nombre, r + 1, 'AÑO', `debe ser ${anioRep} (periodo que se reporta: ${ctx.periodoRep})`);
        if (!vacia(s) && esNum(s) && [1, 2].includes(aNum(s)) && aNum(s) !== semRep) err(nombre, r + 1, 'SEMESTRE', `debe ser ${semRep} (periodo que se reporta: ${ctx.periodoRep})`);
      }
    }

    /* 3. Documento (CC y TI; los documentos de extranjeros no se validan) */
    const iTipo = idx['ID_TIPO_DOCUMENTO'], iDoc = idx['NUM_DOCUMENTO'];
    const tipoDe = (f) => (iTipo == null ? 'CC' : up(f[iTipo]));
    if (iDoc != null) {
      for (const r of filasDatos) {
        const f = filas[r], d = txt(f[iDoc]); if (!d) continue;
        const tipo = tipoDe(f);
        if (tipo === 'CC') {
          if (!/^\d+$/.test(d)) err(nombre, r + 1, 'NUM_DOCUMENTO', 'la cédula solo puede tener dígitos (sin puntos, espacios ni letras)');
          else if (!LONG_CC.includes(d.length)) err(nombre, r + 1, 'NUM_DOCUMENTO', `la cédula tiene ${d.length} dígitos; debe tener de 3 a 8 o 10`);
        } else if (tipo === 'TI') {
          if (!/^\d+$/.test(d)) err(nombre, r + 1, 'NUM_DOCUMENTO', 'la tarjeta de identidad solo puede tener dígitos');
          else if (d.length !== 10 && d.length !== 11) err(nombre, r + 1, 'NUM_DOCUMENTO', `la tarjeta de identidad tiene ${d.length} dígitos; debe tener 10 u 11`);
        }
      }
    }

    /* 4. Teléfono: 10 dígitos que empiezan por 3 y no repetido entre personas distintas (salvo extranjeros) */
    for (const c of Object.keys(idx).filter((x) => /TELEFONO|CELULAR/.test(x))) {
      const porTel = new Map();
      for (const r of filasDatos) {
        const f = filas[r], v = f[idx[c]]; if (vacia(v)) continue;
        const tipo = tipoDe(f); if (tipo !== 'CC' && tipo !== 'TI') continue;   /* extranjeros: sin esta regla */
        const tel = txt(v).replace(/\s+/g, '');
        if (!/^3\d{9}$/.test(tel)) { err(nombre, r + 1, c, 'debe tener 10 dígitos y empezar por 3'); continue; }
        const persona = tipo + '|' + txt(iDoc != null ? f[iDoc] : r);
        if (!porTel.has(tel)) porTel.set(tel, new Map());
        const m = porTel.get(tel); if (!m.has(persona)) m.set(persona, []); m.get(persona).push(r + 1);
      }
      porTel.forEach((m) => { if (m.size > 1) m.forEach((filasP) => filasP.forEach((n) => err(nombre, n, c, 'el teléfono está repetido en otra persona'))); });
    }

    /* 5. Correos */
    for (const c of Object.keys(idx).filter((x) => /EMAIL|CORREO/.test(x))) {
      for (const r of filasDatos) {
        const v = filas[r][idx[c]]; if (vacia(v)) continue;
        if (!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/.test(txt(v))) err(nombre, r + 1, c, 'no es un correo electrónico válido');
      }
    }

    /* 5b. Código de la unidad organizacional: siempre 0101010104. Al cargar se reemplaza automáticamente (api/snies.js · normalizarUnidad); esta es la red de seguridad. */
    if (idx['CODIGO_UNIDAD_ORGANIZACIONAL'] != null && t.id !== 'unidad-organizacional') {
      for (const r of filasDatos) {
        const v = filas[r][idx['CODIGO_UNIDAD_ORGANIZACIONAL']]; if (vacia(v)) continue;
        if (txt(v) !== '0101010104') err(nombre, r + 1, 'CODIGO_UNIDAD_ORGANIZACIONAL', 'debe ser 0101010104 (código de la unidad organizacional de la institución)');
      }
    }
    /* 5c. Fechas escritas como texto (por ejemplo «21/08/2026» alineado a la izquierda): deben ser fechas reales de Excel. */
    for (const c of Object.keys(idx)) {
      if (!/^FECHA_/.test(c)) continue;
      for (const r of filasDatos) { const v = filas[r][idx[c]]; if (typeof v === 'string' && v.trim() !== '' && fechaNum(v) != null) err(nombre, r + 1, c, 'está escrita como texto; debe ser una fecha real de Excel (dd/mm/aaaa)'); }
    }
    /* 5c2. Fechas que son números sueltos (por ejemplo 46255 en formato General): la celda debe tener formato de fecha. */
    {
      const colsF = Object.keys(idx).filter((c) => /^FECHA_/.test(c));
      if (colsF.length && wb.formatosFecha) {
        let fm = null; try { fm = wb.formatosFecha(nombre, { maxCols: 120 }); } catch (e) { fm = null; }
        if (fm) for (const c of colsF) for (const r of filasDatos) {
          const v = filas[r][idx[c]];
          if (typeof v === 'number' && fechaNum(v) != null && !(fm[r] && fm[r][idx[c]])) err(nombre, r + 1, c, 'es un número, no una fecha; la celda debe tener formato de fecha (dd/mm/aaaa)');
        }
      }
    }
    /* 5c3. Ortografía de las descripciones: una palabra desconocida que está a una letra de una palabra común del español se marca como mal escrita
       (por ejemplo «PALNETARIO» → «PLANETARIO»). Los nombres propios que no se parecen a ninguna palabra común no se tocan; los que sí, van en PALABRAS_OK. */
    for (const c of Object.keys(idx).filter((x) => /^DESCRIPCION/.test(x))) {
      for (const r of filasDatos) {
        const v = filas[r][idx[c]]; if (typeof v !== 'string') continue;
        const vistas = new Set();
        for (const w of (v.match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+/g) || [])) {
          const n = sinTilde(w); if (n.length < 5 || vistas.has(n)) continue; vistas.add(n);
          const sug = sugerencia(n); if (sug) err(nombre, r + 1, c, `la palabra «${w.toUpperCase()}» parece mal escrita (¿${sug.toUpperCase()}?)`);
        }
      }
    }
    /* 5c4. Valores de financiación en pesos: un valor positivo menor de 1.000 es casi seguro un dato incompleto (por ejemplo 475 en vez de 475.800). */
    for (const c of Object.keys(idx).filter((x) => /^VLR_FINANCIACION/.test(x))) {
      for (const r of filasDatos) { const v = filas[r][idx[c]]; if (!vacia(v) && esNum(v) && aNum(v) > 0 && aNum(v) < 1000) err(nombre, r + 1, c, 'es menor de $1.000; el valor se escribe en pesos y parece incompleto'); }
    }
    /* 5d. Eventos y actividades: las fechas deben caer dentro del semestre que se reporta (1: 01/01–30/06; 2: 01/07–31/12). */
    if (['evento-cultural', 'actividad-cultural', 'actividad-de-bienestar'].includes(t.id) && anioRep && semRep) {
      const ini = serialDe(anioRep, semRep === 1 ? 1 : 7, 1), fin = serialDe(anioRep, semRep === 1 ? 6 : 12, semRep === 1 ? 30 : 31);
      for (const c of ['FECHA_INICIO', 'FECHA_FINAL']) {
        if (idx[c] == null) continue;
        for (const r of filasDatos) { const x = fechaNum(filas[r][idx[c]]); if (x != null && (x < ini || x > fin)) err(nombre, r + 1, c, `debe estar dentro del semestre ${ctx.periodoRep} (${fechaTxt(ini)} a ${fechaTxt(fin)})`); }
      }
    }

    /* 6. Fechas y números comparados con otra columna */
    for (const [a, op, b] of COMPARACIONES) {
      if (idx[a] == null || idx[b] == null) continue;
      const fecha = a.startsWith('FECHA');
      for (const r of filasDatos) {
        const f = filas[r], va = f[idx[a]], vb = f[idx[b]]; if (vacia(va) || vacia(vb)) continue;
        const x = fecha ? fechaNum(va) : (esNum(va) ? aNum(va) : null), y = fecha ? fechaNum(vb) : (esNum(vb) ? aNum(vb) : null);
        if (x == null || y == null) continue;
        if (!OPS[op][1](x, y)) err(nombre, r + 1, a, `${OPS[op][0]} ${b}`);
      }
    }
    if (idx['FECHA_SNP_SABER_PRO'] != null) {
      const lim = serialDe(2009, 10, 14);
      for (const r of filasDatos) { const x = fechaNum(filas[r][idx['FECHA_SNP_SABER_PRO']]); if (x != null && x <= lim) err(nombre, r + 1, 'FECHA_SNP_SABER_PRO', 'debe ser posterior al 14/10/2009'); }
    }
    if (idx['FECHA_PRUEBA_SABER_11'] != null && anioRep) {
      const lim = serialDe(anioRep, semRep === 2 ? 7 : 1, 1);
      for (const r of filasDatos) { const x = fechaNum(filas[r][idx['FECHA_PRUEBA_SABER_11']]); if (x != null && x >= lim) err(nombre, r + 1, 'FECHA_PRUEBA_SABER_11', `debe ser anterior al ${fechaTxt(lim)}`); }
    }
    if (idx['FECHA_INGRESO'] != null && /integrantes/.test(t.id) && ctx.hoy) {
      for (const r of filasDatos) { const x = fechaNum(filas[r][idx['FECHA_INGRESO']]); if (x != null && x > ctx.hoy) err(nombre, r + 1, 'FECHA_INGRESO', 'no puede ser posterior a la fecha de reporte'); }
    }

    /* 7. Totales: porcentajes de dedicación suman 100 */
    const pcols = Object.keys(idx).filter((x) => /^PORCENTAJE_/.test(x));
    if (pcols.length >= 2) {
      for (const r of filasDatos) {
        const f = filas[r]; let suma = 0, alguno = false;
        for (const c of pcols) {
          const v = f[idx[c]]; if (vacia(v)) continue;
          alguno = true;
          if (!esNum(v) || aNum(v) < 0 || aNum(v) > 100) { err(nombre, r + 1, c, 'el porcentaje debe estar entre 0 y 100'); suma = NaN; } else suma += aNum(v);
        }
        if (alguno && !Number.isNaN(suma) && Math.abs(suma - 100) > 0.001) pcols.forEach((c) => err(nombre, r + 1, c, `los porcentajes de dedicación deben sumar 100 (suman ${Math.round(suma * 100) / 100})`));
      }
    }

    /* 8. Obligatorios condicionales */
    const exige = (f, r, cols, motivo) => cols.forEach((c) => { if (idx[c] != null && vacia(f[idx[c]])) err(nombre, r + 1, c, `es obligatoria ${motivo}`); });
    const iConv = idx['MOVILIDAD_POR_CONVENIO'] != null ? idx['MOVILIDAD_POR_CONVENIO'] : idx['MOVILIDAD_POR_CONVENI O'];
    const nacCols = Object.keys(idx).filter((x) => /^ID_FUENTE_NACIONAL/.test(x) || /^(VLR|VALOR)_FINANCIACION_NACIONAL/.test(x));
    const intCols = Object.keys(idx).filter((x) => /^ID_FUENTE_INTERNACIONAL/.test(x) || x === 'ID_PAIS_FINANCIADOR' || /^(VLR|VALOR)_FINANCIACION_INTERNAC/.test(x) || x === 'NOMBRE_INSTITUCION' || x === 'NOMBRE_ENTIDAD_FTE_INTERNAC');
    for (const r of filasDatos) {
      const f = filas[r];
      if (iConv != null && ['S', 'SI', 'SÍ', '1'].includes(up(f[iConv])) && idx['CODIGO_CONVENIO'] != null) exige(f, r, ['CODIGO_CONVENIO'], 'si la movilidad es por convenio');
      if (nacCols.length > 1 && nacCols.some((c) => !vacia(f[idx[c]]))) exige(f, r, nacCols, 'si se tiene fuente de financiación nacional');
      if (intCols.length > 1 && intCols.some((c) => !vacia(f[idx[c]]))) exige(f, r, intCols, 'si se tiene fuente de financiación internacional');
      if (idx['ES_REINTEGRO_ESTD_ANTES_DE1998'] != null && up(f[idx['ES_REINTEGRO_ESTD_ANTES_DE1998']]) === 'S') exige(f, r, ['AÑO_PRIMER_CURSO', 'SEMESTRE_PRIMER_CURSO'], 'si es reintegro anterior a 1998');
      if (idx['TITULO_PREGRADO'] != null && iTipo != null && up(f[iTipo]) && up(f[iTipo]) !== 'NIT') exige(f, r, ['TITULO_PREGRADO'], 'si el tipo de documento no es NIT');
      const titulo = ['TITULO_RECIBIDO', 'FECHA_GRADO', 'ID_PAIS_INSTITUCION_ESTUDIO'];
      if (/docentes/.test(t.id) && titulo.every((c) => idx[c] != null) && titulo.some((c) => !vacia(f[idx[c]]))) exige(f, r, titulo, 'si el docente tiene título');
    }

    /* 8b. Códigos de las tablas de referencia (DIVIPOLA, ISO de países, CINE campo específico, programas de la ENAP) */
    const tablas = (c) => /^ID_MUNICIPIO/.test(c) ? ['municipios', 'municipios'] : /^ID_DEPARTAMENTO/.test(c) ? ['departamentos', 'departamentos'] : /^ID_PAIS/.test(c) ? ['paises', 'países'] : c === 'ID_CINE_CAMPO_DETALLADO' ? ['cine_especifico', 'campo CINE'] : c === 'PRO_CONSECUTIVO' && !/^programas/.test(t.id) ? ['programas', 'programas de la ENAP (código SNIES)'] : null;
    for (const c of Object.keys(idx)) {
      const tb = tablas(c); if (!tb || !Object.keys(CAT).length || !CAT[tb[0]]) continue;
      const S = conj(tb[0]);
      for (const r of filasDatos) {
        const v = filas[r][idx[c]]; if (vacia(v) || !esNum(v)) continue;
        const k = tb[0] === 'cine_especifico' ? String(Math.floor(aNum(v) / 10)) : String(Math.round(aNum(v)));
        if (!S.has(k)) err(nombre, r + 1, c, tb[0] === 'cine_especifico' ? `no corresponde a ningún campo CINE (su campo específico ${k} no existe)` : `el código ${txt(v)} no existe en la tabla de ${tb[1]}`);
      }
    }

    /* 9. Duplicados: filas completamente iguales, clave de la plantilla y código de la hoja principal */
    const vistas = new Map(), dupFila = new Set();
    for (const r of filasDatos) {
      const firma = H.enc.map((_, i) => up(filas[r][i])).join('\u0001');
      if (vistas.has(firma)) { dupFila.add(r + 1); err(nombre, r + 1, '(fila)', `fila repetida: es igual a la fila ${vistas.get(firma)}`); } else vistas.set(firma, r + 1);
    }
    const claveCols = (CLAVES_DUP[t.id] || []).filter((c) => idx[c] != null);
    if (nombre === nombres[0] && claveCols.length >= 2 && claveCols.some((c) => c === 'NUM_DOCUMENTO')) {
      const k = new Map();
      for (const r of filasDatos) {
        if (dupFila.has(r + 1)) continue;
        const clave = claveCols.map((c) => up(filas[r][idx[c]])).join('|');
        if (k.has(clave)) err(nombre, r + 1, 'NUM_DOCUMENTO', `ya está reportado en la fila ${k.get(clave)} (mismo ${claveCols.map((c) => c.toLowerCase()).join(', ')})`); else k.set(clave, r + 1);
      }
    }
    if (nombre === nombres[0]) {
      const cc = Object.keys(idx).filter((c) => /^CODIGO_/.test(c));
      const esClave = cc.length && (cc.some((c) => c !== 'CODIGO_UNIDAD_ORGANIZACIONAL') || t.id === 'unidad-organizacional');
      if (esClave && !(CLAVES_DUP[t.id])) {
        const k = new Map();
        for (const r of filasDatos) {
          if (dupFila.has(r + 1)) continue;
          const clave = cc.map((c) => up(filas[r][idx[c]])).join('|');
          if (k.has(clave)) err(nombre, r + 1, cc[cc.length - 1], `el código ya está en la fila ${k.get(clave)}; no puede repetirse`); else k.set(clave, r + 1);
        }
      }
    }
  }

  /* 10. Relación entre hojas de la misma plantilla */
  const rel = RELACIONES[t.id];
  const principal = hojas[nombres[0]];
  if (principal && nombres.length > 1) {
    const hijas = nombres.slice(1).filter((n) => hojas[n]);
    const claveEntre = (A, B) => {
      const cods = Object.keys(A.idx).filter((c) => /^CODIGO_/.test(c) && B.idx[c] != null);
      if (cods.length) return cods;
      return ['ID_TIPO_DOCUMENTO', 'NUM_DOCUMENTO'].filter((c) => A.idx[c] != null && B.idx[c] != null);
    };
    const claveFila = (H, f, cols) => cols.map((c) => up(f[H.idx[c]])).join('|');
    const presentes = {};
    for (const hn of hijas) {
      const H = hojas[hn], cols = claveEntre(principal, H);
      if (!cols.length) continue;
      const padre = new Set(principal.datos.map((r) => claveFila(principal, principal.filas[r], cols)));
      const hijo = new Set();
      for (const r of H.datos) {
        const k = claveFila(H, H.filas[r], cols); hijo.add(k);
        if (!padre.has(k)) err(hn, r + 1, cols[cols.length - 1], `no tiene su registro en la hoja ${nombres[0]}`);
      }
      presentes[hn] = { cols, hijo };
    }
    const exigidas = rel && rel.todas ? rel.todas.filter((n) => presentes[n]) : [];
    for (const r of principal.datos) {
      const f = principal.filas[r];
      for (const hn of exigidas) {
        const { cols, hijo } = presentes[hn];
        if (!hijo.has(claveFila(principal, f, cols))) err(nombres[0], r + 1, cols[cols.length - 1], `no tiene registros en la hoja ${hn}; todo lo cargado aquí debe ir también allá`);
      }
      if (rel && rel.alguna) {
        const g = rel.alguna.filter((n) => presentes[n]);
        if (g.length && !g.some((hn) => presentes[hn].hijo.has(claveFila(principal, f, presentes[hn].cols)))) err(nombres[0], r + 1, presentes[g[0]].cols[presentes[g[0]].cols.length - 1], `no tiene registros en ninguna de las hojas ${g.join(' o ')}`);
      }
    }
  }

  const out = {};
  for (const n of Object.keys(hojas)) out[n] = { cols: hojas[n].enc, datos: hojas[n].datos, filas: hojas[n].filas };
  return { errores, hojas: out };
}

/** Texto corto por (hoja, columna, mensaje) con las filas afectadas. */
function resumenTextos(errores) {
  const g = new Map();
  for (const e of errores) { const k = e.h + '|' + e.c + '|' + e.m; if (!g.has(k)) g.set(k, { ...e, filas: [] }); g.get(k).filas.push(e.f); }
  const lista = (f) => f.length <= 6 ? f.join(', ') : f.slice(0, 6).join(', ') + ` y ${f.length - 6} más`;
  const t = [...g.values()].map((x) => (x.c === '(fila)' ? `Hoja ${x.h}: ${x.m} (fila${x.filas.length > 1 ? 's' : ''} ${lista(x.filas)}).` : `Hoja ${x.h} · columna ${x.c} ${x.m} (fila${x.filas.length > 1 ? 's' : ''} ${lista(x.filas)}).`));
  return t.length > 25 ? t.slice(0, 25).concat(`Hay ${t.length - 25} grupos de errores más; corrija estos y vuelva a cargar.`) : t;
}

/** Datos para el visor: la tabla completa de cada hoja, como en Excel (todas las filas con datos), con los errores por celda.
 *  Si hay más celdas de las que caben en pantalla, siempre se incluyen las filas con error (máx. 400) y se completa con las primeras filas. */
function detalleVisor(res) {
  const porHoja = {};
  for (const e of res.errores) { (porHoja[e.h] = porHoja[e.h] || new Map()); if (!porHoja[e.h].has(e.f)) porHoja[e.h].set(e.f, []); porHoja[e.h].get(e.f).push(e); }
  const hojas = [];
  for (const h of Object.keys(res.hojas)) {
    const H = res.hojas[h], pos = []; H.cols.forEach((c, i) => { if (c) pos.push(i); });
    if (!pos.length) continue;
    const cols = pos.map((i) => H.cols[i]), errs = porHoja[h] || new Map();
    const llena = (row) => row && pos.some((i) => row[i] != null && String(row[i]).trim() !== '');
    const todas = []; for (let n = 2; n <= H.filas.length; n++) if (llena(H.filas[n - 1]) || errs.has(n)) todas.push(n);
    const tope = Math.max(150, Math.floor(60000 / cols.length));
    let elegidas = todas;
    if (todas.length > tope) {
      const conError = todas.filter((n) => errs.has(n)).slice(0, 400), set = new Set(conError);
      for (const n of todas) { if (set.size >= tope) break; set.add(n); }
      elegidas = [...set].sort((x, y) => x - y);
    }
    const filas = elegidas.map((n) => ({
      n,
      v: pos.map((i) => { const x = (H.filas[n - 1] || [])[i]; return x == null ? '' : (typeof x === 'number' && /^FECHA/.test(H.cols[i]) && fechaTxt(x)) || x; }),
      e: (errs.get(n) || []).map((x) => ({ c: x.c, m: x.m })),
    }));
    hojas.push({ nombre: h, cols, fecha: cols.filter((c) => /^FECHA/.test(c)), filas, total: errs.size, filasTotal: todas.length });
  }
  return { hojas, total: res.errores.length };
}

module.exports = { leerHoja, ubicarEncabezado, revisarContenido, resumenTextos, detalleVisor, fechaNum };
