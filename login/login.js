import { apiFetch, csrfCookie } from "../common/js/api.js";
import { setUser, getUser } from "../common/js/auth.js";

if (getUser()) location.href = "../index.html";

const form       = document.getElementById("formLogin");
const msg        = document.getElementById("msg");
const btnLogin   = document.getElementById("btnLogin");
const btnText    = document.getElementById("btnText");
const btnSpinner = document.getElementById("btnSpinner");
const togglePass = document.getElementById("togglePass");
const passInput  = document.getElementById("password");
const eyeIcon    = document.getElementById("eyeIcon");

togglePass.addEventListener("click", () => {
  const isPass = passInput.type === "password";
  passInput.type = isPass ? "text" : "password";
  eyeIcon.className = isPass ? "bi bi-eye-slash" : "bi bi-eye";
});

function setLoading(loading) {
  btnLogin.disabled = loading;
  btnText.textContent = loading ? "Ingresando…" : "Ingresar";
  btnSpinner.classList.toggle("d-none", !loading);
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  msg.textContent = "";

  const email = document.getElementById("email").value.trim();
  const password = passInput.value;

  if (!email || !password) {
    msg.textContent = "Completa todos los campos.";
    return;
  }

  setLoading(true);

  try {
    await csrfCookie();

    const res = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      msg.textContent = data.message || "Credenciales inválidas.";
      return;
    }

    setUser(data.user);
    location.href = "../index.html";
  } catch (err) {
    console.error(err);
    msg.textContent = "No se pudo conectar con el servidor.";
  } finally {
    setLoading(false);
  }
});