// pagos/js/pagos.controller.js
import {
  resumenPagos,
  listarPagos,
  facturasPendientes,
  buscarFacturaPorNumero,
} from "./pagos.service.js";

import { createPagosUI, money } from "../../common/js/pagos.ui.js";

// ── Helpers ──────────────────────────────────────────────────
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (m) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m])
  );
}
function num(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

const FORMAS = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
  TARJETA: "Tarjeta",
  BILLETERA: "Billetera",
  OTRO: "Otro",
};

// ── Pagos UI (modal) ─────────────────────────────────────────
const pagosUI = createPagosUI({
  onPagoOk: async () => {
    // refrescar todo lo visible
    await loadKpis();
    if (activeTab === "pendientes") await loadPendientes();
    if (activeTab === "historial") await loadHistorial();

    // si estás en cobro rápido y tienes una factura cargada, refrescar esa vista
    if (activeTab === "cobro" && cobroFactura?.numero) {
      try {
        const fac2 = await buscarFacturaPorNumero(cobroFactura.numero);
        if (fac2 && num(fac2.saldo) > 0) renderCobroResult(fac2);
        else limpiarCobro(); // ya quedó pagada
      } catch (_) {}
    }
  },
});
pagosUI.boot();

// ── Tabs ─────────────────────────────────────────────────────
const tabPanes = { cobro: "tab-cobro", pendientes: "tab-pendientes", historial: "tab-historial" };
let activeTab = "cobro";

document.querySelectorAll("[data-tab]").forEach((btn) => {
  btn.addEventListener("click", async () => {
    activeTab = btn.dataset.tab;

    document.querySelectorAll("[data-tab]").forEach((b) =>
      b.classList.toggle("active", b === btn)
    );

    Object.entries(tabPanes).forEach(([k, id]) => {
      const el = document.getElementById(id);
      if (el) el.style.display = k === activeTab ? "" : "none";
    });

    if (activeTab === "pendientes") await loadPendientes();
    if (activeTab === "historial") await loadHistorial();
  });
});

// ── KPIs ─────────────────────────────────────────────────────
async function loadKpis() {
  try {
    const r = await resumenPagos();
    document.getElementById("kpiFacturado").textContent = money(r.total_facturado);
    document.getElementById("kpiRecaudado").textContent = money(r.total_recaudado);
    document.getElementById("kpiSaldo").textContent = money(r.saldo_pendiente);
    document.getElementById("kpiPendientes").textContent = (r.facturas_con_saldo || 0) + " facturas";

    const badge = document.getElementById("badgePendientes");
    if ((r.facturas_con_saldo || 0) > 0) {
      badge.textContent = r.facturas_con_saldo;
      badge.style.display = "";
    } else {
      badge.style.display = "none";
    }
  } catch (e) {
    console.error("KPIs:", e);
  }
}

document.getElementById("btnRefreshKpi")?.addEventListener("click", loadKpis);

// ── TAB 1: COBRO RÁPIDO ──────────────────────────────────────
let cobroFactura = null;

const cobroInput = document.getElementById("cobroInput");
const cobroResult = document.getElementById("cobroResult");
const cobroMsg = document.getElementById("cobroMsg");
const cobroOk = document.getElementById("cobroOk");
const cobroErr = document.getElementById("cobroErr");

function limpiarCobro() {
  if (cobroInput) cobroInput.value = "";
  if (cobroResult) cobroResult.style.display = "none";
  if (cobroMsg) cobroMsg.textContent = "";
  cobroOk?.classList.add("d-none");
  cobroErr?.classList.add("d-none");
  cobroFactura = null;
}

function renderCobroResult(fac) {
  cobroFactura = fac;
  const saldo = num(fac.saldo);

  document.getElementById("cobroNum").textContent = fac.numero;
  document.getElementById("cobroCliente").textContent =
    fac.cliente?.nombre_razon_social ?? `Cliente ${fac.cliente_id}`;
  document.getElementById("cobroTotal").textContent = money(fac.total);
  document.getElementById("cobroPagado").textContent = money(fac.total_pagado);
  document.getElementById("cobroSaldo").textContent = money(saldo);
  document.getElementById("cobroVerLink").href = `../facturas/factura-view.html?id=${fac.id}`;

  cobroResult.style.display = "";
  cobroOk?.classList.add("d-none");
  cobroErr?.classList.add("d-none");
}

