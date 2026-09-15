// grados/radicacion/solicitud.js

import { login } from "../../shared/authService.js";
import { listarCeremoniasVigentes } from "../shared/ceremoniaService.js";
import { crearSolicitud } from "../shared/solicitudService.js";
import { generarConstanciaPDF } from "../shared/pdfConstancia.js";

const alerta = document.getElementById("alerta");
const acceso = document.getElementById("acceso");
const form = document.getElementById("form-solicitud");
const resultado = document.getElementById("resultado");

function mostrarAlerta(msg, tipo = "error") {
  alerta.textContent = msg;
  alerta.className = `mb-4 rounded-lg px-4 py-3 text-sm ${tipo === "error" ? "bg-red-50 text-red-700 border border-red-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"}`;
  alerta.classList.remove("hidden");
}

async function renderFormulario(user) {
  const ceremonias = await listarCeremoniasVigentes();

  if (ceremonias.length === 0) {
    acceso.innerHTML = `<p class="text-slate-500 text-sm">No hay ceremonias con recepción de solicitudes abierta actualmente.</p>`;
    return;
  }

  acceso.classList.add("hidden");
  form.classList.remove("hidden");

  const opciones = ceremonias.map((c) => `<option value="${c.id}">${c.nombre}</option>`).join("");

  form.innerHTML = `
    <div>
      <label class="block text-sm font-medium text-slate-700 mb-1">Ceremonia</label>
      <select name="ceremoniaId" required class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">${opciones}</select>
    </div>
    <div>
      <label class="block text-sm font-medium text-slate-700 mb-1">Nombre completo</label>
      <input name="nombreCompleto" required value="${user.displayName}" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
    </div>
    <div class="grid grid-cols-2 gap-4">
      <div>
        <label class="block text-sm font-medium text-slate-700 mb-1">Documento</label>
        <input name="documento" required class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      </div>
      <div>
        <label class="block text-sm font-medium text-slate-700 mb-1">Teléfono</label>
        <input name="telefono" required class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      </div>
    </div>
    <div>
      <label class="block text-sm font-medium text-slate-700 mb-1">Programa académico</label>
      <input name="programa" required class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
    </div>
    <div class="rounded-lg bg-slate-50 border border-slate-200 p-4 text-xs text-slate-600 max-h-32 overflow-y-auto">
      Autorizo a la Escuela Naval de Cadetes "Almirante Padilla" el tratamiento de mis datos personales
      conforme a su política institucional, para efectos del trámite de solicitud de grado.
    </div>
    <label class="flex items-center gap-2 text-sm text-slate-700">
      <input type="checkbox" name="aceptaTratamientoDatos" required class="rounded border-slate-300" />
      Acepto el tratamiento de mis datos personales
    </label>
    <div>
      <label class="block text-sm font-medium text-slate-700 mb-1">Firma (escriba su nombre completo)</label>
      <input name="firmaNombre" required placeholder="Nombre y apellidos" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm italic" />
    </div>
    <button type="submit" class="w-full bg-slate-900 text-white text-sm rounded-lg px-4 py-3">Radicar solicitud</button>
  `;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    btn.textContent = "Radicando...";

    try {
      const fd = new FormData(e.target);
      const data = {
        ceremoniaId: fd.get("ceremoniaId"),
        nombreCompleto: fd.get("nombreCompleto"),
        documento: fd.get("documento"),
        correo: user.email,
        telefono: fd.get("telefono"),
        programa: fd.get("programa"),
        aceptaTratamientoDatos: fd.get("aceptaTratamientoDatos") === "on",
        firmaNombre: fd.get("firmaNombre"),
        fechaAceptacion: new Date().toISOString(),
      };

      const radicado = await crearSolicitud(data);
      const pdf = generarConstanciaPDF({ ...data, radicado });

      form.classList.add("hidden");
      resultado.classList.remove("hidden");
      resultado.innerHTML = `
        <p class="text-emerald-600 font-semibold mb-2">Solicitud radicada exitosamente</p>
        <p class="text-sm text-slate-600 mb-4">Número de radicado: <strong>${radicado}</strong></p>
        <button id="btn-descargar" class="bg-slate-900 text-white text-sm rounded-lg px-4 py-2">Descargar constancia PDF</button>
      `;
      document.getElementById("btn-descargar").addEventListener("click", () => {
        pdf.save(`Constancia_${radicado}.pdf`);
      });
    } catch (err) {
      mostrarAlerta(err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = "Radicar solicitud";
    }
  });
}

document.getElementById("btn-login").addEventListener("click", async () => {
  try {
    const { user } = await login();
    await renderFormulario(user);
  } catch (err) {
    mostrarAlerta(err.message);
  }
});
