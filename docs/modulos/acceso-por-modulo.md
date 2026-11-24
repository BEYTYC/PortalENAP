# Acceso por módulo (Administración de usuarios)

- En «Administración de usuarios», tarjeta «Agregar / editar usuario»: se escribe el correo, se marcan los módulos que se le habilitan y se guarda. El rol es opcional («Sin rol»).
- Los módulos marcados se SUMAN al rol; nadie pierde lo que ya tenía. Las descargas de Excel siguen controladas aparte.
- Se guardan en SharePoint (`Accesos/accesos-modulos.json`), nunca en el repositorio. Endpoint: `api/accesos-modulos.js` (solo ADMIN puede listar y guardar; verificado en el servidor con el token).
- `api/roles.js` devuelve también `modulos`; el menú del Portal desbloquea esos módulos.
- Verificación en servidor: Registro de bajas y Antigüedades ENAP (entra como CONSULTA). Los módulos de Apps Script (Concesiones, Certificados, Grados, Balances) validan por su cuenta: aquí solo se desbloquea el menú; si el script exige el correo en su propia lista, hay que agregarlo allí (pedir el código a la autora).
- Catálogo de módulos: constante `MODULOS` en `api/accesos-modulos.js` (mismos nombres que el menú).
