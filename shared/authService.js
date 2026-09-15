// login-admin/login.js

import { login } from "../shared/authService.js";

const btn = document.getElementById("btn-login");
const errorBox = document.getElementById("error-box");
const errorMsg = document.getElementById("error-msg");

btn.addEventListener("click", async () => {
  console.log("[1] Clic detectado, iniciando proceso de login...");
  errorBox.classList.remove("visible");
  btn.disabled = true;
  btn.textContent = "Verificando credenciales...";

  try {
    console.log("[2] Llamando a login()...");
    const { user, roles } = await login();
    console.log("[3] login() terminó bien. Usuario:", user, "Roles:", roles);

    if (roles.length === 0) {
      console.log("[4] El usuario no tiene roles activos.");
      throw new Error("Su cuenta no tiene roles activos asignados. Contacte al administrador.");
    }

    sessionStorage.setItem("enap_user", JSON.stringify(user));
    sessionStorage.setItem("enap_roles", JSON.stringify(roles));
    console.log("[5] Guardado en sessionStorage. Redirigiendo...");

    if (roles.includes("SAC") || roles.includes("ADMIN")) {
      console.log("[6] Redirigiendo a grados/secretaria/");
      window.location.href = "../grados/secretaria/index.html";
    } else {
      console.log("[6] Redirigiendo a index.html");
      window.location.href = "../index.html";
    }
  } catch (err) {
    console.error("[ERROR] Falló en algún punto:", err);
    errorMsg.textContent = err.message || "Ocurrió un error al iniciar sesión.";
    errorBox.classList.add("visible");
  } finally {
    console.log("[7] Bloque finally ejecutado (esto se ejecuta siempre, con o sin error).");
    btn.disabled = false;
    btn.textContent = "Iniciar sesión con cuenta institucional ENAP";
  }
});
