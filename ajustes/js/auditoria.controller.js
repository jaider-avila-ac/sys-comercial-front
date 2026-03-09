// ajustes/js/auditoria.controller.js
import { getUser }      from "../../common/js/auth.js";
import { apiFetch }     from "../../common/js/api.js";
import { activosAhora } from "./usuarios.service.js";

const me = getUser();
if (!me || !["SUPER_ADMIN", "EMPRESA_ADMIN"].includes(me.rol)) {
  alert("No tienes permisos para acceder a esta sección.");
  location.href = "../index.html";
}

// ── Leer parámetro de URL ─────────────────────────────────────
const urlParams       = new URLSearchParams(location.search);
const prefilUsuario   = urlParams.get("usuario_id") || "";
if (prefilUsuario) {
  document.getElementById("filtroUsuarioId").value = prefilUsuario;
}

// ── Helpers ───────────────────────────────────────────────────
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, m =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m])
  );
}
function fmtDt(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });
}
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

const ACCION_BADGE = {
  LOGIN:        "bg-success-subtle text-success",
  LOGOUT:       "bg-secondary-subtle text-secondary",
  CREAR:        "bg-primary-subtle text-primary",
  EDITAR:       "bg-warning-subtle text-warning",
  ELIMINAR:     "bg-danger-subtle text-danger",
  TOGGLE:       "bg-info-subtle text-info",
  CAMBIO_CLAVE: "bg-warning-subtle text-warning",
};

function badgeAccion(a) {
  const cls = ACCION_BADGE[a] ?? "bg-light text-dark";
  return `<span class="badge border ${cls}">${esc(a)}</span>`;
}

function parseUA(ua = "") {
  const dispositivo = ua.includes("Mobile") ? "📱 Móvil" : "🖥️ Escritorio";
  const browser = ua.includes("Edg")     ? "Edge"
    : ua.includes("Chrome")  ? "Chrome"
    : ua.includes("Firefox")  ? "Firefox"
    : ua.includes("Safari")   ? "Safari"
    : "Otro";
  return { dispositivo, browser };
}

// ── Usuarios activos ──────────────────────────────────────────
const activosWrap       = document.getElementById("activosWrap");
const selMinutos        = document.getElementById("selMinutos");
const btnRefreshActivos = document.getElementById("btnRefreshActivos");

async function loadActivos() {
  activosWrap.innerHTML = `<span class="text-muted small">Cargando…</span>`;
  try {
    const res   = await activosAhora(selMinutos.value);
    const users = res.data || [];
    if (!users.length) {
      activosWrap.innerHTML = `<span class="text-muted small">Sin actividad en los últimos ${selMinutos.value} minutos.</span>`;
      return;
    }
    activosWrap.innerHTML = users.map(u => {
      const nombre = [u.nombres, u.apellidos].filter(Boolean).join(" ");
      const ultimo = fmtDt(u.last_login_at);
      return `<div class="d-flex align-items-center gap-1 border rounded px-2 py-1 bg-white small">
        <i class="bi bi-person-circle text-success"></i>
        <span class="fw-semibold">${esc(nombre)}</span>
        <span class="text-muted">· ${esc(u.rol)}</span>
        <span class="text-muted ms-1" style="font-size:.7rem">${ultimo}</span>
      </div>`;
    }).join("");
  } catch (err) {
    activosWrap.innerHTML = `<span class="text-danger small">${esc(err.message)}</span>`;
  }
}

selMinutos.addEventListener("change", loadActivos);
btnRefreshActivos.addEventListener("click", loadActivos);

// ── Historial de sesiones ─────────────────────────────────────
const sesionesSection      = document.getElementById("sesionesSection");
const tbodySesiones        = document.getElementById("tbodySesiones");
const sesionesPageInfo     = document.getElementById("sesionesPageInfo");
const sesionesUsuarioLabel = document.getElementById("sesionesUsuarioLabel");
const btnSesionesPrev      = document.getElementById("btnSesionesPrev");
const btnSesionesNext      = document.getElementById("btnSesionesNext");

let sesionesPage     = 1;
let sesionesLastPage = 1;
let sesionesUid      = "";

