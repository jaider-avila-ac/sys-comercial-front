import "../../common/js/auth.js";
import { money, num, createPagosUI } from "../../common/js/pagos.ui.js";
import { buscarFacturaPorNumero } from "./finanzas.service.js";

let _cobroFactura = null;
let _pagosUI = null;

function limpiarCobro() {
  document.getElementById("cobroInput").value = "";
  document.getElementById("cobroResult").style.display = "none";
  document.getElementById("cobroMsg").textContent = "";
  document.getElementById("cobroOk")?.classList.add("d-none");
  document.getElementById("cobroErr")?.classList.add("d-none");
  _cobroFactura = null;
}

function renderCobroResult(fac) {
  _cobroFactura = fac;
  document.getElementById("cobroNum").textContent = fac.numero;
  document.getElementById("cobroCliente").textContent = fac.cliente?.nombre_razon_social ?? `Cliente ${fac.cliente_id}`;
  document.getElementById("cobroTotal").textContent = money(fac.total);
  document.getElementById("cobroPagado").textContent = money(fac.total_pagado);
  document.getElementById("cobroSaldo").textContent = money(fac.saldo);
  document.getElementById("cobroVerLink").href = `../facturas/factura-view.html?id=${fac.id}`;
  document.getElementById("cobroResult").style.display = "";
  document.getElementById("cobroOk")?.classList.add("d-none");
  document.getElementById("cobroErr")?.classList.add("d-none");
}

async function buscarCobro() {
  const cobroInput = document.getElementById("cobroInput");
  const cobroResult = document.getElementById("cobroResult");
  const cobroMsg = document.getElementById("cobroMsg");
  const val = cobroInput?.value?.trim() || "";
  if (!val) return;

  cobroMsg.textContent = "Buscando…";
  cobroMsg.className = "small text-muted";
  cobroResult.style.display = "none";
  _cobroFactura = null;

  try {
    const fac = await buscarFacturaPorNumero(val);

    if (!fac) {
      cobroMsg.textContent = "Factura no encontrada o no está EMITIDA.";
      cobroMsg.className = "small text-danger";
      return;
    }

    if (num(fac.saldo) <= 0) {
      cobroMsg.textContent = `La factura ${fac.numero} ya está pagada. ✓`;
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

async function actualizarCobroDespuesPago() {
  if (!_cobroFactura?.numero) return;

  try {
    const fac2 = await buscarFacturaPorNumero(_cobroFactura.numero);
    if (fac2 && num(fac2.saldo) > 0) renderCobroResult(fac2);
    else limpiarCobro();
  } catch (_) {}
}

function initCobro() {
  const cobroInput = document.getElementById("cobroInput");

  _pagosUI = createPagosUI({
    onPagoOk: async () => {
      await actualizarCobroDespuesPago();
    },
  });

  _pagosUI.boot();

  document.getElementById("btnBuscarFactura")?.addEventListener("click", buscarCobro);
  cobroInput?.addEventListener("keydown", e => {
    if (e.key === "Enter") buscarCobro();
  });

  document.getElementById("btnLimpiarCobro")?.addEventListener("click", limpiarCobro);

  document.getElementById("btnCobroAbrirPago")?.addEventListener("click", () => {
    if (!_cobroFactura) return;

    _pagosUI.openPagoModal({
      facturaId: _cobroFactura.id,
      numero: _cobroFactura.numero,
      total: num(_cobroFactura.total),
      saldo: num(_cobroFactura.saldo),
      clienteId: _cobroFactura.cliente_id,
    });
  });
}

initCobro();