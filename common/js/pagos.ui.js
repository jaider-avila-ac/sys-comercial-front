import { apiFetch } from "./api.js";

// ─────────────────────────────────────────────────────────────
// Utilidades exportadas — usadas por múltiples módulos
// ─────────────────────────────────────────────────────────────
export function money(n) {
  return Number(n || 0).toLocaleString("es-CO", {
    style: "currency", currency: "COP",
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}

export function num(v) { return parseFloat(v || 0) || 0; }

export function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function showToast(msg, variant = "success") {
  const id = `toast-${Date.now()}`;
  let container = document.getElementById("toastContainer");
  if (!container) {
    container = Object.assign(document.createElement("div"), {
      id: "toastContainer",
      className: "toast-container position-fixed bottom-0 end-0 p-3",
    });
    container.style.zIndex = "1100";
    document.body.appendChild(container);
  }
  container.insertAdjacentHTML("beforeend", `
    <div id="${id}" class="toast align-items-center text-bg-${variant} border-0" role="alert">
      <div class="d-flex">
        <div class="toast-body">${esc(msg)}</div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
      </div>
    </div>`);
  const el = document.getElementById(id);
  new bootstrap.Toast(el, { delay: 3000 }).show();
  el.addEventListener("hidden.bs.toast", () => el.remove());
}

export function showConfirm(message, opts = {}) {
  const { title = "Confirmar", okLabel = "Aceptar", okVariant = "btn-primary" } = opts;
  return new Promise(resolve => {
    const id = `confirm-${Date.now()}`;
    document.body.insertAdjacentHTML("beforeend", `
      <div class="modal fade" id="${id}" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered modal-sm">
          <div class="modal-content">
            <div class="modal-header py-2">
              <h6 class="modal-title">${esc(title)}</h6>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">${esc(message)}</div>
            <div class="modal-footer py-2">
              <button class="btn btn-sm btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button>
              <button class="btn btn-sm ${okVariant}" id="${id}-ok">${esc(okLabel)}</button>
            </div>
          </div>
        </div>
      </div>`);
    const el    = document.getElementById(id);
    const modal = new bootstrap.Modal(el);
    document.getElementById(`${id}-ok`).addEventListener("click", () => { modal.hide(); resolve(true); });
    el.addEventListener("hidden.bs.modal", () => { resolve(false); el.remove(); });
    modal.show();
  });
}

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ─────────────────────────────────────────────────────────────
// Helpers privados del modal
// ─────────────────────────────────────────────────────────────
function setText(id, v)   { const el = document.getElementById(id); if (el) el.textContent = v; }
function show(id)         { const el = document.getElementById(id); if (el) el.style.removeProperty("display"); }
function hide(id)         { const el = document.getElementById(id); if (el) el.style.display = "none"; }
function forceShow(id)    { const el = document.getElementById(id); if (el) { el.style.removeProperty("display"); el.style.setProperty("display", "flex", "important"); } }
function forceHide(id)    { const el = document.getElementById(id); if (el) el.style.setProperty("display", "none", "important"); }
function exists(id)       { return !!document.getElementById(id); }

// ─────────────────────────────────────────────────────────────
// Factory — se instancia UNA VEZ por página en el controller
// ─────────────────────────────────────────────────────────────
export function createPagosUI(options = {}) {
  const { onPagoOk = null } = options;

  const pagoState = { saldoFactura: 0, creditoDisp: 0, facturaCtx: null };
  let modalUnificado = null;

  async function cargarHistorialPagos(facturaId) {
    try {
      const res = await apiFetch(`/facturas/${facturaId}/pagos`);
      const data = await res.json();
      const pagos = Array.isArray(data?.pagos) ? data.pagos : [];
      const tbodyHist = document.getElementById("histTbody");
      
      if (!pagos.length) {
        tbodyHist.innerHTML = `<tr><td colspan="5" class="text-muted text-center py-3">No hay pagos registrados</td></tr>`;
      } else {
        tbodyHist.innerHTML = pagos.map(p => `
          <tr>
            <td class="fw-semibold">${esc(p.numero_recibo || "—")}</td>
            <td>${p.fecha || "—"}</td>
            <td>${esc(p.forma_pago || "—")}</td>
            <td class="text-muted">${esc(p.referencia || "—")}</td>
            <td class="text-end text-success fw-semibold">${money(p.monto)}</td>
          </tr>
        `).join("");
      }
    } catch (e) {
      document.getElementById("histTbody").innerHTML = `<tr><td colspan="5" class="text-danger text-center py-3">${esc(e.message)}</td></tr>`;
    }
  }

  async function openPagoModal(ctx) {
    if (!exists("modalPagoUnificado")) {
      console.error("No existe #modalPagoUnificado en el HTML");
      return;
    }
    
    pagoState.facturaCtx = ctx;
    pagoState.saldoFactura = Number(ctx.saldo || 0);
    pagoState.creditoDisp = 0;

    document.getElementById("pagoFacturaId").value = ctx.facturaId;
    document.getElementById("pagoClienteId").value = ctx.clienteId;
    setText("pagoFacturaNumero", ctx.numero);
    setText("pagoFacturaTotal", money(ctx.total));
    setText("pagoFacturaPagado", money(ctx.pagado || 0));
    setText("pagoFacturaSaldo", money(ctx.saldo));
    
    document.getElementById("pagoFecha").value = todayISO();
    document.getElementById("pagoMonto").value = "";
    document.getElementById("pagoReferencia").value = "";
    document.getElementById("pagoNotas").value = "";
    document.getElementById("pagoMsg").textContent = "";
    
    const montoInput = document.getElementById("pagoMonto");
    const helpText = document.getElementById("pagoMontoHelp");
    const btnPagar = document.getElementById("btnGuardarPago");
    
    if (ctx.saldo <= 0) {
      if (montoInput) {
        montoInput.disabled = true;
        montoInput.classList.add("pago-disabled");
      }
      if (helpText) helpText.innerHTML = '<span class="text-success">✓ Factura pagada completamente</span>';
      if (btnPagar) {
        btnPagar.disabled = true;
        btnPagar.title = "Factura ya está pagada";
      }
    } else {
      if (montoInput) {
        montoInput.disabled = false;
        montoInput.classList.remove("pago-disabled");
      }
      if (helpText) helpText.innerHTML = `Saldo pendiente: ${money(ctx.saldo)}. Ingrese el monto a pagar.`;
      if (btnPagar) {
        btnPagar.disabled = false;
        btnPagar.title = "";
      }
    }
    
    // Verificar crédito del cliente
    try {
      const res = await apiFetch(`/clientes/${ctx.clienteId}`);
      const data = await res.json();
      const fav = parseFloat(data?.cliente?.saldo_a_favor ?? data?.saldo_a_favor ?? 0);
      const banner = document.getElementById("creditoBanner");
      const creditoSpan = document.getElementById("creditoDisponible");
      if (banner && creditoSpan && fav > 0) {
        pagoState.creditoDisp = fav;
        creditoSpan.textContent = money(fav);
        banner.style.display = "flex";
      } else if (banner) {
        banner.style.display = "none";
      }
    } catch (_) {
      const banner = document.getElementById("creditoBanner");
      if (banner) banner.style.display = "none";
    }
    
    // Cargar historial de pagos
    await cargarHistorialPagos(ctx.facturaId);
    
    if (!modalUnificado) {
      const modalEl = document.getElementById("modalPagoUnificado");
      if (modalEl) modalUnificado = new bootstrap.Modal(modalEl);
    }
    if (modalUnificado) modalUnificado.show();
  }

  async function submitPago(e) {
    e.preventDefault();
    
    const errEl = document.getElementById("pagoError");
    const okEl = document.getElementById("pagoOk");
    if (errEl) errEl.classList.add("d-none");
    if (okEl) okEl.classList.add("d-none");

    const facturaId = document.getElementById("pagoFacturaId").value;
    const fecha = document.getElementById("pagoFecha").value;
    const formaPago = document.getElementById("pagoForma").value;
    const monto = parseFloat(document.getElementById("pagoMonto").value);
    const referencia = document.getElementById("pagoReferencia").value || null;
    const notas = document.getElementById("pagoNotas").value || null;
    const msgEl = document.getElementById("pagoMsg");

    if (!fecha) {
      if (msgEl) msgEl.textContent = "La fecha es obligatoria";
      return;
    }
    if (!monto || monto <= 0) {
      if (msgEl) msgEl.textContent = "El monto debe ser mayor a 0";
      return;
    }
    if (monto > pagoState.saldoFactura) {
      if (msgEl) msgEl.textContent = `El monto no puede superar el saldo pendiente (${money(pagoState.saldoFactura)})`;
      return;
    }

    const btn = document.getElementById("btnGuardarPago");
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Guardando...';
    }

    try {
      const payload = {
        factura_id: parseInt(facturaId),
        fecha,
        forma_pago: formaPago,
        monto,
        referencia,
        notas,
      };
      
      const res = await apiFetch("/pagos", { method: "POST", body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Error registrando pago");

      const { saldo_favor_consumido, exceso_nuevo_favor, nuevo_saldo_favor } = data;
      let msg = "Pago registrado correctamente.";
      if (saldo_favor_consumido > 0) msg += ` Crédito aplicado: ${money(saldo_favor_consumido)}.`;
      if (exceso_nuevo_favor > 0) msg += ` Nuevo crédito a favor: ${money(nuevo_saldo_favor)}.`;
      
      if (okEl) {
        okEl.textContent = msg;
        okEl.classList.remove("d-none");
      }
      
      // Actualizar el saldo en el modal
      const nuevoSaldo = pagoState.saldoFactura - monto;
      pagoState.saldoFactura = nuevoSaldo;
      setText("pagoFacturaSaldo", money(nuevoSaldo));
      
      // Recargar historial de pagos
      await cargarHistorialPagos(facturaId);
      
      // Si el saldo llegó a 0, deshabilitar el campo de monto
      if (nuevoSaldo <= 0) {
        const montoInput = document.getElementById("pagoMonto");
        const helpText = document.getElementById("pagoMontoHelp");
        const btnPagar = document.getElementById("btnGuardarPago");
        if (montoInput) {
          montoInput.disabled = true;
          montoInput.classList.add("pago-disabled");
        }
        if (helpText) helpText.innerHTML = '<span class="text-success">✓ Factura pagada completamente</span>';
        if (btnPagar) {
          btnPagar.disabled = true;
          btnPagar.title = "Factura ya está pagada";
        }
      } else {
        document.getElementById("pagoMonto").value = "";
      }
      
      if (msgEl) msgEl.textContent = "";
      
      if (typeof onPagoOk === "function") {
        try { await onPagoOk(data, pagoState.facturaCtx); } catch (_) {}
      }
      
      setTimeout(() => {
        if (modalUnificado) modalUnificado.hide();
      }, 1500);
      
    } catch (err) {
      if (msgEl) msgEl.textContent = err?.message || "Error";
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-cash-coin me-1"></i> Registrar pago';
      }
    }
  }

  function injectModalHTML() {
    if (document.getElementById("modalPagoUnificado")) return;
    
    const modalHtml = `
      <div class="modal fade" id="modalPagoUnificado" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-lg modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title" id="modalUnificadoTitle">Pagos de Factura</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
            </div>
            <div class="modal-body">
              <input type="hidden" id="pagoFacturaId">
              <input type="hidden" id="pagoClienteId">

              <div class="mb-3 p-2 bg-light rounded">
                <div class="small text-muted">Factura</div>
                <div class="fw-semibold fs-5" id="pagoFacturaNumero">—</div>
                <div class="d-flex gap-3 mt-1 flex-wrap">
                  <span class="small">Total: <strong id="pagoFacturaTotal">—</strong></span>
                  <span class="small">Pagado: <strong class="text-success" id="pagoFacturaPagado">—</strong></span>
                  <span class="small">Saldo: <strong class="text-danger" id="pagoFacturaSaldo">—</strong></span>
                </div>
              </div>

              <h6 class="mb-2"><i class="bi bi-cash-coin me-1"></i>Registrar nuevo pago</h6>
              
              <div id="creditoBanner" class="credito-banner mb-3" style="display:none">
                <i class="bi bi-tag-fill"></i>
                <div>Crédito disponible: <span class="credito-val" id="creditoDisponible">$0</span></div>
              </div>

              <div class="row g-2">
                <div class="col-6">
                  <label class="form-label small">Fecha</label>
                  <input id="pagoFecha" type="date" class="form-control form-control-sm" required>
                </div>
                <div class="col-6">
                  <label class="form-label small">Forma de pago</label>
                  <select id="pagoForma" class="form-select form-select-sm" required>
                    <option value="EFECTIVO">EFECTIVO</option>
                    <option value="TRANSFERENCIA">TRANSFERENCIA</option>
                    <option value="TARJETA">TARJETA</option>
                    <option value="BILLETERA">BILLETERA</option>
                    <option value="OTRO">OTRO</option>
                  </select>
                </div>
                <div class="col-12">
                  <label class="form-label small">Monto a pagar</label>
                  <input id="pagoMonto" type="number" class="form-control form-control-sm" step="0.01" min="0.01">
                  <div class="form-text" id="pagoMontoHelp">Ingrese el monto a pagar</div>
                </div>
                <div class="col-12">
                  <label class="form-label small">Referencia (opcional)</label>
                  <input id="pagoReferencia" class="form-control form-control-sm" maxlength="80">
                </div>
                <div class="col-12">
                  <label class="form-label small">Notas (opcional)</label>
                  <textarea id="pagoNotas" class="form-control form-control-sm" rows="2" maxlength="255"></textarea>
                </div>
              </div>

              <hr class="my-3" />

              <h6 class="mb-2"><i class="bi bi-clock-history me-1"></i>Historial de pagos</h6>
              <div class="table-responsive mb-3">
                <table class="table table-sm">
                  <thead class="table-light">
                    <tr>
                      <th>Recibo</th>
                      <th>Fecha</th>
                      <th>Forma</th>
                      <th>Referencia</th>
                      <th class="text-end">Monto</th>
                    </tr>
                  </thead>
                  <tbody id="histTbody">
                    <tr><td colspan="5" class="text-muted text-center py-3">Cargando pagos...</td></tr>
                  </tbody>
                </table>
              </div>

              <div id="pagoMsg" class="small text-danger mt-2"></div>
              <div id="pagoError" class="alert alert-danger mt-3 d-none"></div>
              <div id="pagoOk" class="alert alert-success mt-3 d-none"></div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cerrar</button>
              <button id="btnGuardarPago" type="button" class="btn btn-primary">
                <i class="bi bi-cash-coin me-1"></i> Registrar pago
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML("beforeend", modalHtml);
    
    // Agregar estilos adicionales
    if (!document.getElementById("pago-ui-styles")) {
      const style = document.createElement("style");
      style.id = "pago-ui-styles";
      style.textContent = `
        .pago-disabled {
          background-color: #e9ecef !important;
          opacity: 0.65;
        }
        .credito-banner {
          background: #d1e7dd;
          border: 1px solid #a3cfbb;
          border-radius: .375rem;
          padding: .6rem .85rem;
          display: flex;
          align-items: center;
          gap: .5rem;
          font-size: .82rem;
          color: #0a3622;
        }
        .credito-banner .credito-val {
          font-weight: 700;
          font-size: .9rem;
        }
      `;
      document.head.appendChild(style);
    }
  }

  function boot() {
    injectModalHTML();
    
    const formPago = document.getElementById("formPago");
    if (formPago) {
      formPago.addEventListener("submit", submitPago);
    } else {
      const btnGuardar = document.getElementById("btnGuardarPago");
      if (btnGuardar) {
        btnGuardar.addEventListener("click", submitPago);
      }
    }
    
    // Configurar el cambio de forma de pago
    const pagoForma = document.getElementById("pagoForma");
    if (pagoForma) {
      pagoForma.addEventListener("change", () => {
        // Si es necesario mostrar/ocultar algo
      });
    }
  }

  return { boot, openPagoModal };
}