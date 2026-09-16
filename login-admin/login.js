// login-admin/login.js

import { login } from "../shared/authService.js";

const btn = document.getElementById("btn-login");
const errorBox = document.getElementById("error-box");
const errorMsg = document.getElementById("error-msg");

btn.addEventListener("click", async () => {
  errorBox.classList.add("hidden");
  btn.disabled = true;
  btn.textContent = "Verificando credenciales...";

  try {
    const { user, roles } = await login();

    if (roles.length === 0) {
      throw new Error("Su cuenta no tiene roles activos asignados. Contacte al administrador.");
    }

    sessionStorage.setItem("enap_user", JSON.stringify(user));
    sessionStorage.setItem("enap_roles", JSON.stringify(roles));

    // Redirige según el rol principal
    if (roles.includes("SAC") || roles.includes("ADMIN")) {
      window.location.href = "../grados/secretaria/index.html";
    } else {
      window.location.href = "../index.html";
    }
  } catch (err) {
    errorMsg.textContent = err.message || "Ocurrió un error al iniciar sesión.";
    errorBox.classList.remove("hidden");
  } finally {
    btn.disabled = false;
    btn.textContent = "Iniciar sesión con cuenta institucional ENAP";
  }
});
