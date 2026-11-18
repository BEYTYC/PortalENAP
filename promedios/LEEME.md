# Generación de Promedios Académicos

Reglas de negocio: `docs/modulos/promedios-academicos.md`. Autora: Oficina de Estadística.

## Cómo funciona
- `index.html` + `js/app.js`: pantallas (inicio, carga, resultado, consulta, revisión, ajustes). Pide el token al Portal (`PortalENAP.tokenMicrosoft()`) y llama a `/api/promedios`.
- `js/lector.js`: lee los documentos **en el navegador**. PDF con texto → pdf.js; escaneado/imagen → OCR Tesseract (español) con detección de giro y relectura del recuadro de totales. Nada se sube hasta que se guarda el resultado.
- `js/nucleo.js`: reglas puras (nombres, programas, vigencia, promedio ponderado, lectura de balance y cédula). Se prueba igual en Node.
- `js/certificado.js`: PDF del certificado (jsPDF) con QR.
- `vendor/`: librerías locales (sin CDN). `assets/`: escudo, marca de agua y firma por defecto.
- `api/promedios.js`: guarda en SharePoint `Promedios/` (`registros.json`, `ajustes.json`, `Certificados/`, `Revision/`), bloquea duplicados, arma el ZIP y envía el correo desde certificaciones@enap.edu.co; `GET ?verificar=CÓDIGO` es público. Página pública: `verificar/index.html`.

## Seguridad
Ninguna cédula, balance ni certificado entra al repo. Acceso: Estadística (`jestadisticaplen@`) y usuarios agregados en Ajustes; el servidor lo verifica contra el token.
Para Solicitud de Grado: acción `consulta` (`cedula`, opcional `programaId`) devuelve el promedio emitido.
