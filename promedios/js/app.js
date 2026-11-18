/*!
 * Portal de Servicios Digitales Estadística — Escuela Naval de Cadetes "Almirante Padilla"
 * Autora y desarrolladora: CAMARGO MARTÍNEZ BEYTY PATRICIA — Oficina de Estadística
 * Derechos morales de autor reservados (Ley 23 de 1982, art. 30). Este aviso de autoría no debe eliminarse ni alterarse.
 */
(function () {
  'use strict';
  var N = window.PromediosNucleo, CERT = window.PromediosCertificado;
  var $ = function (i) { return document.getElementById(i); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var YO = null, AJ = null, FILAS = [], LOTE = null, CORREO = '', RESULT = [], PEND = 0, CORREOS = [], MAXLOTE = 10;

  /* ------------------------------ Servidor ------------------------------ */
  function tok() {
    var P = window.parent && window.parent !== window ? window.parent.PortalENAP : null;
    if (!P || !P.tokenMicrosoft) return Promise.reject(new Error('Este módulo se abre desde el Portal (Estadística › Generación de Promedios Académicos).'));
    return Promise.race([P.tokenMicrosoft(), new Promise(function (_, no) { setTimeout(function () { no(new Error('No se pudo obtener su sesión de Microsoft. Cierre sesión, vuelva a entrar y abra de nuevo el módulo.')); }, 25000); })]);
  }
  function api(accion, extra) {
    return tok().then(function (t) {
      return fetch('/api/promedios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ accessToken: t, accion: accion }, extra || {})) })
        .catch(function () { throw new Error('No se pudo conectar con el servidor (paso: ' + accion + '). Revise la conexión e intente de nuevo.'); })
        .then(function (r) { return r.text().then(function (tx) { var j = null; try { j = JSON.parse(tx); } catch (_) {} if (!r.ok || !j) { var e = new Error(j && j.error ? j.error : 'Error ' + r.status + ' del servidor.'); e.http = r.status; e.datos = j; throw e; } return j; }); });
    });
  }
  var MOTIVOS = ['Documento ilegible', 'Falta una cara de la cédula', 'El balance no corresponde al estudiante', 'Balance desactualizado', 'Datos de la cédula y del balance no coinciden'];
  function pedirMotivo(quien, ok) {
    var fondo = document.createElement('div'); fondo.className = 'modal-f';
    fondo.innerHTML = '<div class="modal" role="dialog" aria-modal="true"><div class="gold">Rechazar solicitud</div><h2 style="margin:4px 0 4px;font-size:17px">¿Por qué no se genera el certificado?</h2>' +
      (quien ? '<div style="font-size:12.5px;color:#566370;margin-bottom:12px"><b style="color:#0a2540">' + esc(quien) + '</b></div>' : '') +
      '<div class="lbl">Motivo (se le informa al jefe de programa)</div><textarea class="inp" id="mmot" rows="3" maxlength="300" placeholder="Escriba el motivo o elija uno" style="resize:vertical"></textarea>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">' + MOTIVOS.map(function (x) { return '<button type="button" class="tab" data-mot="' + esc(x) + '">' + esc(x) + '</button>'; }).join('') + '</div>' +
      '<label style="display:flex;align-items:center;gap:8px;margin-top:14px;font-size:12.5px;color:#334155;cursor:pointer"><input type="checkbox" id="mav" checked style="width:16px;height:16px;accent-color:#0b3d66"> Avisar por correo al jefe de programa</label>' +
      '<div style="display:flex;justify-content:flex-end;gap:10px;margin-top:18px"><button type="button" class="btn sec" id="mno">Cancelar</button><button type="button" class="btn" id="msi">Rechazar</button></div></div>';
    document.body.appendChild(fondo);
    var ta = fondo.querySelector('#mmot'); setTimeout(function () { ta.focus(); }, 30);
    function cerrar() { fondo.remove(); document.removeEventListener('keydown', tecla); }
    function tecla(e) { if (e.key === 'Escape') cerrar(); }
    document.addEventListener('keydown', tecla);
    fondo.querySelectorAll('[data-mot]').forEach(function (b) { b.onclick = function () { ta.value = b.dataset.mot; ta.focus(); }; });
    fondo.querySelector('#mno').onclick = cerrar; fondo.onclick = function (e) { if (e.target === fondo) cerrar(); };
    fondo.querySelector('#msi').onclick = function () { var m = ta.value.trim(), av = fondo.querySelector('#mav').checked; cerrar(); ok(m, av); };
  }
  function toast(m) { var t = $('toast'); t.textContent = m; t.classList.add('on'); clearTimeout(t._t); t._t = setTimeout(function () { t.classList.remove('on'); }, 3200); }
  function gate(on, msg) { $('gate').hidden = !on; if (msg) $('gt').textContent = msg; $('card').hidden = on; }
  var CENTRAR = false;
  function vista(html, animar) { document.body.classList.toggle('centrado', CENTRAR); CENTRAR = false; $('vista').innerHTML = html; $('card').hidden = false; $('card').style.animation = 'none'; if (animar !== false) { void $('card').offsetWidth; $('card').style.animation = ''; } }
  function ancho(px) { $('card').style.maxWidth = px + 'px'; }

  /* ------------------------------ Iconos ------------------------------ */
  var IC = {
    doc: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></svg>',
    lista: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>',
    ojo: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    eng: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    clip: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="flex:none"><path d="M21 12.5l-8.6 8.6a5.5 5.5 0 0 1-7.8-7.8l9-9a3.7 3.7 0 0 1 5.2 5.2l-9 9a1.8 1.8 0 0 1-2.6-2.6l8.3-8.3"/></svg>',
    check: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>'
  };
  function volver() { return '<button class="btn sec" id="bvolver">Volver</button>'; }
  function cab(eyebrow, titulo, sub) { return '<div class="gold">' + eyebrow + '</div><h2>' + titulo + '</h2>' + (sub ? '<p class="sub">' + sub + '</p>' : ''); }

  /* ------------------------------ Inicio ------------------------------ */
  function inicio() {
    CENTRAR = true;
    ancho(1000);
    var rev = PEND ? '<span class="cnt">' + PEND + '</span>' : '';
    vista('<div style="text-align:center"><div class="gold">Oficina de Estadística</div><h1>Generación de Promedios Académicos</h1><div class="rule"></div><p class="sub" style="margin-top:16px;font-size:14.5px">¿Qué desea hacer?</p></div>' +
      '<div class="ops"><button class="op" data-go="carga"><div class="ib">' + IC.doc + '</div><b>Generar certificados de promedio</b><span>Cargue la cédula y el balance académico de uno o varios estudiantes.</span></button>' +
      '<button class="op" data-go="consulta"><div class="ib">' + IC.lista + '</div><b>Consultar promedios generados</b><span>Revise los certificados emitidos. Una corrección solo la hace la Oficina de Estadística.</span></button>' +
      (YO.estadistica ? '<button class="op" data-go="revision"><div class="ib">' + IC.ojo + rev + '</div><b>Revisión de escaneados</b><span>Verifique los datos leídos de los documentos escaneados antes de emitir.</span></button>' +
        '<button class="op" data-go="ajustes"><div class="ib">' + IC.eng + '</div><b>Ajustes</b><span>Firmante del certificado, programas, siglas y facultades, y usuarios.</span></button>' : '') + '</div>');
    document.querySelectorAll('[data-go]').forEach(function (b) { b.onclick = function () { ir(b.dataset.go); }; });
  }
  function ir(v) { ({ inicio: inicio, carga: carga, consulta: consulta, revision: revision, ajustes: ajustes })[v](); }
  function pendientes() { if (!YO.estadistica) return Promise.resolve(); return api('revision-lista').then(function (r) { PEND = r.lista.length; }).catch(function () {}); }

  /* ------------------------------ Carga ------------------------------ */
  function nuevaFila() { return { ced: [], bal: null }; }
  function nombresArchivos(a) { return a.map(function (f) { return f.name; }).join(', '); }
  function carga() {
    ancho(1100); if (!FILAS.length) FILAS = [nuevaFila()];
    var ro = YO.estadistica ? '' : ' readonly';
    var filas = FILAS.map(function (f, i) {
      var c = f.ced.length ? '<div class="slot lleno" data-slot="c' + i + '">' + IC.clip + '<div><div class="nm">' + esc(nombresArchivos(f.ced)) + '</div><small>Cédula · ' + (f.ced.length > 1 ? f.ced.length + ' archivos' : 'frente y reverso') + '</small></div></div>' :
        '<div class="slot" data-slot="c' + i + '">' + IC.clip + '<div><div class="nm">Cédula</div><small>Ambas caras. PDF o imagen (puede elegir dos archivos).</small></div></div>';
      var b = f.bal ? '<div class="slot lleno" data-slot="b' + i + '">' + IC.clip + '<div><div class="nm">' + esc(f.bal.name) + '</div><small>Balance académico</small></div></div>' :
        '<div class="slot" data-slot="b' + i + '">' + IC.clip + '<div><div class="nm">Balance académico</div><small>PDF digital o escaneado, o imagen.</small></div></div>';
      return '<div class="fila"><div class="n">' + (i + 1) + '</div>' + c + b + '<button class="x" data-q="' + i + '" title="Quitar" aria-label="Quitar fila">&times;</button></div>';
    }).join('');
    var completas = FILAS.filter(function (f) { return f.ced.length && f.bal; }).length;
    vista(cab('Generar certificados de promedio', 'Cargue los documentos de cada estudiante', '') +
      '<div style="margin-top:14px;display:' + (YO.estadistica ? 'flex' : 'none') + ';align-items:center;gap:14px;padding:0;background:transparent;border:0;flex-wrap:wrap"><div class="lbl" style="margin:0">Enviar el correo a</div><input class="inp" id="correo" type="email" autocomplete="off" value="' + esc(CORREO) + '" placeholder="jefe.de.programa@enap.edu.co" style="flex:1;min-width:220px"' + ro + '>' + '' + '</div>' +
      '<div style="margin-top:10px;overflow:auto;min-height:0">' + filas + '</div>' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:16px;flex-wrap:wrap;gap:10px"><div style="display:flex;gap:10px"><button class="btn sec" id="bmas"' + (FILAS.length >= MAXLOTE ? ' disabled title="Máximo ' + MAXLOTE + ' estudiantes por lote"' : '') + '>+ Agregar estudiante</button>' + volver() + '</div><div style="display:flex;align-items:center;gap:16px"><span style="font-size:13px;color:#566370">' + completas + ' de ' + FILAS.length + ' filas completas (máximo ' + MAXLOTE + ' por lote)</span><button class="btn" id="bgen"' + (completas ? '' : ' disabled') + '>Generar certificados</button></div></div>' +
      '<input type="file" id="fin" hidden>');
    /* autocompletado: mientras ella escribe, el correo usado antes que empieza igual se va rellenando (lo que sobra queda seleccionado: sigue escribiendo o Enter/Tab para aceptar) */
    var ce = $('correo'); if (ce && YO.estadistica) ce.addEventListener('input', function (e) {
      if (e.inputType && e.inputType.indexOf('delete') === 0) return;
      var v = ce.value, ini = ce.selectionStart; if (!v || ini !== v.length) return;
      var m = CORREOS.filter(function (c) { return c.toLowerCase().indexOf(v.toLowerCase()) === 0 && c.length > v.length; })[0];
      if (m) { ce.value = v + m.slice(v.length); ce.setSelectionRange(v.length, m.length); }
    });
    $('bvolver').onclick = inicio; $('bmas').onclick = function () { guardarCorreo(); if (FILAS.length >= MAXLOTE) { toast('Cada lote admite máximo ' + MAXLOTE + ' estudiantes. Cargue los demás en otro lote.'); return; } FILAS.push(nuevaFila()); carga(); };
    document.querySelectorAll('[data-q]').forEach(function (b) { b.onclick = function () { guardarCorreo(); FILAS.splice(+b.dataset.q, 1); carga(); }; });
    document.querySelectorAll('[data-slot]').forEach(function (s) {
      var tipo = s.dataset.slot[0], i = +s.dataset.slot.slice(1);
      function recibir(files) { files = Array.prototype.slice.call(files || []); if (!files.length) return; guardarCorreo(); if (tipo === 'c') FILAS[i].ced = files.slice(0, 2); else FILAS[i].bal = files[0]; carga(); }
      s.onclick = function () { var inp = $('fin'); inp.accept = '.pdf,image/*'; inp.multiple = tipo === 'c'; inp.value = ''; inp.onchange = function () { recibir(inp.files); }; inp.click(); };
      s.ondragover = function (e) { e.preventDefault(); s.classList.add('sobre'); }; s.ondragleave = function () { s.classList.remove('sobre'); };
      s.ondrop = function (e) { e.preventDefault(); s.classList.remove('sobre'); recibir(e.dataTransfer.files); };
    });
    $('bgen').onclick = function () {
      guardarCorreo();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(CORREO)) { toast('Escriba el correo del jefe de programa.'); $('correo').focus(); return; }
      generar();
    };
  }
  function guardarCorreo() { var c = $('correo'); if (c) CORREO = c.value.trim().toLowerCase(); }

  /* ------------------------------ Análisis de un estudiante ------------------------------ */
  function listaProgramas() {
    return AJ.programas.map(function (p) { var base = N.PROGRAMAS.filter(function (b) { return b.id === p.id; })[0]; return Object.assign({ alias: base ? base.alias : [] }, p); });
  }
  var aISO = function (d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  var deISO = function (s) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(); };
  var titulo = function (s) { return String(s || '').toLowerCase().replace(/(^|\s)(\S)/g, function (_, a, b) { return a + b.toUpperCase(); }); };

  /* Devuelve { tipo:'emitir'|'revision'|'error', ... datos } */
  /* Facultad del jefe de programa que carga (o, si carga Estadística, la del correo de destino): el programa del balance se busca entre los de esa facultad. */
  function facultadDelJefe() {
    if (!YO.estadistica) return YO.facultad || '';
    var u = (AJ.usuarios || []).filter(function (x) { return String(x.correo).toLowerCase() === String(CORREO || '').toLowerCase(); })[0];
    return (u && u.facultad) || ((YO.facultades || {})[String(CORREO || '').toLowerCase()]) || '';
  }
  function analizar(ced, bal) {
    var pb = N.parseBalance(bal.texto), pc = N.parseCedula(ced.texto), escaneado = !!(ced.escaneado || bal.escaneado);
    var motivos = [], lp = listaProgramas(), fac = facultadDelJefe(), prog = (fac && N.programaEnFacultad(pb.programaTexto, lp, fac)) || N.programaDe(pb.programaTexto, lp);
    var d = { cedula: pc.numero || pc.numeroLinea || '', lugar: '', programaId: prog ? prog.id : '', programa: prog ? prog.nombre : N.limpiarPrograma(pb.programaTexto), sigla: prog ? prog.sigla : '', nivel: prog ? prog.nivel : 'pregrado', facultad: prog ? prog.facultad : '',
      promedio: pb.promedioImpreso != null ? pb.promedioImpreso : pb.promedioCalculado, periodoTerminacion: pb.periodoTerminacion, diplomado: pb.diplomado, fechaBalance: pb.fechaElaboracion ? aISO(pb.fechaElaboracion) : '', apellidos: '', nombres: '' };
    var rep = pb.nombreCompleto ? N.repartirNombre(pb.nombreCompleto, pc.apellidos, pc.nombres) : null;
    if (rep) { d.apellidos = rep.apellidos; d.nombres = rep.nombres; }
    var nombre = (d.apellidos + ' ' + d.nombres).trim() || N.mayus(pb.nombreCompleto) || '(sin nombre leído)';
    var salida = { datos: d, nombre: nombre, escaneado: escaneado, caras: pc.cara };

    /* Vigencia: si hay periodo leído y el balance está vencido, no se genera */
    var vig = d.periodoTerminacion ? N.vigencia({ nivel: d.nivel, terminacion: d.periodoTerminacion, diplomado: d.diplomado, hoy: new Date() }) : { estado: 'sin-dato' };
    if (vig.estado === 'vencido') { salida.tipo = 'error'; salida.chip = 'Balance desactualizado'; salida.nota = d.diplomado ? 'El Diplomado de Actualización se realizó en ' + d.diplomado + '; por tanto, a hoy el balance está vencido (venció en ' + vig.limite + '). No se genera.' : 'Terminó en ' + d.periodoTerminacion + ' y no registra Diplomado de Actualización vigente. No se genera.'; return salida; }
    d.estadoVigencia = vig.estado === 'actualizado' ? 'actualizado' : 'vigente';

    /* Cédula: ambas caras (sin cara confirmada en un digital → se bloquea; en un escaneado lo decide una persona) */
    var ambas = pc.cara.frente && pc.cara.reverso;
    if (!ambas && !escaneado) { salida.tipo = 'error'; salida.chip = 'Cédula incompleta'; salida.nota = 'Solo se ve una cara de la cédula. Cargue frente y reverso.'; return salida; }
    if (!ambas) motivos.push('No se confirmó que la cédula tenga las dos caras.');

    /* Datos esenciales */
    var faltan = [];
    if (!d.cedula) faltan.push('cédula'); if (!d.apellidos) faltan.push('nombre'); if (d.promedio == null) faltan.push('promedio'); if (!d.periodoTerminacion) faltan.push('periodo de terminación'); if (!d.fechaBalance) faltan.push('fecha de elaboración');
    if (!prog) faltan.push('programa'); else { if (!prog.facultad) faltan.push('facultad de ' + prog.sigla + ' (complétela en Ajustes)'); }
    if (faltan.length) { salida.tipo = 'revision'; salida.manual = true; salida.chip = 'Estadística validará'; salida.nota = ''; salida.motivo = 'No se identificó: ' + faltan.join(', ') + '.'; return salida; }

    /* Controles cruzados: solo si todos pasan se emite sin revisión humana */
    var ok = true;
    var calcOk = pb.promedioCalculado != null && Math.abs(pb.promedioCalculado - pb.promedioImpreso) < 0.0005 && (pb.creditosImpresos == null || pb.creditosImpresos === pb.creditosCalculados);
    if (pb.promedioImpreso == null) { motivos.push('No se leyó el promedio impreso.'); ok = false; }
    else if (pb.promedioCalculado == null) { if (escaneado) { motivos.push('No se pudo recalcular el promedio con las materias.'); ok = false; } }
    else if (!calcOk) { motivos.push('El promedio recalculado (' + pb.promedioCalculado.toFixed(3) + ') no coincide con el impreso (' + pb.promedioImpreso.toFixed(3) + ').'); ok = false; }
    /* El número sale de la cédula (lo más importante); si el número impreso no se lee pero la línea de lectura sí, se usa esa. */
    var num = /^\d{6,11}$/.test(pc.numero || '') ? pc.numero.replace(/^0+/, '') : '', lin = /^\d{6,11}$/.test(pc.numeroLinea || '') ? pc.numeroLinea.replace(/^0+/, '') : '';
    if (!num && lin) { d.cedula = lin; num = lin; }
    if (!num) { motivos.push('No se leyó con claridad el número de la cédula.'); ok = false; }
    else if (lin && lin !== num) { motivos.push('El número de la cédula no coincide con su línea de lectura.'); ok = false; }
    else if (!lin && escaneado) { motivos.push('No se pudo contrastar el número con la línea de lectura de la cédula.'); ok = false; }
    /* El nombre sale del balance. La cédula solo sirve para detectar un documento de otra persona: si se leyó su apellido y es claramente distinto, va a revisión. */
    if (!rep) { motivos.push('No se pudo separar el nombre del balance.'); ok = false; }
    else if (pc.apellidos && N.similitud(rep.apellidos, pc.apellidos) < 0.6) { motivos.push('El nombre del balance no coincide con el de la cédula.'); ok = false; }
    if (!(ambas)) ok = false;
    salida.tipo = ok ? 'emitir' : 'revision'; salida.motivo = motivos.join(' '); salida.chip = ok ? '' : 'En revisión de Estadística';
    salida.nota = ok ? '' : 'Estadística lo revisa antes de firmar y enviar.';
    return salida;
  }

  /* ------------------------------ PDF ------------------------------ */
  var IMG = {};
  function imagen(n, tipo) { if (IMG[n]) return Promise.resolve(IMG[n]); return fetch('assets/' + n).then(function (r) { return r.blob(); }).then(function (b) { return new Promise(function (ok) { var fr = new FileReader(); fr.onload = function () { IMG[n] = fr.result; ok(fr.result); }; fr.readAsDataURL(b); }); }); }
  function pdfDe(d, codigo) {
    return Promise.all([imagen('escudo-cert.png'), imagen('marca-cert.jpg'), AJ.firmante.firma ? Promise.resolve(AJ.firmante.firma) : imagen('firma-cert.png')]).then(function (im) {
      var doc = CERT.generar(window.jspdf.jsPDF, window.qrcode, { nombres: d.nombres, apellidos: d.apellidos, documento: d.cedula, lugar: '', programa: d.programa, promedio: d.promedio, periodo: d.periodoTerminacion,
        fechaBalance: deISO(d.fechaBalance), facultad: d.facultad, estado: d.estadoVigencia, diplomado: d.diplomado, fecha: new Date(), codigo: codigo, enlace: AJ.enlaceVerificacion, firmante: AJ.firmante, escudo: im[0], marca: im[1], firma: im[2] });
      var b64 = doc.output('datauristring').split(',')[1];
      /* PDF no editable: la página se convierte en una imagen de alta calidad y se arma un PDF solo con esa imagen (sin texto ni capas). */
      return window.Lector.pdfAImagen(b64, 3.5).then(function (jpg) {
        var plano = new window.jspdf.jsPDF({ unit: 'pt', format: 'letter', orientation: 'portrait', compress: true, encryption: { userPermissions: ['print'], ownerPassword: Math.random().toString(36).slice(2) + Date.now().toString(36) } });
        plano.setProperties({ title: 'Certificado de promedio - ' + N.mayus(d.nombres + ' ' + d.apellidos), creator: 'Portal de servicios digitales Estadística' });
        plano.addImage(jpg, 'JPEG', 0, 0, 612, 792, undefined, 'SLOW');
        return plano.output('datauristring').split(',')[1];
      }).catch(function (e) { throw new Error('No se pudo generar el certificado como imagen no editable. Recargue el Portal (Ctrl+F5) e intente de nuevo.'); });
    });
  }

  /* ------------------------------ Generar lote ------------------------------ */
  /* Sonido suave al terminar el lote (dos notas). El contexto se crea al pulsar para que el navegador lo permita. */
  var AUDIO = null;
  function prepararSonido() { try { var A = window.AudioContext || window.webkitAudioContext; if (A && !AUDIO) AUDIO = new A(); if (AUDIO && AUDIO.state === 'suspended') AUDIO.resume(); } catch (e) {} }
  function sonar() {
    try {
      if (!AUDIO) return; var t = AUDIO.currentTime;
      [[659.25, 0], [880, 0.16]].forEach(function (n) { var o = AUDIO.createOscillator(), g = AUDIO.createGain(); o.type = 'sine'; o.frequency.value = n[0]; g.gain.setValueAtTime(0.0001, t + n[1]); g.gain.exponentialRampToValueAtTime(0.18, t + n[1] + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + n[1] + 0.5); o.connect(g); g.connect(AUDIO.destination); o.start(t + n[1]); o.stop(t + n[1] + 0.55); });
    } catch (e) {}
  }
  function generar() {
    prepararSonido();
    if (YO.estadistica && CORREO && CORREOS.indexOf(CORREO) < 0) CORREOS.unshift(CORREO);
    var filas = FILAS.filter(function (f) { return f.ced.length && f.bal; }).slice(0, MAXLOTE); LOTE = 'L' + Date.now().toString(36); var correo = CORREO;
    RESULT = filas.map(function (f) { return { nombre: '(leyendo documentos…)', programa: '', promedio: null, estado: 'leyendo' }; }); resultado();
    var p = Promise.resolve();
    filas.forEach(function (f, i) {
      p = p.then(function () { return procesar(f, i, correo); }).catch(function (e) { RESULT[i] = Object.assign(RESULT[i], { estado: 'error', chip: 'No se pudo procesar', nota: e.message }); });
      p = p.then(function () { resultado(true); });
    });
    p.then(function () { return enviarLote(); }).then(function () { return api('avisar-lote', { loteId: LOTE }).catch(function () {}); }).then(function () { window.Lector.terminar(); FILAS = []; return pendientes(); }).then(function () { resultado(); sonar(); estadoCarga(); });
  }
  function leerFila(f, i) {
    var progreso = function (t) { RESULT[i].nota = t; resultado(true); };
    return Promise.all([f.ced.reduce(function (p, a) { return p.then(function (acc) { return window.Lector.leer(a, 'cedula', progreso).then(function (r) { acc.push(r); return acc; }); }); }, Promise.resolve([])), window.Lector.leer(f.bal, 'balance', progreso)]).then(function (x) {
      var c = x[0]; return { ced: { texto: c.map(function (r) { return r.texto; }).join('\n'), escaneado: c.some(function (r) { return r.escaneado; }), imagenes: [].concat.apply([], c.map(function (r) { return r.imagenes; })) }, bal: x[1] };
    });
  }
  /* Cédula y balance tal como se cargaron: se guardan junto al certificado (carpeta del estudiante en OneDrive). */
  function b64DeArchivo(file) { return file.arrayBuffer().then(function (buf) { var u8 = new Uint8Array(buf), t = '', k; for (k = 0; k < u8.length; k += 0x8000) t += String.fromCharCode.apply(null, u8.subarray(k, k + 0x8000)); return btoa(t); }); }
  function pdfDeImagenes(imgs) {
    return imgs.reduce(function (p, src) { return p.then(function (doc) { return new Promise(function (ok) { var im = new Image(); im.onload = function () { var w = im.width * 0.75, h = im.height * 0.75; if (!doc) doc = new window.jspdf.jsPDF({ unit: 'pt', format: [w, h], orientation: w > h ? 'l' : 'p', compress: true }); else doc.addPage([w, h], w > h ? 'l' : 'p'); doc.addImage(src, 'JPEG', 0, 0, w, h); ok(doc); }; im.onerror = function () { ok(doc); }; im.src = src; }); }); }, Promise.resolve(null)).then(function (doc) { return doc ? doc.output('datauristring').split(',')[1] : null; });
  }
  function original(archivos, imagenes) {
    var a0 = archivos[0], ext = a0 ? (a0.name.split('.').pop() || '').toLowerCase() : '';
    if (archivos.length === 1 && a0.size <= 3 * 1024 * 1024 && ['pdf', 'jpg', 'jpeg', 'png'].indexOf(ext) >= 0) return b64DeArchivo(a0).then(function (b) { return { ext: ext, b64: b }; });
    if (!imagenes || !imagenes.length) return Promise.resolve(null);
    return pdfDeImagenes(imagenes).then(function (b) { return b ? { ext: 'pdf', b64: b } : null; });
  }
  function guardarOriginales(codigo, f, lec) {
    return original(f.ced, lec.ced.imagenes).then(function (c) { return c ? api('guardar-original', { codigo: codigo, tipo: 'cedula', ext: c.ext, archivo: c.b64 }) : null; })
      .then(function () { return original([f.bal], lec.bal.imagenes); }).then(function (b) { return b ? api('guardar-original', { codigo: codigo, tipo: 'balance', ext: b.ext, archivo: b.b64 }) : null; })
      .catch(function () {});
  }
  function procesar(f, i, correo) {
    return leerFila(f, i).then(function (lec) {
      var a = analizar(lec.ced, lec.bal), r = RESULT[i];
      r.nombre = a.nombre; r.programa = a.datos.programa; r.promedio = a.datos.promedio; r.sigla = a.datos.sigla; r.apellidos = a.datos.apellidos; r.nombres = a.datos.nombres; r.cedula = a.datos.cedula;
      if (a.tipo === 'error') { r.estado = 'error'; r.chip = a.chip; r.nota = a.nota; if (a.chip === 'Balance desactualizado') r.promedio = null; return; }
      var revision = a.tipo === 'revision';
      return api('reservar', { datos: a.datos, loteId: LOTE, correo: correo, revision: revision }).then(function (res) {
        r.codigo = res.codigo;
        return guardarOriginales(res.codigo, f, lec).then(function () {
        if (revision) {
          var imgs = lec.ced.imagenes.concat(lec.bal.imagenes), et = lec.ced.imagenes.map(function () { return 'Cédula'; }).concat(lec.bal.imagenes.map(function () { return 'Balance'; }));
          if (!imgs.length) { imgs = []; }
          var guardarImgs = function () { return imgs.slice(0, 8).reduce(function (p, im, k) { return p.then(function () { return api('a-revision-imagen', { codigo: res.codigo, n: k + 1, imagen: im }); }); }, Promise.resolve()); };
          return api('a-revision', { codigo: res.codigo, motivo: a.motivo, imagenes: [], etiquetas: et.slice(0, 8), ocr: (lec.bal.texto || '').slice(0, 1800) + '\n---\n' + (lec.ced.texto || '').slice(0, 900) }).then(function () { return guardarImgs(); }).then(function () { r.estado = a.manual ? 'manual' : 'revision'; r.chip = a.chip; r.nota = a.nota; });
        }
        return pdfDe(a.datos, res.codigo).then(function (pdf) { return api('emitir', { codigo: res.codigo, pdf: pdf }); }).then(function () { r.estado = 'emitido'; r.nota = ''; })
          .catch(function (e) { api('liberar', { codigo: res.codigo }).catch(function () {}); throw e; });
        });
      }).catch(function (e) {
        if (e.http === 409 && e.datos && e.datos.duplicado) { r.estado = 'error'; r.chip = 'Ya existe un promedio'; r.nota = 'Esta cédula ya tiene certificado en este programa. Solicite la corrección a Estadística.'; r.promedio = e.datos.duplicado.promedio != null ? e.datos.duplicado.promedio : null; return; }
        throw e;
      });
    });
  }
  function enviarLote() {
    if (!RESULT.some(function (r) { return r.estado === 'emitido'; })) return Promise.resolve();
    return api('enviar-lote', { loteId: LOTE }).then(function (e) { RESULT.forEach(function (r) { if (r.estado === 'emitido') { r.estado = 'enviado'; } }); })
      .catch(function (e) { RESULT.forEach(function (r) { if (r.estado === 'emitido') { r.chip = 'Emitido, correo pendiente'; r.nota = 'El certificado se generó, pero no se pudo enviar el correo: ' + e.message; r.reenviar = true; } }); });
  }

  /* ------------------------------ Resultado ------------------------------ */
  function chipDe(r) {
    if (r.estado === 'leyendo') return '<span class="chip rev"><span class="spin"></span>Procesando…</span>' + (r.nota ? '<div class="m">' + esc(r.nota) + '</div>' : '');
    if (r.estado === 'enviado') return '<span class="chip ok">' + IC.check + 'Enviado al correo electrónico</span>';
    if (r.estado === 'emitido') return '<span class="chip aviso">' + esc(r.chip || 'Emitido') + '</span>' + (r.nota ? '<div class="m">' + esc(r.nota) + '</div>' : '') + (r.reenviar ? '<div style="margin-top:8px"><button class="btn sec" data-reenviar="1" style="padding:6px 14px;font-size:13px">Reintentar envío</button></div>' : '');
    var cl = r.estado === 'revision' ? 'rev' : r.estado === 'manual' ? 'aviso' : 'err';
    return '<span class="chip ' + cl + '">' + esc(r.chip) + '</span><div class="m">' + esc(r.nota) + '</div>';
  }
  /* Ventana con el estado de la carga (al terminar el lote). Es opcional: se cierra con "Cerrar", Esc o pulsando fuera. */
  function estadoCarga() {
    var c = { enviado: 0, revision: 0, manual: 0, error: 0 }; RESULT.forEach(function (r) { if (c[r.estado] != null) c[r.estado]++; else if (r.estado === 'emitido') c.enviado++; });
    var aEst = c.revision + c.manual, mail = c.enviado;
    var pl = function (n, a, b) { return n + ' ' + (n === 1 ? a : b); };
    var lineas = [];
    if (mail) lineas.push(['#0f7a4d', pl(mail, 'certificado llegó', 'certificados llegaron') + ' al correo.']);
    if (aEst) lineas.push(['#8a6d0b', pl(aEst, 'estudiante está pendiente', 'estudiantes están pendientes') + ' de la respuesta de Estadística.']);
    if (c.error) lineas.push(['#b42318', pl(c.error, 'estudiante no se pudo procesar', 'estudiantes no se pudieron procesar') + '.']);
    if (!lineas.length) return;
    var tit = !aEst && !c.error ? 'Carga completa' : 'Estado de la carga';
    var fondo = document.createElement('div'); fondo.className = 'modal-f';
    fondo.innerHTML = '<div class="modal" role="dialog" aria-modal="true"><div class="gold">Resultado de la solicitud</div><h2 style="margin:4px 0 10px;font-size:17px">' + esc(tit) + '</h2>' +
      lineas.map(function (l) { return '<div style="display:flex;gap:10px;align-items:center;margin-top:6px;font-size:13px;color:#0b3d66"><span style="width:9px;height:9px;border-radius:50%;background:' + l[0] + ';flex:none"></span><span>' + esc(l[1]) + '</span></div>'; }).join('') +
      '<div style="display:flex;justify-content:flex-end;margin-top:20px"><button type="button" class="btn" id="ccerrar">Cerrar</button></div></div>';
    document.body.appendChild(fondo);
    var cerrar = function () { document.removeEventListener('keydown', tecla); fondo.remove(); };
    var tecla = function (e) { if (e.key === 'Escape') cerrar(); };
    document.addEventListener('keydown', tecla);
    fondo.onclick = function (e) { if (e.target === fondo) cerrar(); };
    fondo.querySelector('#ccerrar').onclick = cerrar; fondo.querySelector('#ccerrar').focus();
  }
  function resultado(sinAnimar) {
    ancho(1160);
    var c = { enviado: 0, revision: 0, manual: 0, error: 0 }; RESULT.forEach(function (r) { if (c[r.estado] != null) c[r.estado]++; else if (r.estado === 'emitido') c.enviado++; });
    var listo = !RESULT.some(function (r) { return r.estado === 'leyendo'; });
    var chips = (c.enviado ? '<span class="chip ok">' + c.enviado + ' ' + (c.enviado === 1 ? 'enviado' : 'enviados') + '</span>' : '') + (c.revision ? '<span class="chip rev">' + c.revision + ' en revisión</span>' : '') + (c.manual ? '<span class="chip aviso">' + c.manual + ' manual</span>' : '') + (c.error ? '<span class="chip err">' + c.error + ' con error</span>' : '');
    var filas = RESULT.map(function (r) { return '<div class="r"><b>' + esc(r.nombre) + '</b><span>' + esc(r.programa) + '</span><span style="font-variant-numeric:tabular-nums;font-weight:600">' + (r.promedio != null ? Number(r.promedio).toFixed(3) : '—') + '</span><div>' + chipDe(r) + '</div></div>'; }).join('');
    var y = $('vista').scrollTop;
    vista('<div style="display:flex;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;gap:10px"><div><div class="gold">Resultado de la solicitud</div><h2>' + RESULT.length + ' ' + (RESULT.length === 1 ? 'estudiante procesado' : 'estudiantes procesados') + '</h2></div><div style="display:flex;gap:8px;flex-wrap:wrap">' + chips + '</div></div>' +
      '<div class="r h"><span class="lbl">Estudiante</span><span class="lbl">Programa</span><span class="lbl">Promedio</span><span class="lbl">Estado</span></div><div style="overflow:auto;min-height:0">' + filas + '</div>' +
      '<div style="display:flex;justify-content:flex-end;gap:12px;margin-top:16px;flex-wrap:wrap"><button class="btn" id="botro"' + (listo ? '' : ' disabled') + '>Cargar otro lote</button></div>', !sinAnimar);
    $('vista').scrollTop = y;
    $('botro').onclick = function () { FILAS = []; carga(); };
    var re = document.querySelector('[data-reenviar]'); if (re) re.onclick = function () { re.disabled = true; enviarLote().then(function () { resultado(); }); };
  }

  /* ------------------------------ Consulta ------------------------------ */
  function consulta() {
    ancho(1160); vista('<div class="vac"><span class="spin"></span> Cargando…</div>');
    api('lista').then(function (r) { pintarConsulta(r.lista, ''); }).catch(function (e) { vista('<div class="vac">' + esc(e.message) + '</div><div style="text-align:center">' + volver() + '</div>'); $('bvolver').onclick = inicio; });
  }
  var ESTADOS = { emitido: ['ok', 'Emitido'], revision: ['rev', 'En revisión'], rechazado: ['err', 'Rechazado'] };
  function pintarConsulta(lista, q) {
    var x = N.norm(q), vis = lista.filter(function (r) { return !x || N.norm(r.apellidos + ' ' + r.nombres + ' ' + r.cedula + ' ' + r.sigla + ' ' + r.codigo).indexOf(x) >= 0; }).reverse();
    var filas = vis.map(function (r) { var e = ESTADOS[r.estado] || ['rev', r.estado]; return '<div class="r" style="grid-template-columns:1.6fr .9fr .5fr 1fr .8fr"><b>' + esc((r.apellidos + ' ' + r.nombres).trim() || '(por validar)') + '</b><span>' + esc(r.sigla || r.programa) + '</span><span style="font-variant-numeric:tabular-nums;font-weight:600">' + (r.promedio != null ? Number(r.promedio).toFixed(3) : '—') + '</span><span style="font-size:12.5px;color:#566370">' + esc(r.codigo) + '<br>' + new Date(r.fecha).toLocaleDateString('es-CO') + '</span><div><span class="chip ' + e[0] + '">' + e[1] + '</span>' + (r.estado === 'emitido' ? '<div style="margin-top:6px"><a href="#" data-pdf="' + r.codigo + '" style="font-size:12.5px;color:#0b3d66;font-weight:600">Descargar PDF</a></div>' : '') + '</div></div>'; }).join('');
    vista(cab('Certificados de promedio', 'Promedios generados', 'Un certificado emitido no se repite: si hay un error, la corrección la hace la Oficina de Estadística.') +
      '<div style="margin-top:14px"><input class="inp" id="q" placeholder="Buscar por nombre, cédula, sigla o código" value="' + esc(q) + '"></div>' +
      '<div style="overflow:auto;min-height:0;margin-top:8px">' + (filas || '<div class="vac">No hay certificados que coincidan.</div>') + '</div><div style="margin-top:14px">' + volver() + '</div>');
    $('bvolver').onclick = inicio; var qi = $('q'); qi.oninput = function () { var p = qi.selectionStart; pintarConsulta(lista, qi.value); $('q').focus(); $('q').setSelectionRange(p, p); };
    document.querySelectorAll('[data-pdf]').forEach(function (a) { a.style.cursor = 'pointer'; a.onclick = function (e) { e.preventDefault(); api('descargar', { codigo: a.dataset.pdf }).then(function (r) { var l = document.createElement('a'); l.href = 'data:application/pdf;base64,' + r.pdf; l.download = r.archivo || (a.dataset.pdf + '.pdf'); l.click(); }).catch(function (er) { toast(er.message); }); }; });
  }

  /* ------------------------------ Revisión (Estadística) ------------------------------ */
  /* Firma y envía de una vez todos los certificados pendientes de revisión que tengan los datos completos y el balance vigente. */
  function confirmarModal(titulo, texto, textoOk, ok) {
    var fondo = document.createElement('div'); fondo.className = 'modal-f';
    fondo.innerHTML = '<div class="modal" role="dialog" aria-modal="true"><div class="gold">Confirmar</div><h2 style="margin:4px 0 8px;font-size:17px">' + esc(titulo) + '</h2><div style="font-size:14px;color:#334155;line-height:1.5">' + esc(texto) + '</div><div style="display:flex;justify-content:flex-end;gap:10px;margin-top:18px"><button type="button" class="btn sec" id="cno">Cancelar</button><button type="button" class="btn" id="csi">' + esc(textoOk) + '</button></div></div>';
    document.body.appendChild(fondo);
    fondo.querySelector('#cno').onclick = function () { fondo.remove(); };
    fondo.querySelector('#csi').onclick = function () { fondo.remove(); ok(); };
  }
  function aprobarTodos(lista) {
    var elegibles = [], omitidos = [];
    lista.forEach(function (it) {
      var d = Object.assign({}, it.datos), prog = AJ.programas.filter(function (x) { return x.id === d.programaId; })[0] || null, falta = false;
      ['apellidos', 'nombres', 'cedula', 'programaId', 'periodoTerminacion', 'fechaBalance'].forEach(function (k) { if (!d[k]) falta = true; });
      if (!(d.promedio >= 0 && d.promedio <= 10) || !prog || !prog.facultad) falta = true;
      var v = falta ? null : N.vigencia({ nivel: prog.nivel, terminacion: d.periodoTerminacion, diplomado: d.diplomado, hoy: new Date() });
      if (falta || !v || (v.estado !== 'vigente' && v.estado !== 'actualizado')) { omitidos.push(it); return; }
      d.programa = prog.nombre; d.sigla = prog.sigla; d.nivel = prog.nivel; d.facultad = prog.facultad; d.lugar = ''; d.estadoVigencia = v.estado === 'actualizado' ? 'actualizado' : 'vigente';
      elegibles.push({ it: it, d: d });
    });
    if (!elegibles.length) { toast('Ninguno tiene los datos completos para emitirse de una vez. Revíselos uno por uno.'); return; }
    confirmarModal('¿Firmar y enviar todos?', 'Se emitirán ' + elegibles.length + ' certificado' + (elegibles.length === 1 ? '' : 's') + ' con los datos tal como están leídos.' + (omitidos.length ? ' ' + omitidos.length + ' no se emitirán porque les falta algún dato o el balance está desactualizado; esos los revisa uno por uno.' : ''), 'Firmar y enviar', function () {
      var hechos = 0, fallos = 0;
      elegibles.reduce(function (p, e, i) {
        return p.then(function () { gate(true, 'Firmando y enviando ' + (i + 1) + ' de ' + elegibles.length + '…'); return pdfDe(e.d, e.it.codigo).then(function (pdf) { return api('revision-aprobar', { codigo: e.it.codigo, datos: e.d, pdf: pdf }); }).then(function () { hechos++; }).catch(function () { fallos++; }); });
      }, Promise.resolve()).then(function () {
        gate(false); toast(hechos + (hechos === 1 ? ' certificado emitido' : ' certificados emitidos') + ' y enviados.' + (fallos ? ' ' + fallos + ' no se pudieron emitir.' : '') + (omitidos.length ? ' Quedan ' + omitidos.length + ' por revisar.' : ''));
        pendientes().then(function () { revision(); });
      });
    });
  }
  function revision() {
    ancho(1200); vista('<div class="vac"><span class="spin"></span> Cargando…</div>');
    api('revision-lista').then(function (r) { PEND = r.lista.length; if (!r.lista.length) { vista(cab('Revisión · Oficina de Estadística', 'Nada pendiente', 'No hay documentos escaneados esperando revisión.') + '<div style="margin-top:18px">' + volver() + '</div>'); $('bvolver').onclick = inicio; return; } revisar(r.lista, 0); }).catch(function (e) { toast(e.message); inicio(); });
  }
  function opcionesProg(sel) { return AJ.programas.map(function (p) { return '<option value="' + esc(p.id) + '"' + (p.id === sel ? ' selected' : '') + '>' + esc(p.nombre) + '</option>'; }).join(''); }
  var fmtFecha = function (iso) { var d = deISO(iso); return iso ? d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear() : ''; };
  var desdeFecha = function (t) { var d = N.parseFecha(t); return d ? aISO(d) : ''; };
  var IMGREV = {}, GENPRE = 0;
  function revisar(lista, k) {
    var it = lista[k], d = it.datos;
    vista('<div style="display:flex;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;gap:8px"><div><div class="gold">Revisión · Oficina de Estadística</div><h2>Verifique los datos leídos</h2></div><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><select id="selrev" class="inp" style="width:auto;max-width:100%;padding:6px 12px;font-weight:600;color:#0b3d66;cursor:pointer" title="Elija cuál validar">' + lista.map(function (x, j) { var dd = x.datos || {}, nm = ((dd.apellidos || '') + ' ' + (dd.nombres || '')).trim() || 'Sin nombre'; return '<option value="' + j + '"' + (j === k ? ' selected' : '') + '>' + (j + 1) + ' de ' + lista.length + ' · ' + esc((dd.sigla ? dd.sigla + ' ' : '') + nm) + '</option>'; }).join('') + '</select>' + (lista.length > 1 ? '<button class="btn" id="btodos" style="padding:7px 16px;font-size:12.5px">Firmar y enviar todos (' + lista.length + ')</button>' : '') + '</div></div>' +
      (it.motivoRevision ? '<div class="chip aviso" style="margin-top:10px;white-space:normal;border-radius:10px">' + esc(it.motivoRevision) + '</div>' : '') +
      '<div class="sdoc" style="display:flex;gap:22px;margin-top:14px;flex:1;min-height:0"><div style="flex:1.05;display:flex;flex-direction:column;min-width:0;min-height:340px"><div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap" id="tabs"></div><div class="doc" id="doc"><span class="spin"></span></div></div>' +
      '<div style="flex:1;min-width:0;overflow:auto"><div class="g2"><div><div class="lbl">Apellidos</div><input class="inp" id="f_ap" value="' + esc(d.apellidos) + '"></div><div><div class="lbl">Nombres</div><input class="inp" id="f_no" value="' + esc(d.nombres) + '"></div>' +
      '<div><div class="lbl">Cédula</div><input class="inp" id="f_ce" inputmode="numeric" value="' + esc(d.cedula) + '"></div></div>' +
      '<div style="margin-top:12px"><div class="lbl">Programa</div><select class="inp" id="f_pr"><option value="">Seleccione…</option>' + opcionesProg(d.programaId) + '</select></div>' +
      '<div class="g2" style="margin-top:12px"><div><div class="lbl">Facultad (según el programa)</div><input class="inp" id="f_fa" readonly></div><div><div class="lbl">Periodo de terminación</div><input class="inp" id="f_pe" placeholder="2026-1" value="' + esc(d.periodoTerminacion) + '"></div>' +
      '<div><div class="lbl">Diplomado de actualización (periodo)</div><input class="inp" id="f_di" placeholder="Opcional · 2026-1" value="' + esc(d.diplomado) + '"></div><div><div class="lbl">Fecha de elaboración</div><input class="inp" id="f_fe" type="date" max="2100-12-31" value="' + esc(/^\d{4}-\d{2}-\d{2}$/.test(d.fechaBalance || '') ? d.fechaBalance : '') + '" style="cursor:pointer"></div>' +
      '<div><div class="lbl">Promedio ponderado</div><input class="inp" id="f_pm" inputmode="decimal" value="' + (d.promedio != null ? Number(d.promedio).toFixed(3) : '') + '"></div><div><div class="lbl">Vigencia</div><input class="inp" id="f_vi" readonly></div></div>' +
      (it.ocr ? '<details style="margin-top:12px"><summary style="font-size:12.5px;color:#566370;font-weight:600">Texto leído por el lector</summary><pre style="white-space:pre-wrap;font-size:11.5px;color:#3b4754;max-height:160px;overflow:auto;margin:6px 0 0">' + esc(it.ocr) + '</pre></details>' : '') +
      '<div id="f_err" class="chip err" style="margin-top:12px;white-space:normal;border-radius:10px" hidden></div></div></div>' +
      '<div style="display:flex;justify-content:space-between;gap:12px;margin-top:14px;flex-wrap:wrap"><div style="display:flex;gap:10px">' + volver() + '<button class="btn sec" id="brech">Rechazar</button></div><button class="btn" id="bapr">Aprobar y emitir</button></div>');
    $('bvolver').onclick = inicio;
    $('selrev').onchange = function () { revisar(lista, +this.value); };
    if ($('btodos')) $('btodos').onclick = function () { aprobarTodos(lista); };
    var etiquetas = it.etiquetas && it.etiquetas.length ? it.etiquetas : null, cache = (IMGREV[it.codigo] = IMGREV[it.codigo] || {});
    var tabs = $('tabs'); for (var i = 1; i <= it.nImagenes; i++) (function (n) { var b = document.createElement('button'); b.className = 'tab' + (n === 1 ? ' on' : ''); var et0 = etiquetas && etiquetas[n - 1] ? etiquetas[n - 1] : 'Documento', tot = etiquetas ? etiquetas.slice(0, it.nImagenes).filter(function (e) { return e === et0; }).length : it.nImagenes; b.textContent = et0 + (tot > 1 ? ' ' + (etiquetas ? etiquetas.slice(0, n).filter(function (e) { return e === et0; }).length : n) : ''); b.onclick = function () { tabs.querySelectorAll('.tab').forEach(function (x) { x.classList.remove('on'); }); b.classList.add('on'); mostrar(n); }; tabs.appendChild(b); })(i);
    if (!etiquetas || etiquetas.slice(0, it.nImagenes).indexOf('Balance') < 0) { var bb = document.createElement('button'); bb.className = 'tab'; bb.textContent = 'Balance'; bb.onclick = function () { tabs.querySelectorAll('.tab').forEach(function (x) { x.classList.remove('on'); }); bb.classList.add('on'); var dc = $('doc'); dc.classList.remove('zoom'); dc.innerHTML = '<div class="vac">Este registro se cargó antes y no guardó la imagen del balance.<br>Recházalo sin avisar al jefe de programa y vuelve a cargarlo para ver el balance aquí.</div>'; }; tabs.appendChild(bb); }
    var z = 1;
    function zoomar(nz) { z = Math.max(1, Math.min(4, nz)); var doc = $('doc'), im = doc.firstChild; if (!im || im.tagName !== 'IMG') return; if (z === 1) { doc.classList.remove('zoom'); im.style.width = ''; } else { doc.classList.add('zoom'); im.style.width = (z * 100) + '%'; } }
    var zb = document.createElement('span'); zb.className = 'zb'; zb.innerHTML = '<button type="button" title="Alejar" id="zmenos">−</button><button type="button" title="Tamaño completo" id="zfit" style="width:auto;padding:0 10px">Ajustar</button><button type="button" title="Acercar" id="zmas">+</button>'; $('tabs').appendChild(zb);
    $('zmenos').onclick = function () { zoomar(z - 0.5); }; $('zmas').onclick = function () { zoomar(z + 0.5); }; $('zfit').onclick = function () { zoomar(1); };
    (function () {      /* arrastrar con la mano para moverse dentro del documento ampliado */
      var d = $('doc'), x0, y0, sl, st, abajo = false;
      d.addEventListener('mousedown', function (e) { if (!d.classList.contains('zoom') || e.button !== 0) return; abajo = true; x0 = e.clientX; y0 = e.clientY; sl = d.scrollLeft; st = d.scrollTop; d.classList.add('mov'); e.preventDefault(); });
      window.addEventListener('mousemove', function (e) { if (!abajo) return; d.scrollLeft = sl - (e.clientX - x0); d.scrollTop = st - (e.clientY - y0); });
      window.addEventListener('mouseup', function () { abajo = false; d.classList.remove('mov'); });
      d.addEventListener('wheel', function (e) { if (e.ctrlKey) { e.preventDefault(); zoomar(z + (e.deltaY < 0 ? 0.5 : -0.5)); } }, { passive: false });
    })();
    function mostrar(n) { var doc = $('doc'); if (cache[n]) { doc.innerHTML = '<img alt="Documento" title="Doble clic para ampliar. Con zoom, arrastre para moverse">'; doc.firstChild.src = cache[n]; doc.firstChild.ondblclick = function () { zoomar(z >= 2 ? 1 : 2); }; zoomar(z); return; } doc.innerHTML = '<span class="spin"></span>'; api('revision-imagen', { codigo: it.codigo, n: n }).then(function (r) { cache[n] = r.imagen; mostrar(n); }).catch(function (e) { doc.textContent = e.message; }); }
    if (it.nImagenes) mostrar(1); else $('doc').textContent = 'Sin imágenes guardadas.';
    /* precarga en segundo plano: el resto de imágenes de este estudiante y luego las de los demás pendientes, para que al elegir otro se vea enseguida */
    (function () {
      var gen = ++GENPRE, cola = [], j;
      for (j = 2; j <= (it.nImagenes || 0); j++) cola.push([it, j]);
      lista.forEach(function (x, q) { if (q !== k) for (var n = 1; n <= Math.min(x.nImagenes || 0, 4); n++) cola.push([x, n]); });
      cola.reduce(function (pr, c) { return pr.then(function () { if (gen !== GENPRE) return; var m = (IMGREV[c[0].codigo] = IMGREV[c[0].codigo] || {}); if (m[c[1]]) return; return api('revision-imagen', { codigo: c[0].codigo, n: c[1] }).then(function (r) { m[c[1]] = r.imagen; }).catch(function () {}); }); }, Promise.resolve());
    })();
    /* lo que se edita queda en la lista: al elegir otro estudiante y volver no se pierde, y el nombre del selector se actualiza al escribir */
    function sincronizar() {
      var f = leerForm().datos, dd = it.datos;
      ['apellidos', 'nombres', 'cedula', 'programaId', 'programa', 'sigla', 'nivel', 'facultad', 'periodoTerminacion', 'diplomado', 'fechaBalance'].forEach(function (c) { dd[c] = f[c]; });
      dd.promedio = isFinite(f.promedio) ? f.promedio : null;
      var op = $('selrev').options[k], nm = ((dd.apellidos || '') + ' ' + (dd.nombres || '')).trim() || 'Sin nombre';
      if (op) op.textContent = (k + 1) + ' de ' + lista.length + ' · ' + (dd.sigla ? dd.sigla + ' ' : '') + nm;
    }
    ['f_ap', 'f_no', 'f_ce', 'f_pr', 'f_pe', 'f_di', 'f_fe', 'f_pm'].forEach(function (id) { var e = $(id); if (e) { e.addEventListener('input', sincronizar); e.addEventListener('change', sincronizar); } });
    function leerForm() {
      var p = AJ.programas.filter(function (x) { return x.id === $('f_pr').value; })[0] || null;
      var pm = parseFloat(String($('f_pm').value).replace(',', '.'));
      return { p: p, datos: { apellidos: N.mayus($('f_ap').value), nombres: N.mayus($('f_no').value), cedula: $('f_ce').value.replace(/\D/g, ''), lugar: '', programaId: p ? p.id : '', programa: p ? p.nombre : '', sigla: p ? p.sigla : '', nivel: p ? p.nivel : 'pregrado', facultad: p ? p.facultad : '',
        promedio: pm, periodoTerminacion: $('f_pe').value.trim(), diplomado: $('f_di').value.trim(), fechaBalance: /^\d{4}-\d{2}-\d{2}$/.test($('f_fe').value) ? $('f_fe').value : '' } };
    }
    function refrescar() { var f = leerForm(); $('f_fa').value = f.p ? (f.p.facultad || 'Falta en Ajustes') : ''; var v = f.datos.periodoTerminacion ? N.vigencia({ nivel: f.datos.nivel, terminacion: f.datos.periodoTerminacion, diplomado: f.datos.diplomado, hoy: new Date() }) : { estado: 'sin-dato' }; $('f_vi').value = ({ vigente: 'Vigente', actualizado: 'Actualizado con diplomado', vencido: 'Desactualizado', 'sin-dato': '—' })[v.estado]; return { f: f, v: v }; }
    document.querySelectorAll('#vista input,#vista select').forEach(function (e) { e.oninput = refrescar; e.onchange = refrescar; }); refrescar();
    function siguiente() { var rest = lista.filter(function (_, j) { return j !== k; }); PEND = rest.length; if (!rest.length) { toast('Revisión terminada.'); inicio(); } else revisar(rest, Math.min(k, rest.length - 1)); }
    $('brech').onclick = function () { pedirMotivo(it.nombre || [it.sigla, it.apellidos, it.nombres].filter(Boolean).join(' '), function (m, av) { gate(true, av ? 'Rechazando y enviando el aviso por correo…' : 'Rechazando…'); api('revision-rechazar', { codigo: it.codigo, motivo: m, avisar: av }).then(function (r) { gate(false); toast(r && r.avisoError ? 'Rechazado, pero el correo no salió: ' + r.avisoError : 'Certificado rechazado. El jefe de programa recibirá el aviso.'); siguiente(); }).catch(function (e) { gate(false); toast(e.message); }); }); };
    $('bapr').onclick = function () {
      var x = refrescar(), err = $('f_err'), d = x.f.datos, falta = [];
      ['apellidos', 'nombres', 'cedula', 'programaId', 'periodoTerminacion', 'fechaBalance'].forEach(function (k2) { if (!d[k2]) falta.push(k2); });
      if (!(d.promedio >= 0 && d.promedio <= 10)) falta.push('promedio');
      if (x.f.p && !x.f.p.facultad) falta.push('facultad (complétela en Ajustes)');
      var msg = falta.length ? 'Falta o es inválido: ' + falta.join(', ') + '.' : x.v.estado === 'vencido' ? 'El balance está desactualizado: no se puede emitir.' : x.v.estado === 'sin-dato' ? 'Revise el periodo de terminación (formato 2026-1).' : '';
      err.hidden = !msg; err.textContent = msg; if (msg) return;
      d.estadoVigencia = x.v.estado === 'actualizado' ? 'actualizado' : 'vigente'; var b = $('bapr'); b.disabled = true; b.textContent = 'Emitiendo…'; gate(true, 'Emitiendo…');
      pdfDe(d, it.codigo).then(function (pdf) { return api('revision-aprobar', { codigo: it.codigo, datos: d, pdf: pdf }); }).then(function (r) { gate(false); toast(r.envio && r.envio.enviados ? 'Emitido y enviado al correo (' + r.envio.enviados + ').' : 'Certificado emitido.'); siguiente(); }).catch(function (e) { gate(false); b.disabled = false; b.textContent = 'Aprobar y emitir'; err.hidden = false; err.textContent = e.message; });
    };
  }

  /* ------------------------------ Ajustes (Estadística) ------------------------------ */
  function ajustes() {
    ancho(1200); var f = AJ.firmante, us = (AJ.usuarios || []).slice(), prog = AJ.programas.map(function (p) { return Object.assign({}, p); }), firma = f.firma;
    function pintar() {
      var filasP = prog.map(function (p, i) { return '<div class="tr" style="grid-template-columns:1.5fr .7fr 1fr;margin-top:8px"><input class="inp" data-p="nombre" data-i="' + i + '" value="' + esc(p.nombre) + '"><input class="inp" data-p="sigla" data-i="' + i + '" value="' + esc(p.sigla) + '"><input class="inp" data-p="facultad" data-i="' + i + '" placeholder="Escriba la facultad" value="' + esc(p.facultad) + '"></div>'; }).join('');
      var filasU = us.map(function (u, i) { return '<div class="tr" style="grid-template-columns:1fr 1fr 1fr 1fr auto;margin-top:8px"><input class="inp" data-u="correo" data-i="' + i + '" placeholder="usuario@enap.edu.co" value="' + esc(u.correo) + '"><input class="inp" data-u="nombre" data-i="' + i + '" placeholder="Nombre" value="' + esc(u.nombre) + '"><input class="inp" data-u="correoEnvio" data-i="' + i + '" placeholder="Correo donde recibe los certificados" value="' + esc(u.correoEnvio || '') + '"><input class="inp" data-u="facultad" list="a_facs" data-i="' + i + '" placeholder="Facultad del jefe" value="' + esc(u.facultad || '') + '"><button class="x" data-qu="' + i + '">&times;</button></div>'; }).join('') + '<datalist id="a_facs">' + prog.map(function (p) { return p.facultad; }).filter(function (v, k, a) { return v && a.indexOf(v) === k; }).map(function (v) { return '<option value="' + esc(v) + '">'; }).join('') + '</datalist>';
      vista('<div style="display:flex;gap:24px;flex:1;min-height:0" class="sdoc"><div style="flex:1;min-width:0;overflow:auto;padding-right:6px">' + cab('Solo Oficina de Estadística', 'Firmante del certificado', 'Estos datos salen en cada certificado nuevo. Los ya emitidos conservan el firmante con el que se emitieron.') +
        '<div class="g2" style="grid-template-columns:.6fr 1.4fr;margin-top:16px"><div><div class="lbl">Grado</div><input class="inp" id="a_gr" value="' + esc(f.grado) + '"></div><div><div class="lbl">Nombres y apellidos</div><input class="inp" id="a_no" value="' + esc(f.nombre) + '"></div></div>' +
        '<div style="margin-top:12px"><div class="lbl">Cargo</div><input class="inp" id="a_ca" value="' + esc(f.cargo) + '"></div>' +
        '<div style="margin-top:12px"><div class="lbl">Imagen de la firma (PNG, fondo transparente)</div><label class="fm slot" style="min-height:0">' + (firma ? '<img src="' + firma + '" alt="Firma">' : '<span style="color:#566370;font-weight:400">Se usa la firma actual del certificado.</span>') + '<span style="margin-left:auto">Cargar imagen</span><input type="file" id="a_fi" accept="image/png,image/jpeg" hidden></label></div>' +
        '<div style="margin-top:22px">' + cab('Solo Oficina de Estadística', 'Usuarios autorizados', 'Jefes de programa que pueden generar certificados. Solo ven lo que generan; el correo es donde reciben el archivo.') + filasU + '<div style="margin-top:10px"><button class="btn sec" id="a_mu">+ Agregar usuario</button></div></div></div>' +
        '<div style="flex:1;min-width:0;display:flex;flex-direction:column">' + cab('Solo Oficina de Estadística', 'Programa y facultad', 'De aquí salen la facultad del certificado y la sigla de cada archivo.') +
        '<div class="tr" style="grid-template-columns:1.5fr .7fr 1fr;margin-top:12px"><div class="lbl">Programa académico</div><div class="lbl">Sigla</div><div class="lbl">Facultad</div></div><div style="overflow:auto;min-height:0;flex:1;padding-right:6px">' + filasP + '</div></div></div>' +
        '<div id="a_cm" style="margin-top:10px;font-size:13px;color:#566370;word-break:break-word"></div><div style="display:flex;justify-content:space-between;margin-top:8px;gap:12px;flex-wrap:wrap">' + volver() + '<span style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn sec" id="a_co">Enviar correo de prueba</button><button class="btn" id="a_gu">Guardar ajustes</button></span></div>');
      $('a_co').onclick = function () { var b = $('a_co'), o = $('a_cm'); b.disabled = true; o.style.color = '#566370'; o.textContent = 'Enviando…'; api('probar-correo').then(function (r) { b.disabled = false; if (r.ok) { o.style.color = '#1b6e43'; o.textContent = 'Enviado desde ' + r.de + ' a ' + r.a + '. Revise su bandeja y la carpeta de correo no deseado.'; } else { o.style.color = '#b3261e'; o.textContent = 'No salió: ' + r.error; } }).catch(function (e) { b.disabled = false; o.style.color = '#b3261e'; o.textContent = e.message; }); };
      $('bvolver').onclick = inicio;
      document.querySelectorAll('[data-p]').forEach(function (e) { e.oninput = function () { prog[+e.dataset.i][e.dataset.p] = e.value; }; });
      document.querySelectorAll('[data-u]').forEach(function (e) { e.oninput = function () { us[+e.dataset.i][e.dataset.u] = e.value; }; });
      document.querySelectorAll('[data-qu]').forEach(function (b) { b.onclick = function () { leerCampos(); us.splice(+b.dataset.qu, 1); pintar(); }; });
      $('a_mu').onclick = function () { leerCampos(); us.push({ correo: '', nombre: '', correoEnvio: '', facultad: '' }); pintar(); };
      $('a_fi').onchange = function (e) { var fl = e.target.files[0]; if (!fl) return; if (fl.size > 600000) { toast('La imagen pesa demasiado (máx. 600 KB).'); return; } var fr = new FileReader(); fr.onload = function () { leerCampos(); firma = fr.result; pintar(); }; fr.readAsDataURL(fl); };
      $('a_gu').onclick = function () {
        leerCampos(); var b = $('a_gu'); b.disabled = true;
        var nuevo = { firmante: { grado: f.grado, nombre: f.nombre, cargo: f.cargo, firma: firma || null }, programas: prog, usuarios: us.filter(function (u) { return u.correo; }) };
        api('ajustes-guardar', { ajustes: nuevo }).then(function () { AJ.firmante = nuevo.firmante; AJ.programas = nuevo.programas; AJ.usuarios = nuevo.usuarios; toast('Ajustes guardados.'); inicio(); }).catch(function (e) { b.disabled = false; toast(e.message); });
      };
    }
    function leerCampos() { if ($('a_gr')) { f = { grado: $('a_gr').value, nombre: $('a_no').value, cargo: $('a_ca').value, firma: firma }; } }
    pintar();
  }

  /* ------------------------------ Arranque ------------------------------ */
  gate(true, 'Cargando sesión…');
  api('sesion').then(function (s) {
    YO = s; AJ = { firmante: s.ajustes.firmante, programas: s.ajustes.programas, enlaceVerificacion: s.ajustes.enlaceVerificacion, usuarios: s.ajustes.usuarios || [] };
    CORREOS = s.correos || []; CORREO = s.estadistica ? (CORREOS[0] || '') : s.correo; gate(false); return pendientes();
  }).then(function () { inicio(); }).catch(function (e) { gate(false); vista('<div class="vac"><b style="color:#062a4a;font-size:17px">No se pudo abrir el módulo</b><br>' + esc(e.message) + '</div>'); ancho(640); });
})();
