#!/usr/bin/env python3
"""Genera apps-script/Index.html (un solo archivo) a partir de index.html y los módulos.
Uso:  python3 construir-apps-script.py
Apps Script solo sirve HTML, así que los .js se incrustan y las librerías vienen de cdnjs."""
import base64, pathlib, re

AQUI = pathlib.Path(__file__).resolve().parent
html = (AQUI / 'index.html').read_text(encoding='utf8')

LIBS = '''<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>'''

def js(nombre):
    t = (AQUI / nombre).read_text(encoding='utf8')
    assert '</script' not in t and '<?' not in t, nombre
    return '<script>\n' + t + '\n</script>'

def uri(nombre):
    return 'data:image/png;base64,' + base64.b64encode((AQUI / 'assets' / nombre).read_bytes()).decode()

MODULOS = '\n'.join(js(n) for n in ('motor.js', 'programas.js', 'lector-excel.js', 'pdf.js'))
ENTORNO = ('<script>window.__GAS = true; window.__PARAMS = <?!= params ?>;\n'
           'window.__ASSETS = {logo: "%s", marca: "%s"};</script>') % (uri('logo-armada.png'), uri('marca-agua.png'))

def bloque(nombre, nuevo):
    global html
    pat = re.compile(r'<!-- build:%s -->.*?<!-- /build:%s -->' % (nombre, nombre), re.S)
    assert pat.search(html), nombre
    html = pat.sub(lambda m: nuevo, html, count=1)

# jsPDF va incrustado (no depende de que el CDN cargue dentro de Apps Script)
jspdf = (AQUI / 'vendor' / 'jspdf.umd.min.js').read_text(encoding='utf8')
assert '</script' not in jspdf and '<?' not in jspdf
LIBS += '\n<script>\n' + jspdf + '\n;window.jspdf = window.jspdf || self.jspdf;\n</script>'
bloque('libs', LIBS)
bloque('modulos', MODULOS)
bloque('entorno', ENTORNO)
destino = AQUI / 'apps-script' / 'Index.html'
destino.write_text(html, encoding='utf8')
print('Escrito', destino, round(destino.stat().st_size / 1024), 'KB')
