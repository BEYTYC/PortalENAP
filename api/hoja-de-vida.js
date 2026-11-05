/**
 * api/hoja-de-vida.js
 *
 * Servidor del módulo "Hoja de vida del estudiante": toda la trayectoria de un
 * estudiante por la ENAP en una sola pantalla. Solo lectura.
 *
 * Quién puede usarlo (por ahora): sea@enap.edu.co y jestadisticaplen@enap.edu.co.
 *
 * Fuentes (OneDrive de jestadisticaplen, y SharePoint del Portal):
 *   - CONGLOMERADO ........ ingresos (sigla, contingente, fecha, motivo de salida).
 *   - Bajas y Ascensos .... hoja "Bajas desde 1935" (retiros) y hoja "Ascensos" (escalafón y su puesto).
 *   - Graduados en la ENAP  quién se graduó (hoja "Grados").
 *   - Antigüedades ........ (SharePoint, carpeta Antiguedades/, todos los periodos): notas por semestre,
 *                           puesto, alumno distinguido y excelencia académica.
 *   - Base Concesiones.xlsm (B.D Distinguidos, Becados, Mérito y Laureado): hoja Concesiones (col. D = Sí, col. O = concesión) y las hojas de becas, mención de honor, meritorios, laureados y distinguidos.
 *   - Base de Datos Cursos de Extensión: extensión; BASE DE DATOS CCP 1970 - ACTUALIDAD: complementación profesional; Control Curso de Capacitación para Ascenso: cursos de ley.
 *
 * Regla de oro: lo que no existe en las bases NO se muestra ni se inventa.
 * Lo que se cruza solo por nombre (bases viejas sin cédula) sale marcado
 * como "coincidencia por nombre, por verificar".
 */

const roles = require('./roles.js');
const X = require('./_xlsx.js');

const GRAPH = 'https://graph.microsoft.com/v1.0';
const ADMINS = ['sea@enap.edu.co', 'jestadisticaplen@enap.edu.co'];
const DUENO = 'jestadisticaplen@enap.edu.co';
const RUTA_BD = 'Estadística/Bases de Datos/';
const RUTAS = {
  conglomerado: [RUTA_BD + 'B.D Ingresos/CONGLOMERADO.xlsx', RUTA_BD + 'B.D Ingresos/CONGLOMERADO.xlsm'],
  graduados: [RUTA_BD + 'B.D Grados - Balances Académicos/Graduados en la ENAP.xlsx'],
  extension: [RUTA_BD + 'BD Cursos de Ley - Cursos de Extensión/Base de Datos Cursos de Extensión.xlsx'],
  ccp: [RUTA_BD + 'B.D Registro CCP/BASE DE DATOS CCP 1970 - ACTUALIDAD.xlsx'],
  medallas: [RUTA_BD + 'B.D Medalla Caldas/Base Datos Solicitud Caldas.xlsx'],
  ley: [RUTA_BD + 'BD Cursos de Ley - Cursos de Extensión/Control Curso de Capacitación para Ascenso.xlsx'],
};
const CARPETA_BAJAS = RUTA_BD + 'B.D Retiros y Ascensos';
const CARPETA_CONC = RUTA_BD + 'B.D Concesiones/B.D Concesiones';
const HOJA_BAJAS = 'Bajas desde 1935';
const HOJA_ASC = 'Ascensos';
const PESOS = [0.5, 0.2, 0.2, 0.1]; // académica, aptitud naval, disciplina, cultura física (igual que Antigüedades)

function error(mensaje, status) { const e = new Error(mensaje); e.status = status || 500; return e; }
const sinTildes = (s) => String(s == null ? '' : s).replace(/[ñÑ]/g, '\u0001').normalize('NFD').replace(/\u0001(?:̃)?/g, 'Ñ').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
/* Cédula normalizada igual en todas las bases: solo dígitos, sin ceros a la izquierda, sin prefijo (CC, C.C., CE, TI), sin decimales (.0) ni notación científica. */
const cedKey = (v) => {
  if (v == null || v === '') return '';
  let t;
  if (typeof v === 'number') t = Number.isInteger(v) ? v.toFixed(0) : String(v);
  else t = String(v).trim().toUpperCase();
  if (/^\d+(\.\d+)?E\+?\d+$/.test(t)) { const n = Number(t); if (Number.isFinite(n)) t = n.toFixed(0); }
  t = t.replace(/^\d+[.,]0+$/, (m) => m.replace(/[.,]0+$/, ''));
  t = t.replace(/^(C\.?\s?C\.?|C\.?\s?E\.?|T\.?\s?I\.?|NUIP|CEDULA|CÉDULA|DOC(UMENTO)?\.?)\s*[:#.\-]?\s*(?=\d)/, '');
  t = t.replace(/[^0-9A-Z]/g, '').replace(/^0+(?=\d)/, '');
  return /\d/.test(t) ? t : ''; // 'NR', 'N/A', '-' no son cédula: se cruza por nombre
};
/* Llave de nombre: palabras ordenadas, sin tildes ni signos (sirve aunque cambie el orden apellidos/nombres). */
const nomKey = (n) => sinTildes(n).replace(/Ñ/g, 'N').replace(/[^A-Z ]/g, ' ').split(' ').filter(Boolean).sort().join(' ');
/* Nombre para mostrar: mayúsculas con tildes y Ñ tal como vienen en la base. */
const txt = (v) => String(v == null ? '' : v).trim();
/* Nombres y apellidos frecuentes: las bases a veces vienen sin tilde ni Ñ; se restituyen para mostrar. */
const CON_TILDE = ('ÁLVAREZ ÁLVARO ÁNGEL ÁNGELA ÁNGELES ÁVILA ÁVILES ADRIÁN AGUSTÍN ALMANZA ANÍBAL ANDRÉS AMÉRICO ARÁMBULO ARANGUREN BARRIOS BENÍTEZ BERMÚDEZ BOHÓRQUEZ CÁCERES CÁRDENAS CÉSAR CÓRDOBA CORTÉS CARRIÓN CASTAÑEDA CASTAÑO CASTAÑEDA CRISTÓBAL CHÁVEZ DÁVILA DÍAZ DOMÍNGUEZ DUEÑAS EFRAÍN ENRÍQUEZ ESCOBAR FÁBREGAS FABIÁN FERNÁNDEZ FLÓREZ FRANCISCO GÁLVEZ GARCÍA GERMÁN GÓMEZ GONZÁLEZ GUTIÉRREZ GUZMÁN HÉCTOR HENRÍQUEZ HERNÁNDEZ HERNÁN IBÁÑEZ IVÁN JESÚS JIMÉNEZ JOAQUÍN JOSÉ JULIÁN LÓPEZ LÓPEZ LUCÍA MÁRQUEZ MÓNICA MARÍA MARTÍNEZ MEJÍA MENDÉZ MUÑOZ NÁJERA NARVÁEZ NÉSTOR NICOLÁS NIÑO NÚÑEZ ORDÓÑEZ ÓSCAR OSCAR_ PÁEZ PEÑA PEÑALOZA PEÑARANDA PÉREZ PIÑEROS QUIÑONES QUIÑÓNEZ RAMÍREZ RAÚL RODRÍGUEZ ROMÁN RUBÉN RÚA SÁNCHEZ SANTAMARÍA SEBASTIÁN SERRANO_ TÁMARA TOMÁS TRUJILLO_ VÁSQUEZ VÁSQUEZ VÁZQUEZ VALDÉS VÉLEZ VELÁSQUEZ VERÓNICA VÍCTOR VIÑA ZÚÑIGA ZÁRATE JAIME_ SOFÍA ÉDGAR ÉDISON ÉRIKA ÉLIDA HÉCTOR GABRIÉL_ MIGUEL_ AMPARO_ CAMILA_ JUAN_ LEÓN LEÓNIDAS MARÍN MARTÍN_ MÉNDEZ MONTAÑO MONTOYA_ NARIÑO OLAYA_ PADILLA_ PÉÑA_ QUINTERO_ RÍOS RIVERA_ ROJAS_ RUÍZ_ SALAZAR_ SUÁREZ TAPIAS_ TÉLLEZ TORRÉS_ ULLOA_ URIBE_ VALENCIA_ VARGAS_ VEGA_ VILLALOBOS_ YÁÑEZ ZAMBRANO_ ZULUAGA_ DARÍO ELÍAS INÉS BENJAMÍN RAMÓN MATÍAS ESTEFANÍA ÁLEX GAITÁN ALARCÓN ALBÁN ALCÁNTARA BELTRÁN BOLÍVAR CALDERÓN CUÉLLAR DURÁN ESTÉVEZ GALÁN GARZÓN LONDOÑO MELÉNDEZ MORÁN MORÓN OTÁLORA PINZÓN POLANÍA RINCÓN TOBÓN CÉSPEDES JÁCOME CAÑÓN CAÑAS RIAÑO SEPÚLVEDA SOLÓRZANO BÁEZ CHAVARRÍA COLÓN ECHEVERRÍA GÁMEZ MÚNERA PIÑA ROLDÁN SÁENZ SOLÍS VELÁZQUEZ VILLAMARÍN YÉPEZ GRIJALBA AGUDELO_ MARÍA JOSÉ').split(/\s+/).filter((w) => !w.endsWith('_'));
const quitaTil = (w) => w.replace(/Ñ/g, '\u0001').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\u0001/g, 'N');
const MAPA_TIL = {};
CON_TILDE.forEach((w) => { MAPA_TIL[quitaTil(w)] = w; });
const nom = (v) => txt(v).toUpperCase().replace(/\s+/g, ' ').replace(/[A-ZÁÉÍÓÚÜÑ]+/g, (w) => MAPA_TIL[w] || w);
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => (d ? `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` : '');
function fechaCelda(v) {
  if (v == null || v === '') return '';
  if (typeof v === 'number') return iso(X.serialAFecha(v));
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/); if (m) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
  return '';
}
const anioDe = (f) => (f ? +f.slice(0, 4) : null);

/* ------------------------------ Graph básico ------------------------------ */

let TOKEN = null, SITE = null;
async function ctx() { TOKEN = await roles.getAppAccessToken(); SITE = await roles.resolveSiteId(TOKEN); }
async function g(url) {
  for (let intento = 0; intento < 3; intento++) {
    const r = await fetch(url.startsWith('http') ? url : GRAPH + url, { headers: { Authorization: `Bearer ${TOKEN}` } });
    if ((r.status === 429 || r.status === 503 || r.status === 504) && intento < 2) { await new Promise((ok) => setTimeout(ok, 1500 * (intento + 1))); continue; }
    return r;
  }
}
async function leerJsonAnt(n) {
  const r = await g(`/sites/${SITE}/drive/root:/Antiguedades/${n}:/content`);
  if (r.status === 404) return null;
  if (!r.ok) throw error(`No se pudo leer Antiguedades/${n} (${r.status}).`, 502);
  return r.json();
}
const enc = (ruta) => ruta.split('/').map(encodeURIComponent).join('/');
const normNom = (n) => sinTildes(n).replace(/[^A-Z0-9.]/g, '');

