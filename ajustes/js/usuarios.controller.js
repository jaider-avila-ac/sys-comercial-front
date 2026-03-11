// ajustes/js/usuarios.controller.js
import { getUser } from "../../common/js/auth.js";
import {
  listarUsuarios, toggleUsuario, cambiarPassword,
  crearEmpresaConAdmin,
} from "./usuarios.service.js";

// ── Guards de rol ────────────────────────────────────────────
const me = getUser();
if (!me || !["SUPER_ADMIN", "EMPRESA_ADMIN"].includes(me.rol)) {
  alert("No tienes permisos para acceder a esta sección.");
  location.href = "../index.html";
}

const isSA = me.rol === "SUPER_ADMIN";

// ── Helpers ──────────────────────────────────────────────────
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, m =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m])
  );
}
function fmtDatetime(iso) {
  if (!iso) return '<span class="text-muted">—</span>';
  return new Date(iso).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });
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

// ── Panel SUPER_ADMIN ─────────────────────────────────────────
if (isSA) {
  // Mostrar panel exclusivo SA
  document.getElementById("saPanelWrap")?.classList.remove("d-none");
  // Mostrar columna Empresa en tabla
  document.getElementById("thEmpresa")?.classList.remove("d-none");
  // Mostrar filtro por empresa
  document.getElementById("filtroEmpresaWrap")?.classList.remove("d-none");
} else {
  // EMPRESA_ADMIN no ve SUPER_ADMINs en el filtro
  const optSA = selRol.querySelector('option[value="SUPER_ADMIN"]');
  if (optSA) optSA.remove();
}

