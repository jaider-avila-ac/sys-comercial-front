// facturas/js/facturas.controller.js
import { apiFetch } from "../../common/js/api.js";
import { createPagosUI, money } from "../../common/js/pagos.ui.js";
import { emitirFactura } from "./facturas.service.js";
import { showToast, showConfirm } from "../../common/js/ui.utils.js";

// ─── UI pagos (reutilizable) ──────────────────────────────────
const pagosUI = createPagosUI({
  onPagoOk: async () => {
    await loadFacturas();
  },
});
pagosUI.boot();

// ─── Listado de facturas ──────────────────────────────────────
async function loadFacturas() {
  const q      = document.getElementById("search")?.value?.trim() || "";
  const estado = document.getElementById("estado")?.value || "";

  const qs = new URLSearchParams();
  if (q)      qs.set("search", q);
  if (estado) qs.set("estado", estado);

  const msg = document.getElementById("msg");

  try {
    const res  = await apiFetch(`/facturas?${qs}`);
    const data = await res.json();

    if (!res.ok) throw new Error(data?.message || "Error cargando facturas");

    const rows  = data.data ?? data;
    const tbody = document.getElementById("tbody");

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-muted p-3">Sin resultados.</td></tr>`;
      if (msg) msg.textContent = "0 facturas";
      return;
    }

    tbody.innerHTML = rows
      .map((f) => {
        const saldo = Number(f.saldo || 0);
        const estadoBadge = {
          BORRADOR: "secondary",
          EMITIDA:  "primary",
          ANULADA:  "danger",
        }[f.estado] ?? "secondary";

        return `
        <tr>
          <td class="fw-semibold">${f.numero}</td>
          <td>${f.cliente?.nombre_razon_social ?? "—"}</td>
          <td><span class="badge bg-${estadoBadge}">${f.estado}</span></td>
          <td>${f.fecha ?? "—"}</td>
          <td class="text-end">${money(f.total)}</td>
          <td class="text-end">${money(f.total_pagado)}</td>
          <td class="text-end ${saldo > 0 ? "text-danger fw-semibold" : "text-success"}">${money(saldo)}</td>
          <td class="text-end">
            <div class="btn-group btn-group-sm">
              <a class="btn btn-outline-secondary" href="factura-view.html?id=${f.id}" title="Ver">
                <i class="bi bi-eye"></i>
              </a>
              ${f.estado === "BORRADOR"
                ? `<button class="btn btn-outline-success btn-emitir"
                           data-id="${f.id}"
                           data-numero="${f.numero}"
                           title="Emitir factura">
                     <i class="bi bi-check2-circle"></i>
                   </button>`
                : ""
              }
              ${f.estado === "EMITIDA" && saldo > 0
                ? `<button class="btn btn-outline-success btn-pago"
                           data-id="${f.id}"
                           data-numero="${f.numero}"
                           data-total="${f.total}"
                           data-saldo="${f.saldo}"
                           data-cliente="${f.cliente_id}"
                           title="Registrar pago">
                     <i class="bi bi-cash-coin"></i>
                   </button>`
                : ""
              }
              ${f.estado !== "BORRADOR"
                ? `<button class="btn btn-outline-info btn-hist"
                           data-id="${f.id}"
                           data-numero="${f.numero}"
                           title="Ver pagos">
                     <i class="bi bi-receipt"></i>
                   </button>`
                : ""
              }
            </div>
          </td>
        </tr>`;
      })
      .join("");

    if (msg) msg.textContent = `${rows.length} facturas`;
  } catch (err) {
    if (msg) msg.textContent = err?.message || "Error";
  }
}

// ─── Eventos ──────────────────────────────────────────────────
function bootEvents() {
  document.getElementById("search")?.addEventListener("input", loadFacturas);
  document.getElementById("estado")?.addEventListener("change", loadFacturas);
  document.getElementById("btnRefrescar")?.addEventListener("click", loadFacturas);

  document.getElementById("tbody")?.addEventListener("click", async (e) => {
    const btnPago   = e.target.closest(".btn-pago");
    const btnHist   = e.target.closest(".btn-hist");
    const btnEmitir = e.target.closest(".btn-emitir");

    if (btnPago) {
      pagosUI.openPagoModal({
        facturaId: btnPago.dataset.id,
        numero:    btnPago.dataset.numero,
        total:     Number(btnPago.dataset.total || 0),
        saldo:     Number(btnPago.dataset.saldo || 0),
        clienteId: btnPago.dataset.cliente,
      });
    }

    if (btnHist) {
      pagosUI.openHistorialModal({
        facturaId: btnHist.dataset.id,
        numero:    btnHist.dataset.numero,
      });
    }

    if (btnEmitir) {
      const { id, numero } = btnEmitir.dataset;

      const ok = await showConfirm(
        `¿Emitir la factura <strong>${numero}</strong>?<br>
         <span class="text-muted small">Se descontará el inventario de productos.</span>`,
        { title: "Emitir factura", okLabel: "Sí, emitir", okVariant: "btn-success" }
      );
      if (!ok) return;

      btnEmitir.disabled = true;
      try {
        await emitirFactura(id);
        showToast(`Factura ${numero} emitida correctamente.`, "success");
        await loadFacturas();
      } catch (err) {
        showToast(err.message || "No se pudo emitir la factura.", "danger");
        btnEmitir.disabled = false;
      }
    }
  });
}

// ─── Init ─────────────────────────────────────────────────────
bootEvents();
loadFacturas();