async function itemBajas() {
  const r = await g(`/users/${encodeURIComponent(DUENO)}/drive/root:/${enc(CARPETA_BAJAS)}:/children?$select=id,name,eTag,lastModifiedDateTime,file&$top=200`);
  if (!r.ok) throw error(`No se pudo abrir la carpeta ${CARPETA_BAJAS} (${r.status}).`, 502);
  const L = ((await r.json()).value || []).filter((x) => x.file);
  const es = (x, ext) => normNom(x.name).startsWith('BAJASYASCENSOS') && normNom(x.name).endsWith(ext);
  const pick = (ext) => L.filter((x) => es(x, ext)).sort((a, b) => String(b.lastModifiedDateTime).localeCompare(String(a.lastModifiedDateTime)))[0];
  const m = pick('.XLSX') || pick('.XLSM');
  if (!m) throw error(`No se encontró Bajas y Ascensos en ${CARPETA_BAJAS}.`, 404);
  return { id: m.id, eTag: m.eTag, nombre: m.name, mod: m.lastModifiedDateTime };
}
async function itemConcesiones() {
  const base = `/users/${encodeURIComponent(DUENO)}/drive`;
  const sel = '?$select=id,name,eTag,lastModifiedDateTime,file,folder&$top=200';
  const esBase = (x) => x.file && /\.xls[xm]$/i.test(x.name) && normNom(x.name).startsWith('BASECONCESIONES') && !x.name.startsWith('~$');
  const hijos = async (ruta) => { const r = await g(`${base}/root:/${enc(ruta)}:/children${sel}`); return r.ok ? ((await r.json()).value || []) : null; };
  const raiz = await hijos(CARPETA_CONC);
  if (!raiz) throw error(`No se pudo abrir la carpeta ${CARPETA_CONC}.`, 502);
  let L = raiz.filter(esBase);
  // Si no está en la carpeta, se busca en sus subcarpetas (un nivel y dos).
  for (const sub of raiz.filter((x) => x.folder && !L.length)) {
    const h1 = (await hijos(CARPETA_CONC + '/' + sub.name)) || [];
    L = h1.filter(esBase);
    for (const s2 of h1.filter((x) => x.folder && !L.length)) L = ((await hijos(CARPETA_CONC + '/' + sub.name + '/' + s2.name)) || []).filter(esBase);
  }
  L.sort((a, b) => String(b.lastModifiedDateTime).localeCompare(String(a.lastModifiedDateTime)));
  if (!L[0]) throw error(`No se encontró "Base Concesiones" en ${CARPETA_CONC}.`, 404);
  return { id: L[0].id, eTag: L[0].eTag, nombre: L[0].name, mod: L[0].lastModifiedDateTime };
}
async function item(clave) {
  if (clave === 'bajas') return itemBajas();
  if (clave === 'concesiones') return itemConcesiones();
  for (const ruta of RUTAS[clave]) {
    const r = await g(`/users/${encodeURIComponent(DUENO)}/drive/root:/${enc(ruta)}`);
    if (r.ok) { const m = await r.json(); return { id: m.id, eTag: m.eTag, nombre: m.name, mod: m.lastModifiedDateTime }; }
    if (r.status !== 404) throw error(`No se pudo abrir ${ruta} (${r.status}).`, 502);
  }
  throw error(`No se encontró el archivo en el OneDrive de Estadística (${RUTAS[clave][0]}).`, 404);
}
async function descargar(it) {
  const r = await g(`/users/${encodeURIComponent(DUENO)}/drive/items/${it.id}/content`);
  if (!r.ok) throw error(`No se pudo descargar ${it.nombre} (${r.status}).`, 502);
  return Buffer.from(await r.arrayBuffer());
}
const MODS = {}; // última modificación de cada archivo (para "datos actualizados al")
const CACHE = {}; // por instancia de la función, vigente mientras no cambie el eTag
const TTL_FUENTE = 2 * 60000;
async function fuente(clave, procesar) {
  const c = CACHE[clave];
  if (c && Date.now() - c.t < TTL_FUENTE) return c.valor; // reciente: no consulta nada
  const it = await item(clave);
  if (it.mod) MODS[clave] = it.mod;
  if (c && c.eTag === it.eTag) { c.t = Date.now(); return c.valor; }
  const valor = procesar(X.abrir(await descargar(it)), it);
  CACHE[clave] = { eTag: it.eTag, valor, t: Date.now() };
  return valor;
}

function indiceCols(encab, nombres) {
  const H = encab.map((h) => sinTildes(h).replace(/Ñ/g, 'N').replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim());
  const out = {};
  for (const [k, alts] of Object.entries(nombres)) {
    out[k] = -1;
    for (const a of alts) { const i = H.indexOf(a); if (i >= 0) { out[k] = i; break; } }
    if (k === 'ced' && out[k] < 0) { const i = H.findIndex((x) => /(CEDULA|DOCUMENTO|IDENTIF|IDENTIDAD)/.test(x) && !/(TIPO|LUGAR|EXPEDI|FECHA)/.test(x)); if (i >= 0) out[k] = i; }
  }
  return out;
}
function agregar(mapa, k, v) { if (k) (mapa[k] = mapa[k] || []).push(v); }

/* --------------------------- Procesar cada fuente -------------------------- */

const normCont = (v) => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
function procesarConglomerado(libro) {
  const hoja = libro.hojas.find((h) => /todos los ingresos/i.test(h)) || libro.hojas[0];
  const F = libro.leer(hoja, { maxCols: 30 });
  const c = indiceCols(F[0] || [], {
    esp: ['ESP INGRESO'], cont: ['CONTING', 'CONTINGENTE'], fecha: ['FECHA INGRESO'], periodo: ['PERIODO INGRESO'],
    nombre: ['APELLIDOS Y NOMBRES'], cedula: ['CEDULA'], sexo: ['SEXO'], ext: ['EXTRANJERO'], pais: ['PAIS'],
    salida: ['MOTIVO SALIDA'], anioSal: ['ANO DEFINITIVO SALIDA'], promo: ['NUMERO PROMOCION', 'NUMERO / PROMOCION'],
  });
  if (c.promo < 0) c.promo = (F[0] || []).map((x) => sinTildes(x).replace(/Ñ/g, 'N')).findIndex((x) => /PROMOCION/.test(x) && !/(FECHA|ANO |PERIODO)/.test(x));
  // SEGUNDO CONTINGENTE (REINGRESO): si trae dato, el estudiante reingresó; la fecha sale de una columna de fecha de reingreso si existe o, si no, de la fecha de ingreso de ese contingente.
  const H0 = (F[0] || []).map((x) => sinTildes(x).replace(/Ñ/g, 'N').replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim());
  c.cont2 = H0.findIndex((x) => /SEGUNDO CONTI/.test(x) || (/REINGRESO/.test(x) && /CONTI/.test(x)));
  c.fechaRe = H0.findIndex((x, j) => j !== c.cont2 && /REINGRESO/.test(x) && /(FECHA|PERIODO|ANO)/.test(x));
  c.resol = H0.findIndex((x) => x === 'RES ING 2'); if (c.resol < 0) c.resol = H0.findIndex((x) => /RESOLUCION/.test(x) && !/(REINGRESO|RETIRO|SALIDA|BAJA|ESCALAF|GRADO)/.test(x));
  c.resolRe = H0.findIndex((x) => /RESOLUCION/.test(x) && /REINGRESO/.test(x));
  if (c.nombre < 0) throw error('CONGLOMERADO no tiene la columna APELLIDOS Y NOMBRES.', 500);
  const porCed = {}, porNom = {};
  const fechasCont = {}; // contingente -> {fecha: veces}
  let n = 0;
  for (let i = 1; i < F.length; i++) {
    const r = F[i];
    if (!r[c.nombre]) continue;
    const d = c.fecha >= 0 ? X.serialAFecha(r[c.fecha]) : null;
    let anio = d ? d.getUTCFullYear() : null;
    if (!anio && c.periodo >= 0) { const m = String(r[c.periodo] || '').match(/^(\d{4})/); if (m) anio = +m[1]; }
    const ext = String(r[c.ext] || '').toUpperCase().startsWith('S');
    const ck = c.cedula >= 0 ? cedKey(r[c.cedula]) : '';
    const reg = {
      nombre: nom(r[c.nombre]), cedula: ck ? txt(r[c.cedula]) : '', ck, sigla: txt(r[c.esp]), cont: txt(r[c.cont]).replace(/\s+/g, ''),
      fecha: iso(d), anio: anio || null, sexo: /^[MF]$/i.test(txt(r[c.sexo])) ? txt(r[c.sexo]).toUpperCase() : '',
      nac: ext ? sinTildes(r[c.pais] || '') : (c.ext >= 0 ? 'COLOMBIA' : ''), salida: txt(r[c.salida]), anioSal: txt(r[c.anioSal]), promo: c.promo >= 0 ? txt(r[c.promo]) : '',
      resol: c.resol >= 0 ? txt(r[c.resol]) : '', resolRe: c.resolRe >= 0 ? txt(r[c.resolRe]) : '',
      cont2: c.cont2 >= 0 ? txt(r[c.cont2]).replace(/\s+/g, '') : '', fechaRe: c.fechaRe >= 0 ? fechaCelda(r[c.fechaRe]) : '',
    };
    if (reg.cont && reg.fecha) { const kc = normCont(reg.cont); const m = (fechasCont[kc] = fechasCont[kc] || {}); m[reg.fecha] = (m[reg.fecha] || 0) + 1; }
    n++;
    if (ck) agregar(porCed, ck, reg); else agregar(porNom, nomKey(reg.nombre), reg);
  }
  // fecha de reingreso: la de ese contingente (la más frecuente entre sus integrantes)
  const fechaDeCont = (k) => { const m = fechasCont[normCont(k)]; return m ? Object.keys(m).sort((a, b) => m[b] - m[a])[0] : ''; };
  [porCed, porNom].forEach((M) => Object.values(M).forEach((L) => L.forEach((reg) => { if (reg.cont2 && !/^(-|NO|NA|N\/A|0)$/i.test(reg.cont2)) reg.reingreso = { cont: reg.cont2, fecha: reg.fechaRe || fechaDeCont(reg.cont2) || '', resol: reg.resolRe || '' }; })));
  return { porCed, porNom, filas: n };
}

function procesarBajas(libro) {
  const F = libro.leer(HOJA_BAJAS, { maxCols: 33 });
  const colRes = (H, def) => { const j = (H || []).findIndex((x) => /^RESOLUCION$/.test(sinTildes(x))); return j >= 0 ? j : def; };
  const iResB = colRes(F[0], 16);
  const porCed = {}, porNom = {};
  let n = 0;
  for (let i = 1; i < F.length; i++) {
    const r = F[i];
    const ck = cedKey(r[5]);
    if (!ck && !r[4]) continue;
    const reg = {
      nombre: nom(r[4]), ck, sigla: txt(r[2]), cont: txt(r[3]).replace(/\s+/g, ''), anioIng: r[6] || null, ingreso: fechaCelda(r[7]),
      curso: txt(r[11]), grado: txt(r[13]), retiro: fechaCelda(r[14]), doc: txt(r[iResB]), causal: txt(r[20]), obs: txt(r[22]),
    };
    n++;
    if (ck) agregar(porCed, ck, reg); else agregar(porNom, nomKey(reg.nombre), reg);
  }
  // Ascensos (escalafón): A N, B tipo, C contingente, D sigla, E promoción, F especialidad, G nombre, H cédula, I ciencias,
  // J puesto, K "p/tot", L total, M promedio, N periodo, O fecha, P año, Q resolución.
  const asc = { porCed: {}, porNom: {}, filas: 0 };
  try {
    const A = libro.leer(HOJA_ASC, { maxCols: 18 });
    const iResA = colRes(A[0], 16);
    for (let i = 1; i < A.length; i++) {
      const r = A[i];
      const ck = cedKey(r[7]);
      if (!ck && !r[6]) continue;
      const puesto = +r[9], total = +r[11];
      const reg = {
        nombre: nom(r[6]), ck, cont: txt(r[2]), sigla: txt(r[3]), promocion: txt(r[4]), especialidad: txt(r[5]),
        puesto: puesto > 0 ? puesto : null, total: total > 0 ? total : null, promedio: typeof r[12] === 'number' ? r[12] : null,
        periodo: txt(r[13]), fecha: fechaCelda(r[14]), resolucion: txt(r[iResA]),
      };
      asc.filas++;
      if (ck) agregar(asc.porCed, ck, reg); else agregar(asc.porNom, nomKey(reg.nombre), reg);
    }
  } catch (e) { asc.error = e.message; }
  return { porCed, porNom, filas: n, asc };
}

