/**
 * Balance Académico · ENAP — Google Apps Script (aplicación web independiente)
 *
 * Guardado: SIEMPRE en OneDrive (Microsoft Graph, credenciales de aplicación).
 * Identidad: aplicación independiente (sin Portal); el acceso lo controla el despliegue de Apps Script y,
 *            si se quiere, la propiedad USUARIOS_PERMITIDOS.
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
var ROLES_PORTAL = { 'JEFE_PROGRAMA': 'jefe' };   // la página es solo del Jefe de Programa (ADMIN también entra)

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
    '\nClave de acceso: ' + (prop_('CLAVE_ACCESO') ? 'configurada' : '(no configurada)') + '\nUsuarios permitidos: ' + (prop_('USUARIOS_PERMITIDOS', '') || '(cualquiera que abra la página)') +
    '\nPlantillas: ' + (prop_('PORTAL_URL') ? prop_('PORTAL_URL').replace(/\/+$/, '') + '/balances/' : 'OneDrive ' + carpetaPlantillas_()));
}

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
  var r, c, intento = 0;
  while (true) {                                 // reintenta fallas de red pasajeras (“Dirección no disponible”) y 429/5xx
    try { r = UrlFetchApp.fetch(GRAPH + ruta, o); c = r.getResponseCode(); }
    catch (err) { if (++intento >= 5) throw err; Utilities.sleep(700 * intento); continue; }
    if ((c === 429 || c >= 500) && ++intento < 5) { Utilities.sleep(900 * intento); continue; }
    break;
  }
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

/** Identidad y acceso.
 *  · Con la propiedad CLAVE_ACCESO la implementación puede ser de acceso “Cualquier persona” (así se ve dentro de la página
 *    del Portal también en celulares): la aplicación pide la clave y el servidor la verifica en CADA acción.
 *  · Sin esa propiedad se usa la cuenta de Google de quien abre la página (y USUARIOS_PERMITIDOS, si existe).
 *  El argumento `tokenUsuario` es la clave que escribió la persona. */
