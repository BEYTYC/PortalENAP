/**
 * Balance Académico · ENAP — Google Apps Script (aplicación web independiente)
 *
 * Guardado: SIEMPRE en OneDrive (Microsoft Graph, credenciales de aplicación).
 * Identidad: la persona inicia sesión en Microsoft en el Portal; la pantalla entrega su token y este servidor
 *            lo valida con Graph (/me) y consulta sus roles con el mismo endpoint /api/roles del Portal.
 * Plantillas: los Excel Balance_*.xlsm se leen del Portal (…/balances/) o, si no, de OneDrive.
 *
 * Propiedades de la secuencia de comandos (Configuración del proyecto): ver LEEME.md.
 * Ejecute `configurar()` una vez para verificar la conexión con OneDrive.
 */

var APP = 'Balance Académico · ENAP';
var GRAPH = 'https://graph.microsoft.com/v1.0';
var DOMINIO = 'enap.edu.co';
var CARPETA_DEFECTO = 'Balances Académicos ENAP';
var CLAVE_BALANCE = /^balance:[a-z0-9\-]+:\d{1,20}$/;
var ARCHIVO_PLANTILLA = /^Balance_[A-Za-z0-9_]+\.(xlsm|xltm|xlsx)$/;
var ROLES_PORTAL = { 'JEFE_PROGRAMA': 'jefe', 'DECANO': 'decano' };   // ADMIN puede ambos

/* ───────── entrada ───────── */

function doGet(e) {
  var t = HtmlService.createTemplateFromFile('Index');
  t.params = JSON.stringify((e && e.parameter) || {});
  return t.evaluate()
    .setTitle(APP)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);   // se incrusta en el Portal
}

/* ───────── configuración ───────── */

function prop_(k, defecto) {
  var v = PropertiesService.getScriptProperties().getProperty(k);
  return (v === null || v === '') ? (defecto === undefined ? '' : defecto) : v;
}
function requerida_(k) {
  var v = prop_(k);
  if (!v) throw new Error('Falta la propiedad ' + k + ' en la configuración del script (ver LEEME.md).');
  return v;
}

/** Ejecutar una vez desde el editor: comprueba credenciales, OneDrive y carpeta de balances. */
function configurar() {
  var t = tokenApp_();
  var d = graph_('get', rutaDrive_() + '?$select=id,name,webUrl', null, t);
  asegurarCarpeta_(t);
  Logger.log('OneDrive conectado: ' + (d.webUrl || d.name) + '\nCarpeta de balances: ' + carpetaBalances_() +
    '\nModo prueba (sin Portal): ' + (modoPrueba_() ? 'ACTIVO' : 'apagado') +
    '\nPlantillas: ' + (prop_('PORTAL_URL') ? prop_('PORTAL_URL').replace(/\/+$/, '') + '/balances/' : 'OneDrive ' + carpetaPlantillas_()));
}

function modoPrueba_() { return prop_('MODO_PRUEBA', 'true').toLowerCase() === 'true'; }
function carpetaBalances_() { return prop_('ONEDRIVE_CARPETA', CARPETA_DEFECTO).replace(/^\/+|\/+$/g, ''); }
function carpetaPlantillas_() { return prop_('ONEDRIVE_PLANTILLAS', carpetaBalances_() + '/Plantillas').replace(/^\/+|\/+$/g, ''); }

/** OneDrive donde se guarda: de una persona (ONEDRIVE_USUARIO) o una biblioteca (GRAPH_DRIVE_ID). */
function rutaDrive_() {
  var id = prop_('GRAPH_DRIVE_ID');
  if (id) return '/drives/' + encodeURIComponent(id);
  return '/users/' + encodeURIComponent(requerida_('ONEDRIVE_USUARIO')) + '/drive';
}
function rutaItem_(ruta) {
  return rutaDrive_() + '/root:/' + ruta.split('/').map(encodeURIComponent).join('/');
}

/* ───────── Microsoft Graph ───────── */

