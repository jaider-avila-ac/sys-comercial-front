// ajustes/js/usuarios.controller.js
import { getUser } from "../../common/js/auth.js";
import {
  listarUsuarios, toggleUsuario, cambiarPassword,
} from "./usuarios.service.js";

// ── Guards de rol ────────────────────────────────────────────
const me = getUser();
if (!me || !["SUPER_ADMIN", "EMPRESA_ADMIN"].includes(me.rol)) {
  alert("No tienes permisos para acceder a esta sección.");
  location.href = "../index.html";
}

// ── Helpers ──────────────────────────────────────────────────
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, m =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m])
  );
}
function fmtDatetime(iso) {
  if (!iso) return '<span class="text-muted">—</span>';
  const d = new Date(iso);
  return d.toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });
}

const ROL_LABELS = {
  SUPER_ADMIN:   '<span class="badge bg-danger">Super Admin</span>',
  EMPRESA_ADMIN: '<span class="badge bg-primary">Empresa Admin</span>',
  OPERATIVO:     '<span class="badge bg-secondary">Operativo</span>',
};

// ── Estado ───────────────────────────────────────────────────
let currentPage = 1;
let lastPage    = 1;

// ── Refs DOM ─────────────────────────────────────────────────
const tbody      = document.getElementById("tbody");
const pageInfo   = document.getElementById("pageInfo");
const btnPrev    = document.getElementById("btnPrev");
const btnNext    = document.getElementById("btnNext");
const inputSearch  = document.getElementById("search");
const selRol       = document.getElementById("filtroRol");
const selActivo    = document.getElementById("filtroActivo");

// SUPER_ADMIN puede ver SUPER_ADMINs; ocultar opción si no aplica
if (me.rol !== "SUPER_ADMIN") {
  const optSA = selRol.querySelector('option[value="SUPER_ADMIN"]');
  if (optSA) optSA.remove();
}

// ── Carga tabla ──────────────────────────────────────────────
async function load(page = 1) {
  currentPage = page;
  tbody.innerHTML = `<tr><td colspan="6" class="text-muted p-3">Cargando…</td></tr>`;

  try {
    const data = await listarUsuarios({
      search:  inputSearch.value.trim(),
      rol:     selRol.value,
      activo:  selActivo.value,
      page,
    });

    lastPage = data.last_page || 1;
    const rows = data.data || [];

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted p-4">Sin usuarios para los filtros aplicados.</td></tr>`;
      pageInfo.textContent = "0 registros";
      return;
    }

    tbody.innerHTML = rows.map(u => {
      const activoBadge = u.is_activo
        ? '<span class="badge bg-success-subtle text-success border border-success-subtle">Activo</span>'
        : '<span class="badge bg-danger-subtle text-danger border border-danger-subtle">Inactivo</span>';

      const toggleIcon  = u.is_activo ? "bi-toggle-on text-success" : "bi-toggle-off text-secondary";
      const toggleTitle = u.is_activo ? "Desactivar" : "Activar";

      // No mostrar toggle si soy yo mismo
      const esSelf = u.id === me.id;

      return `<tr>
        <td>
          <div class="fw-semibold">${esc(u.nombres)} ${esc(u.apellidos ?? "")}</div>
          <div class="text-muted small">ID ${u.id}${u.empresa ? " · " + esc(u.empresa.nombre) : ""}</div>
        </td>
        <td class="small">${esc(u.email)}</td>
        <td>${ROL_LABELS[u.rol] ?? esc(u.rol)}</td>
        <td class="small text-nowrap">${fmtDatetime(u.last_login_at)}</td>
        <td>${activoBadge}</td>
        <td class="text-end text-nowrap">
        <a class="btn btn-outline-info btn-sm" 
   href="auditoria.html?usuario_id=${u.id}" 
   title="Historial">
  <i class="bi bi-clock-history"></i>
</a>
          <a href="usuario-form.html?id=${u.id}"
             class="btn btn-sm btn-outline-primary me-1" title="Editar">
            <i class="bi bi-pencil"></i>
          </a>
          <button class="btn btn-sm btn-outline-secondary me-1"
                  data-pwd="${u.id}"
                  data-nombre="${esc(u.nombres + " " + (u.apellidos ?? ""))}"
                  title="Cambiar contraseña">
            <i class="bi bi-key"></i>
          </button>
          ${esSelf ? "" : `
          <button class="btn btn-sm btn-outline-secondary"
                  data-toggle="${u.id}" title="${toggleTitle}">
            <i class="bi ${toggleIcon} fs-5"></i>
          </button>`}
        </td>
      </tr>`;
    }).join("");

    pageInfo.textContent = `Página ${data.current_page} de ${data.last_page} · ${data.total} usuarios`;
    btnPrev.disabled = data.current_page <= 1;
    btnNext.disabled = data.current_page >= data.last_page;

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-danger p-3">${esc(err.message)}</td></tr>`;
  }
}

