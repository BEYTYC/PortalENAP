/*!
 * Portal de Servicios Digitales Estadística — Escuela Naval de Cadetes "Almirante Padilla"
 * Autora y desarrolladora: CAMARGO MARTÍNEZ BEYTY PATRICIA — Oficina de Estadística
 * Derechos morales de autor reservados (Ley 23 de 1982, art. 30). Este aviso de autoría no debe eliminarse ni alterarse.
 */
/**
 * api/_xlsx-editar.js — corrige un .xlsx ya cargado: cambia celdas y elimina filas completas, sin tocar el resto del archivo.
 * aplicar(buf, { cambios: [{ hoja, fila, col(índice), valor, numero }], borrar: { hoja: [fila,...] } }) -> Buffer
 * Las filas son las del archivo original (1 = encabezado).
 */
const zlib = require('zlib');
const { abrir, entradasZip, leerEntrada, colIndex } = require('./_xlsx');

const TABLA = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = TABLA[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const letras = (i) => { let s = ''; for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s; return s; };

function editarHoja(xml, ediciones, borrar, estiloFecha) {
  const b = new Set(borrar || []);
  const orden = [...b].sort((x, y) => x - y);
  const antes = (n) => { let k = 0; for (const x of orden) { if (x < n) k++; else break; } return k; };
  return xml.replace(/<row\b([^>]*?)(\/>|>([\s\S]*?)<\/row>)/g, (todo, at, cierre, cuerpo) => {
    const rn = +((at.match(/\br="(\d+)"/) || [])[1] || 0);
    if (!rn) return todo;
    if (b.has(rn)) return '';
    const nuevo = rn - antes(rn);
    const ed = ediciones[rn] || {};
    const celdas = [];
    const re = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g; let m;
    while ((m = re.exec(cuerpo || ''))) {
      const ref = (m[1].match(/\br="([A-Z]+)\d+"/) || [])[1];
      celdas.push({ ci: ref ? colIndex(ref) : celdas.length, at: m[1], x: m[0] });
    }
    for (const k of Object.keys(ed)) {
      const ci = +k, e = ed[k];
      const prev = celdas.find((c) => c.ci === ci);
      const estilo = prev && (prev.at.match(/\bs="(\d+)"/) || [])[1];
      const s = e.fecha && estiloFecha != null ? ` s="${estiloFecha}"` : (estilo ? ` s="${estilo}"` : '');
      let x;
      if (e.valor === '' || e.valor == null) x = `<c r="@"${s}/>`;
      else if (e.numero) x = `<c r="@"${s}><v>${e.numero}</v></c>`;
      else x = `<c r="@"${s} t="inlineStr"><is><t xml:space="preserve">${esc(e.valor)}</t></is></c>`;
      if (prev) { prev.x = x; prev.at = ''; } else celdas.push({ ci, at: '', x });
    }
    celdas.sort((p, q) => p.ci - q.ci);
    const interior = celdas.map((c) => c.x.replace(/\br="[A-Z]*(?:\d+|@)"/, `r="${letras(c.ci)}${nuevo}"`)).join('');
    const atr = at.replace(/\br="\d+"/, `r="${nuevo}"`).replace(/\sspans="[^"]*"/, '');
    return celdas.length ? `<row${atr}>${interior}</row>` : `<row${atr}/>`;
  });
}

/* Estilo de fecha (dd/mm/aaaa) para las fechas corregidas: se reutiliza el de la hoja si existe; si no, se agrega uno a styles.xml. */
function estiloDeFecha(buf, z) {
  if (!z['xl/styles.xml']) return null;
  let st = leerEntrada(buf, z['xl/styles.xml']).toString('utf8');
  const cx = st.match(/<cellXfs\b([^>]*)>([\s\S]*?)<\/cellXfs>/); if (!cx) return null;
  const xfs = cx[2].match(/<xf\b[^>]*?(?:\/>|>[\s\S]*?<\/xf>)/g) || [];
  const ya = xfs.findIndex((x) => /numFmtId="(14|15|16|17)"/.test(x));
  if (ya >= 0) return { indice: ya, xml: null };
  const nuevo = '<xf numFmtId="14" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>';
  st = st.replace(cx[0], `<cellXfs count="${xfs.length + 1}">${cx[2]}${nuevo}</cellXfs>`);
  return { indice: xfs.length, xml: Buffer.from(st, 'utf8') };
}

function aplicar(buf, op) {
  const wb = abrir(buf), z = entradasZip(buf);
  const porHoja = {};
  (op.cambios || []).forEach((c) => { ((porHoja[c.hoja] = porHoja[c.hoja] || {}).e = porHoja[c.hoja].e || {}); (porHoja[c.hoja].e[c.fila] = porHoja[c.hoja].e[c.fila] || {})[c.col] = c; });
  Object.keys(op.borrar || {}).forEach((h) => { porHoja[h] = porHoja[h] || {}; porHoja[h].b = op.borrar[h]; });
  const nuevos = {};
  let estiloFecha = null;
  if ((op.cambios || []).some((c) => c.fecha)) { const ef = estiloDeFecha(buf, z); if (ef) { estiloFecha = ef.indice; if (ef.xml) nuevos['xl/styles.xml'] = ef.xml; } }
  for (const h of Object.keys(porHoja)) {
    const ruta = wb.ruta(h); if (!ruta || !z[ruta]) throw new Error(`No se encontró la hoja "${h}".`);
    nuevos[ruta] = Buffer.from(editarHoja(leerEntrada(buf, z[ruta]).toString('utf8'), porHoja[h].e || {}, porHoja[h].b || [], estiloFecha), 'utf8');
  }
  const partes = [], central = []; let off = 0;
  for (const nombre of Object.keys(z)) {
    const datos = nuevos[nombre] || leerEntrada(buf, z[nombre]);
    const comp = zlib.deflateRawSync(datos), crc = crc32(datos), nb = Buffer.from(nombre, 'utf8');
    const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(8, 8);
    h.writeUInt32LE(crc, 14); h.writeUInt32LE(comp.length, 18); h.writeUInt32LE(datos.length, 22); h.writeUInt16LE(nb.length, 26);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(8, 10);
    c.writeUInt32LE(crc, 16); c.writeUInt32LE(comp.length, 20); c.writeUInt32LE(datos.length, 24); c.writeUInt16LE(nb.length, 28); c.writeUInt32LE(off, 42);
    partes.push(h, nb, comp); central.push(c, nb); off += 30 + nb.length + comp.length;
  }
  const cd = Buffer.concat(central), fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0); fin.writeUInt16LE(Object.keys(z).length, 8); fin.writeUInt16LE(Object.keys(z).length, 10); fin.writeUInt32LE(cd.length, 12); fin.writeUInt32LE(off, 16);
  return Buffer.concat([...partes, cd, fin]);
}

module.exports = { aplicar };