async function buscarCobro() {
  const val = cobroInput?.value?.trim() || "";
  if (!val) return;

  cobroMsg.textContent = "Buscando…";
  cobroMsg.className = "small text-muted";
  cobroResult.style.display = "none";
  cobroFactura = null;

  try {
    const fac = await buscarFacturaPorNumero(val);
    if (!fac) {
      cobroMsg.textContent = "Factura no encontrada o no está EMITIDA.";
      cobroMsg.className = "small text-danger";
      return;
    }
    if (num(fac.saldo) <= 0) {
      cobroMsg.textContent = `La factura ${fac.numero} ya está pagada en su totalidad. ✓`;
      cobroMsg.className = "small text-success";
      return;
    }

    cobroMsg.textContent = "";
    renderCobroResult(fac);
  } catch (e) {
    cobroMsg.textContent = e.message || "Error al buscar.";
    cobroMsg.className = "small text-danger";
  }
}

document.getElementById("btnBuscarFactura")?.addEventListener("click", buscarCobro);
cobroInput?.addEventListener("keydown", (e) => { if (e.key === "Enter") buscarCobro(); });
document.getElementById("btnLimpiarCobro")?.addEventListener("click", limpiarCobro);

// Abre modal pagos.ui.js para la factura encontrada
document.getElementById("btnCobroAbrirPago")?.addEventListener("click", () => {
  if (!cobroFactura) return;

  pagosUI.openPagoModal({
    facturaId: cobroFactura.id,
    numero: cobroFactura.numero,
    total: Number(cobroFactura.total || 0),
    saldo: Number(cobroFactura.saldo || 0),
    clienteId: cobroFactura.cliente_id,
  });
});

// ── TAB 2: SALDOS PENDIENTES ─────────────────────────────────
const tbodyPend = document.getElementById("tbodyPend");

async function loadPendientes() {
  const search = document.getElementById("pendSearch")?.value?.trim() || "";

  tbodyPend.innerHTML = `<tr><td colspan="7" class="text-muted p-3">Cargando…</td></tr>`;
  document.getElementById("footPendSaldo").textContent = "—";
  document.getElementById("footPendPagado").textContent = "—";

  try {
    const data = await facturasPendientes({ search });
    const rows = data.data || [];

    if (!rows.length) {
      tbodyPend.innerHTML = `<tr><td colspan="7" class="text-center text-muted p-4">
        <i class="bi bi-check2-circle text-success d-block fs-3 mb-1"></i>
        Sin facturas con saldo pendiente. ¡Todo al día!
      </td></tr>`;
      document.getElementById("footPendSaldo").textContent = money(0);
      document.getElementById("footPendPagado").textContent = money(0);
      return;
    }

    let sumPagado = 0, sumSaldo = 0;

    tbodyPend.innerHTML = rows.map((f) => {
      const saldo = num(f.saldo);
      sumPagado += num(f.total_pagado);
      sumSaldo += saldo;

      return `<tr>
        <td class="fw-semibold">
          <a href="../facturas/factura-view.html?id=${f.id}" class="text-decoration-none">${esc(f.numero)}</a>
        </td>
        <td>${esc(f.cliente?.nombre_razon_social ?? "—")}</td>
        <td>${esc((f.fecha ?? "").substring(0, 10))}</td>
        <td class="text-end">${money(f.total)}</td>
        <td class="text-end text-success">${money(f.total_pagado)}</td>
        <td class="text-end text-danger fw-semibold">${money(saldo)}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-success"
            data-pend-pay="1"
            data-id="${f.id}"
            data-num="${esc(f.numero)}"
            data-total="${Number(f.total || 0)}"
            data-saldo="${Number(f.saldo || 0)}"
            data-cliente="${f.cliente_id}"
            title="Cobrar">
            <i class="bi bi-cash-coin"></i>
          </button>
        </td>
      </tr>`;
    }).join("");

    document.getElementById("footPendPagado").textContent = money(sumPagado);
    document.getElementById("footPendSaldo").textContent = money(sumSaldo);
  } catch (e) {
    tbodyPend.innerHTML = `<tr><td colspan="7" class="text-danger p-3">${esc(e.message)}</td></tr>`;
  }
}

