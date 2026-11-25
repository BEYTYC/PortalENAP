#!/usr/bin/env python3
# Genera snies/instructivos/datos.json (instructivo de diligenciamiento dinámico) a partir de:
#  - api/_snies-columnas.json (hojas y encabezados oficiales)
#  - api/_snies-reglas.json (tipo, longitud, obligatorio y valores del Manual de Validaciones V9.1)
#  - los PDF recortados del Manual del Usuario SNIES v2.11 (uno por plantilla, nombre <id>.pdf) en la carpeta que se pase como argumento
#  - api/_snies-catalogos.json y el listado de programas de la ENAP.
# Uso: python3 docs/modulos/snies-generar-instructivos.py <carpeta_con_pdf>
import json, re, subprocess, sys, os, unicodedata
nfc = lambda x: unicodedata.normalize('NFC', x)
R = json.load(open('api/_snies-reglas.json', encoding='utf8'))
C = json.load(open('api/_snies-columnas.json', encoding='utf8'))
M = json.load(open('api/_snies-maestro.json', encoding='utf8'))
carpeta = sys.argv[1]
CAMPO = re.compile(r'^([A-ZÑÁÉÍÓÚ][A-ZÑÁÉÍÓÚ0-9_ ]{2,60}):\s*(.*)$')
PIE = re.compile(r'^(Versión: 2\.11|\s*\d{1,3}\s*$)')
def parsear(pdf):
    t = subprocess.run(['pdftotext', '-layout', pdf, '-'], capture_output=True, text=True).stdout
    t = nfc(t)
    campos, cur = {}, None
    for ln in t.replace('\x0c', '').split('\n'):
        if PIE.match(ln.strip()) or 'Fecha de actualización' in ln: continue
        m = CAMPO.match(ln)
        if m:
            cur = m.group(1).strip().replace(' ', '_'); campos.setdefault(cur, {'d': [], 'v': []}); campos[cur]['d'].append(m.group(2)); continue
        if cur is None: continue
        mv = re.match(r'^\s{6,}(\S.*?)\s{2,}(\S.*)$', ln)
        if mv and not re.search(r'DESC|DESCRIPCI', mv.group(2)) and not re.match(r'^[A-ZÑ_]{6,}$', mv.group(1)) :
            campos[cur]['v'].append([mv.group(1).strip(), mv.group(2).strip()])
        elif ln.strip() and not re.match(r'^\s{6,}\S+\s*$', ln):
            campos[cur]['d'].append(ln.strip())
    out = {}
    for k, v in campos.items():
        d = re.sub(r'\s+', ' ', ' '.join(v['d'])).strip()
        d = re.sub(r'\s*Los valores permitidos son:?\s*$', '', d, flags=re.I)
        out[k] = {'d': d, 'v': v['v'] if 1 < len(v['v']) <= 40 else []}
    return out
TILDES = {'Administracion': 'Administración', 'Maritima': 'Marítima', 'Maritimas': 'Marítimas', 'Oceanografia': 'Oceanografía', 'Fisica': 'Física', 'Nauticas': 'Náuticas', 'Infanteria': 'Infantería', 'Maquina': 'Máquina', 'Ingenieria': 'Ingeniería', 'Electronica': 'Electrónica', 'Maestria': 'Maestría', 'Gestion': 'Gestión', 'Logistica': 'Logística', 'Especializacion': 'Especialización', 'Politica': 'Política', 'Tecnologia': 'Tecnología', 'Hidrografia': 'Hidrografía', 'Estrategia': 'Estrategia'}
MENOR = {'De', 'Del', 'Para', 'En', 'Y', 'La', 'El', 'Y'}
def bonito(n):
    ws = [TILDES.get(w, w) for w in n.title().split()]
    return ' '.join(w.lower() if (i and w in MENOR) else w for i, w in enumerate(ws))
progs = []
try:
    import openpyxl
    ws = openpyxl.load_workbook(os.path.join(carpeta, 'programas.xlsx'), read_only=True).worksheets[0]
    progs = [[str(int(r[0])), bonito(str(r[1]))] for r in ws.iter_rows(min_row=2, values_only=True) if isinstance(r[0], (int, float))]
except Exception: pass
GEN = {'AÑO': 'Año del periodo que se reporta, con 4 dígitos.', 'SEMESTRE': 'Semestre del periodo que se reporta: 1 o 2.',
       'ID_TIPO_DOCUMENTO': 'Sigla del tipo de documento de identidad de la persona. Escoja una de las opciones de la lista.',
       'NUM_DOCUMENTO': 'Número del documento de identidad, tal como está en el documento: sin puntos, comas, apóstrofes ni espacios.',
       'PRO_CONSECUTIVO': 'Código SNIES del programa académico. Escójalo en el listado de programas de la ENAP.'}
def generico(c, r):
    if c in GEN: return GEN[c]
    f = {'n': 'Escriba un número' + (f" de hasta {r['l']} dígitos" if r.get('l') else ''), 'f': 'Escriba la fecha con formato dd/mm/aaaa', 'x': 'Escriba el texto' + (f" (hasta {r['l']} caracteres)" if r.get('l') else '')}.get(r.get('t'), 'Diligencie este campo según la instrucción del Ministerio')
    return f + '. ' + ('Es obligatorio.' if r.get('o') else '') + (' Solo se admiten los valores de la lista.' if r.get('v') else '')
datos = {}
for t in M:
    if t['id'] not in {x for x in os.listdir('api') and []} and t['codigo'] is None: continue
    cols = C.get(str(t['codigo']))
    if not cols: continue
    pdf = os.path.join(carpeta, t['id'] + '.pdf'); man = parsear(pdf) if os.path.exists(pdf) else {}
    hojas = {}
    for hoja, cs in cols.items():
        lista = []
        for c in cs:
            r = (R.get(t['id'], {}).get(hoja, {}) or {}).get(c, {})
            m = man.get(c) or man.get(c.replace('_', ' ')) or {}
            d = m.get('d', '') or generico(c, r)
            ob = 'o' if r.get('o') else ('c' if re.search(r'obligatori', m.get('d', ''), re.I) else 'p')
            e = {'c': c, 'o': ob, 't': r.get('t', ''), 'l': r.get('l', 0), 'd': d, 'v': m.get('v') or [[x, ''] for x in r.get('v', [])]}
            if c == 'PRO_CONSECUTIVO' and progs: e['v'] = progs
            lista.append(e)
        hojas[hoja] = lista
    datos[t['id']] = {'n': t['nombre'], 'h': hojas}
json.dump(datos, open('snies/instructivos/datos.json', 'w', encoding='utf8'), ensure_ascii=False, separators=(',', ':'))
print(len(datos), 'plantillas')
