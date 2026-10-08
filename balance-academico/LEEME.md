# Balance Académico (módulo independiente)

Abrir `balance-academico/index.html` desde el mismo servidor del portal (necesita leer `../balances/*.xlsm`).

- `index.html` pantalla (datos y notas → revisión → firma y PDF)
- `motor.js` lector del SMA, cruce con pénsum/equivalencias, reglas, bitácora, firmas
- `lector-excel.js` lee los Excel de `../balances/` (los Excel siguen siendo la fuente)
- `programas.js` lista de los 13 programas con plantilla
- `pdf.js` PDF con la geometría del formato EDUCA-FT-009-JINEN
- `vendor/` SheetJS y jsPDF · `assets/` logo y marca de agua

Precarga por enlace (para la integración futura):
`index.html?programa=ing-electronica&tipoDoc=CC&documento=…&nombres=…&apellidos=…&nivel=pregrado`
