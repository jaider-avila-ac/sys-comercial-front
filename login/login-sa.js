import { apiFetch, csrfCookie } from "../common/js/api.js";
import { setUser, getUser } from "../common/js/auth.js";

// Si ya hay sesión activa de SUPER_ADMIN, redirigir directo
const existing = getUser();
if (existing?.rol === "SUPER_ADMIN") {
  location.href = "../ajustes/usuarios.html";
}

const emailInput  = document.getElementById("saEmail");
const passInput   = document.getElementById("saPassword");
const msgEl       = document.getElementById("saMsg");
const btn         = document.getElementById("saBtnLogin");
const btnText     = document.getElementById("saBtnText");
const spinner     = document.getElementById("saSpinner");
const toggleEye   = document.getElementById("saToggleEye");
const eyeIcon     = document.getElementById("saEyeIcon");

// Toggle visibilidad contraseña
toggleEye.addEventListener("click", () => {
  const isPass = passInput.type === "password";
  passInput.type = isPass ? "text" : "password";
  eyeIcon.className = isPass ? "bi bi-eye-slash" : "bi bi-eye";
});

function setLoading(v) {
  btn.disabled     = v;
  btnText.textContent = v ? "Verificando…" : "Acceder al sistema";
  spinner.style.display = v ? "block" : "none";
}

function showError(msg) {
  msgEl.textContent = msg;
  msgEl.style.display = "block";
}
function clearError() {
  msgEl.style.display = "none";
  msgEl.textContent = "";
}

async function doLogin() {
  clearError();
  const email    = emailInput.value.trim();
  const password = passInput.value;

  if (!email || !password) {
    showError("Completa todos los campos.");
    return;
  }

  setLoading(true);

  try {
    await csrfCookie();

    const res  = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();

    if (!res.ok) {
      showError(data?.message || "Credenciales inválidas.");
      return;
    }

    // ── Verificación estricta de rol ──────────────────────────
    if (data.user?.rol !== "SUPER_ADMIN") {
      // No revelar que el rol es incorrecto, mismo mensaje genérico
      showError("Acceso denegado.");
      return;
    }

    setUser(data.user);

    // Redirigir al panel de usuarios (gestión de empresas/admins)
    location.href = "../ajustes/usuarios.html";

  } catch {
    showError("No se pudo conectar con el servidor.");
  } finally {
    setLoading(false);
  }
}

// Submit con Enter
[emailInput, passInput].forEach(el =>
  el.addEventListener("keydown", e => { if (e.key === "Enter") doLogin(); })
);

btn.addEventListener("click", doLogin);
