import { listarProveedores, eliminarProveedor } from "./proveedores.service.js";
import { showToast, showConfirm } from "../../common/js/ui.utils.js";

const search    = document.getElementById("search");
const btnRefresh = document.getElementById("btnRefrescar");
const tbody     = document.getElementById("tbody");
const pageInfo  = document.getElementById("pageInfo");
const btnPrev   = document.getElementById("btnPrev");
const btnNext   = document.getElementById("btnNext");
const filtroActivos = document.getElementById("filtroActivos");

let currentPage = 1;
let lastPage    = 1;

// ── helpers ────────────────────────────────────────────────────
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, m =>
    ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[m])
  );
}

// ── render ─────────────────────────────────────────────────────
async function load(page = 1) {
  currentPage = page;
  tbody.innerHTML = `<tr><td colspan="6" class="text-muted p-3">Cargando…</td></tr>`;

  try {
    const data = await listarProveedores({
      search:  search.value.trim(),
      activos: filtroActivos.value,
    });

    lastPage = data.last_page || 1;
    const rows = data.data || [];

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-muted p-3">Sin resultados.</td></tr>`;
      pageInfo.textContent = "0 registros";
      return;
    }

    tbody.innerHTML = rows.map(p => `
      <tr>
        <td>
          <div class="fw-semibold">${esc(p.nombre)}</div>
          ${p.nit ? `<div class="text-muted small">NIT: ${esc(p.nit)}</div>` : ""}
        </td>
        <td>${esc(p.contacto || "—")}</td>
        <td>${esc(p.telefono || "—")}</td>
        <td>${esc(p.email    || "—")}</td>
        <td>
          ${p.is_activo
            ? `<span class="badge bg-success">Activo</span>`
            : `<span class="badge bg-secondary">Inactivo</span>`}
        </td>
        <td class="text-end text-nowrap">
          <a class="btn btn-sm btn-outline-secondary"
             href="proveedor-form.html?id=${p.id}" title="Editar">
            <i class="bi bi-pencil"></i>
          </a>
          <a class="btn btn-sm btn-outline-primary ms-1"
             href="../compras/compras.html?proveedor_id=${p.id}" title="Ver compras">
            <i class="bi bi-cart3"></i>
          </a>
          <button class="btn btn-sm btn-outline-danger ms-1 btn-desactivar"
                  data-id="${p.id}" data-nombre="${esc(p.nombre)}"
                  title="Desactivar" ${!p.is_activo ? "disabled" : ""}>
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>`).join("");

    pageInfo.textContent = `Página ${data.current_page} de ${data.last_page} · ${data.total} registros`;
    btnPrev.disabled = data.current_page <= 1;
    btnNext.disabled = data.current_page >= data.last_page;

  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-danger p-3">${esc(e.message)}</td></tr>`;
  }
}

// ── eventos ────────────────────────────────────────────────────
let t;
search.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => load(1), 300); });
filtroActivos.addEventListener("change", () => load(1));
btnRefresh.addEventListener("click", () => load(currentPage));
btnPrev.addEventListener("click", () => load(Math.max(1, currentPage - 1)));
btnNext.addEventListener("click", () => load(Math.min(lastPage, currentPage + 1)));

tbody.addEventListener("click", async e => {
  const btn = e.target.closest(".btn-desactivar");
  if (!btn) return;

  const { id, nombre } = btn.dataset;
  const ok = await showConfirm(
    `¿Desactivar a <strong>${nombre}</strong>? Sus items quedarán sin proveedor habitual.`,
    { title: "Desactivar proveedor", okLabel: "Sí, desactivar", okVariant: "btn-danger" }
  );
  if (!ok) return;

  try {
    await eliminarProveedor(id);
    showToast("Proveedor desactivado.", "warning");
    load(currentPage);
  } catch (e) {
    showToast(e.message || "Error al desactivar.", "danger");
  }
});

load(1);
