/* Registro Cursos de Extension: todo lo que aparece en pantalla entra con un
   desplazamiento suave hacia arriba (fade + subida). Es un script suelto que
   no toca el codigo de la aplicacion: observa el DOM y anima cada elemento
   nuevo que React agrega (primera carga, cambio de pestana, filas nuevas,
   mensajes, etc.), con un pequeno escalonado entre hermanos. */
(function () {
  'use strict';
  var reducir = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducir) return;

  var st = document.createElement('style');
  st.textContent =
    '@keyframes apArriba{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}' +
    '[data-ap]{animation:apArriba .55s cubic-bezier(.22,.8,.3,1) backwards;animation-delay:var(--ap-d,0ms)}';
  document.head.appendChild(st);

  var SALTAR = /^(SCRIPT|STYLE|LINK|META|OPTION|OPTGROUP|TBODY|THEAD|COLGROUP|COL|BR|HR|PATH|CIRCLE|RECT|LINE|POLYLINE|POLYGON|G|DEFS|USE|TITLE)$/;

  function animable(el) {
    if (!el || el.nodeType !== 1 || SALTAR.test(el.tagName)) return false;
    if (el.closest('[data-ap]')) return false;          // ya viene dentro de algo animado
    if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') return false;
    var cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.display === 'contents') return false;
    if (cs.animationName && cs.animationName !== 'none') return false; // p.ej. spinner
    return true;
  }

  function animar(el, retraso) {
    el.style.setProperty('--ap-d', retraso + 'ms');
    el.setAttribute('data-ap', '');
    var fin = function () { el.removeAttribute('data-ap'); el.style.removeProperty('--ap-d'); };
    el.addEventListener('animationend', fin, { once: true });
    setTimeout(fin, 1500 + retraso);
  }

  function procesar(nodo) {
    if (!animable(nodo)) {
      // si el contenedor no se anima, probar con sus hijos directos (p. ej. <tbody> o fragmentos)
      if (nodo.nodeType === 1 && nodo.children) {
        Array.prototype.slice.call(nodo.children, 0, 40).forEach(function (h, i) {
          if (animable(h)) animar(h, Math.min(i * 45, 450));
        });
      }
      return;
    }
    animar(nodo, 0);
    // escalonado de los hijos directos del bloque nuevo
    var hijos = nodo.children || [];
    for (var i = 0; i < hijos.length && i < 14; i++) {
      (function (h, idx) {
        // los hijos se animan despues de que el padre empieza; se marcan tras un frame
        requestAnimationFrame(function () {
          if (h.isConnected && !h.hasAttribute('data-ap') && getComputedStyle(h).animationName === 'none') {
            h.style.setProperty('--ap-d', (60 + idx * 55) + 'ms');
            h.setAttribute('data-ap', '');
            var fin = function () { h.removeAttribute('data-ap'); h.style.removeProperty('--ap-d'); };
            h.addEventListener('animationend', fin, { once: true });
            setTimeout(fin, 1500 + idx * 55);
          }
        });
      })(hijos[i], i);
    }
  }

  var pendientes = [];
  var programado = false;
  function vaciar() {
    programado = false;
    var lote = pendientes; pendientes = [];
    lote.forEach(function (n) { if (n.isConnected) procesar(n); });
  }

  var obs = new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++) {
      var add = muts[i].addedNodes;
      for (var j = 0; j < add.length; j++) {
        var n = add[j];
        if (n.nodeType !== 1) continue;
        var root = document.getElementById('root');
        if (!root || !root.contains(n) || n === root) continue;
        pendientes.push(n);
      }
    }
    if (pendientes.length && !programado) { programado = true; requestAnimationFrame(vaciar); }
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });
})();
