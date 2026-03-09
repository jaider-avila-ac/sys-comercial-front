import { listarCotizaciones, eliminarCotizacion } from "./cotizaciones.service.js";
import { showToast, showConfirm } from "../../common/js/ui.utils.js";

const tbody        = document.getElementById("tbody");
const search       = document.getElementById("search");
const estado       = document.getElementById("estado");
const btnRefrescar = document.getElementById("btnRefrescar");
const msg          = document.getElementById("msg");

const ESTADO_BADGE = {
  BORRADOR:  "bg-secondary",
  EMITIDA:   "bg-success",
  VENCIDA:   "bg-warning text-dark",
  FACTURADA: "bg-primary",
  ANULADA:   "bg-danger",
};

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, m =>
    ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[m])
  );
}
function money(n) {
  return Number(n || 0).toLocaleString("es-CO", { style:"currency", currency:"COP" });
}

async function load() {
  msg.textContent = "";
  tbody.innerHTML = `<tr><td colspan="7" class="text-muted p-3">Cargando…</td></tr>`;

  try {
    const data = await listarCotizaciones({
      search: search.value.trim(),
      estado: estado.value,
    });
    const rows = data.data || [];

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-muted p-3">Sin resultados.</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map(c => {
      const badgeClass = ESTADO_BADGE[c.estado] ?? "bg-secondary";
      return `
        <tr>
          <td class="fw-semibold">${escapeHtml(c.numero)}</td>
          <td>${escapeHtml(c.cliente?.nombre_razon_social ?? "—")}</td>
          <td><span class="badge ${badgeClass}">${escapeHtml(c.estado)}</span></td>
          <td>${escapeHtml(c.fecha)}</td>
          <td>${escapeHtml(c.fecha_vencimiento)}</td>
          <td class="text-end">${money(c.total)}</td>
          <td class="text-end">
            <div class="btn-group btn-group-sm">
              <a class="btn btn-outline-secondary"
                 href="cotizacion-view.html?id=${c.id}" title="Ver">
                <i class="bi bi-eye"></i>
              </a>
              <a class="btn btn-outline-primary"
                 href="cotizacion-form.html?id=${c.id}" title="Editar">
                <i class="bi bi-pencil"></i>
              </a>
              <button class="btn btn-outline-danger"
                      data-del="${c.id}" data-numero="${escapeHtml(c.numero)}"
                      title="Eliminar">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </td>
        </tr>`;
    }).join("");

  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-danger p-3">${escapeHtml(e.message)}</td></tr>`;
  }
}

let t = null;
search.addEventListener("input", () => { clearTimeout(t); t = setTimeout(load, 300); });
estado.addEventListener("change", load);
btnRefrescar.addEventListener("click", load);

tbody.addEventListener("click", async e => {
  const btn = e.target.closest("[data-del]");
  if (!btn) return;

  const ok = await showConfirm(
    `¿Eliminar la cotización <strong>${btn.dataset.numero}</strong>? Esta acción no se puede deshacer.`,
    { title: "Eliminar cotización", okLabel: "Sí, eliminar", okVariant: "btn-danger" }
  );
  if (!ok) return;

  try {
    await eliminarCotizacion(btn.dataset.del);
    showToast("Cotización eliminada.", "success");
    load();
  } catch (err) {
    showToast(err.message || "No se pudo eliminar.", "danger");
  }
});

load();