function requiereClave() { return !!prop_('CLAVE_ACCESO'); }
function iguales_(a, b) {
  a = String(a); b = String(b);
  var d = a.length === b.length ? 0 : 1, n = Math.max(a.length, b.length);
  for (var i = 0; i < n; i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0;
}
function sesionDe_(tokenUsuario) {
  var clave = prop_('CLAVE_ACCESO'), correo = '';
  try { correo = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase(); } catch (e) {}
  if (clave) {
    var cache = CacheService.getScriptCache(), fallos = Number(cache.get('fallos') || 0);
    if (fallos >= 40) throw new Error('Clave incorrecta: demasiados intentos. Espere 10 minutos.');
    if (!iguales_(tokenUsuario || '', clave)) {
      cache.put('fallos', String(fallos + 1), 600); Utilities.sleep(1200);
      throw new Error('Clave de acceso incorrecta.');
    }
    return { email: correo, nombre: correo || 'Jefe de Programa', roles: ['jefe'], prueba: false };
  }
  if (!correo) throw new Error('Falta configurar la propiedad CLAVE_ACCESO (la implementación es de acceso público y no hay cuenta de Google).');
  var permitidos = prop_('USUARIOS_PERMITIDOS', '').toLowerCase().split(/[,;\s]+/).filter(Boolean);
  if (permitidos.length && permitidos.indexOf(correo) < 0) throw new Error('Su cuenta no tiene permiso para usar el Balance Académico.');
  return { email: correo, nombre: correo, roles: ['jefe'], prueba: false };
}

function exigir_(token, permitidos) {
  var s = sesionDe_(token);
  if (!s.roles.some(function (r) { return permitidos.indexOf(r) >= 0; })) throw new Error('Su cuenta no tiene permiso para esta acción.');
  return s;
}

/** Nombre del Decano de Facultad: es el mismo para todos los balances, se guarda en el servidor. */
function obtenerDecano(token) {
  exigir_(token, ['jefe']);
  return prop_('DECANO_NOMBRE', '');
}
function guardarDecano(token, nombre) {
  exigir_(token, ['jefe']);
  var n = String(nombre || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  PropertiesService.getScriptProperties().setProperty('DECANO_NOMBRE', n);
  return n;
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
  exigir_(token, ['jefe']);
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
  var s = exigir_(token, ['jefe']);
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
  exigir_(token, ['jefe']);
  validarClave_(key);
  var r = graph_('get', rutaItem_(rutaBalance_(key)) + ':/content', null, tokenApp_(), { crudo: true, noExiste: true });
  if (!r) throw new Error('No se encontró el balance en OneDrive.');
  return r.getContentText();
}

function listarBalances(token) {
  exigir_(token, ['jefe']);
  var idx = leerIndice_(tokenApp_());
  return Object.keys(idx).map(function (k) { return idx[k]; })
    .sort(function (a, b) { return String(b.actualizado).localeCompare(String(a.actualizado)); }).slice(0, 300);
}

/* ───── Reformas de pénsum (versiones del pénsum creadas por el Jefe de Programa) ───── */
function rutaPensums_() { return carpetaBalances_() + '/_pensums.json'; }
function leerPensums_(t) {
  var r = graph_('get', rutaItem_(rutaPensums_()) + ':/content', null, t, { crudo: true, noExiste: true });
  if (!r) return {};
  try { return JSON.parse(r.getContentText()) || {}; } catch (e) { return {}; }
}
function listarPensums(token) {
  exigir_(token, ['jefe']);
  var o = leerPensums_(tokenApp_());
  return Object.keys(o).map(function (k) { return o[k]; });
}
function limpiarPensum_(p) {
  var txt = function (v, n) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n || 200); };
  var num = function (v) { var n = Number(v); return isFinite(n) && n >= 0 ? n : 0; };
  if (!/^[a-z0-9-]{3,80}$/.test(String(p.id))) throw new Error('Identificador de pénsum no válido.');
  if (!txt(p.programaId, 60) || !txt(p.nombre, 80)) throw new Error('Faltan el programa o el nombre de la reforma.');
  if (!Array.isArray(p.items) || !p.items.length || p.items.length > 250) throw new Error('El pénsum debe tener entre 1 y 250 filas.');
  return {
    id: String(p.id), programaId: txt(p.programaId, 60), nombre: txt(p.nombre, 80),
    items: p.items.map(function (it) {
      var k = it.kind === 'bloque' ? 'bloque' : (it.kind === 'slot' ? 'slot' : 'mat');
      var o = { kind: k, id: txt(it.id, 60), area: txt(it.area, 120) };
      if (k === 'bloque') { o.label = txt(it.label, 160); o.req = num(it.req); }
      else { o.cod = k === 'mat' ? txt(it.cod, 30) : ''; o.nombre = txt(it.nombre, 200); o.cred = num(it.cred); }
      return o;
    })
  };
}
function guardarPensum(token, json) {
  var s = exigir_(token, ['jefe']);
  var p = limpiarPensum_(JSON.parse(json));
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var t = tokenApp_();
    asegurarCarpeta_(t);
    var o = leerPensums_(t);
    p.actualizado = new Date().toISOString(); p.por = s.email || s.nombre || '';
    if (o[p.id] && o[p.id].creado) p.creado = o[p.id].creado; else p.creado = p.actualizado;
    o[p.id] = p;
    graph_('put', rutaItem_(rutaPensums_()) + ':/content', JSON.stringify(o), t, { tipo: 'application/json' });
  } finally { lock.releaseLock(); }
  return p;
}
function eliminarPensum(token, id) {
  exigir_(token, ['jefe']);
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var t = tokenApp_(), o = leerPensums_(t);
    delete o[String(id)];
    graph_('put', rutaItem_(rutaPensums_()) + ':/content', JSON.stringify(o), t, { tipo: 'application/json' });
  } finally { lock.releaseLock(); }
  return true;
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