/* Graduados: se leen TODAS las hojas del libro que tengan encabezados reconocibles (pregrado, especializaciones, maestrías, doctorado… pueden ir en hojas distintas). */
function procesarGraduados(libro) {
  const porCed = {}, porNom = {};
  let n = 0, cols = null;
  const hojasInfo = [];
  const hojas = libro.hojas.slice().sort((a, b) => (/^grados$/i.test(b) ? 1 : 0) - (/^grados$/i.test(a) ? 1 : 0));
  hojas.forEach((hoja) => {
    let F;
    try { F = libro.leer(hoja, { maxCols: 40 }); } catch (e) { return; }
    const r = graduadosDeHoja(F, porCed, porNom);
    hojasInfo.push(r ? { hoja, usada: true, filas: r.n, cols: r.cols, ultimos: r.ultimos, totalFilas: F.length } : { hoja, usada: false });
    if (r) { n += r.n; cols = cols || r.columnas; ['fecha', 'titulo', 'trabajo', 'nombre', 'cedula'].forEach((k) => { if (r.columnas[k]) cols[k] = true; }); }
  });
  return { porCed, porNom, filas: n, hojas: hojasInfo, columnas: cols || { fecha: false, titulo: false, trabajo: false, nombre: false, cedula: false } };
}
function graduadosDeHoja(F, porCed, porNom) {
  // La fila de encabezados puede no ser la primera: se toma la primera (de las 8 primeras) que traiga cédula o nombre.
  let h0 = 0, c = null;
  for (let q = 0; q < Math.min(F.length, 8); q++) {
    const t = indiceCols(F[q] || [], {
      ced: ['CEDULA', 'CEDULA DE CIUDADANIA', 'DOCUMENTO', 'IDENTIFICACION', 'NUMERO DE DOCUMENTO', 'NUMERO DE IDENTIFICACION', 'CC', 'C C'],
      prog: ['NOMBRE PROGRAMA', 'PROGRAMA', 'PROGRAMA ACADEMICO', 'NOMBRE DEL PROGRAMA'],
      nombre: ['APELLIDOS Y NOMBRES', 'NOMBRES Y APELLIDOS', 'NOMBRE', 'NOMBRES', 'NOMBRE COMPLETO', 'ESTUDIANTE', 'GRADUANDO', 'GRADUADO'],
      ape: ['APELLIDOS', 'APELLIDO', 'PRIMER APELLIDO'],
      fecha: ['FECHA GRADO', 'FECHA DE GRADO', 'FECHA ACTA', 'FECHA DE ACTA', 'FECHA'], titulo: ['TITULO', 'TITULO OTORGADO', 'NOMBRE TITULO'],
      trabajo: ['TRABAJO DE GRADO', 'NOMBRE TRABAJO DE GRADO', 'TITULO TRABAJO DE GRADO', 'TITULO DEL TRABAJO DE GRADO', 'NOMBRE DEL TRABAJO DE GRADO', 'TRABAJO GRADO', 'TESIS', 'TITULO TESIS', 'NOMBRE DEL TRABAJO'],
    });
    if (t.ced >= 0 || t.nombre >= 0 || t.ape >= 0) { c = t; h0 = q; break; }
  }
  if (!c) c = indiceCols(F[0] || [], { ced: ['CEDULA'], prog: ['NOMBRE PROGRAMA'], nombre: ['APELLIDOS Y NOMBRES'], ape: ['APELLIDOS'], fecha: ['FECHA GRADO'], titulo: ['TITULO'], trabajo: ['TRABAJO DE GRADO'] });
  const encab = (F[h0] || []).map((x) => sinTildes(x).replace(/Ñ/g, 'N'));
  if (c.nombre < 0) c.nombre = encab.findIndex((x) => /NOMBRE/.test(x) && !/(PROGRAMA|TRABAJO|TITULO|ACTA|ESPECIAL)/.test(x));
  if (c.ape < 0) c.ape = encab.findIndex((x) => /^APELLIDO/.test(x));
  if (c.trabajo < 0) c.trabajo = encab.findIndex((x) => /(TRABAJO|TESIS|MONOGRAFIA|PROYECTO DE GRADO)/.test(x) && !/(FECHA|NOTA|CALIFIC|DIRECTOR|ASESOR|JURADO|ACTA)/.test(x));
  // Respaldo: si "APELLIDOS Y NOMBRES" viene vacío (fórmula sin valor guardado), se arma con APELLIDOS2 + NOMBRES.
  const iAp2 = encab.findIndex((x) => /^APELLIDOS ?2$/.test(x)), iNom2 = encab.findIndex((x) => /^NOMBRES$/.test(x));
  if (c.ced < 0 && c.nombre < 0 && c.ape < 0 && iAp2 < 0) return null;
  if (c.prog < 0 && c.fecha < 0) return null; // hoja sin programa ni fecha: no es una lista de grados
  let n = 0; const ultimos = [];
  for (let i = h0 + 1; i < F.length; i++) {
    const r = F[i];
    const ck = c.ced >= 0 ? cedKey(r[c.ced]) : '';
    let nm = c.nombre >= 0 ? sinTildes(r[c.nombre]) : '';
    if (!/[A-Z]/.test(nm)) nm = '';
    if (c.ape >= 0 && c.ape !== c.nombre) { const ap = sinTildes(r[c.ape]); if (ap && !nm.includes(ap)) nm = (ap + ' ' + nm).trim(); }
    if (!/[A-Z]/.test(nm)) nm = '';
    if (!nm && (iAp2 >= 0 || iNom2 >= 0)) nm = sinTildes([iAp2 >= 0 ? r[iAp2] : '', iNom2 >= 0 ? r[iNom2] : ''].filter(Boolean).join(' '));
    if (!ck && !nm) continue;
    const reg = { programa: c.prog >= 0 ? sinTildes(r[c.prog]) : '', titulo: c.titulo >= 0 ? txt(r[c.titulo]) : '', fecha: c.fecha >= 0 ? fechaCelda(r[c.fecha]) : '', nombre: nm ? nom(nm) : '', trabajo: c.trabajo >= 0 ? txt(r[c.trabajo]) : '' };
    n++;
    ultimos.push((reg.nombre || '(sin nombre)') + ' [' + (ck || 'sin cédula') + ']' + (reg.fecha ? ' ' + reg.fecha : '')); if (ultimos.length > 3) ultimos.shift();
    if (ck) agregar(porCed, ck, reg); else if (reg.nombre) agregar(porNom, nomKey(reg.nombre), reg);
  }
  return { n, ultimos, cols: (F[h0] || []).map((x) => txt(x)).filter(Boolean), columnas: { fecha: c.fecha >= 0, titulo: c.titulo >= 0, trabajo: c.trabajo >= 0, nombre: c.nombre >= 0, cedula: c.ced >= 0 } };
}

/* Cursos de extensión / complementación / ascenso: columnas por nombre de encabezado; si no se reconocen, no se muestra nada. */
const procesarExtension = (libro) => procesarCursos(libro, 'extension');
const procesarLey = (libro) => procesarCursos(libro, 'ley');
const procesarCcp = (libro) => procesarCursos(libro, 'ccp');
function horasDe(v) { const m = String(v == null ? '' : v).replace(',', '.').match(/\d+(\.\d+)?/); return m && +m[0] > 0 ? +m[0] : null; }
function procesarCursos(libro, base) {
  const porCed = {}, porNom = {};
  const hojas = [];
  let n = 0;
  for (const nombreHoja of libro.hojas) {
    let F;
    try { F = libro.leer(nombreHoja, { maxCols: 40, maxRows: 60000 }); } catch (e) { continue; }
    let h0 = -1, c = null;
    for (let i = 0; i < Math.min(F.length, 8); i++) {
      const t = indiceCols(F[i] || [], {
        ced: ['CEDULA', 'CC', 'C C', 'DOCUMENTO', 'DOCUMENTO DE IDENTIDAD', 'DOCUMENTO IDENTIDAD', 'NUMERO DE DOCUMENTO', 'NUMERO DOCUMENTO', 'NO DOCUMENTO', 'CEDULA DE CIUDADANIA', 'IDENTIFICACION', 'NUMERO DE IDENTIFICACION', 'NUMERO DE IDENTIDAD'],
        nombre: ['APELLIDOS Y NOMBRES', 'NOMBRES Y APELLIDOS', 'NOMBRE', 'NOMBRES', 'NOMBRE COMPLETO', 'ALUMNO', 'ESTUDIANTE'],
        curso: ['CURSO', 'NOMBRE CURSO', 'NOMBRE DEL CURSO', 'PROGRAMA', 'NOMBRE PROGRAMA'],
        tipo: ['TIPO', 'TIPO CURSO', 'TIPO DE CURSO', 'CLASE', 'MODALIDAD', 'CATEGORIA'],
        inicio: ['FECHA INICIO', 'FECHA DE INICIO', 'INICIO', 'FECHA INGRESO', 'FECHA DE INGRESO', 'INGRESO', 'FECHA INICIO CCP'],
        horas: ['HORAS', 'NUMERO DE HORAS', 'NO HORAS', 'N HORAS', 'CANTIDAD DE HORAS', 'INTENSIDAD HORARIA', 'INTENSIDAD', 'DURACION HORAS', 'DURACION', 'HORAS CURSO', 'TOTAL HORAS'],
        fin: ['FECHA FIN', 'FECHA FINALIZACION', 'FECHA DE FINALIZACION', 'FIN', 'FECHA TERMINACION', 'FECHA DE TERMINACION', 'FECHA TERMINO', 'FECHA DE TERMINO', 'TERMINACION', 'FECHA'],
        ape: ['APELLIDOS'],
        nota: ['NOTA', 'PROMEDIO', 'NOTA FINAL', 'CALIFICACION'], puesto: ['PUESTO', 'PUESTO OCUPADO'],
        promo: ['PROMOCION', 'CURSO CCP', 'CCP', 'NUMERO CCP', 'NO CCP'], espec: ['ESPECIALIDAD', 'SIGLA', 'ESP'],
        programa: ['CCP REALIZADO', 'PROGRAMA', 'NOMBRE PROGRAMA', 'PROGRAMA ACADEMICO', 'NOMBRE DEL PROGRAMA', 'CARRERA', 'TITULO', 'PROFESION', 'ESPECIALIZACION'],
      });
      if ((t.curso >= 0 || base === 'ccp') && (t.ced >= 0 || t.nombre >= 0)) { h0 = i; c = t; break; }
    }
    if (!c) { hojas.push({ hoja: nombreHoja, usada: false }); continue; }
    let k = 0;
    for (let i = h0 + 1; i < F.length; i++) {
      const r = F[i];
      if (base !== 'ccp' && !txt(r[c.curso])) continue;
      const ck = c.ced >= 0 ? cedKey(r[c.ced]) : '';
      let nm = c.nombre >= 0 ? sinTildes(r[c.nombre]) : '';
      if (c.ape >= 0 && c.nombre >= 0) { const ap = sinTildes(r[c.ape]); if (ap && !nm.includes(ap)) nm = (ap + ' ' + nm).trim(); }
      if (!ck && !nm) continue;
      const clase = sinTildes((c.tipo >= 0 ? txt(r[c.tipo]) : '') + ' ' + nombreHoja);
      const reg = {
        curso: base === 'ccp' ? 'CURSO DE COMPLEMENTACIÓN PROFESIONAL' : sinTildes(r[c.curso]), clase: base === 'ccp' ? 'complementacion' : base === 'ley' ? 'ley' : /COMPLEMENT/.test(clase) ? 'complementacion' : /ASCENSO|LEY/.test(clase) ? 'ley' : 'extension',
        tipo: base === 'ccp' ? [c.programa >= 0 ? nom(r[c.programa]) : [c.curso >= 0 && nom(r[c.curso]), c.espec >= 0 && nom(r[c.espec])].filter(Boolean).join(' · '), c.promo >= 0 && nom(r[c.promo])].filter(Boolean).join(' · ') : (c.tipo >= 0 ? txt(r[c.tipo]) : ''), hoja: nombreHoja, inicio: c.inicio >= 0 ? fechaCelda(r[c.inicio]) : '', fin: c.fin >= 0 ? fechaCelda(r[c.fin]) : '', horas: c.horas >= 0 ? horasDe(r[c.horas]) : null,
        nota: c.nota >= 0 && typeof r[c.nota] === 'number' ? r[c.nota] : null, puesto: c.puesto >= 0 && +r[c.puesto] > 0 ? +r[c.puesto] : null, nombre: nm,
      };
      k++; n++;
      if (ck) agregar(porCed, ck, reg); else agregar(porNom, nomKey(nm), reg);
    }
    hojas.push({ hoja: nombreHoja, usada: true, filas: k, cols: (F[h0] || []).map((x) => txt(x)).filter(Boolean) });
  }
  return { porCed, porNom, filas: n, hojas };
}