function tokenApp_() {
  var cache = CacheService.getScriptCache(), c = cache.get('graph_app_token');
  if (c) return c;
  var r = UrlFetchApp.fetch('https://login.microsoftonline.com/' + requerida_('GRAPH_TENANT_ID') + '/oauth2/v2.0/token', {
    method: 'post', muteHttpExceptions: true,
    payload: { client_id: requerida_('GRAPH_CLIENT_ID'), client_secret: requerida_('GRAPH_CLIENT_SECRET'),
               scope: 'https://graph.microsoft.com/.default', grant_type: 'client_credentials' }
  });
  if (r.getResponseCode() !== 200) throw new Error('No se pudo autenticar con Microsoft Graph (' + r.getResponseCode() + ').');
  var d = JSON.parse(r.getContentText());
  cache.put('graph_app_token', d.access_token, Math.max(60, Math.min(d.expires_in - 120, 21000)));
  return d.access_token;
}

/** Llamada JSON a Graph. `cuerpo` es objeto (JSON) o ya texto con `tipo`. */
function graph_(metodo, ruta, cuerpo, token, opciones) {
  opciones = opciones || {};
  var o = { method: metodo, muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + token } };
  if (cuerpo !== null && cuerpo !== undefined) {
    o.payload = typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo);
    o.contentType = opciones.tipo || 'application/json';
  }
  var r = UrlFetchApp.fetch(GRAPH + ruta, o), c = r.getResponseCode();
  if (opciones.crudo && c < 300) return r;
  if (c === 404 && opciones.noExiste) return null;
  if (c >= 300) throw new Error('OneDrive respondió ' + c + ': ' + String(r.getContentText()).slice(0, 180));
  var t = r.getContentText();
  return t ? JSON.parse(t) : {};
}

function asegurarCarpeta_(token) {
  var partes = carpetaBalances_().split('/'), acumulado = '';
  partes.forEach(function (p) {
    var padre = acumulado ? rutaItem_(acumulado) + ':/children' : rutaDrive_() + '/root/children';
    acumulado = acumulado ? acumulado + '/' + p : p;
    var ya = graph_('get', rutaItem_(acumulado), null, token, { noExiste: true });
    if (!ya) graph_('post', padre, { name: p, folder: {}, '@microsoft.graph.conflictBehavior': 'fail' }, token);
  });
}

/* ───────── identidad y roles ───────── */

function sha_(t) {
  return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, t)).slice(0, 40);
}

/** Valida el token de Microsoft de la persona y devuelve {email, nombre, roles, prueba}. */
function sesionDe_(tokenUsuario) {
  if (!tokenUsuario) {
    if (modoPrueba_()) return { email: '', nombre: 'Modo prueba', roles: ['jefe', 'decano'], prueba: true };
    throw new Error('Abra el Balance Académico desde el Portal para iniciar sesión.');
  }
  var cache = CacheService.getScriptCache(), k = 'ses_' + sha_(tokenUsuario), hit = cache.get(k);
  if (hit) return JSON.parse(hit);
  var r = UrlFetchApp.fetch(GRAPH + '/me?$select=displayName,mail,userPrincipalName', { headers: { Authorization: 'Bearer ' + tokenUsuario }, muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) throw new Error('La sesión de Microsoft venció. Vuelva a abrir el Portal.');
  var p = JSON.parse(r.getContentText());
  var correo = String(p.mail || p.userPrincipalName || '').trim().toLowerCase();
  if (!correo || correo.slice(-(DOMINIO.length + 1)) !== '@' + DOMINIO) throw new Error('Solo cuentas institucionales @' + DOMINIO + '.');
  var rolesPortal = rolesPortal_(correo, tokenUsuario);
  var roles = [];
  if (rolesPortal.indexOf('ADMIN') >= 0) roles = ['jefe', 'decano'];
  Object.keys(ROLES_PORTAL).forEach(function (rp) { if (rolesPortal.indexOf(rp) >= 0 && roles.indexOf(ROLES_PORTAL[rp]) < 0) roles.push(ROLES_PORTAL[rp]); });
  var s = { email: correo, nombre: p.displayName || correo, roles: roles, prueba: false };
  cache.put(k, JSON.stringify(s), 300);
  return s;
}

/** Mismo endpoint que usa el Portal para saber el rol (lista ENAP_Permisos_Usuarios). */
function rolesPortal_(correo, tokenUsuario) {
  var base = prop_('PORTAL_URL').replace(/\/+$/, '');
  if (!base) throw new Error('Falta PORTAL_URL (dirección del Portal) para consultar los roles.');
  var r = UrlFetchApp.fetch(base + '/api/roles', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    payload: JSON.stringify({ correo: correo, accessToken: tokenUsuario })
  });
  if (r.getResponseCode() !== 200) throw new Error('No se pudieron consultar los roles (' + r.getResponseCode() + ').');
  return (JSON.parse(r.getContentText()).roles || []).map(function (x) { return String(x).toUpperCase(); });
}

