import { apiFetch, csrfCookie } from "../common/js/api.js";
import { setUser, getUser, clearAuth } from "../common/js/auth.js";

// Limpiar sesiones previas
clearAuth();

if (getUser()) {
  location.href = "../index.html";
}

// Elementos del DOM
const step1 = document.getElementById("step1");
const step2 = document.getElementById("step2");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const displayEmail = document.getElementById("displayEmail");
const msgStep1 = document.getElementById("msgStep1");
const msgStep2 = document.getElementById("msgStep2");
const btnContinue = document.getElementById("btnContinue");
const btnLogin = document.getElementById("btnLogin");
const btnBack = document.getElementById("btnBack");
const btnText1 = document.getElementById("btnText1");
const btnSpinner1 = document.getElementById("btnSpinner1");
const btnText2 = document.getElementById("btnText2");
const btnSpinner2 = document.getElementById("btnSpinner2");
const togglePass = document.getElementById("togglePass");
const eyeIcon = document.getElementById("eyeIcon");
const formLogin = document.getElementById("formLogin");

// Mostrar/ocultar contraseña
if (togglePass) {
  togglePass.addEventListener("click", () => {
    const isPass = passwordInput.type === "password";
    passwordInput.type = isPass ? "text" : "password";
    eyeIcon.className = isPass ? "bi bi-eye-slash" : "bi bi-eye";
  });
}

// Volver al paso 1
btnBack.addEventListener("click", () => {
  step1.style.display = "block";
  step2.style.display = "none";
  msgStep1.textContent = "";
  msgStep2.textContent = "";
  emailInput.value = "";
  passwordInput.value = "";
  cachedPreToken = null;
  cachedEmail = null;
});

function setLoading(step, loading) {
  if (step === 1) {
    btnContinue.disabled = loading;
    btnText1.textContent = loading ? "Verificando..." : "Continuar";
    btnSpinner1.classList.toggle("d-none", !loading);
  } else {
    btnLogin.disabled = loading;
    btnText2.textContent = loading ? "Ingresando..." : "Ingresar";
    btnSpinner2.classList.toggle("d-none", !loading);
  }
}

function showMessage(step, text, isError = true) {
  const msgElement = step === 1 ? msgStep1 : msgStep2;
  msgElement.textContent = text;
  msgElement.className = isError ? "text-danger small mb-3" : "text-success small mb-3";
}

let cachedPreToken = null;
let cachedEmail = null;

// PASO 1: Validar email y obtener pre_token
btnContinue.addEventListener("click", async () => {
  const email = emailInput.value.trim();

  if (!email) {
    showMessage(1, "Ingresa tu correo electrónico.");
    return;
  }

  setLoading(1, true);
  showMessage(1, "");

  try {
    await csrfCookie();
    
    const res = await apiFetch("/auth/iniciar", {
      method: "POST",
      body: JSON.stringify({ email }),
    });

    const data = await res.json();

    if (!res.ok) {
      showMessage(1, data.message || "El correo no está registrado.");
      return;
    }

    cachedPreToken = data.pre_token;
    cachedEmail = email;

    displayEmail.textContent = email;
    step1.style.display = "none";
    step2.style.display = "block";
    passwordInput.value = "";
    passwordInput.focus();
    showMessage(2, "Correo verificado. Ingresa tu contraseña.", false);

  } catch (err) {
    console.error("Error:", err);
    showMessage(1, "No se pudo conectar con el servidor.");
  } finally {
    setLoading(1, false);
  }
});

// PASO 2: Validar contraseña
if (formLogin) {
  formLogin.addEventListener("submit", async (e) => {
    e.preventDefault();

    const password = passwordInput.value;

    if (!password) {
      showMessage(2, "Ingresa tu contraseña.");
      return;
    }

    if (!cachedPreToken || !cachedEmail) {
      showMessage(2, "Sesión expirada. Debes volver a ingresar el correo.");
      setTimeout(() => btnBack.click(), 2000);
      return;
    }

    setLoading(2, true);
    showMessage(2, "");

    try {
      await csrfCookie();

      const res = await apiFetch("/auth/verificar", {
        method: "POST",
        body: JSON.stringify({
          email: cachedEmail,
          token: cachedPreToken,
          password: password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        showMessage(2, data.message || "Contraseña incorrecta.");
        return;
      }

      // Obtener datos del usuario y token
      const userData = data.usuario || data.user;
      const accessToken = data.access_token;
      
      if (!userData) {
        showMessage(2, "Error al obtener datos del usuario.");
        return;
      }

      // Guardar usuario con token
      const userWithToken = {
        ...userData,
        access_token: accessToken
      };
      
      setUser(userWithToken);
      
      // Verificar que se guardó correctamente
      const savedUser = getUser();
      console.log("Usuario guardado:", savedUser);
      
      // Redirigir
      location.href = "../index.html";

    } catch (err) {
      console.error("Error:", err);
      showMessage(2, "No se pudo conectar con el servidor.");
    } finally {
      setLoading(2, false);
    }
  });
}