// ── Toggle activo/inactivo ────────────────────────────────────
tbody.addEventListener("click", async e => {
  const btnToggle = e.target.closest("[data-toggle]");
  if (btnToggle) {
    const id = btnToggle.dataset.toggle;
    btnToggle.disabled = true;
    try {
      await toggleUsuario(id);
      load(currentPage);
    } catch (err) {
      alert(err.message);
      btnToggle.disabled = false;
    }
    return;
  }

  // Abrir modal de contraseña
  const btnPwd = e.target.closest("[data-pwd]");
  if (btnPwd) {
    document.getElementById("mpwdId").value      = btnPwd.dataset.pwd;
    document.getElementById("mpwdNombre").textContent = btnPwd.dataset.nombre;
    document.getElementById("mpwdPass").value    = "";
    document.getElementById("mpwdConfirm").value = "";
    document.getElementById("mpwdErr").classList.add("d-none");
    document.getElementById("mpwdOk").classList.add("d-none");
    modalPwd.show();
  }
});

// ── Modal contraseña ──────────────────────────────────────────
const modalPwd = new bootstrap.Modal(document.getElementById("modalPassword"));

document.getElementById("btnMpwdGuardar").addEventListener("click", async () => {
  const id      = document.getElementById("mpwdId").value;
  const pass    = document.getElementById("mpwdPass").value;
  const confirm = document.getElementById("mpwdConfirm").value;
  const errEl   = document.getElementById("mpwdErr");
  const okEl    = document.getElementById("mpwdOk");

  errEl.classList.add("d-none");
  okEl.classList.add("d-none");

  if (pass.length < 8) {
    errEl.textContent = "La contraseña debe tener al menos 8 caracteres.";
    errEl.classList.remove("d-none");
    return;
  }
  if (pass !== confirm) {
    errEl.textContent = "Las contraseñas no coinciden.";
    errEl.classList.remove("d-none");
    return;
  }

  const btn = document.getElementById("btnMpwdGuardar");
  try {
    btn.disabled = true;
    await cambiarPassword(id, pass, confirm);
    okEl.classList.remove("d-none");
    document.getElementById("mpwdPass").value    = "";
    document.getElementById("mpwdConfirm").value = "";
    setTimeout(() => modalPwd.hide(), 1500);
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove("d-none");
  } finally {
    btn.disabled = false;
  }
});

// ── Filtros ───────────────────────────────────────────────────
let searchTimer = null;
inputSearch.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => load(1), 300);
});
selRol.addEventListener("change",    () => load(1));
selActivo.addEventListener("change", () => load(1));
document.getElementById("btnRefresh").addEventListener("click", () => load(1));
btnPrev.addEventListener("click", () => load(Math.max(1, currentPage - 1)));
btnNext.addEventListener("click", () => load(Math.min(lastPage, currentPage + 1)));

// ── Init ──────────────────────────────────────────────────────
load(1);