function exigir_(token, permitidos) {
  var s = sesionDe_(token);
  if (!s.roles.some(function (r) { return permitidos.indexOf(r) >= 0; })) throw new Error('Su cuenta no tiene permiso para esta acción.');
  return s;
}

/** La pantalla lo llama al abrir. */
function infoSesion(token) { return sesionDe_(token); }

/* ───────── plantillas Excel ───────── */

/** Identifica el programa por las palabras del nombre (sin tildes, mayúsculas, guiones, “BALANCE”, “PARA”, “DE”, “EN” ni extensión). */
function claveArchivo_(nombre) {
  var base = String(nombre).replace(/\.[A-Za-z0-9]+$/, '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
  var vacias = { BALANCE: 1, PARA: 1, DE: 1, DEL: 1, EN: 1, LA: 1, Y: 1 };
  return base.split(' ').filter(function (w) { return w && !vacias[w]; }).sort().join(' ');
}

/** Excel del programa en base64 (la pantalla lo lee con SheetJS). Los Excel siguen siendo la fuente de verdad. */
function plantilla(token, archivo) {
  exigir_(token, ['jefe', 'decano']);
  if (!ARCHIVO_PLANTILLA.test(String(archivo))) throw new Error('Nombre de plantilla no válido.');
  var base = prop_('PORTAL_URL').replace(/\/+$/, '');
  var r, motivoPortal = '';
  if (base) {
    var url = base + '/balances/' + encodeURIComponent(archivo);
    try {
      r = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
      if (r.getResponseCode() === 200) return Utilities.base64Encode(r.getContent());
      motivoPortal = 'El Portal respondió ' + r.getResponseCode() + ' en ' + url;
    } catch (e) {
      motivoPortal = 'No se pudo conectar con ' + url + ' (' + e.message + ')';
    }
  }
  try {
    var t = tokenApp_();
    r = graph_('get', rutaItem_(carpetaPlantillas_() + '/' + archivo) + ':/content', null, t, { crudo: true });
    return Utilities.base64Encode(r.getContent());
  } catch (e2) {
    var t2 = null, vistos = '';
    try {
      t2 = tokenApp_();
      var hijos = graph_('get', rutaItem_(carpetaPlantillas_()) + ':/children?$select=name,id', null, t2, { noExiste: true });
      if (hijos && hijos.value) {
        var buscado = claveArchivo_(archivo);
        for (var i = 0; i < hijos.value.length; i++) {      // mismo programa aunque el nombre del archivo se escriba distinto
          if (claveArchivo_(hijos.value[i].name) === buscado) {
            return Utilities.base64Encode(graph_('get', rutaDrive_() + '/items/' + hijos.value[i].id + '/content', null, t2, { crudo: true }).getContent());
          }
        }
        vistos = 'La carpeta existe y contiene ' + hijos.value.length + ' archivo(s): ' +
          hijos.value.slice(0, 20).map(function (x) { return x.name; }).join(', ') + '.';
      } else {
        var raiz = graph_('get', rutaDrive_() + '/root/children?$select=name&$top=50', null, t2, { noExiste: true });
        vistos = 'La carpeta “' + carpetaPlantillas_() + '” NO existe en el OneDrive de ' + (prop_('ONEDRIVE_USUARIO') || prop_('GRAPH_DRIVE_ID')) +
          '. En la raíz de ese OneDrive hay: ' + (raiz && raiz.value ? raiz.value.map(function (x) { return x.name; }).join(', ') : '(no se pudo listar)') + '.';
      }
    } catch (e3) { vistos = 'No se pudo explorar OneDrive: ' + e3.message; }
    throw new Error('No se pudo leer ' + archivo + '. ' +
      (motivoPortal ? motivoPortal + '. ' : 'PORTAL_URL no está configurada. ') +
      'En OneDrive (' + carpetaPlantillas_() + ') tampoco: ' + e2.message + ' ' + vistos);
  }
}

/* ───────── balances en OneDrive ───────── */

function nombreArchivo_(key) { return key.replace(/:/g, '_') + '.json'; }
function validarClave_(key) { if (!CLAVE_BALANCE.test(String(key))) throw new Error('Identificador de balance no válido.'); }
function rutaBalance_(key) { return carpetaBalances_() + '/' + nombreArchivo_(key); }
function rutaIndice_() { return carpetaBalances_() + '/_indice.json'; }

function leerIndice_(t) {
  var r = graph_('get', rutaItem_(rutaIndice_()) + ':/content', null, t, { crudo: true, noExiste: true });
  if (!r) return {};
  try { return JSON.parse(r.getContentText()) || {}; } catch (e) { return {}; }
}
function escribirIndice_(idx, t) {
  graph_('put', rutaItem_(rutaIndice_()) + ':/content', JSON.stringify(idx), t, { tipo: 'application/json' });
}

/** Crea o reemplaza el balance. Las imágenes de firma nunca se guardan. */
function guardarBalance(token, key, json, resumen) {
  var s = exigir_(token, ['jefe', 'decano']);
  validarClave_(key);
  var obj = JSON.parse(json); delete obj.firmasImg; delete obj.firmasDim;
  var contenido = JSON.stringify(obj);
  if (contenido.length > 3.5 * 1024 * 1024) throw new Error('El balance es demasiado grande para guardarlo.');
  var res = JSON.parse(resumen || '{}'); res.key = key; res.actualizado = new Date().toISOString(); res.por = s.email || s.nombre;
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var t = tokenApp_();
    asegurarCarpeta_(t);
    graph_('put', rutaItem_(rutaBalance_(key)) + ':/content', contenido, t, { tipo: 'application/json' });
    var idx = leerIndice_(t); idx[key] = res; escribirIndice_(idx, t);
  } finally { lock.releaseLock(); }
  return true;
}

function cargarBalance(token, key) {
  exigir_(token, ['jefe', 'decano']);
  validarClave_(key);
  var r = graph_('get', rutaItem_(rutaBalance_(key)) + ':/content', null, tokenApp_(), { crudo: true, noExiste: true });
  if (!r) throw new Error('No se encontró el balance en OneDrive.');
  return r.getContentText();
}

function listarBalances(token) {
  exigir_(token, ['jefe', 'decano']);
  var idx = leerIndice_(tokenApp_());
  return Object.keys(idx).map(function (k) { return idx[k]; })
    .sort(function (a, b) { return String(b.actualizado).localeCompare(String(a.actualizado)); }).slice(0, 300);
}

/** Solo el Jefe de Programa elimina. */
function eliminarBalance(token, key) {
  exigir_(token, ['jefe']);
  validarClave_(key);
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var t = tokenApp_();
    graph_('delete', rutaItem_(rutaBalance_(key)), null, t, { noExiste: true });
    var idx = leerIndice_(t); delete idx[key]; escribirIndice_(idx, t);
  } finally { lock.releaseLock(); }
  return true;
}
