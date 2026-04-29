import "../../common/js/auth.js";
import { money, num, esc } from "../../common/js/pagos.ui.js";
import { listarPagos } from "./finanzas.service.js";

const FORMAS = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
  TARJETA: "Tarjeta",
  BILLETERA: "Billetera",
  OTRO: "Otro"
};

const BADGE_FORMA = {
  EFECTIVO: "bg-success",
  TRANSFERENCIA: "bg-primary",
  TARJETA: "bg-info text-dark",
  BILLETERA: "bg-warning text-dark",
  OTRO: "bg-secondary"
};

async function loadHistorial() {
  const tbodyHist = document.getElementById("tbodyHist");
  const histSearch = document.getElementById("histSearch");
  const histForma = document.getElementById("histForma");
  const histDesde = document.getElementById("histDesde");
  const histHasta = document.getElementById("histHasta");

  tbodyHist.innerHTML = `<tr><td colspan="7" class="text-muted p-3 text-center">Cargando…</td></tr>`;
  document.getElementById("footHistAplicado").textContent = "—";

  try {
    const data = await listarPagos({
      search: histSearch?.value?.trim() || "",
      formaPago: histForma?.value || "",
      fechaDesde: histDesde?.value || "",
      fechaHasta: histHasta?.value || "",
    });

    const rows = data.data || [];

    if (!rows.length) {
      tbodyHist.innerHTML = `<tr><td colspan="7" class="text-muted p-3 text-center">Sin pagos en el período.</td></tr>`;
      document.getElementById("footHistAplicado").textContent = money(0);
      return;
    }

    let sumAplicado = 0;

    tbodyHist.innerHTML = rows.map(p => {
      const esMostrador = String(p.cliente?.nombre_razon_social ?? "").trim().toUpperCase() === "MOSTRADOR";

      const aplicado = esMostrador
        ? num(p.total_pagado)
        : (p.aplicaciones || []).reduce((s, a) => s + num(a.monto), 0);

      sumAplicado += aplicado;

      const facturas = esMostrador
        ? `<span class="badge bg-light text-dark border">VENTA RÁPIDA</span>`
        : (p.aplicaciones || []).map(a =>
            a.factura
              ? `<a href="../facturas/factura-view.html?id=${a.factura.id}"
                   class="badge bg-light text-dark border text-decoration-none me-1">${esc(a.factura.numero)}</a>`
              : ""
          ).join("");

      return `<tr>
        <td class="fw-semibold">${esc(p.numero_recibo)}</td>
        <td>${esc((p.fecha ?? "").substring(0, 10))}</td>
        <td>${esc(p.cliente?.nombre_razon_social ?? "—")}</td>
        <td>${facturas || "—"}</td>
        <td><span class="badge ${BADGE_FORMA[p.forma_pago] ?? "bg-secondary"}">${esc(FORMAS[p.forma_pago] ?? p.forma_pago)}</span></td>
        <td class="text-muted small">${esc(p.referencia ?? "—")}</td>
        <td class="text-end text-success fw-semibold">${money(aplicado)}</td>
      </tr>`;
    }).join("");

    document.getElementById("footHistAplicado").textContent = money(sumAplicado);
  } catch (e) {
    tbodyHist.innerHTML = `<tr><td colspan="7" class="text-danger p-3">${esc(e.message)}</td></tr>`;
  }
}

function initHistorial() {
  const histSearch = document.getElementById("histSearch");
  const histForma = document.getElementById("histForma");
  const histDesde = document.getElementById("histDesde");
  const histHasta = document.getElementById("histHasta");

  let timer = null;

  histSearch?.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(loadHistorial, 300);
  });

  [histForma, histDesde, histHasta].forEach(el => {
    el?.addEventListener("change", loadHistorial);
  });

  document.getElementById("btnHistRefresh")?.addEventListener("click", loadHistorial);

  loadHistorial();
}

initHistorial();