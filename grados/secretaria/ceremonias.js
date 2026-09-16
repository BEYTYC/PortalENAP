// grados/secretaria/ceremonias.js

import { login, hasRole } from "../../shared/authService.js";
import {
  listarCeremonias,
  crearCeremonia,
  actualizarCeremonia,
} from "../shared/ceremoniaService.js";

const alerta = document.getElementById("alerta");
const loading = document.getElementById("loading");
const tablaContainer = document.getElementById("tabla-container");
const formContainer = document.getElementById("form-container");
const btnVolver = document.getElementById("btn-volver");

let usuarioActual = null;

// Detecta si esta página fue cargada dentro de un iframe del portal
// (Portal Estadístico ENAP) mediante el parámetro ?embedded=1, igual
// que hacen los demás módulos (registro, titulacion).
const embebido = new URLSearchParams(window.location.search).get("embedded") === "1";

if (embebido) {
  btnVolver.hidden = false;
  btnVolver.addEventListener("click", () => {
    // Mismo origen: se puede llamar directo a la función del portal.
    if (window.parent && typeof window.parent.volverAlPortal === "function") {
      window.parent.volverAlPortal();
    } else {
      // Respaldo por si el portal está en otro origen algún día.
      window.parent.postMessage("volverAlInicio", "*");
    }
  });
}

function mostrarAlerta(msg, tipo = "error") {
  alerta.textContent = msg;
  alerta.className =
    `mb-4 rounded-lg px-4 py-3 text-sm ${tipo === "error" ? "bg-red-50 text-red-700 border border-red-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"}`;
  alerta.classList.remove("hidden");
}

async function verificarAcceso() {
  const cached = sessionStorage.getItem("enap_roles");
  if (cached) {
    usuarioActual = JSON.parse(sessionStorage.getItem("enap_user"));
    return JSON.parse(cached);
  }
  const { user, roles } = await login();
  usuarioActual = user;
  sessionStorage.setItem("enap_user", JSON.stringify(user));
  sessionStorage.setItem("enap_roles", JSON.stringify(roles));
  return roles;
}

function renderTabla(ceremonias) {
  const filas = ceremonias
    .map(
      (c) => `
    <tr class="border-t border-slate-100">
      <td class="px-4 py-3 text-sm font-medium text-slate-900">${c.nombre}</td>
      <td class="px-4 py-3 text-sm text-slate-600">${new Date(c.fechaCeremonia).toLocaleString("es-CO")}</td>
      <td class="px-4 py-3 text-sm text-slate-600">${new Date(c.inicioRecepcion).toLocaleDateString("es-CO")} - ${new Date(c.cierreRecepcion).toLocaleDateString("es-CO")}</td>
      <td class="px-4 py-3 text-sm">
        <span class="px-2 py-1 rounded-full text-xs font-medium ${c.estado === "Activa" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}">${c.estado}</span>
      </td>
      <td class="px-4 py-3 text-sm text-right">
        <button data-id="${c.id}" class="btn-editar text-slate-600 hover:text-slate-900 text-sm">Editar</button>
      </td>
    </tr>`
    )
    .join("");

  tablaContainer.innerHTML = `
    <table class="w-full">
      <thead class="bg-slate-50">
        <tr>
          <th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Nombre</th>
          <th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Fecha ceremonia</th>
          <th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Recepción</th>
          <th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Estado</th>
          <th class="px-4 py-3"></th>
        </tr>
      </thead>
      <tbody>${filas || `<tr><td colspan="5" class="text-center py-8 text-slate-400 text-sm">Sin ceremonias registradas</td></tr>`}</tbody>
    </table>`;

  document.querySelectorAll(".btn-editar").forEach((btn) => {
    btn.addEventListener("click", () => {
      const ceremonia = ceremonias.find((c) => c.id === btn.dataset.id);
      mostrarFormulario(ceremonia);
    });
  });
}

function mostrarFormulario(ceremonia = null) {
  formContainer.classList.remove("hidden");
  formContainer.innerHTML = `
    <h3 class="text-lg font-semibold text-slate-900 mb-4">${ceremonia ? "Modificar" : "Nueva"} ceremonia</h3>
    <form id="form-ceremonia" class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
        <input name="nombre" required value="${ceremonia?.nombre || ""}" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      </div>
      <div class="grid grid-cols-3 gap-4">
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Fecha ceremonia</label>
          <input type="datetime-local" name="fechaCeremonia" required value="${ceremonia?.fechaCeremonia?.slice(0,16) || ""}" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Inicio recepción</label>
          <input type="datetime-local" name="inicioRecepcion" required value="${ceremonia?.inicioRecepcion?.slice(0,16) || ""}" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Cierre recepción</label>
          <input type="datetime-local" name="cierreRecepcion" required value="${ceremonia?.cierreRecepcion?.slice(0,16) || ""}" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
      </div>
      <div>
        <label class="block text-sm font-medium text-slate-700 mb-1">Estado</label>
        <select name="estado" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="Activa" ${ceremonia?.estado === "Activa" ? "selected" : ""}>Activa</option>
          <option value="Cerrada" ${ceremonia?.estado === "Cerrada" ? "selected" : ""}>Cerrada</option>
          <option value="Cancelada" ${ceremonia?.estado === "Cancelada" ? "selected" : ""}>Cancelada</option>
        </select>
      </div>
      <div class="flex justify-end gap-3">
        <button type="button" id="btn-cancelar" class="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-600">Cancelar</button>
        <button type="submit" class="px-4 py-2 text-sm rounded-lg bg-slate-900 text-white">Guardar</button>
      </div>
    </form>`;

  document.getElementById("btn-cancelar").addEventListener("click", () => {
    formContainer.classList.add("hidden");
  });

  document.getElementById("form-ceremonia").addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    try {
      if (ceremonia) {
        await actualizarCeremonia(ceremonia.id, data, usuarioActual.email);
      } else {
        await crearCeremonia(data, usuarioActual.email);
      }
      mostrarAlerta("Ceremonia guardada correctamente.", "exito");
      formContainer.classList.add("hidden");
      await cargarCeremonias();
    } catch (err) {
      mostrarAlerta(err.message);
    }
  });
}

async function cargarCeremonias() {
  loading.classList.remove("hidden");
  tablaContainer.classList.add("hidden");
  try {
    const ceremonias = await listarCeremonias();
    renderTabla(ceremonias);
    tablaContainer.classList.remove("hidden");
  } catch (err) {
    mostrarAlerta(err.message);
  } finally {
    loading.classList.add("hidden");
  }
}

document.getElementById("btn-nueva").addEventListener("click", () => mostrarFormulario());

(async function init() {
  try {
    const roles = await verificarAcceso();
    if (!hasRole(roles, ["SAC", "ADMIN"])) {
      document.body.innerHTML = `<div class="p-10 text-center text-red-600">No tiene permisos para acceder a este módulo.</div>`;
      return;
    }
    await cargarCeremonias();
  } catch (err) {
    mostrarAlerta(err.message);
    loading.classList.add("hidden");
  }
})();
