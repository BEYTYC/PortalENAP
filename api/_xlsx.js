/**
 * api/_xlsx.js — lector mínimo de Excel (.xlsx / .xlsm) sin dependencias.
 *
 * Vercel no convierte en función los archivos que empiezan con "_".
 * Se usa para leer CONGLOMERADO, Bajas y Ascensos y Graduados desde el
 * OneDrive de Estadística (solo lectura). Las fechas llegan como número
 * serial de Excel; usar serialAFecha() para convertirlas.
 */
const zlib = require('zlib');

function entradasZip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 70000); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('El archivo no es un Excel válido (zip).');
  const total = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const mapa = {};
  for (let k = 0; k < total; k++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const metodo = buf.readUInt16LE(p + 10);
    const comp = buf.readUInt32LE(p + 20);
    const nLen = buf.readUInt16LE(p + 28), xLen = buf.readUInt16LE(p + 30), cLen = buf.readUInt16LE(p + 32);
    const off = buf.readUInt32LE(p + 42);
    const nombre = buf.toString('utf8', p + 46, p + 46 + nLen);
    mapa[nombre] = { metodo, comp, off };
    p += 46 + nLen + xLen + cLen;
  }
  return mapa;
}

function leerEntrada(buf, e) {
  const nLen = buf.readUInt16LE(e.off + 26), xLen = buf.readUInt16LE(e.off + 28);
  const ini = e.off + 30 + nLen + xLen;
  const datos = buf.subarray(ini, ini + e.comp);
  return e.metodo === 0 ? datos : zlib.inflateRawSync(datos);
}

const decode = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16))).replace(/&amp;/g, '&');

function textoSi(si) {
  let t = '';
  const re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g;
  let m;
  // ignora el texto fonético (<rPh>)
  si = si.replace(/<rPh[\s\S]*?<\/rPh>/g, '');
  while ((m = re.exec(si))) t += m[1] ? decode(m[1]) : '';
  return t;
}

function colIndex(ref) {
  let n = 0;
  for (let i = 0; i < ref.length; i++) {
    const c = ref.charCodeAt(i);
    if (c < 65 || c > 90) break;
    n = n * 26 + (c - 64);
  }
  return n - 1;
}

/** Abre el libro y devuelve { hojas: [nombres], leer(nombre, {maxCols, maxRows}) -> filas[][] } */
function abrir(buf) {
  const z = entradasZip(buf);
  const txt = (n) => (z[n] ? leerEntrada(buf, z[n]).toString('utf8') : null);
  const wb = txt('xl/workbook.xml') || '';
  const rels = txt('xl/_rels/workbook.xml.rels') || '';
  const relMap = {};
  rels.replace(/<Relationship\b[^>]*>/g, (r) => {
    const id = (r.match(/\bId="([^"]+)"/) || [])[1];
    const tg = (r.match(/\bTarget="([^"]+)"/) || [])[1];
    if (id && tg) relMap[id] = tg.replace(/^\/?xl\//, '').replace(/^\//, '');
    return r;
  });
  const hojas = [];
  wb.replace(/<sheet\b[^>]*>/g, (s) => {
    const nombre = decode((s.match(/\bname="([^"]*)"/) || [])[1] || '');
    const rid = (s.match(/\br:id="([^"]+)"/) || [])[1];
    hojas.push({ nombre, ruta: 'xl/' + (relMap[rid] || '') });
    return s;
  });
  let compartidos = null;
  function shared() {
    if (compartidos) return compartidos;
    compartidos = [];
    const x = txt('xl/sharedStrings.xml');
    if (x) { const re = /<si>([\s\S]*?)<\/si>/g; let m; while ((m = re.exec(x))) compartidos.push(textoSi(m[1])); }
    return compartidos;
  }
  function leer(nombre, op) {
    op = op || {};
    const h = hojas.find((x) => x.nombre === nombre);
    if (!h || !z[h.ruta]) throw new Error(`No se encontró la hoja "${nombre}".`);
    const maxCols = op.maxCols || 200, maxRows = op.maxRows || 1e7;
    const ss = shared();
    const x = leerEntrada(buf, z[h.ruta]).toString('utf8');
    const filas = [];
    const reRow = /<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g;
    const reC = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let m;
    while ((m = reRow.exec(x))) {
      const rn = +((m[1].match(/\br="(\d+)"/) || [])[1] || filas.length + 1);
      if (rn > maxRows) break;
      const fila = [];
      if (m[2]) {
        let c; reC.lastIndex = 0;
        let pos = 0;
        while ((c = reC.exec(m[2]))) {
          const at = c[1];
          const ref = (at.match(/\br="([A-Z]+)\d+"/) || [])[1];
          const ci = ref ? colIndex(ref) : pos;
          pos = ci + 1;
          if (ci >= maxCols) continue;
          const t = (at.match(/\bt="([^"]+)"/) || [])[1];
          const cuerpo = c[2] || '';
          let v = null;
          if (t === 'inlineStr') v = textoSi(cuerpo);
          else {
            const vm = cuerpo.match(/<v>([\s\S]*?)<\/v>/);
            if (vm) {
              const raw = decode(vm[1]);
              if (t === 's') v = ss[+raw] != null ? ss[+raw] : '';
              else if (t === 'str' || t === 'e') v = raw;
              else if (t === 'b') v = raw === '1';
              else v = raw === '' ? null : (isNaN(+raw) ? raw : +raw);
            }
          }
          fila[ci] = v;
        }
      }
      filas[rn - 1] = fila;
    }
    for (let i = 0; i < filas.length; i++) if (!filas[i]) filas[i] = [];
    return filas;
  }
  return { hojas: hojas.map((h) => h.nombre), leer };
}

function serialAFecha(v) {
  if (typeof v !== 'number' || !isFinite(v) || v < 1) return null;
  const ms = Math.round((v - 25569) * 86400000);
  const d = new Date(ms);
  return isNaN(d) ? null : d; // fecha en UTC
}
function fechaASerial(y, m, d) { return Date.UTC(y, m - 1, d) / 86400000 + 25569; }

module.exports = { abrir, serialAFecha, fechaASerial, colIndex };
