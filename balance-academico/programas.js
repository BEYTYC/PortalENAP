/* Programas con plantilla de Balance Académico.
   Los Excel viven en ../balances/ y siguen siendo la fuente de verdad (el portal también los enlaza). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BalanceProgramas = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* Programas en los que el módulo está habilitado por ahora. Los demás tienen su plantilla leída y probada,
     pero no se ofrecen hasta que se decida abrirlos (basta agregar su id aquí). */
  var ACTIVOS = ['esp-logistica', 'mae-logistica'];

  var LISTA = [
    { id: 'administracion',        archivo: 'Balance_Administracion.xlsm',                              nombre: 'Administración',                                      nivel: 'pregrado',  alias: ['Administración'] },
    { id: 'administracion-maritima', archivo: 'Balance_Administracion_Maritima.xlsm',                   nombre: 'Administración Marítima',                             nivel: 'pregrado',  alias: ['Administración Marítima'] },
    { id: 'cn-maquinas',           archivo: 'Balance_Ciencias_Nauticas_Maquinas.xlsm',                  nombre: 'Ciencias Náuticas para Oficiales Mercantes de Máquinas', nivel: 'pregrado', alias: ['Ciencias Náuticas Mercantes de Máquinas', 'Ciencias Náuticas para Oficiales Mercantes de Máquinas'] },
    { id: 'cn-puente',             archivo: 'Balance_Ciencias_Nauticas_Puente.xlsm',                    nombre: 'Ciencias Náuticas para Oficiales Mercantes de Puente',   nivel: 'pregrado', alias: ['Ciencias Náuticas Oficiales Mercantes', 'Ciencias Náuticas para Oficiales Mercantes de Puente'] },
    { id: 'cn-infanteria',         archivo: 'Balance_Ciencias_Navales_Oficiales_Infanteria_Marina.xlsm', nombre: 'Ciencias Navales para Oficiales de Infantería de Marina', nivel: 'pregrado', alias: ['Ciencias Navales Infantería de Marina', 'Ciencias Navales para Oficiales de Infantería de Marina'] },
    { id: 'cn-navales',            archivo: 'Balance_Ciencias_Navales_Oficiales_Navales.xlsm',          nombre: 'Ciencias Navales para Oficiales Navales',                nivel: 'pregrado', alias: ['Ciencias Navales Oficiales Navales', 'Ciencias Navales para Oficiales Navales'] },
    { id: 'esp-logistica',         archivo: 'Balance_Especializacion_Gestion_Logistica.xlsm',           nombre: 'Especialización en Gestión Logística',                   nivel: 'posgrado', alias: ['Especialización en Logística', 'Especialización en Gestión Logística'] },
    { id: 'ing-electronica',       archivo: 'Balance_Ingenieria_Electronica.xlsm',                      nombre: 'Ingeniería Electrónica',                                 nivel: 'pregrado', alias: ['Ingeniería Electrónica'] },
    { id: 'ing-naval',             archivo: 'Balance_Ingenieria_Naval.xlsm',                            nombre: 'Ingeniería Naval',                                       nivel: 'pregrado', alias: ['Ingeniería Naval'] },
    { id: 'mae-logistica',         archivo: 'Balance_Maestria_Gestion_Logistica.xlsm',                  nombre: 'Maestría en Gestión Logística',                          nivel: 'posgrado', alias: ['Maestría en Gestión Logística'] },
    { id: 'mae-ing-naval',         archivo: 'Balance_Maestria_Ingenieria_Naval.xltm',                   nombre: 'Maestría en Ingeniería Naval',                           nivel: 'posgrado', alias: ['Maestría en Ingeniería Naval'] },
    { id: 'mae-oceanografia',      archivo: 'Balance_Maestria_Oceanografia.xlsm',                       nombre: 'Maestría en Oceanografía',                               nivel: 'posgrado', alias: ['Maestría en Oceanografía'] },
    { id: 'oceanografia-fisica',   archivo: 'Balance_Oceanografia_Fisica.xlsm',                         nombre: 'Oceanografía Física',                                    nivel: 'pregrado', alias: ['Oceanografía Física'] }
  ];

  /* Siguen cargando el balance a mano (no se genera aquí). */
  var MANUALES = [
    'Especialización en Política y Estrategia Marítima',
    'Doctorado en Ciencias del Mar'
  ];

  function norm(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
  }
  function porId(id) { return LISTA.filter(function (p) { return p.id === id; })[0] || null; }
  function porNombre(n) {
    var x = norm(n);
    if (!x) return null;
    for (var i = 0; i < LISTA.length; i++) {
      if (norm(LISTA[i].nombre) === x) return LISTA[i];
      for (var j = 0; j < LISTA[i].alias.length; j++) if (norm(LISTA[i].alias[j]) === x) return LISTA[i];
    }
    return null;
  }
  function activos() { return LISTA.filter(function (p) { return ACTIVOS.indexOf(p.id) >= 0; }); }
  function estaActivo(p) { return !!p && ACTIVOS.indexOf(p.id) >= 0; }
  function esManual(n) { var x = norm(n); return MANUALES.some(function (m) { return norm(m) === x; }); }

  return { lista: LISTA, activos: activos, estaActivo: estaActivo, manuales: MANUALES, porId: porId, porNombre: porNombre, esManual: esManual };
});
