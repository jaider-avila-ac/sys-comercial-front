// ajustes/js/usuario-form.controller.js
import { getUser } from "../../common/js/auth.js";
import { getUsuario, crearUsuario, editarUsuario, cambiarPassword } from "./usuarios.service.js";

const me = getUser();
if (!me || !["SUPER_ADMIN", "EMPRESA_ADMIN"].includes(me.rol)) {
  alert("No tienes permisos para acceder a esta sección.");
  location.href = "../index.html";
}

// ── Leer ?id= de la URL ──────────────────────────────────────
const params = new URLSearchParams(location.search);
const editId = params.get("id") ? Number(params.get("id")) : null;
const isEdit = editId !== null;

// ── Refs DOM ─────────────────────────────────────────────────
const inp = {
  nombres:         document.getElementById("nombres"),
  apellidos:       document.getElementById("apellidos"),
  email:           document.getElementById("email"),
  password:        document.getElementById("password"),
  passwordConfirm: document.getElementById("passwordConfirm"),
  rol:             document.getElementById("rol"),
  empresa_id:      document.getElementById("empresa_id"),
  is_activo:       document.getElementById("is_activo"),
};
const errEl          = document.getElementById("formErr");
const okEl           = document.getElementById("formOk");
const btnGuardar     = document.getElementById("btnGuardar");
const wrapEmpresa    = document.getElementById("wrapEmpresa");
const wrapCamposPass = document.getElementById("wrapCamposPass");
const btnTogglePass  = document.getElementById("btnTogglePass");
const passSubtitle   = document.getElementById("passSubtitle");
const loadingMsg     = document.getElementById("loadingMsg");

// ── Ajustes según rol del actor ──────────────────────────────
if (me.rol === "SUPER_ADMIN") {
  const opt = document.createElement("option");
  opt.value = "SUPER_ADMIN";
  opt.textContent = "Super Admin";
  inp.rol.appendChild(opt);
  wrapEmpresa.classList.remove("d-none");
}

// ── Modo edición: ocultar campos de contraseña por defecto ───
let cambiarPassActivo = false;

if (isEdit) {
  document.getElementById("tituloForm").textContent    = "Editar usuario";
  document.getElementById("subtituloForm").textContent = `ID: ${editId}`;
  passSubtitle.textContent = "";

  // Ocultar campos de contraseña hasta que el usuario decida cambiarla
  wrapCamposPass.classList.add("d-none");
  btnTogglePass.classList.remove("d-none");

  btnTogglePass.addEventListener("click", () => {
    cambiarPassActivo = !cambiarPassActivo;
    wrapCamposPass.classList.toggle("d-none", !cambiarPassActivo);
    btnTogglePass.innerHTML = cambiarPassActivo
      ? '<i class="bi bi-x me-1"></i>Cancelar cambio'
      : '<i class="bi bi-pencil me-1"></i>Cambiar contraseña';

    if (!cambiarPassActivo) {
      inp.password.value        = "";
      inp.passwordConfirm.value = "";
    }
  });
}

// ── Cargar datos si es edición ────────────────────────────────
if (isEdit) {
  loadingMsg.classList.remove("d-none");
  try {
    const u = await getUsuario(editId);
    inp.nombres.value    = u.nombres    ?? "";
    inp.apellidos.value  = u.apellidos  ?? "";
    inp.email.value      = u.email      ?? "";
    inp.rol.value        = u.rol        ?? "OPERATIVO";
    inp.empresa_id.value = u.empresa_id ?? "";
    inp.is_activo.value  = u.is_activo  ? "1" : "0";
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove("d-none");
  } finally {
    loadingMsg.classList.add("d-none");
  }
}

// ── Guardar ───────────────────────────────────────────────────
btnGuardar.addEventListener("click", async () => {
  errEl.classList.add("d-none");
  okEl.classList.add("d-none");

  const payload = {
    nombres:   inp.nombres.value.trim(),
    apellidos: inp.apellidos.value.trim() || null,
    email:     inp.email.value.trim(),
    rol:       inp.rol.value,
    is_activo: inp.is_activo.value === "1",
  };

  if (!payload.nombres) {
    errEl.textContent = "El nombre es obligatorio.";
    errEl.classList.remove("d-none");
    return;
  }
  if (!payload.email) {
    errEl.textContent = "El email es obligatorio.";
    errEl.classList.remove("d-none");
    return;
  }

  if (me.rol === "SUPER_ADMIN") {
    const eid = inp.empresa_id.value.trim();
    payload.empresa_id = eid ? Number(eid) : null;
  }

  const pwd     = inp.password.value;
  const pwdConf = inp.passwordConfirm.value;

  // Validar contraseña
  if (!isEdit) {
    // Creación: obligatoria
    if (pwd.length < 8) {
      errEl.textContent = "La contraseña debe tener al menos 8 caracteres.";
      errEl.classList.remove("d-none");
      return;
    }
    if (pwd !== pwdConf) {
      errEl.textContent = "Las contraseñas no coinciden.";
      errEl.classList.remove("d-none");
      return;
    }
    payload.password = pwd;
  } else if (cambiarPassActivo) {
    // Edición con cambio de contraseña solicitado
    if (pwd.length < 8) {
      errEl.textContent = "La contraseña debe tener al menos 8 caracteres.";
      errEl.classList.remove("d-none");
      return;
    }
    if (pwd !== pwdConf) {
      errEl.textContent = "Las contraseñas no coinciden.";
      errEl.classList.remove("d-none");
      return;
    }
  }

  try {
    btnGuardar.disabled = true;
    btnGuardar.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Guardando…';

    if (isEdit) {
      await editarUsuario(editId, payload);

      // Si se activó el cambio de contraseña, hacerlo en llamada separada
      if (cambiarPassActivo && pwd) {
        await cambiarPassword(editId, pwd, pwdConf);
      }

      okEl.textContent = "Usuario actualizado correctamente.";
    } else {
      await crearUsuario(payload);
      okEl.textContent = "Usuario creado correctamente.";
    }

    okEl.classList.remove("d-none");
    setTimeout(() => location.href = "usuarios.html", 1200);

  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove("d-none");
  } finally {
    btnGuardar.disabled = false;
    btnGuardar.innerHTML = '<i class="bi bi-save me-1"></i>Guardar';
  }
});