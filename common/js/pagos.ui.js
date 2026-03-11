// common/js/pagos.ui.js
import { apiFetch } from "./api.js";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
export function money(n) {
  return Number(n || 0).toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function setText(id, v) {
  const el = document.getElementById(id);
  if (el) el.textContent = v;
}

function show(id) {
  const el = document.getElementById(id);
  if (el) el.style.removeProperty("display");
}

function hide(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = "none";
}

function forceShow(id) {
  const el = document.getElementById(id);
  if (el) {
    el.style.removeProperty("display");
    el.style.setProperty("display", "flex", "important");
  }
}

function forceHide(id) {
  const el = document.getElementById(id);
  if (el) el.style.setProperty("display", "none", "important");
}

function exists(id) {
  return !!document.getElementById(id);
}

// ─────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────
export function createPagosUI(options = {}) {
  const { onPagoOk = null, onHistorialOpen = null } = options;

  // Estado del modal de pago
  const pagoState = {
    saldoFactura: 0,
    creditoDisp: 0,
    facturaCtx: null, // {facturaId, numero, total, saldo, clienteId}
  };

  // ───────────────────────────────────────────────────────────
  // Desglose
  // ───────────────────────────────────────────────────────────
  function calcularDesglose() {
    const montoHoy = parseFloat(document.getElementById("pagoMontoAplicado")?.value) || 0;
    const efectivo = parseFloat(document.getElementById("pagoEfectivoRecibido")?.value) || 0;
    const forma = document.getElementById("pagoForma")?.value;

    const { saldoFactura, creditoDisp } = pagoState;

    const creditoQueSeUsa = Math.min(creditoDisp, saldoFactura);
    const saldoTrasCred = saldoFactura - creditoQueSeUsa;

    const abonoEfectivo = Math.min(montoHoy, saldoTrasCred);
    const exesoNuevoFav = Math.max(0, montoHoy - saldoTrasCred);

    const totalAbonado = creditoQueSeUsa + abonoEfectivo;

    const cambio =
      forma === "EFECTIVO" && efectivo > 0 ? Math.max(0, efectivo - montoHoy) : 0;

    return { creditoQueSeUsa, abonoEfectivo, exesoNuevoFav, totalAbonado, cambio };
  }

  function renderDesglose() {
    const { creditoQueSeUsa, abonoEfectivo, exesoNuevoFav, totalAbonado, cambio } =
      calcularDesglose();
    const montoHoy = parseFloat(document.getElementById("pagoMontoAplicado")?.value) || 0;

    if (montoHoy <= 0 && creditoQueSeUsa <= 0) {
      hide("pagoBreakdown");
      hide("cambioBox");
      hide("nuevoFavorBox");
      return;
    }

    show("pagoBreakdown");

    if (creditoQueSeUsa > 0) {
      setText("pbDescVal", `- ${money(creditoQueSeUsa)}`);
      show("pbDescRow");
    } else {
      hide("pbDescRow");
    }

    setText("pbPagoVal", money(abonoEfectivo));
    setText("pbTotalVal", money(totalAbonado));

    if (cambio > 0) {
      setText("pagoCambio", money(cambio));
      show("cambioBox");
    } else {
      hide("cambioBox");
    }

    if (exesoNuevoFav > 0) {
      const nuevoTotal =
        pagoState.creditoDisp -
        Math.min(pagoState.creditoDisp, pagoState.saldoFactura) +
        exesoNuevoFav;
      setText("nuevoFavorVal", money(nuevoTotal));
      show("nuevoFavorBox");
    } else {
      hide("nuevoFavorBox");
    }
  }

  // ───────────────────────────────────────────────────────────
  // Abrir modal pago
  // ───────────────────────────────────────────────────────────
  async function openPagoModal(ctx) {
    if (!exists("modalPago")) throw new Error("No existe #modalPago en el HTML.");

    pagoState.facturaCtx = ctx;
    pagoState.saldoFactura = Number(ctx.saldo || 0);
    pagoState.creditoDisp = 0;

    // hidden
    document.getElementById("pagoFacturaId").value = ctx.facturaId;
    document.getElementById("pagoClienteId").value = ctx.clienteId;

    // info
    setText("pagoFacturaNumero", ctx.numero);
    setText("pagoFacturaTotal", money(ctx.total));
    setText("pagoFacturaSaldo", money(ctx.saldo));

    // reset
    document.getElementById("pagoFecha").value = todayISO();
    document.getElementById("pagoMontoAplicado").value = "";
    document.getElementById("pagoEfectivoRecibido").value = "";
    document.getElementById("pagoForma").value = "EFECTIVO";
    document.getElementById("pagoReferencia").value = "";
    document.getElementById("pagoNotas").value = "";

    hide("pagoBreakdown");
    hide("cambioBox");
    hide("nuevoFavorBox");
    forceHide("creditoBanner");

    document.getElementById("pagoError")?.classList.add("d-none");
    document.getElementById("pagoOk")?.classList.add("d-none");

    // EFECTIVO por default
    show("wrapEfectivo");

    // crédito
    try {
      const res = await apiFetch(`/clientes/${ctx.clienteId}`);
      const data = await res.json();
      const fav = parseFloat(data?.cliente?.saldo_a_favor ?? data?.saldo_a_favor ?? 0);

      if (fav > 0) {
        pagoState.creditoDisp = fav;
        setText("creditoDisponible", money(fav));

        const usara = Math.min(fav, pagoState.saldoFactura);
        setText(
          "creditoAplicarInfo",
          usara > 0 ? `Se aplicarán ${money(usara)} automáticamente` : ""
        );

        forceShow("creditoBanner");
      }
    } catch (_) {}

    renderDesglose();

    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById("modalPago"));
    modal.show();
  }

  // ───────────────────────────────────────────────────────────
  // Submit pago
  // ───────────────────────────────────────────────────────────
  async function submitPago(e) {
    e.preventDefault();

    const errEl = document.getElementById("pagoError");
    const okEl = document.getElementById("pagoOk");
    errEl?.classList.add("d-none");
    okEl?.classList.add("d-none");

    const facturaId = document.getElementById("pagoFacturaId").value;
    const montoAplicado = parseFloat(document.getElementById("pagoMontoAplicado").value);

    if (!montoAplicado || montoAplicado <= 0) {
      if (errEl) {
        errEl.textContent = "Ingresa el monto a pagar.";
        errEl.classList.remove("d-none");
      }
      return;
    }

    const payload = {
      fecha: document.getElementById("pagoFecha").value,
      forma_pago: document.getElementById("pagoForma").value,
      monto_aplicado: montoAplicado,
      referencia: document.getElementById("pagoReferencia").value || null,
      notas: document.getElementById("pagoNotas").value || null,
    };

    const btn = document.getElementById("btnGuardarPago");
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span>Guardando…`;

    try {
      const res = await apiFetch(`/facturas/${facturaId}/pagos`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Error registrando pago");

      const { saldo_favor_consumido, exceso_nuevo_favor, nuevo_saldo_favor } = data;
      let msg = "Pago registrado correctamente.";
      if (saldo_favor_consumido > 0)
        msg += ` Se aplicó ${money(saldo_favor_consumido)} de crédito a favor.`;
      if (exceso_nuevo_favor > 0)
        msg += ` Nuevo crédito a favor del cliente: ${money(nuevo_saldo_favor)}.`;

      if (okEl) {
        okEl.textContent = msg;
        okEl.classList.remove("d-none");
      }

      if (typeof onPagoOk === "function") {
        try {
          await onPagoOk(data, pagoState.facturaCtx);
        } catch (_) {}
      }

      setTimeout(() => {
        bootstrap.Modal.getInstance(document.getElementById("modalPago"))?.hide();
      }, 900);
    } catch (err) {
      if (errEl) {
        errEl.textContent = err?.message || "Error";
        errEl.classList.remove("d-none");
      }
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<i class="bi bi-cash-coin me-1"></i> Guardar pago`;
    }
  }

  // ───────────────────────────────────────────────────────────
  // Historial
  // ───────────────────────────────────────────────────────────
  async function openHistorialModal(ctx) {
  if (!exists("modalPagos")) throw new Error("No existe #modalPagos en el HTML.");

  setText("histFacturaNumero", ctx.numero);

  const tbody = document.getElementById("histTbody");
  tbody.innerHTML = `<tr><td colspan="6" class="text-muted p-2">Cargando…</td></tr>`;
  setText("histTotalCaja", "—");
  setText("histTotalCredito", "—");
  setText("histTotal", "—");
  forceHide("histCreditoRow");

  bootstrap.Modal.getOrCreateInstance(document.getElementById("modalPagos")).show();

  if (typeof onHistorialOpen === "function") {
    try {
      await onHistorialOpen(ctx.facturaId);
    } catch (_) {}
  }

  try {
    const res = await apiFetch(`/facturas/${ctx.facturaId}/pagos`);
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Error cargando historial de pagos");

    const pagos = Array.isArray(data?.pagos) ? data.pagos : [];

    if (!pagos.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-muted p-2">Sin pagos registrados.</td></tr>`;
      setText("histTotalCaja", money(0));
      setText("histTotal", money(0));
      return;
    }

    let totalCaja = 0;
    let totalCredito = 0;
    let totalAbonado = 0;

    tbody.innerHTML = pagos.map((pa) => {
      const recibo    = pa.numero_recibo ?? "—";
      const fecha     = pa.fecha ?? "—";
      const forma     = pa.forma_pago ?? "—";
      const referencia= pa.referencia ?? "";
      const aplicado  = Number(pa.monto ?? 0);

      // Si el backend no envía total_pagado, usamos monto como fallback
      const enCaja    = Number(pa.total_pagado ?? aplicado);
      const credito   = Math.max(0, aplicado - enCaja);

      totalCaja += enCaja;
      totalCredito += credito;
      totalAbonado += aplicado;

      let html = `
        <tr>
          <td class="fw-semibold">${recibo}</td>
          <td>${fecha}</td>
          <td><span class="badge bg-secondary">${forma}</span></td>
          <td class="text-muted">${referencia || "—"}</td>
          <td class="text-end">${money(enCaja)}</td>
          <td class="text-end fw-semibold">${money(aplicado)}</td>
        </tr>`;

      if (credito > 0.01) {
        html += `
          <tr class="hist-descuento-row">
            <td colspan="4" class="ps-4 fst-italic">
              <i class="bi bi-tag me-1"></i>Descuento / crédito a favor aplicado
            </td>
            <td class="text-end">—</td>
            <td class="text-end">- ${money(credito)}</td>
          </tr>`;
      }

      return html;
    }).join("");

    setText("histTotalCaja", money(totalCaja));
    setText("histTotal", money(totalAbonado));

    if (totalCredito > 0.01) {
      setText("histTotalCredito", money(totalCredito));
      forceShow("histCreditoRow");
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-danger p-2">${err?.message || "Error"}</td></tr>`;
  }
}

  // ───────────────────────────────────────────────────────────
  // Boot
  // ───────────────────────────────────────────────────────────
  function boot() {
    // Si no existen los modales en este HTML, no hacemos nada (para no romper otras páginas)
    if (!exists("formPago")) return;

    document.getElementById("pagoForma")?.addEventListener("change", (e) => {
      if (e.target.value === "EFECTIVO") show("wrapEfectivo");
      else {
        hide("wrapEfectivo");
        document.getElementById("pagoEfectivoRecibido").value = "";
      }
      renderDesglose();
    });

    ["pagoMontoAplicado", "pagoEfectivoRecibido"].forEach((id) => {
      document.getElementById(id)?.addEventListener("input", renderDesglose);
    });

    document.getElementById("formPago")?.addEventListener("submit", submitPago);
  }

  return { boot, openPagoModal, openHistorialModal };
}