/* Base Concesiones.xlsx, hoja "Concesiones": D = otorgada (Sí/Si), O = nombre de la concesión (según Estadística). Solo se muestran las otorgadas. */
function normPeriodo(v) {
  const t = String(v == null ? '' : v).toUpperCase().replace(/\s+/g, '');
  const m = t.match(/(\d{4})\D*(II|I|1|2)$/);
  if (m) return `${m[1]}-${m[2] === 'II' || m[2] === '2' ? 2 : 1}`;
  const m2 = t.match(/^(II|I|1|2)\D+(\d{4})$/);
  if (m2) return `${m2[2]}-${m2[1] === 'II' || m2[1] === '2' ? 2 : 1}`;
  return '';
}
const CLASES_HOJA = [[/BECA/, 'beca', 'Beca'], [/MENCION|HONOR/, 'mencion', 'Mención de honor'], [/MERIT/, 'merito', 'Meritorio'], [/LAUREAD/, 'laureado', 'Laureado'], [/DISTINGUID/, 'distinguido', 'Alumno distinguido']];
function procesarConcesiones(libro) {
  const porCed = {}, porNom = {}, hojas = [];
  let n = 0;
  for (const hoja of libro.hojas) {
    const nh = sinTildes(hoja);
    const cl = /^CONCESIONES$/.test(nh) ? ['concesion', 'Concesión'] : (CLASES_HOJA.filter((x) => x[0].test(nh))[0] || []).slice(1);
    if (!cl.length) { hojas.push({ hoja, usada: false }); continue; }
    let F;
    try { F = libro.leer(hoja, { maxCols: 40, maxRows: 60000 }); } catch (e) { continue; }
    let h0 = -1, c = null;
    for (let i = 0; i < Math.min(F.length, 8); i++) {
      const t = indiceCols(F[i] || [], {
        ced: ['CEDULA', 'CC', 'C C', 'DOCUMENTO', 'DOCUMENTO DE IDENTIDAD', 'IDENTIFICACION', 'NUMERO DE DOCUMENTO', 'NUMERO DE IDENTIDAD'],
        nombre: ['APELLIDOS Y NOMBRES', 'NOMBRES Y APELLIDOS', 'NOMBRE', 'NOMBRES', 'ESTUDIANTE', 'NOMBRE COMPLETO'],
        periodo: ['PERIODO', 'PERIODO ACADEMICO', 'PERIODO CONCESION', 'SEMESTRE', 'SEM'],
        ano: ['AÑO', 'ANO', 'ANIO', 'AÑO CONCESION', 'AÑO DE LA CONCESION', 'AÑO ACADEMICO'],
        valor: ['DESCUENTO', 'PORCENTAJE', 'VALOR DESCUENTO', 'PORCENTAJE DESCUENTO', 'VALOR'],
        tipo: ['TIPO', 'TIPO DE BECA', 'TIPO BECA', 'CLASE', 'DESCRIPCION', 'CATEGORIA', 'CONCESION'],
        fecha: ['FECHA', 'FECHA RESOLUCION', 'FECHA DE RESOLUCION', 'FECHA OTORGAMIENTO'],
        concesion: ['CONCESION', 'NOMBRE CONCESION', 'NOMBRE DE LA CONCESION', 'TIPO CONCESION', 'TIPO DE CONCESION', 'CONCESION OTORGADA'],
        otorgada: ['OTORGADA', 'OTORGADO', 'CONCEDIDA', 'SE OTORGA', 'SE OTORGO', 'APROBADA'],
        pct: ['PORCENTAJE', '% DESCUENTO', 'PORCENTAJE DESCUENTO', 'PORCENTAJE DE DESCUENTO', 'DESCUENTO', 'PORCENT'],
        motivo: ['MOTIVO', 'CAUSAL', 'JUSTIFICACION', 'OBSERVACION', 'OBSERVACIONES', 'RAZON'],
        resol: ['RESOLUCION', 'NUMERO RESOLUCION', 'NO RESOLUCION'],
      });
      const HH = (F[i] || []).map((x) => sinTildes(x).replace(/Ñ/g, 'N').replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim());
      let jn = HH.findIndex((x) => /^APELLIDOS Y NOMBRES?( |$)/.test(x) && !/MINUSC/.test(x)); if (jn < 0) jn = HH.findIndex((x) => /^APELLIDOS Y NOMBRES?( |$)/.test(x)); if (jn >= 0) t.nombre = jn;
      if (t.ced >= 0 && /CODIGO/.test(HH[t.ced])) { const jc = HH.findIndex((x) => /^(CEDULA|IDENTIFICACION|DOCUMENTO)$/.test(x)); t.ced = jc; } // 'CODIGOS/ CEDULA' trae códigos estudiantiles, no cédulas
      if (t.ced >= 0 || t.nombre >= 0) { h0 = i; c = t; break; }
    }
    if (!c) { hojas.push({ hoja, usada: false }); continue; }
    const cols = (F[h0] || []).map((x) => txt(x)).filter(Boolean);
    if (c.periodo < 0) { // cualquier encabezado que hable de periodo, semestre o año
      const H = (F[h0] || []).map((x) => sinTildes(x));
      let j = H.findIndex((x) => /PERIODO/.test(x)); if (j < 0) j = H.findIndex((x) => /SEMESTRE/.test(x)); if (j < 0 && c.ano < 0) j = H.findIndex((x) => /^(ANO|AÑO|(ANO|AÑO) .*|.* (ANO|AÑO))$/.test(x));
      c.periodo = j;
    }
    { const HH = (F[h0] || []).map((x) => sinTildes(x).replace(/Ñ/g, 'N').replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim());
      c.honor = HH.findIndex((x) => /GRADO DE HONOR/.test(x)); c.prog = HH.findIndex((x) => x === 'PROGRAMA'); c.anog = HH.findIndex((x) => x === 'ANOG'); c.cursoSem = HH.findIndex((x) => x === 'CURSO' || x === 'CURSO ACTUAL'); c.dist = HH.findIndex((x) => /^TIPO DISTINT/.test(x)); c.trab = HH.findIndex((x) => /TRABAJO DE GRADO/.test(x));
      const ia = HH.findIndex((x) => x === 'APELLIDOS'), inn = HH.findIndex((x) => x === 'NOMBRES'); c.apeNom = ia >= 0 && inn >= 0 && !HH.some((x) => /^APELLIDOS Y NOMBRES?/.test(x)) ? [ia, inn] : null; }
    let k = 0;
    for (let i = h0 + 1; i < F.length; i++) {
      const r = F[i];
      let titulo = cl[1];
      if (cl[0] === 'concesion') { // otorgada: columna por encabezado o, si no, D (Sí/Si); nombre: por encabezado o, si no, O
        if (!/^s[ií]$/i.test(txt(r[c.otorgada >= 0 ? c.otorgada : 3]))) continue;
        const v = nom(r[c.concesion >= 0 ? c.concesion : 14]);
        titulo = v && !/^\d{1,4}$/.test(v) ? v : 'Concesión especial';
      }
      const ck = c.ced >= 0 ? cedKey(r[c.ced]) : '';
      const nombre = c.apeNom ? nom(txt(r[c.apeNom[0]]) + ' ' + txt(r[c.apeNom[1]])) : (c.nombre >= 0 ? nom(r[c.nombre]) : '');
      if (!ck && !nombre) continue;
      const f = c.fecha >= 0 ? fechaCelda(r[c.fecha]) : '';
      const ym0 = (v) => { const t = txt(v).match(/^(\d{4})(?:\.0+)?$/); return t ? +t[1] : null; };
      let per = c.periodo >= 0 ? normPeriodo(r[c.periodo]) : '';
      let anioCol = c.ano >= 0 ? ym0(r[c.ano]) : null;
      if (!per && c.periodo >= 0 && c.periodo !== c.ano) { // periodo = 1/2/I/II y el año en su propia columna
        const sm = txt(r[c.periodo]).toUpperCase().match(/^(II|I|1|2)$/);
        if (sm && anioCol) per = `${anioCol}-${sm[1] === 'II' || sm[1] === '2' ? 2 : 1}`;
      }
      if (!per && f) per = `${f.slice(0, 4)}-${+f.slice(5, 7) <= 6 ? 1 : 2}`;
      const ym = (v) => { const t = txt(v).match(/^(\d{4})(?:\.0+)?$/); return t ? +t[1] : null; };
      const anio = per ? null : anioCol || (c.anog >= 0 ? ym(r[c.anog]) : null) || (c.periodo >= 0 ? ym(r[c.periodo]) : null) || ym(r[c.concesion >= 0 ? c.concesion : 14]);
      const pr = c.pct >= 0 ? r[c.pct] : (c.valor >= 0 ? r[c.valor] : '');
      const pct = typeof pr === 'number' ? (pr > 0 && pr <= 1 ? Math.round(pr * 100) : Math.round(pr * 100) / 100) + ' %' : txt(pr);
      const motivo = c.motivo >= 0 ? txt(r[c.motivo]) : '';
      const resol = c.resol >= 0 ? txt(r[c.resol]) : '';
      const det = [cl[0] !== 'concesion' && c.tipo >= 0 && txt(r[c.tipo])].filter(Boolean).join(' · ');
      // Meritorios: TIPO DISTINCIÓN dice si fue Meritorio, Laureado, Cum Laude, Magna Cum Laude o Summa Cum Laude.
      let claseR = cl[0];
      if (cl[0] === 'merito' && c.dist >= 0 && txt(r[c.dist])) {
        const d = sinTildes(r[c.dist]);
        if (/LAUREAD/.test(d)) { claseR = 'laureado'; titulo = 'Laureado'; }
        else if (/MERIT/.test(d)) titulo = 'Meritorio';
        else titulo = nom(r[c.dist]);
      }
      const trabajo = c.trab >= 0 ? txt(r[c.trab]).replace(/^["“”']+|["“”']+$/g, '').trim() : '';
      const honorTxt = '';
      const honor = /^(-|#N\/A|#NAME\?|NO|NA|N\/A|0)?$/i.test(honorTxt) ? '' : honorTxt;
      const reg = { clase: claseR, trabajo, concesion: titulo, periodo: per, anio, valor: det, pct, motivo, resol, nombre, honor: honor ? (/^S[IÍ]$/i.test(honor) ? 'Grado de honor' : nom(honor)) : '', programa: c.prog >= 0 ? nom(r[c.prog]) : '', curso: c.cursoSem >= 0 ? txt(r[c.cursoSem]) : '' };
      k++; n++;
      if (ck) agregar(porCed, ck, reg); else agregar(porNom, nomKey(nombre), reg);
    }
    hojas.push({ hoja, usada: true, filas: k, cols });
  }
  return { porCed, porNom, filas: n, hojas };
}

/* Medallas Caldas (Base Datos Solicitud Caldas.xlsx): columnas por encabezado. Si hay columna de estado, solo las otorgadas/aprobadas. */
function procesarMedallas(libro) {
  const porCed = {}, porNom = {}, hojas = [];
  let n = 0, sinEstado = false;
  for (const hoja of libro.hojas) {
    let F;
    try { F = libro.leer(hoja, { maxCols: 40, maxRows: 60000 }); } catch (e) { continue; }
    let h0 = -1, c = null;
    for (let i = 0; i < Math.min(F.length, 8); i++) {
      const t = indiceCols(F[i] || [], {
        ced: ['CEDULA', 'CC', 'C C', 'DOCUMENTO', 'DOCUMENTO DE IDENTIDAD', 'IDENTIFICACION', 'NUMERO DE DOCUMENTO', 'NUMERO DE IDENTIDAD'],
        nombre: ['APELLIDOS Y NOMBRES', 'NOMBRES Y APELLIDOS', 'NOMBRE', 'NOMBRES', 'ESTUDIANTE', 'NOMBRE COMPLETO'],
        medalla: ['MEDALLA', 'TIPO MEDALLA', 'TIPO DE MEDALLA', 'PREMIO', 'CONDECORACION', 'DISTINCION', 'CATEGORIA'],
        periodo: ['PERIODO', 'PERIODO ACADEMICO', 'SEMESTRE'],
        fecha: ['FECHA', 'FECHA SOLICITUD', 'FECHA DE SOLICITUD', 'FECHA OTORGAMIENTO', 'FECHA ENTREGA', 'FECHA RESOLUCION'],
        estado: ['ESTADO', 'OTORGADA', 'APROBADA', 'RESULTADO', 'OTORGADO', 'APROBADO', 'RESPUESTA'],
        programa: ['PROGRAMA', 'NOMBRE PROGRAMA', 'PROGRAMA ACADEMICO', 'ESPECIALIDAD', 'CARRERA', 'CURSO'],
        curso: ['CURSO ESPECIFICO'], general: ['CURSO GENERAL'],
      });
      if (t.curso < 0) t.curso = (F[i] || []).map((x) => sinTildes(x)).findIndex((x) => /CURSO/.test(x) && /ESPECIF/.test(x));
      if (t.general < 0) t.general = (F[i] || []).map((x) => sinTildes(x)).findIndex((x) => /CURSO/.test(x) && /GENERAL/.test(x));
      if (t.ced >= 0 || t.nombre >= 0) { h0 = i; c = t; break; }
    }
    if (!c) { hojas.push({ hoja, usada: false }); continue; }
    if (c.estado < 0) sinEstado = true;
    let k = 0;
    for (let i = h0 + 1; i < F.length; i++) {
      const r = F[i];
      const ck = c.ced >= 0 ? cedKey(r[c.ced]) : '';
      const nombre = c.nombre >= 0 ? nom(r[c.nombre]) : '';
      if (!ck && !nombre) continue;
      if (c.estado >= 0) { const e = sinTildes(r[c.estado]); if (!/OTORG|APROB|ENTREG|CONCED|^SI$|^S$/.test(e) || /NO OTORG|NO APROB|RECHAZ|NIEGA|NEGAD/.test(e)) continue; }
      const f = c.fecha >= 0 ? fechaCelda(r[c.fecha]) : '';
      let per = c.periodo >= 0 ? normPeriodo(r[c.periodo]) : '';
      if (!per && f) per = `${f.slice(0, 4)}-${+f.slice(5, 7) <= 6 ? 1 : 2}`;
      const reg = { medalla: c.medalla >= 0 && txt(r[c.medalla]) ? nom(r[c.medalla]) : '', programa: c.programa >= 0 && c.programa !== c.curso && c.programa !== c.general ? nom(r[c.programa]) : '', curso: c.curso >= 0 ? nom(r[c.curso]) : '', general: c.general >= 0 ? nom(r[c.general]) : '', fecha: f, periodo: per, estado: c.estado >= 0, nombre };
      k++; n++;
      if (ck) agregar(porCed, ck, reg); else agregar(porNom, nomKey(nombre), reg);
    }
    hojas.push({ hoja, usada: true, filas: k, cols: (F[h0] || []).map((x) => txt(x)).filter(Boolean) });
  }
  return { porCed, porNom, filas: n, hojas, sinEstado };
}

/* Antigüedades: todos los periodos cargados en el Portal. */
let ANT = null; // { clave, t, idx }
async function cargarAntiguedades() {
  const idx = (await leerJsonAnt('periodos.json')) || { lista: [] };
  const lista = (idx.lista || []).slice().sort();
  const clave = lista.join(',');
  if (ANT && ANT.clave === clave && Date.now() - ANT.t < 5 * 60000) return ANT.v;
  const archivos = await Promise.all(lista.map(async (p) => ({ p, d: await leerJsonAnt(`datos-${p}.json`) })));
  if (!lista.length) { const d = await leerJsonAnt('datos.json'); if (d && d.meta && d.meta.periodo) archivos.push({ p: d.meta.periodo, d }); }
  archivos.sort((a, b) => a.p.localeCompare(b.p));
  const porCed = {}, porNom = {};
  let n = 0;
  for (const { p, d } of archivos) {
    const D = d && d.datos; if (!D) continue;
    const listas = [D.esc || [], ...Object.values(D.sheets || {})];
    listas.forEach((L) => (L || []).forEach((s) => {
      if (!s || !s.n) return;
      const ck = cedKey(s.ce);
      const reg = { per: p, n: nom(s.n), ce: ck ? txt(s.ce) : '', cu: txt(s.cu), g: txt(s.g), ct: txt(s.ct), e: txt(s.e), ev: txt(s.ev), p: s.p == null ? null : s.p, f: typeof s.f === 'number' ? s.f : null, h: Array.isArray(s.h) ? s.h : [], hp: Array.isArray(s.hp) ? s.hp : [], dst: Array.isArray(s.dst) ? s.dst : [], exa: Array.isArray(s.exa) ? s.exa : [], dis: !!s.dis, exc: !!s.exc };
      n++;
      if (ck) agregar(porCed, ck, reg); else agregar(porNom, nomKey(reg.n), reg);
    }));
  }
  const v = { porCed, porNom, periodos: archivos.filter((a) => a.d && a.d.datos).map((a) => a.p), filas: n };
  ANT = { clave, t: Date.now(), v };
  return v;
}

/* ------------------------------ Armar la ficha ----------------------------- */

const perNum = (p) => { const m = String(p || '').match(/^(\d{4})-([12])$/); return m ? +m[1] + (+m[2] - 1) * 0.5 : null; };
const sigPer = (p, d) => { const m = String(p).match(/^(\d{4})-([12])$/); if (!m) return null; const t = +m[1] * 2 + (+m[2] - 1) + d; return `${Math.floor(t / 2)}-${(t % 2) + 1}`; };
const tFecha = (f) => { if (!f) return null; const m = f.match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? +m[1] + ((+m[2] - 1) * 30.4 + +m[3]) / 365 : null; };
const promSem = (b) => { let sw = 0, sv = 0; PESOS.forEach((w, i) => { const x = b[i + 1]; if (typeof x === 'number') { sw += w; sv += w * x; } }); return sw ? sv / sw : null; };

/* Semestres a partir del historial de Antigüedades (h = notas por semestre, hp = puesto por periodo). */
function semestres(reg) {
  const h = reg.h || [], hp = (reg.hp || []).slice(), usado = new Set();
  const ligar = h.map((b) => {
    let j;
    if (b[0] === 'Refuerzo') j = hp.findIndex((e, x) => !usado.has(x) && e[4] === 'E');
    else {
      j = hp.findIndex((e, x) => !usado.has(x) && e[1] === b[0] && e[4] !== 'E');
      if (j < 0 && b[7]) j = hp.findIndex((e, x) => !usado.has(x) && e[0] === b[7] && e[4] !== 'E');
    }
    if (j >= 0) usado.add(j);
    return j < 0 ? null : hp[j];
  });
  const per = h.map((b, i) => (b[7] && /^\d{4}-[12]$/.test(b[7]) ? b[7] : ligar[i] ? ligar[i][0] : null));
  for (let i = 0; i < per.length; i++) {
    if (per[i]) continue;
    let j = i - 1; while (j >= 0 && !per[j]) j--;
    if (j >= 0) { per[i] = sigPer(per[j], i - j); continue; }
    j = i + 1; while (j < per.length && !per[j]) j++;
    if (j < per.length) per[i] = sigPer(per[j], i - j);
  }
  return h.map((b, i) => {
    const e = ligar[i];
    const p = per[i];
    const dist = p && (reg.dst || []).indexOf(p) >= 0, exc = p && (reg.exa || []).indexOf(p) >= 0;
    return {
      label: String(b[0]), periodo: p || '', t: perNum(p),
      ac: typeof b[1] === 'number' ? b[1] : null, an: typeof b[2] === 'number' ? b[2] : null, di: typeof b[3] === 'number' ? b[3] : null, cf: typeof b[4] === 'number' ? b[4] : null,
      prom: promSem(b), puesto: e && typeof e[2] === 'number' ? e[2] : null, total: e && typeof e[3] === 'number' ? e[3] : null,
      reprobado: /A$/.test(String(b[0])), perdido: /A$/.test(String(b[0])) || [b[1], b[2], b[3]].some((x) => typeof x === 'number' && x < 6) || (typeof b[4] === 'number' && b[4] < 7), refuerzo: b[0] === 'Refuerzo', dist: !!dist, exc: !!exc,
    };
  });
}

/* Une las filas de una fuente: las de cédula exacta y las que solo coinciden por nombre. */
function reunir(fu, ck, nks) {
  const exactas = (fu && fu.porCed[ck]) || [];
  const porNombre = [];
  nks.forEach((nk) => (((fu && fu.porNom && fu.porNom[nk]) || []).forEach((r) => porNombre.push(r))));
  return { exactas, porNombre };
}

/* Significado de cada categoría de la Medalla Caldas, según Estadística. */
const MOTIVO_CALDAS = { 'A LA CONSAGRACION': 'Por haber obtenido el primer puesto en su promoción' };

/* Quita repetidos (misma clave); entre dos iguales se queda el que trae más datos y, si empatan, el de cédula exacta. */
function sinRepetidos(lista, clave) {
  const mapa = new Map();
  lista.forEach((x) => {
    const k = clave(x);
    const peso = (y) => Object.values(y).filter((v) => v !== '' && v != null && v !== false).length + (y.pv ? 0 : 0.5);
    if (!mapa.has(k) || peso(x) > peso(mapa.get(k))) mapa.set(k, x);
  });
  return Array.from(mapa.values());
}
const kt = (v) => sinTildes(v).replace(/[^A-Z0-9]/g, '');

/* Jerarquía con la que se escalafona según la especialidad (y si es extranjero naval, honorario). */
function claseEsp(txt0) {
  const e = sinTildes(txt0);
  if (/\bIM\b|INFANTERIA/.test(e) && /\bNAV\b|NAVAL/.test(e)) return ''; // 'NAV - IM' es el nombre del grupo, no distingue
  if (/\bIM\b|INFANTERIA/.test(e)) return 'IM';
  if (/\b(MER|MC|MM)\b|MERCANTE/.test(e)) return 'MER';
  if (/\bNAV\b|NAVAL/.test(e)) return 'NAV';
  return '';
}
/* Según la columna NUMERO/ PROMOCION del CONGLOMERADO: IM o CDPRIM = Infantería de Marina; NAV o NA = naval; MC o MM = mercante; cualquier otra cosa = Teniente de Corbeta. */
function clasePromo(promo) {
  const T = sinTildes(promo).split(/[^A-Z0-9]+/).filter(Boolean);
  if (!T.length) return '';
  if (T.some((x) => x === 'IM' || /CDPRIM/.test(x))) return 'IM';
  if (T.some((x) => x === 'MC' || x === 'MM')) return 'MER';
  if (T.some((x) => x === 'NAV' || x === 'NA')) return 'NAV';
  return 'OTRA';
}
function jerarquiaPromo(promo, nac) {
  const k = clasePromo(promo);
  if (!k) return null;
  const ext = !!nac && sinTildes(nac) !== 'COLOMBIA';
  if (ext) return k === 'NAV' || k === 'OTRA' ? 'Teniente de Corbeta Honorario' : '';
  if (k === 'IM') return 'Subteniente del Cuerpo de Infantería de Marina';
  if (k === 'MER') return 'Teniente de Corbeta de la Reserva Activa';
  return 'Teniente de Corbeta';
}
/* Título de la tarjeta de ingreso según la especialidad con que ingresó; sin especialidad militar (civiles) solo "Ingreso como Aspirante". */
function tituloIngreso(sigla) {
  const e = sinTildes(sigla);
  if (/\bIM\b|INFANTERIA/.test(e)) return 'Ingreso como Aspirante a Cadete de Infantería de Marina';
  if (/\bMER\b|MERCANTE/.test(e)) return 'Ingreso como Aspirante a Cadete Mercante';
  if (/\bNAV\b|NAVAL/.test(e)) return 'Ingreso como Aspirante a Cadete Naval';
  return 'Ingreso como Aspirante';
}
function jerarquiaEsc(esp, nac, cdprim) {
  const e = sinTildes(esp);
  if (cdprim) return 'Subteniente del Cuerpo de Infantería de Marina';
  const ext = !!nac && sinTildes(nac) !== 'COLOMBIA';
  const im = /\bIM\b|INFANTERIA/.test(e), mer = /\bMER\b|MERCANTE/.test(e), nav = /\bNAV\b|NAVAL/.test(e);
  if (ext) return nav ? 'Teniente de Corbeta Honorario' : '';
  if (mer) return 'Teniente de Corbeta de la Reserva Activa';
  if (nav || im) return 'Teniente de Corbeta';
  return '';
}

/* Grado de complementación: su programa coincide con el de un curso CCP, o es un grado posterior al ingreso a la complementación (CCP).
   Los demás grados son la titulación académica inicial. */
function esGradoComp(g, cursos, fEsc) {
  const kg = kt(g.programa || g.titulo || '');
  if (/CIENCIAS (NAVALES|NAUTICAS)/.test(sinTildes(g.programa || g.titulo || ''))) return false; // es la titulación inicial: quien la recibe es titulado
  const ccp = cursos.filter((c) => c.clase === 'complementacion');
  if (kg && ccp.some((c) => kt(c.tipo || '') && (kt(c.tipo).includes(kg) || kg.includes(kt(c.tipo))))) return true;
  const fg = g.fecha || '';
  return !!fg && ccp.some((c) => { const f = c.inicio || c.fin || ''; return f && f <= fg && (!fEsc || fg > fEsc); });
}

function armarFicha(id, S) {
  const avisos = [];
  const m = String(id || '').match(/^([cn]):(.+)$/);
  if (!m) throw error('Identificador inválido.', 400);
  let ck = m[1] === 'c' ? m[2] : '';
  const nkIni = m[1] === 'n' ? m[2] : '';
  const nks = new Set(nkIni ? [nkIni] : []);
  const gather = (fu) => (ck && fu && fu.porCed[ck]) || [];
  const cong = gather(S.cong);
  const bajRows = gather(S.baj);
  const antRows = gather(S.ant);
  const otrasFu = [S.grad, S.ext, S.ccp, S.ley];
  const otras = otrasFu.map((fu) => gather(fu));
  [cong, bajRows, antRows].concat(otras).forEach((L) => L.forEach((r) => nks.add(nomKey(r.nombre || r.n))));
  if (!ck && nkIni) { // sin cédula: se busca por nombre en todas
    [S.cong, S.baj, S.ant, S.grad, S.ext, S.ccp, S.ley].forEach((fu) => { if (!fu) return; ((fu.porCed && Object.values(fu.porCed)) || []).forEach((L) => L.forEach((r) => { if (nomKey(r.nombre || r.n) === nkIni && r.ck) ck = ck || r.ck; })); });
  }
  const nomPorNom = (fu) => reunir(fu, ck, nks).porNombre;
  const todoCong = cong.concat(nomPorNom(S.cong));
  let nombre = (cong[0] && cong[0].nombre) || (bajRows[0] && bajRows[0].nombre) || (antRows[0] && antRows[0].n) || (todoCong[0] && todoCong[0].nombre) || (otras.map((L) => L[0] && L[0].nombre).filter(Boolean)[0]) || '';
  if (!nombre && nkIni) { [S.grad, S.ext, S.ccp, S.ley].forEach((fu) => { if (!nombre && fu && fu.porNom && fu.porNom[nkIni] && fu.porNom[nkIni][0]) nombre = fu.porNom[nkIni][0].nombre || ''; }); }
  if (!nombre) throw error('No se encontró ese estudiante.', 404);

  const porVerificar = []; // etiquetas de lo que viene solo por nombre
  const pick = (fu, clave) => {
    const r = reunir(fu, ck, nks);
    if (r.porNombre.length) porVerificar.push(clave);
    return { exactas: r.exactas, nombre: r.porNombre };
  };

  /* ---- Ingreso(s) ---- */
  const cg = pick(S.cong, 'ingreso');
  const ingresos = cg.exactas.map((x) => Object.assign({ pv: false }, x)).concat(cg.nombre.map((x) => Object.assign({ pv: true }, x)));
  ingresos.sort((a, b) => (a.fecha || String(a.anio || '')).localeCompare(b.fecha || String(b.anio || '')));
  const ing0 = ingresos[0] || null;

  /* ---- Retiro ---- */
  const bj = pick(S.baj, 'retiro');
  const retiros = bj.exactas.map((x) => Object.assign({ pv: false }, x)).concat(bj.nombre.map((x) => Object.assign({ pv: true }, x))).filter((x) => x.retiro || x.causal || x.doc);
  const retiro = retiros.sort((a, b) => (a.retiro || '').localeCompare(b.retiro || '')).pop() || null;

  /* ---- Graduado ---- */
  const gr = pick(S.grad, 'graduado');
  const grados = sinRepetidos(gr.exactas.map((x) => Object.assign({ pv: false }, x)).concat(gr.nombre.map((x) => Object.assign({ pv: true }, x))), (x) => [kt(x.programa), x.fecha].join('|'));

  /* ---- Escalafón ---- */
  const asr = pick(S.baj && S.baj.asc, 'escalafón');
  let escal = asr.exactas.map((x) => Object.assign({ pv: false }, x)).concat(asr.nombre.map((x) => Object.assign({ pv: true }, x)));
  // Los mercantes escalafonados en 2026-2 son los últimos Tenientes de Corbeta de la Reserva Activa: de 2027-1 en adelante solo se titulan.
  {
    const esMer = (ing0 && (clasePromo(ing0.promo) === 'MER' || /^(MC|MM)$/.test(sinTildes(ing0.sigla || '')))) || escal.some((e) => /\bMER\b|MERCANTE|\bMC\b|\bMM\b/.test(sinTildes([e.sigla, e.especialidad, e.promocion].join(' '))));
    if (esMer) escal = escal.filter((e) => !(e.periodo && String(e.periodo) > '2026-2'));
  }

  /* ---- Notas (Antigüedades) ---- */
  const an = pick(S.ant, 'notas');
  const regsAnt = an.exactas.concat(an.nombre);
  const pvAnt = !an.exactas.length && an.nombre.length > 0;
  let mejor = null;
  regsAnt.forEach((r) => { if (!mejor || (r.h || []).length > (mejor.h || []).length || ((r.h || []).length === (mejor.h || []).length && r.per > mejor.per)) mejor = r; });
  const ultimo = regsAnt.slice().sort((a, b) => a.per.localeCompare(b.per)).pop() || null;
  const sems = mejor ? semestres(mejor) : [];

  /* ---- Extensión / complementación / ascenso ---- */
  const cursos = [];
  [S.ext, S.ccp, S.ley].forEach((fu) => { const ex = pick(fu, 'cursos'); ex.exactas.forEach((x) => cursos.push(Object.assign({ pv: false }, x))); ex.nombre.forEach((x) => cursos.push(Object.assign({ pv: true }, x))); });
  const cursosU = sinRepetidos(cursos, (x) => [kt(x.curso), x.fin || x.inicio || '', x.clase === 'complementacion' ? 'c' : ''].join('|'));
  cursos.length = 0; cursosU.forEach((x) => cursos.push(x));

  /* ---- Concesiones especiales (otorgadas) ---- */
  const cn = pick(S.conc, 'concesiones');
  const desde2019 = (x) => { const a = x.periodo ? +String(x.periodo).slice(0, 4) : (x.anio ? +x.anio : null); return a == null || a >= 2019; };
  const concesiones = sinRepetidos(cn.exactas.map((x) => Object.assign({ pv: false }, x)).concat(cn.nombre.map((x) => Object.assign({ pv: true }, x))), (x) => [x.clase, kt(x.concesion), x.periodo || x.anio || ''].join('|'));
  for (let q = concesiones.length - 1; q >= 0; q--) if (concesiones[q].clase !== 'distinguido' && !desde2019(concesiones[q])) concesiones.splice(q, 1);

  /* ---- Medallas Caldas ---- */
  const md = pick(S.med, 'medallas');
  const medallas = sinRepetidos(md.exactas.map((x) => Object.assign({ pv: false }, x)).concat(md.nombre.map((x) => Object.assign({ pv: true }, x))), (x) => [kt(x.medalla), x.periodo || x.fecha, kt(x.general), kt(x.curso), kt(x.programa)].join('|'));

  /* ---- Estado ---- */
  let estado = '';
  const POSG = /ESPECIALIZ|MAESTR|DOCTOR|DIPLOMAD/;
  const titulado = grados.some((g) => !POSG.test(sinTildes(g.programa || g.titulo || '')) && !esGradoComp(g, cursos, ((escal.slice().sort((a, b) => (a.periodo || '').localeCompare(b.periodo || '')).pop()) || {}).fecha || ''));
  const hayReingreso = !!(ing0 && ing0.reingreso) || ingresos.length > 1; // si reingresó, el retiro fue anterior: no queda como Retirado
  // Civil: solo aparece en Extensión y/o Graduados de la ENAP (sin ingreso, notas, retiro, escalafón ni cursos militares).
  const civil = !ing0 && !retiros.length && !regsAnt.length && !escal.length && !cursos.some((c) => c.clase === 'complementacion' || c.clase === 'ley');
  if (civil) estado = grados.length ? 'GRADUADO' : '';
  else if (titulado) estado = 'GRADUADO';
  else if (retiro && !hayReingreso) estado = 'RETIRADO';
  else if (!escal.length && ing0 && (ing0.salida || ing0.anioSal) && !(ultimo && ultimo.e !== 'Retirado' && ultimo.e !== 'Salió')) estado = 'SALIÓ';
  else if (ultimo && (ultimo.e === 'Retirado' || ultimo.e === 'Salió') && !hayReingreso) estado = 'RETIRADO';
  else if (escal.length) {
    // PR, CDPRIM, CDPRON y CEXTIM no son egresados sin grado: su ciclo termina en el escalafonamiento.
    const SIN_GRADO = /^(PR|CDPRIM|CDPRON|CEXTIM)$/;
    const progEsc = [ing0 && ing0.sigla, ...escal.map((e) => e.sigla)].map((v) => sinTildes(v || '').replace(/[^A-Z]/g, '')).filter(Boolean);
    estado = progEsc.some((v) => SIN_GRADO.test(v)) && !progEsc.some((v) => /^(CNN|NAV|CIM|IM|MC|MM)$/.test(v)) ? 'ESCALAFONADO' : 'EGRESADO NO GRADUADO';
  }
  else if (ultimo) estado = 'ACTIVO';

  /* ---- Línea de tiempo ---- */
  const linea = [];
  if (ing0) linea.push({ tipo: 'ingreso', t: tFecha(ing0.fecha) != null ? tFecha(ing0.fecha) : (ing0.anio ? ing0.anio + 0.01 : null), fecha: ing0.fecha, anio: ing0.anio || anioDe(ing0.fecha), titulo: tituloIngreso(ing0.sigla), detalle: [ing0.cont && 'Contingente ' + ing0.cont].filter(Boolean).join(' · '), resolucion: ing0.resol || '', pv: ing0.pv });
  if (ing0 && ing0.reingreso && !ingresos.slice(1).some((x) => normCont(x.cont) === normCont(ing0.reingreso.cont))) linea.push({ tipo: 'regreso', t: tFecha(ing0.reingreso.fecha) != null ? tFecha(ing0.reingreso.fecha) : null, fecha: ing0.reingreso.fecha, anio: anioDe(ing0.reingreso.fecha), titulo: 'Reingreso a la ENAP', detalle: 'Contingente ' + ing0.reingreso.cont, resolucion: ing0.reingreso.resol || '', pv: ing0.pv });
  ingresos.slice(1).forEach((x) => linea.push({ tipo: 'regreso', t: tFecha(x.fecha) != null ? tFecha(x.fecha) : (x.anio ? x.anio + 0.01 : null), fecha: x.fecha, anio: x.anio || anioDe(x.fecha), titulo: 'Reingreso a la ENAP', detalle: [x.cont && 'Contingente ' + x.cont].filter(Boolean).join(' · '), resolucion: x.resol || '', pv: x.pv }));
  sems.forEach((s) => linea.push({ tipo: 'semestre', t: s.t, anio: s.periodo ? +s.periodo.slice(0, 4) : null, semestre: s, pv: pvAnt }));
  const e0 = escal.slice().sort((a, b) => (a.periodo || '').localeCompare(b.periodo || '')).pop() || null;
  let tEsc = null;
  if (e0) {
    // La jerarquía depende de la promoción en que se escalafonó (no de la especialidad de ingreso); si cambió de especialidad se indica.
    const escTxt = [e0.cont, e0.promocion, e0.especialidad].find((v) => claseEsp(v)) || (ing0 && [ing0.cont, ing0.sigla].find((v) => claseEsp(v))) || '';
    const kPromo = ing0 && ing0.promo ? clasePromo(ing0.promo) : '';
    const claseEsc = kPromo && kPromo !== 'OTRA' ? kPromo : claseEsp(escTxt), claseIng = (ing0 && (claseEsp(ing0.cont) || claseEsp(ing0.sigla))) || '';
    const cambioEsp = claseEsc && claseIng && claseEsc !== claseIng ? { de: claseIng, a: claseEsc } : null;
    tEsc = tFecha(e0.fecha) != null ? tFecha(e0.fecha) : (perNum(e0.periodo) != null ? perNum(e0.periodo) + 0.45 : null);
    linea.push({ tipo: 'escalafon', t: tEsc, fecha: e0.fecha, anio: anioDe(e0.fecha) || (e0.periodo ? +e0.periodo.slice(0, 4) : null), titulo: 'Escalafonamiento', jerarquia: (ing0 && ing0.promo && jerarquiaPromo(ing0.promo, ing0.nac)) || jerarquiaEsc(escTxt, ing0 && ing0.nac, /CDPRIM/.test(sinTildes([e0.sigla, e0.promocion, e0.especialidad, e0.cont].join(' ')))), cambioEsp: cambioEsp, puesto: e0.puesto, total: e0.total, promedio: e0.promedio, periodo: e0.periodo, resolucion: e0.resolucion, especialidad: e0.especialidad, promocion: (ing0 && ing0.promo) || e0.promocion, pv: e0.pv });
  }
  grados.forEach((x) => { const t = tFecha(x.fecha); linea.push({ tipo: 'grado', t: t != null ? t : (tEsc != null ? tEsc + 0.02 : null), fecha: x.fecha, anio: anioDe(x.fecha), titulo: 'Graduación', detalle: x.titulo || x.programa || '', programa: x.programa, tituloAcad: x.titulo || '', trabajo: x.trabajo || '', comp: esGradoComp(x, cursos, e0 ? e0.fecha : ''), pv: x.pv }); });
  cursos.forEach((x) => {
    const f = x.clase === 'complementacion' ? (x.inicio || x.fin) : (x.fin || x.inicio);
    linea.push({ tipo: x.clase, t: tFecha(f), fecha: f, anio: anioDe(f), titulo: x.curso, detalle: x.tipo, nota: x.nota, puesto: x.puesto, inicio: x.inicio, fin: x.fin, horas: x.horas, pv: x.pv });
  });
  concesiones.forEach((x) => linea.push({ tipo: x.clase === 'concesion' ? 'concesion' : 'reconocimiento', clase: x.clase, t: x.periodo ? perNum(x.periodo) + 0.01 : (x.anio ? x.anio + 0.01 : null), periodo: x.periodo, anioSolo: !x.periodo && !!x.anio, anio: x.periodo ? +x.periodo.slice(0, 4) : (x.anio || null), titulo: x.concesion, pct: x.pct || '', motivo: x.motivo || '', detalle: [x.pct && x.pct + ' de descuento', x.motivo && 'Motivo: ' + x.motivo, x.resol && 'Resolución ' + x.resol, x.valor].filter(Boolean).join(' · '), pv: x.pv }));
  // Complementación o posgrado cursado sin grado: "Egresado no graduado - <programa>".
  linea.forEach((e) => {
    if (e.tipo === 'complementacion') {
      if (!linea.some((g) => g.tipo === 'grado' && g.comp)) { e.egNG = true; e.egNom = String(e.detalle || '').split(' · ')[0]; }
    } else if (e.tipo === 'extension' && /ESPECIALIZ|MAESTR|DOCTOR/.test(sinTildes(e.titulo || ''))) { // los diplomados y demás cursos de extensión no llevan "egresado no graduado"
      const k = kt(e.titulo);
      if (!linea.some((g) => g.tipo === 'grado' && (kt(g.programa || '') && (k.includes(kt(g.programa)) || kt(g.programa).includes(k))))) { e.egNG = true; e.egNom = e.titulo; }
    }
  });
  // La medalla Caldas nunca va suelta: se asocia a un programa o curso (escalafonamiento, titulación, complementación o curso de ley).
  // CURSO ESPECÍFICO y PERIODO de la base de medallas dicen dónde se obtuvo.
  // Se ubica por CURSO GENERAL y CURSO ESPECÍFICO y por PERIODO; la categoría (consagración, aplicación…) no decide nada.
  // Una tarjeta (curso o programa) lleva a lo sumo una Caldas: si ya tiene una, la medalla busca otra tarjeta que también coincida; si no hay, es repetida y se omite.
  medallas.forEach((x) => {
    const m = { titulo: 'Medalla “Francisco José de Caldas”', categoria: x.medalla && x.medalla !== 'MEDALLA CALDAS' ? x.medalla : '', motivo: '', programa: x.programa || '', curso: x.general || x.curso || '', pv: x.pv };
    const claves = [kt(x.general), kt(x.curso), kt(x.programa)].filter(Boolean);
    const tM = x.periodo ? perNum(x.periodo) : tFecha(x.fecha);
    const coincide = (a, b) => a && b && (a.includes(b) || b.includes(a));
    const dist = (e) => (tM != null ? Math.abs((e.t || 0) - tM) : 0);
    const libres = (L) => L.filter((e) => !(e.medallas && e.medallas.length));
    const mejor = (L) => { const F = libres(L); return (F.length ? F : []).sort((a, b) => dist(a) - dist(b))[0]; };
    const tarjetas = linea.filter((e) => ['ley', 'grado', 'complementacion', 'extension', 'escalafon'].includes(e.tipo) && e.t != null);
    const casa = (e, k) => e.tipo === 'escalafon' ? /ESCALAF/.test(k) : (coincide(kt(e.titulo), k) || coincide(kt(e.programa || ''), k) || coincide(kt(e.tituloAcad || ''), k) || (e.tipo === 'complementacion' && coincide(kt(e.detalle || ''), k)));
    const poner = (ev) => { (ev.medallas = ev.medallas || []).push(m); };
    // 1. Por cada clave (general primero), tarjetas que coinciden y no tienen ya una Caldas; la del periodo más cercano.
    for (const k of claves) {
      const L = tarjetas.filter((e) => casa(e, k));
      if (L.length) { const e = mejor(L); if (e) return poner(e); return; } // todas ocupadas: medalla repetida
    }
    // 2. Sin coincidencia por nombre: la tarjeta libre más cercana al periodo.
    if (tM != null) { const e = mejor(tarjetas); if (e) return poner(e); return; }
    const gA = linea.find((e) => e.tipo === 'grado' && !e.comp && !(e.medallas && e.medallas.length)) || linea.find((e) => e.tipo === 'escalafon' && !(e.medallas && e.medallas.length));
    if (gA) return poner(gA);
  });
  if (retiro) linea.push({ tipo: 'retiro', t: tFecha(retiro.retiro), fecha: retiro.retiro, anio: anioDe(retiro.retiro) || retiro.anioIng || null, titulo: 'Retiro', causal: retiro.causal, doc: retiro.doc, obs: retiro.obs, curso: retiro.curso, grado: retiro.grado, pv: retiro.pv });
  // Grado de honor / meritorio / laureado: van en la tarjeta de la titulación académica (la primera que no es de complementación).
  const gAcad = linea.find((e) => e.tipo === 'grado' && !e.comp) || linea.find((e) => e.tipo === 'grado');
  const honores = concesiones.filter((x) => ['mencion', 'merito', 'laureado'].includes(x.clase));
  honores.forEach((x) => {
    const kpH = kt(x.programa || '');
    const g = (kpH && linea.find((e) => e.tipo === 'grado' && kt(e.programa || '') && (kt(e.programa).includes(kpH) || kpH.includes(kt(e.programa))))) || gAcad;
    if (!g) return;
    const titulo = x.concesion + (x.honor ? ' · ' + x.honor : '');
    g.distinciones = g.distinciones || [];
    if (!g.distinciones.some((d) => d.titulo === titulo)) g.distinciones.push({ titulo });
    if (x.trabajo && !g.trabajo) g.trabajo = x.trabajo;
  });
  // Logros: cuántos distinguidos, becas y excelencias académicas (solo lo que exista).
  // Distinguido / excelencia por periodo: de las listas históricas del registro (dst/exa) y de las marcas de cada periodo (dis/exc) en todos los archivos de Antigüedades.
  const periodosMarca = (lista, marca) => { const st = new Set(); antRows.forEach((r) => { if (r[marca]) st.add(r.per); (lista === 'dst' ? r.dst : r.exa || []).forEach((q) => st.add(q)); }); return st; };
  const setDist = periodosMarca('dst', 'dis');
  sems.filter((x) => x.dist && x.periodo).forEach((x) => setDist.add(x.periodo));
  concesiones.filter((x) => x.clase === 'distinguido').forEach((x) => setDist.add(x.periodo || ('a' + x.anio)));
  const nBecas = new Set(concesiones.filter((x) => x.clase === 'beca').map((x) => (x.periodo || ('a' + x.anio)) + '|' + kt(x.concesion))).size;
  const setExc = periodosMarca('exa', 'exc');
  sems.filter((x) => x.exc && x.periodo).forEach((x) => setExc.add(x.periodo));
  const nExc = setExc.size;
  // Semestre (1.1, 1.2, 2.1…) en que fue distinguido: del curso del periodo en Antigüedades o, si no, del curso en la hoja Distinguido.
  const semDe = (c0) => { const m = String(c0 || '').match(/^\s*(\d)\.(\d)/); return m ? m[1] + '.' + m[2] : ''; };
  const semsDist = Array.from(setDist).map((per) => {
    const sm = sems.find((x) => x.periodo === per);
    const cd = concesiones.find((x) => x.clase === 'distinguido' && (x.periodo === per));
    return { per, sem: semDe(sm && sm.label) || semDe(cd && cd.curso) };
  }).filter((x) => x.sem || /^\d{4}-\d$/.test(x.per)).sort((a, b) => (perNum(a.per) || 0) - (perNum(b.per) || 0));
  const semestresDist = Array.from(new Set(semsDist.map((x) => x.sem).filter(Boolean)));
  const items = [];
  if (setDist.size) items.push({ k: 'distinguido', label: 'Alumno distinguido', n: setDist.size, semestres: semsDist.map((x) => x.sem).filter(Boolean) });
  if (nBecas) items.push({ k: 'beca', label: nBecas === 1 ? 'Beca' : 'Becas', n: nBecas });
  if (nExc) items.push({ k: 'excelencia', label: 'Excelencia académica', n: nExc });
  if (items.length) {
    const ing = linea.find((e) => e.tipo === 'ingreso');
    const ti = ing && ing.t != null ? ing.t + 0.01 : (ing && ing.anio ? ing.anio + 0.02 : null);
    linea.push({ tipo: 'logros', t: ti, anio: ing ? ing.anio : null, titulo: 'Logros', items });
  }
  // Un reingreso solo puede ocurrir después de un retiro: si no trae fecha, va justo después del retiro.
  {
    const rt = linea.find((e) => e.tipo === 'retiro');
    if (rt && rt.t != null) linea.filter((e) => e.tipo === 'regreso' && e.t == null).forEach((e) => { e.t = rt.t + 0.0005; });
  }
  // Orden: por fecha; los que no tienen fecha conservan su orden natural al final de su grupo.
  const orden = { ingreso: 0, regreso: 1, logros: 1.5, semestre: 2, escalafon: 3, grado: 4, complementacion: 5, ley: 5, extension: 5, concesion: 5, reconocimiento: 5, medalla: 5, retiro: 6 };
  linea.forEach((e, i) => { e.i = i; e.o = (e.tipo === 'grado' && /ESPECIALIZ|MAESTR|DOCTOR|DIPLOMAD/.test(sinTildes(e.programa || ''))) ? 5.5 : orden[e.tipo]; });
  linea.sort((a, b) => {
    if (a.tipo === 'ingreso' || b.tipo === 'ingreso') return (a.tipo === 'ingreso' ? 0 : 1) - (b.tipo === 'ingreso' ? 0 : 1);
    if (a.t != null && b.t != null && a.t !== b.t) return a.t - b.t;
    if (a.o !== b.o) return a.o - b.o;
    return a.i - b.i;
  });
  linea.forEach((e) => { delete e.i; delete e.o; });
  {
    const ir = linea.findIndex((e) => e.tipo === 'retiro'), ie = linea.findIndex((e) => e.tipo === 'escalafon');
    if (ir >= 0 && ie > ir && !linea.slice(ir, ie).some((e) => e.tipo === 'regreso')) avisos.push('Tiene un escalafonamiento posterior al retiro y no hay un reingreso registrado entre los dos: revisar.');
  }

  // Nombre más completo entre las fuentes (si el corto está contenido en el largo): evita ver el segundo nombre en unas partes y en otras no.
  {
    const tk = (v) => sinTildes(v).split(/\s+/).filter(Boolean);
    const cand = [nombre].concat(bajRows.map((x) => x.nombre), antRows.map((x) => x.n), todoCong.map((x) => x.nombre), grados.filter((x) => !x.pv).map((x) => x.nombre), cursos.filter((x) => !x.pv).map((x) => x.nombre), concesiones.filter((x) => !x.pv).map((x) => x.nombre), medallas.filter((x) => !x.pv).map((x) => x.nombre)).filter(Boolean);
    const base = new Set(tk(nombre));
    cand.forEach((c) => { const t = tk(c); if (t.length > tk(nombre).length && Array.from(base).every((w) => t.includes(w))) nombre = c; });
  }

  nombre = nom(nombre); // restituye tildes y Ñ en el nombre mostrado
  const alertas = [];
  if (porVerificar.length) alertas.push('Coincidencia por nombre, por verificar: ' + Array.from(new Set(porVerificar)).join(', ') + '.');
  return {
    persona: { nombre, cedula: (ing0 && ing0.cedula) || (cong[0] && cong[0].cedula) || (ck || ''), sigla: (ing0 && ing0.sigla) || '', cont: (ing0 && ing0.cont) || (e0 && e0.cont) || '', sexo: (ing0 && ing0.sexo) || '', nac: (ing0 && ing0.nac) || '', curso: (ultimo && ultimo.cu) || '', grado: (ultimo && ultimo.g) || '' },
    estado, civil, graduado: grados.length > 0, escalafonado: !!e0, retiro: retiro ? { fecha: retiro.retiro, causal: retiro.causal, doc: retiro.doc, obs: retiro.obs } : null,
    ingreso: ing0 ? { fecha: ing0.fecha, anio: ing0.anio } : null,
    resumen: {
      semestres: sems.length,
      perdidos: sems.filter((s) => s.perdido).length, distinguido: sems.filter((s) => s.dist).length, excelencia: sems.filter((s) => s.exc).length,
      medallas: medallas.length, concesiones: concesiones.filter((x) => x.clase === 'concesion').length, reconocimientos: concesiones.filter((x) => x.clase !== 'concesion' && x.clase !== 'distinguido').length, cursos: cursos.length, puesto: e0 ? e0.puesto : null, total: e0 ? e0.total : null,
    },
    linea, alertas, avisos,
  };
}

/* ----------------------------- Búsqueda de personas ------------------------ */

function listaPersonas(S) {
  const P = {}, vistosNom = new Set();
  const add = (ck, nombre, extra) => {
    if (!nombre) return;
    const k = ck ? 'c:' + ck : 'n:' + nomKey(nombre);
    const p = P[k] || (P[k] = { id: k, nombre: nom(nombre), cedula: '', sigla: '', cont: '', anio: null, k: nomKey(nombre) });
    Object.keys(extra || {}).forEach((x) => { if (extra[x] && !p[x]) p[x] = extra[x]; });
    if (ck) vistosNom.add(nomKey(nombre));
  };
  if (S.cong) { Object.entries(S.cong.porCed).forEach(([ck, L]) => L.forEach((r) => add(ck, r.nombre, { cedula: r.cedula, sigla: r.sigla, cont: r.cont, anio: r.anio }))); }
  if (S.baj) { Object.entries(S.baj.porCed).forEach(([ck, L]) => L.forEach((r) => add(ck, r.nombre, { cedula: ck, sigla: r.sigla, cont: r.cont, anio: +r.anioIng || null }))); }
  if (S.ant) { Object.entries(S.ant.porCed).forEach(([ck, L]) => L.forEach((r) => add(ck, r.n, { cedula: r.ce, cont: r.ct }))); }
  // Civiles: quienes solo están en Extensión y/o Graduados de la ENAP también se pueden consultar.
  [S.grad, S.ext].forEach((fu) => { if (fu) Object.entries(fu.porCed || {}).forEach(([ck, L]) => L.forEach((r) => add(ck, r.nombre, { cedula: ck }))); });
  const sinCed = (fu, campo) => { if (!fu) return; Object.entries(fu.porNom).forEach(([nk, L]) => { if (vistosNom.has(nk)) return; L.forEach((r) => add('', r[campo], { sigla: r.sigla, cont: r.cont || r.ct, anio: r.anio || null })); }); };
  sinCed(S.cong, 'nombre'); sinCed(S.baj, 'nombre'); sinCed(S.ant, 'n'); sinCed(S.grad, 'nombre'); sinCed(S.ext, 'nombre');
  // Mismo estudiante registrado dos veces: una fila sin cédula con el nombre abreviado (p. ej. "FRANCISCO H") frente a otra con cédula y nombre completo.
  const todos = Object.values(P);
  const palabras = (n) => sinTildes(n).replace(/Ñ/g, 'N').replace(/[^A-Z ]/g, ' ').split(' ').filter(Boolean);
  const conCed = {};
  todos.filter((p) => p.id[0] === 'c').forEach((p) => { const w = palabras(p.nombre); if (w[0]) (conCed[w[0]] = conCed[w[0]] || []).push({ p, w }); });
  return todos.filter((p) => {
    if (p.id[0] !== 'n') return true;
    const w = palabras(p.nombre);
    return !((conCed[w[0]] || []).some((c) => c.w.length >= w.length && c.w.slice(0, w.length - 1).join(' ') === w.slice(0, -1).join(' ') && c.w[w.length - 1].startsWith(w[w.length - 1]) && (!p.cont || !c.p.cont || p.cont === c.p.cont) && (!p.anio || !c.p.anio || p.anio === c.p.anio)));
  });
}

/* La lista de personas se rehace si cambia CUALQUIER fuente (antes solo miraba el Conglomerado y, al actualizarse Graduados, la búsqueda seguía con la lista vieja). */
let LISTA_C = null;
function listaCache(S) {
  const f = ['cong', 'baj', 'ant', 'grad', 'ext'];
  if (!LISTA_C || f.some((k) => LISTA_C.S[k] !== S[k])) LISTA_C = { S: Object.fromEntries(f.map((k) => [k, S[k]])), lista: listaPersonas(S) };
  return LISTA_C.lista;
}

function buscar(S, q) {
  const t = String(q || '').trim();
  if (t.length < 3) throw error('Escriba al menos 3 caracteres (cédula o nombre).', 400);
  const lista = S.solo ? listaCache(S) : listaPersonas(S);
  const soloNum = /^[\d.\s]+$/.test(t);
  let res;
  if (soloNum) {
    const k = cedKey(t);
    res = lista.filter((p) => p.id.startsWith('c:') && p.id.slice(2).includes(k)).sort((a, b) => (a.id.slice(2) === k ? -1 : 0) - (b.id.slice(2) === k ? -1 : 0));
  } else {
    const toks = sinTildes(t).replace(/Ñ/g, 'N').replace(/[^A-Z ]/g, ' ').split(' ').filter(Boolean);
    res = lista.filter((p) => toks.every((w) => p.k.split(' ').some((x) => x.startsWith(w))));
    res.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }
  return { total: res.length, lista: res.slice(0, 30).map((p) => ({ id: p.id, nombre: p.nombre, cedula: p.cedula, sigla: p.sigla, cont: p.cont, anio: p.anio, sinCedula: p.id.startsWith('n:') })) };
}

/* ---------------------- Carga de fuentes con tolerancia -------------------- */

async function cargar() {
  const fuentes = [];
  const S = {};
  const intenta = async (clave, nombre, fn, detalle) => {
    const t0 = Date.now();
    try { const v = await fn(); fuentes.push({ clave, nombre, ok: true, filas: v.filas, ms: Date.now() - t0, nota: detalle ? detalle(v) : '' }); return v; }
    catch (e) { fuentes.push({ clave, nombre, ok: false, ms: Date.now() - t0, nota: e.message }); return null; }
  };
  const [cong, baj, grad, ant, ext, ley, ccp, conc, med] = await Promise.all([
    intenta('conglomerado', 'CONGLOMERADO (ingresos)', () => fuente('conglomerado', procesarConglomerado)),
    intenta('bajas', 'Bajas y Ascensos', () => fuente('bajas', procesarBajas), (v) => (v.asc.error ? 'Hoja Ascensos: ' + v.asc.error : `Ascensos: ${v.asc.filas} filas`)),
    intenta('graduados', 'Graduados en la ENAP', () => fuente('graduados', procesarGraduados), (v) => `${v.filas} registros · ` + v.hojas.map((h) => h.hoja + (h.usada ? ` (${h.filas}; columnas: ${(h.cols || []).join(', ')}; filas en la hoja: ${h.totalFilas}; ÚLTIMOS LEÍDOS: ${(h.ultimos || []).join(' | ')})` : ' (sin columnas reconocidas)')).join(' · ') + (!v.columnas.nombre ? ' · SIN columna de nombre: quienes solo están en Graduados no se pueden buscar por nombre.' : v.columnas.fecha ? '' : ' · Sin columna de fecha de grado.')),
    intenta('antiguedades', 'Antigüedades (notas, distinguido, excelencia)', cargarAntiguedades, (v) => `Periodos: ${v.periodos.join(', ')}`),
    intenta('extension', 'Cursos de extensión', () => fuente('extension', procesarExtension), (v) => v.hojas.map((h) => h.hoja + (h.usada ? ` (${h.filas}; columnas: ${(h.cols || []).join(', ')})` : ' (sin columnas reconocidas)')).join(' · ')),
    intenta('ley', 'Cursos de ley (capacitación para ascenso)', () => fuente('ley', procesarLey), (v) => v.hojas.map((h) => h.hoja + (h.usada ? ` (${h.filas}; columnas: ${(h.cols || []).join(', ')})` : ' (sin columnas reconocidas)')).join(' · ')),
    intenta('ccp', 'Complementación profesional (CCP 1970 – actualidad)', () => fuente('ccp', procesarCcp), (v) => v.hojas.map((h) => h.hoja + (h.usada ? ` (${h.filas}; columnas: ${(h.cols || []).join(', ')})` : ' (sin columnas reconocidas)')).join(' · ')),
    intenta('concesiones', 'Concesiones, becas, mención de honor, meritorios y laureados (Base Concesiones)', () => fuente('concesiones', procesarConcesiones), (v) => v.hojas.map((h) => h.hoja + (h.usada ? ` (${h.filas}; columnas: ${(h.cols || []).join(', ')})` : ' (no usada)')).join(' · ')),
    intenta('medallas', 'Medallas Caldas (Solicitud Caldas)', () => fuente('medallas', procesarMedallas), (v) => (v.sinEstado ? 'Sin columna de estado: se muestran todas las solicitudes registradas. ' : 'Solo otorgadas/aprobadas. ') + v.hojas.map((h) => h.hoja + (h.usada ? ` (${h.filas}; columnas: ${(h.cols || []).join(', ')})` : ' (sin columnas reconocidas)')).join(' · ')),
  ]);
  S.cong = cong; S.baj = baj; S.grad = grad; S.ant = ant; S.ext = ext; S.ley = ley; S.ccp = ccp; S.conc = conc; S.med = med;
  return { S, fuentes };
}

async function identificar(accessToken) {
  const r = await fetch(`${GRAPH}/me`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!r.ok) throw error('La sesión de Microsoft no es válida o expiró. Vuelva a iniciar sesión en el Portal.', 401);
  const p = await r.json();
  const correo = String(p.mail || p.userPrincipalName || '').trim().toLowerCase();
  return { correo, nombre: p.displayName || correo };
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method !== 'POST') { res.status(405).json({ error: 'Use POST.' }); return; }
    const body = typeof req.body === 'object' && req.body ? req.body : {};
    if (!body.accessToken || !body.accion) throw error('Faltan "accessToken" o "accion".', 400);
    const yo = await identificar(body.accessToken);
    if (!ADMINS.includes(yo.correo)) throw error('Este módulo es solo para sea@enap.edu.co y jestadisticaplen@enap.edu.co.', 403);
    const a = body.accion;
    if (a === 'sesion') { res.status(200).json({ correo: yo.correo, nombre: yo.nombre }); return; }
    await ctx();
    if (a === 'refrescar') { // descarta lo guardado en memoria y vuelve a leer todas las fuentes desde los archivos
      Object.keys(CACHE).forEach((k) => { delete CACHE[k]; }); ANT = null;
      const t0 = Date.now(); await cargar(); res.status(200).json({ ok: true, ms: Date.now() - t0 }); return;
    }
    if (a === 'calentar') { // precarga todas las fuentes en la memoria de la función (se llama al abrir el módulo)
      const t0 = Date.now(); await cargar(); res.status(200).json({ ok: true, ms: Date.now() - t0 }); return;
    }
    if (a === 'sugerir') { // autocompletar mientras se escribe: TODAS las fuentes (antes solo el Conglomerado y no salían quienes están solo en Graduados/Extensión)
      const { S: S0 } = await cargar();
      const r = buscar(Object.assign({}, S0, { solo: true }), body.q);
      res.status(200).json({ total: r.total, lista: r.lista.slice(0, 8) });
      return;
    }
    const { S, fuentes: fuentesTodas } = await cargar();
    const fuentes = yo.correo === 'jestadisticaplen@enap.edu.co' ? fuentesTodas : [];
    if (a === 'fuentes') { res.status(200).json({ fuentes }); return; }
    if (a === 'buscar') { res.status(200).json(Object.assign(buscar(S, body.q), { fuentes: fuentes.filter((f) => !f.ok && true) })); return; }
    if (a === 'ficha') { res.status(200).json(Object.assign(armarFicha(body.id, S), { fuentes, actualizado: Object.values(MODS).sort().slice(-1)[0] || '' })); return; }
    throw error(`Acción desconocida: ${a}`, 400);
  } catch (e) {
    res.status(e.status || 500).json({ error: e instanceof Error ? e.message : String(e) });
  }
};

module.exports._test = { procesarConglomerado, procesarLey, procesarCcp, sinRepetidos, procesarMedallas, procesarConcesiones, normPeriodo, armarFicha, buscar, semestres, procesarExtension, procesarGraduados, cedKey, nomKey, fechaCelda, listaPersonas };