async function loadSesiones(usuarioId, page = 1) {
  sesionesUid  = usuarioId;
  sesionesPage = page;

  if (!usuarioId) {
    sesionesSection.style.display = "none";
    return;
  }

  sesionesSection.style.display = "";
  sesionesUsuarioLabel.textContent = `Usuario ID: ${usuarioId}`;
  tbodySesiones.innerHTML = `<tr><td colspan="5" class="text-muted p-3">Cargando…</td></tr>`;

  const desde = document.getElementById("filtroDes").value;
  const hasta = document.getElementById("filtroHas").value;
  const params = new URLSearchParams({ page });
  if (desde) params.set("desde", desde);
  if (hasta) params.set("hasta", hasta);

  try {
    const res  = await apiFetch(`/usuarios/${usuarioId}/sesiones?${params}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Error");

    sesionesLastPage = data.last_page || 1;
    const rows = data.data || [];

    if (!rows.length) {
      tbodySesiones.innerHTML = `<tr><td colspan="5" class="text-muted p-3 text-center">Sin sesiones registradas para este período.</td></tr>`;
      sesionesPageInfo.textContent = "0 registros";
      btnSesionesPrev.disabled = true;
      btnSesionesNext.disabled = true;
      return;
    }

    tbodySesiones.innerHTML = rows.map(s => {
      const { dispositivo, browser } = parseUA(s.user_agent || "");
      return `<tr>
        <td class="text-nowrap small fw-semibold">${fmtDt(s.iniciado_en)}</td>
        <td class="small">${esc(s.ip ?? "—")}</td>
        <td class="small">${dispositivo}</td>
        <td class="small">${browser}</td>
        <td class="small text-muted"
            style="max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
            title="${esc(s.user_agent ?? "")}">${esc(s.user_agent ?? "—")}</td>
      </tr>`;
    }).join("");

    sesionesPageInfo.textContent = `Página ${data.current_page} de ${data.last_page} · ${data.total} inicios`;
    btnSesionesPrev.disabled = data.current_page <= 1;
    btnSesionesNext.disabled = data.current_page >= data.last_page;

  } catch (err) {
    tbodySesiones.innerHTML = `<tr><td colspan="5" class="text-danger p-3">${esc(err.message)}</td></tr>`;
  }
}

btnSesionesPrev.addEventListener("click", () =>
  loadSesiones(sesionesUid, Math.max(1, sesionesPage - 1))
);
btnSesionesNext.addEventListener("click", () =>
  loadSesiones(sesionesUid, Math.min(sesionesLastPage, sesionesPage + 1))
);

// ── Historial de auditoría ────────────────────────────────────
const tbodyAudit    = document.getElementById("tbodyAudit");
const auditPageInfo = document.getElementById("auditPageInfo");
const btnPrev       = document.getElementById("btnPrev");
const btnNext       = document.getElementById("btnNext");

let currentPage = 1;
let lastPage    = 1;

async function loadAudit(page = 1) {
  currentPage = page;
  tbodyAudit.innerHTML = `<tr><td colspan="6" class="text-muted p-3">Cargando…</td></tr>`;

  const uid    = document.getElementById("filtroUsuarioId").value.trim();
  const accion = document.getElementById("filtroAccion").value;
  const desde  = document.getElementById("filtroDes").value;
  const hasta  = document.getElementById("filtroHas").value;

  try {
    let data;

    if (uid) {
      const res = await apiFetch(`/usuarios/${uid}/auditoria?tipo=por&page=${page}`);
      data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Error");
    } else {
      const params = new URLSearchParams({ page });
      if (accion) params.set("accion", accion);
      if (desde)  params.set("desde",  desde);
      if (hasta)  params.set("hasta",  hasta);
      const res = await apiFetch(`/auditoria?${params}`);
      data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Error");
    }

    lastPage = data.last_page || 1;
    const rows = data.data || [];

    if (!rows.length) {
      tbodyAudit.innerHTML = `<tr><td colspan="6" class="text-muted p-3 text-center">Sin registros.</td></tr>`;
      auditPageInfo.textContent = "0 registros";
      return;
    }

    tbodyAudit.innerHTML = rows.map(r => {
      const actor = r.usuario
        ? esc([r.usuario.nombres, r.usuario.apellidos].filter(Boolean).join(" ") || r.usuario.email)
        : `<span class="text-muted">ID ${r.usuario_id ?? "—"}</span>`;

      return `<tr>
        <td class="text-nowrap small">${fmtDt(r.ocurrido_en)}</td>
        <td class="small">${actor}</td>
        <td>${badgeAccion(r.accion)}</td>
        <td class="small text-muted">${esc(r.entidad)} #${r.entidad_id ?? "—"}</td>
        <td class="small">${esc(r.descripcion ?? "—")}</td>
        <td class="small text-muted">${esc(r.ip ?? "—")}</td>
      </tr>`;
    }).join("");

    auditPageInfo.textContent = `Página ${data.current_page} de ${data.last_page} · ${data.total} registros`;
    btnPrev.disabled = data.current_page <= 1;
    btnNext.disabled = data.current_page >= data.last_page;

  } catch (err) {
    tbodyAudit.innerHTML = `<tr><td colspan="6" class="text-danger p-3">${esc(err.message)}</td></tr>`;
  }
}

// ── Botón buscar: carga auditoría + sesiones si hay uid ───────
document.getElementById("btnBuscar").addEventListener("click", () => {
  const uid = document.getElementById("filtroUsuarioId").value.trim();
  loadAudit(1);
  loadSesiones(uid, 1);
});

btnPrev.addEventListener("click", () => loadAudit(Math.max(1, currentPage - 1)));
btnNext.addEventListener("click", () => loadAudit(Math.min(lastPage, currentPage + 1)));

// ── Fechas por defecto (mes actual) ──────────────────────────
const hoy = todayISO();
document.getElementById("filtroHas").value = hoy;
document.getElementById("filtroDes").value = hoy.substring(0, 8) + "01";

// ── Init ──────────────────────────────────────────────────────
loadActivos();
loadAudit(1);

// Si viene con usuario_id en URL, carga sus sesiones automáticamente
if (prefilUsuario) {
  loadSesiones(prefilUsuario, 1);
}