// ── Carga tabla ──────────────────────────────────────────────
async function load(page = 1) {
  currentPage = page;
  const cols = isSA ? 7 : 6;
  tbody.innerHTML = `<tr><td colspan="${cols}" class="text-muted p-3">Cargando…</td></tr>`;

  try {
    const empresaId = isSA
      ? (document.getElementById("filtroEmpresaId")?.value.trim() || "")
      : "";

    const data = await listarUsuarios({
      search:     inputSearch.value.trim(),
      rol:        selRol.value,
      activo:     selActivo.value,
      empresa_id: empresaId,
      page,
    });

    lastPage = data.last_page || 1;
    const rows = data.data || [];

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="${cols}" class="text-center text-muted p-4">
        Sin usuarios para los filtros aplicados.
      </td></tr>`;
      pageInfo.textContent = "0 registros";
      return;
    }

    tbody.innerHTML = rows.map(u => {
      const activoBadge = u.is_activo
        ? '<span class="badge bg-success-subtle text-success border border-success-subtle">Activo</span>'
        : '<span class="badge bg-danger-subtle text-danger border border-danger-subtle">Inactivo</span>';
      const toggleIcon  = u.is_activo ? "bi-toggle-on text-success" : "bi-toggle-off text-secondary";
      const toggleTitle = u.is_activo ? "Desactivar" : "Activar";
      const esSelf      = u.id === me.id;

      const colEmpresa = isSA
        ? `<td class="small text-muted">${esc(u.empresa?.nombre ?? "—")}</td>`
        : "";

      return `<tr>
        <td>
          <div class="fw-semibold">${esc(u.nombres)} ${esc(u.apellidos ?? "")}</div>
          <div class="text-muted small">ID ${u.id}</div>
        </td>
        <td class="small">${esc(u.email)}</td>
        <td>${ROL_LABELS[u.rol] ?? esc(u.rol)}</td>
        ${colEmpresa}
        <td class="small text-nowrap">${fmtDatetime(u.last_login_at)}</td>
        <td>${activoBadge}</td>
        <td class="text-end text-nowrap">
          <a class="btn btn-outline-info btn-sm"
             href="auditoria.html?usuario_id=${u.id}" title="Historial">
            <i class="bi bi-clock-history"></i>
          </a>
          <a href="usuario-form.html?id=${u.id}"
             class="btn btn-sm btn-outline-primary ms-1" title="Editar">
            <i class="bi bi-pencil"></i>
          </a>
          <button class="btn btn-sm btn-outline-secondary ms-1"
                  data-pwd="${u.id}"
                  data-nombre="${esc(u.nombres + " " + (u.apellidos ?? ""))}"
                  title="Cambiar contraseña">
            <i class="bi bi-key"></i>
          </button>
          ${esSelf ? "" : `
          <button class="btn btn-sm btn-outline-secondary ms-1"
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
    tbody.innerHTML = `<tr><td colspan="${cols}" class="text-danger p-3">${esc(err.message)}</td></tr>`;
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

  // Abrir modal contraseña
  const btnPwd = e.target.closest("[data-pwd]");
  if (btnPwd) {
    document.getElementById("mpwdId").value = btnPwd.dataset.pwd;
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

// ── Modal Nueva Empresa + Admin (solo SUPER_ADMIN) ────────────
if (isSA) {
  const modalEmp    = new bootstrap.Modal(document.getElementById("modalNuevaEmpresa"));
  const empErrEl    = document.getElementById("empErr");
  const empOkEl     = document.getElementById("empOk");
  const btnGuardar  = document.getElementById("btnGuardarEmpresa");

  // Abrir modal
  document.getElementById("btnNuevaEmpresa")?.addEventListener("click", () => {
    // Limpiar campos
    ["empNombre","empNit","empTelefono","empCiudad","empDireccion",
     "adminNombres","adminApellidos","adminEmail","adminPassword","adminPasswordConfirm"
    ].forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
    empErrEl.classList.add("d-none");
    empOkEl.classList.add("d-none");
    modalEmp.show();
  });

  // Ir a vista de empresas (ajustar ruta si existe)
  document.getElementById("btnVerEmpresas")?.addEventListener("click", () => {
    location.href = "../empresa/empresa.html";
  });

  // Toggle contraseña admin en modal
  document.getElementById("btnToggleAdminPass")?.addEventListener("click", () => {
    const inp = document.getElementById("adminPassword");
    const ico = document.getElementById("adminEyeIcon");
    const isPass = inp.type === "password";
    inp.type = isPass ? "text" : "password";
    ico.className = isPass ? "bi bi-eye-slash" : "bi bi-eye";
  });

  // Guardar empresa + admin
  btnGuardar.addEventListener("click", async () => {
    empErrEl.classList.add("d-none");
    empOkEl.classList.add("d-none");

    const empNombre  = document.getElementById("empNombre").value.trim();
    const empNit     = document.getElementById("empNit").value.trim();
    const empTel     = document.getElementById("empTelefono").value.trim();
    const empCiudad  = document.getElementById("empCiudad").value.trim();
    const empDir     = document.getElementById("empDireccion").value.trim();

    const nombres    = document.getElementById("adminNombres").value.trim();
    const apellidos  = document.getElementById("adminApellidos").value.trim();
    const email      = document.getElementById("adminEmail").value.trim();
    const password   = document.getElementById("adminPassword").value;
    const passConfirm = document.getElementById("adminPasswordConfirm").value;

    // Validaciones
    if (!empNombre) {
      empErrEl.textContent = "El nombre de la empresa es obligatorio.";
      empErrEl.classList.remove("d-none");
      return;
    }
    if (!nombres) {
      empErrEl.textContent = "El nombre del administrador es obligatorio.";
      empErrEl.classList.remove("d-none");
      return;
    }
    if (!email) {
      empErrEl.textContent = "El email del administrador es obligatorio.";
      empErrEl.classList.remove("d-none");
      return;
    }
    if (password.length < 8) {
      empErrEl.textContent = "La contraseña debe tener al menos 8 caracteres.";
      empErrEl.classList.remove("d-none");
      return;
    }
    if (password !== passConfirm) {
      empErrEl.textContent = "Las contraseñas no coinciden.";
      empErrEl.classList.remove("d-none");
      return;
    }

    btnGuardar.disabled = true;
    btnGuardar.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Creando…';

    try {
      const result = await crearEmpresaConAdmin({
        empresa: {
          nombre:    empNombre,
          nit:       empNit || null,
          telefono:  empTel || null,
          ciudad:    empCiudad || null,
          direccion: empDir || null,
        },
        admin: {
          nombres,
          apellidos: apellidos || null,
          email,
          password,
          password_confirmation: passConfirm,
        },
      });

      empOkEl.innerHTML = `
        <i class="bi bi-check-circle me-1"></i>
        Empresa <strong>${esc(result.empresa?.nombre ?? empNombre)}</strong>
        creada. Admin: <strong>${esc(email)}</strong>
        (ID empresa: ${result.empresa?.id ?? "—"})
      `;
      empOkEl.classList.remove("d-none");
      setTimeout(() => {
        modalEmp.hide();
        load(1);
      }, 2000);

    } catch (err) {
      empErrEl.textContent = err.message;
      empErrEl.classList.remove("d-none");
    } finally {
      btnGuardar.disabled = false;
      btnGuardar.innerHTML = '<i class="bi bi-building-add me-1"></i>Crear empresa y administrador';
    }
  });
}

// ── Filtros ───────────────────────────────────────────────────
let searchTimer = null;
inputSearch.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => load(1), 300);
});
selRol.addEventListener("change",    () => load(1));
selActivo.addEventListener("change", () => load(1));
document.getElementById("btnRefresh").addEventListener("click", () => load(1));
document.getElementById("filtroEmpresaId")?.addEventListener("input", () => load(1));
btnPrev.addEventListener("click", () => load(Math.max(1, currentPage - 1)));
btnNext.addEventListener("click", () => load(Math.min(lastPage, currentPage + 1)));

// ── Init ──────────────────────────────────────────────────────
load(1);