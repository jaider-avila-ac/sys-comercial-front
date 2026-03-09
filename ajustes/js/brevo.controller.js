import { apiFetch } from "../../common/js/api.js";
import { getUser } from "../../common/js/auth.js";

const me = getUser();

if (!me || !["SUPER_ADMIN", "EMPRESA_ADMIN"].includes(me.rol)) {
  alert("No tienes permisos para acceder a esta sección.");
  location.href = "../index.html";
}

const switchActivo = document.getElementById("switchActivo");
const apiKey = document.getElementById("apiKey");
const senderName = document.getElementById("senderName");
const senderEmail = document.getElementById("senderEmail");
const templateId = document.getElementById("templateId");
const formMsg = document.getElementById("formMsg");
const statusDot = document.getElementById("statusDot");
const statusMsg = document.getElementById("statusMsg");
const testCard = document.getElementById("testCard");
const testEmail = document.getElementById("testEmail");
const testMsg = document.getElementById("testMsg");

function setStatus(state, text) {
  statusDot.className = "status-dot" + (state ? " " + state : "");
  statusMsg.textContent = text;
}

function showMsg(text, type = "danger") {
  formMsg.className = "alert alert-" + type + " py-2 small";
  formMsg.textContent = text;
  formMsg.classList.remove("d-none");
}

function hideMsg() {
  formMsg.classList.add("d-none");
}

document.getElementById("btnEye").addEventListener("click", () => {
  const isPass = apiKey.type === "password";
  apiKey.type = isPass ? "text" : "password";
  document.getElementById("eyeIcon").className = isPass
    ? "bi bi-eye-slash"
    : "bi bi-eye";
});

async function cargarConfig() {
  setStatus("loading", "Cargando configuración...");
  hideMsg();

  try {
    const res = await apiFetch("/brevo/config");
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.message || "Error al cargar la configuración.");
    }

    const cfg = data.config;

    if (!cfg) {
      switchActivo.checked = false;
      senderName.value = "";
      senderEmail.value = "";
      templateId.value = "";
      apiKey.value = "";
      apiKey.placeholder = "xkeysib-...";
      testCard.style.display = "none";
      setStatus("", "Sin configuración. Completa el formulario y guarda.");
      return;
    }

    switchActivo.checked = !!cfg.is_activo;
    senderName.value = cfg.sender_name || "";
    senderEmail.value = cfg.sender_email || "";
    templateId.value = cfg.template_id || "";
    apiKey.value = "";
    apiKey.placeholder = cfg.tiene_key
      ? "API Key guardada - déjala vacía para no cambiarla"
      : "xkeysib-...";

    testCard.style.display = "";
    setStatus(cfg.is_activo ? "ok" : "", "Configuración cargada correctamente.");
  } catch (err) {
    setStatus("error", err.message || "Error al cargar.");
  }
}

document.getElementById("btnGuardar").addEventListener("click", async () => {
  hideMsg();

  const payload = {
    is_activo: switchActivo.checked,
    api_key: apiKey.value.trim() || null,
    sender_name: senderName.value.trim(),
    sender_email: senderEmail.value.trim(),
    template_id: templateId.value ? parseInt(templateId.value, 10) : null,
  };

  if (!payload.sender_name) {
    showMsg("El nombre del remitente es requerido.");
    return;
  }

  if (!payload.sender_email) {
    showMsg("El email del remitente es requerido.");
    return;
  }

  setStatus("loading", "Guardando configuración...");

  try {
    const res = await apiFetch("/brevo/config", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.message || "Error al guardar.");
    }

    showMsg(data?.message || "Configuración guardada correctamente.", "success");
    apiKey.value = "";
    await cargarConfig();
  } catch (err) {
    setStatus("error", "Error al guardar");
    showMsg(err.message || "Error al guardar.");
  }
});

document.getElementById("btnTest").addEventListener("click", () => {
  testCard.style.display = testCard.style.display === "none" ? "" : "none";
});

document.getElementById("btnEnviarTest").addEventListener("click", async () => {
  const email = document.getElementById("testEmail").value.trim();
  const msgEl = document.getElementById("testMsg");

  if (!email) {
    msgEl.className = "small text-danger mt-2";
    msgEl.textContent = "Ingresa un email de destino.";
    return;
  }

  msgEl.className = "small text-muted mt-2";
  msgEl.textContent = "Enviando email de prueba...";

  try {
    const res = await apiFetch("/brevo/test", {
      method: "POST",
      body: JSON.stringify({ email }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.message || "Error al enviar la prueba.");
    }

    msgEl.className = "small text-success mt-2";
    msgEl.textContent = data?.message || "Email enviado correctamente.";
  } catch (err) {
    msgEl.className = "small text-danger mt-2";
    msgEl.textContent = err.message || "Error de conexión.";
  }
});

cargarConfig();