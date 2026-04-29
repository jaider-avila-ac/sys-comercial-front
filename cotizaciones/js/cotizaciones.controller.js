import { listarCotizaciones, eliminarCotizacion, emitirCotizacion, anularCotizacion, convertirAFactura } from "./cotizaciones.service.js";
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
      const esBorrador = c.estado === "BORRADOR";
      const esEmitida = c.estado === "EMITIDA";
      const esAnulada = c.estado === "ANULADA";
      const esFacturada = c.estado === "FACTURADA";
      
      return `
        <tr data-id="${c.id}" data-estado="${c.estado}">
          <td class="fw-semibold">${escapeHtml(c.numero || "Sin número")}</td>
          <td>${escapeHtml(c.cliente?.nombre_razon_social ?? "—")}</td>
          <td><span class="badge ${badgeClass}">${escapeHtml(c.estado)}</span></td>
          <td>${escapeHtml(c.fecha)}</td>
          <td>${escapeHtml(c.fecha_vencimiento)}</td>
          <td class="text-end">${money(c.total)}</td>
          <td class="text-end">
            <div class="btn-group btn-group-sm" role="group">
              <a class="btn btn-outline-secondary" href="cotizacion-view.html?id=${c.id}" title="Ver">
                <i class="bi bi-eye"></i>
              </a>
              ${esBorrador ? `
                <a class="btn btn-outline-primary" href="cotizacion-form.html?id=${c.id}" title="Editar">
                  <i class="bi bi-pencil"></i>
                </a>
                <button class="btn btn-outline-success" data-emitir="${c.id}" data-numero="${escapeHtml(c.numero)}" title="Emitir">
                  <i class="bi bi-check2-circle"></i>
                </button>
                <button class="btn btn-outline-danger" data-eliminar="${c.id}" data-numero="${escapeHtml(c.numero)}" title="Eliminar">
                  <i class="bi bi-trash"></i>
                </button>
              ` : ''}
              ${esEmitida ? `
                <button class="btn btn-outline-warning" data-anular="${c.id}" data-numero="${escapeHtml(c.numero)}" title="Anular">
                  <i class="bi bi-slash-circle"></i>
                </button>
                <button class="btn btn-outline-info" data-convertir="${c.id}" data-numero="${escapeHtml(c.numero)}" title="Convertir a factura">
                  <i class="bi bi-receipt"></i>
                </button>
              ` : ''}
              ${(esAnulada || esFacturada) ? `
                <span class="text-muted small align-self-center ms-2"></span>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join("");

  } catch (e) {
    tbody.innerHTML = `<td><td colspan="7" class="text-danger p-3">${escapeHtml(e.message)}</td></tr>`;
  }
}

let t = null;
search.addEventListener("input", () => { clearTimeout(t); t = setTimeout(load, 300); });
estado.addEventListener("change", load);
btnRefrescar.addEventListener("click", load);

tbody.addEventListener("click", async e => {
  const btnEliminar = e.target.closest("[data-eliminar]");
  const btnEmitir = e.target.closest("[data-emitir]");
  const btnAnular = e.target.closest("[data-anular]");
  const btnConvertir = e.target.closest("[data-convertir]");

  if (btnEliminar) {
    const ok = await showConfirm(
      `¿Eliminar la cotización <strong>${btnEliminar.dataset.numero}</strong>? Esta acción no se puede deshacer.`,
      { title: "Eliminar cotización", okLabel: "Sí, eliminar", okVariant: "btn-danger" }
    );
    if (!ok) return;
    try {
      await eliminarCotizacion(btnEliminar.dataset.eliminar);
      showToast("Cotización eliminada.", "success");
      load();
    } catch (err) {
      showToast(err.message || "No se pudo eliminar.", "danger");
    }
  }

  if (btnEmitir) {
    const ok = await showConfirm(
      `¿Emitir la cotización <strong>${btnEmitir.dataset.numero}</strong>?`,
      { title: "Emitir cotización", okLabel: "Sí, emitir", okVariant: "btn-success" }
    );
    if (!ok) return;
    try {
      await emitirCotizacion(btnEmitir.dataset.emitir);
      showToast("Cotización emitida.", "success");
      load();
    } catch (err) {
      showToast(err.message || "No se pudo emitir.", "danger");
    }
  }

  if (btnAnular) {
    const ok = await showConfirm(
      `¿Anular la cotización <strong>${btnAnular.dataset.numero}</strong>?`,
      { title: "Anular cotización", okLabel: "Sí, anular", okVariant: "btn-warning" }
    );
    if (!ok) return;
    try {
      await anularCotizacion(btnAnular.dataset.anular);
      showToast("Cotización anulada.", "warning");
      load();
    } catch (err) {
      showToast(err.message || "No se pudo anular.", "danger");
    }
  }

  if (btnConvertir) {
    const ok = await showConfirm(
      `¿Convertir la cotización <strong>${btnConvertir.dataset.numero}</strong> a factura?`,
      { title: "Convertir a factura", okLabel: "Sí, convertir", okVariant: "btn-primary" }
    );
    if (!ok) return;
    try {
      const data = await convertirAFactura(btnConvertir.dataset.convertir);
      showToast(data.message || "Cotización convertida a factura.", "success");
      load();
    } catch (err) {
      showToast(err.message || "No se pudo convertir.", "danger");
    }
  }
});

load();