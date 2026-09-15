# Módulo de Grados - PortalENAP

Este paquete contiene el login administrativo y el módulo de Aprobación de Grados
(Fase 1: Ceremonias, Radicación y Tratamiento de Datos), listos para subir a tu
repositorio `PortalENAP` sin necesidad de Node.js ni pasos de compilación.

## Cómo subirlo a tu repo

1. Descomprime este ZIP.
2. Copia las carpetas `shared/`, `login-admin/` y `grados/` tal cual dentro de la
   raíz de tu repositorio `PortalENAP` (al mismo nivel que `registro/` y `titulacion/`).
3. Súbelas a GitHub (arrastrando en la web, o con `git add` / `git commit` / `git push`
   si usas Git de escritorio).

La estructura final de tu repo quedará así:

```
PortalENAP/
├── index.html
├── registro/
├── titulacion/
├── shared/              ← nuevo (login y conexión a SharePoint, compartido)
│   ├── msalConfig.js
│   ├── spConfig.js
│   ├── graphClient.js
│   └── authService.js
├── login-admin/         ← nuevo (pantalla de inicio de sesión)
│   ├── index.html
│   └── login.js
└── grados/               ← nuevo (módulo de aprobación de grados)
    ├── shared/
    │   ├── ceremoniaService.js
    │   ├── solicitudService.js
    │   └── pdfConstancia.js
    ├── secretaria/       (vista para sac@enap.edu.co)
    │   ├── index.html
    │   └── ceremonias.js
    └── radicacion/       (vista pública/estudiante)
        ├── index.html
        └── solicitud.js
```

## Antes de que funcione: 2 cosas por configurar

1. **`shared/spConfig.js`** → cambia `TUTENANT.sharepoint.com:/sites/PortalENAP`
   por la URL real de tu sitio de SharePoint.

2. **Azure AD (Entra ID)** → la app registrada con el Client ID
   `be68b5b7-e7eb-45e2-98f4-e5ffd8888ce6` debe tener permisos delegados de
   Microsoft Graph `User.Read` y `Sites.ReadWrite.All`, con consentimiento
   de administrador otorgado.

3. **Listas de SharePoint que debe existir en tu sitio**, con estas columnas:
   - `ENAP_Permisos_Usuarios`: `Title` (correo), `Rol`, `Estado`
   - `ENAP_Ceremonias`: `Title` (nombre), `FechaCeremonia`, `InicioRecepcion`, `CierreRecepcion`, `Estado`
   - `ENAP_HistorialCeremonias`: `Title`, `CeremoniaId`, `Accion`, `UsuarioResponsable`, `FechaCambio`, `Detalle`
   - `ENAP_Solicitudes`: `Title` (radicado), `CeremoniaId`, `NombreCompleto`, `Documento`, `Correo`, `Telefono`, `Programa`, `AceptaTratamientoDatos`, `FirmaNombre`, `FechaAceptacion`, `Estado`, `FechaRadicacion`

## Cómo probarlo

Abre `login-admin/index.html` en el navegador (o súbelo a GitHub Pages / tu
hosting actual). Al iniciar sesión con una cuenta con rol `SAC` o `ADMIN`, te
lleva a `grados/secretaria/`. La vista de estudiante está en
`grados/radicacion/index.html`.