let pendTimer = null;
document.getElementById("pendSearch")?.addEventListener("input", () => {
  clearTimeout(pendTimer);
  pendTimer = setTimeout(loadPendientes, 300);
});
document.getElementById("btnPendRefresh")?.addEventListener("click", loadPendientes);

// Delegación: cobrar desde pendientes -> abre pagos.ui modal
tbodyPend?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-pend-pay]");
  if (!btn) return;

  pagosUI.openPagoModal({
    facturaId: btn.dataset.id,
    numero: btn.dataset.num,
    total: Number(btn.dataset.total || 0),
    saldo: Number(btn.dataset.saldo || 0),
    clienteId: btn.dataset.cliente,
  });
});

// ── TAB 3: HISTORIAL (global) ─────────────────────────────────
const tbodyHist = document.getElementById("tbodyHist");

async function loadHistorial() {
  tbodyHist.innerHTML = `<tr><td colspan="7" class="text-muted p-3">Cargando…</td></tr>`;
  document.getElementById("footHistAplicado").textContent = "—";

  try {
    const data = await listarPagos({
      search: document.getElementById("histSearch")?.value?.trim() || "",
      formaPago: document.getElementById("histForma")?.value || "",
      fechaDesde: document.getElementById("histDesde")?.value || "",
      fechaHasta: document.getElementById("histHasta")?.value || "",
    });

    const rows = data.data || [];

    if (!rows.length) {
      tbodyHist.innerHTML = `<tr><td colspan="7" class="text-muted p-3 text-center">Sin pagos en el período.</td></tr>`;
      document.getElementById("footHistAplicado").textContent = money(0);
      return;
    }

    let sumAplicado = 0;

    tbodyHist.innerHTML = rows.map((p) => {
      const aplicado = (p.aplicaciones || []).reduce((s, a) => s + num(a.monto), 0);
      sumAplicado += aplicado;

      const facturas = (p.aplicaciones || [])
        .map((a) =>
          a.factura
            ? `<a href="../facturas/factura-view.html?id=${a.factura.id}"
                 class="badge bg-light text-dark border text-decoration-none me-1">${esc(a.factura.numero)}</a>`
            : ""
        )
        .join("");

      return `<tr>
        <td class="fw-semibold">${esc(p.numero_recibo)}</td>
        <td>${esc((p.fecha ?? "").substring(0, 10))}</td>
        <td>${esc(p.cliente?.nombre_razon_social ?? "—")}</td>
        <td>${facturas || "—"}</td>
        <td><span class="badge bg-light text-dark border">${esc(FORMAS[p.forma_pago] ?? p.forma_pago)}</span></td>
        <td class="text-muted small">${esc(p.referencia ?? "—")}</td>
        <td class="text-end text-success fw-semibold">${money(aplicado)}</td>
      </tr>`;
    }).join("");

    document.getElementById("footHistAplicado").textContent = money(sumAplicado);
  } catch (e) {
    tbodyHist.innerHTML = `<tr><td colspan="7" class="text-danger p-3">${esc(e.message)}</td></tr>`;
  }
}

let histTimer = null;
document.getElementById("histSearch")?.addEventListener("input", () => {
  clearTimeout(histTimer);
  histTimer = setTimeout(loadHistorial, 300);
});
["histForma", "histDesde", "histHasta"].forEach((id) =>
  document.getElementById(id)?.addEventListener("change", loadHistorial)
);
document.getElementById("btnHistRefresh")?.addEventListener("click", loadHistorial);

// ── INIT ─────────────────────────────────────────────────────
loadKpis();