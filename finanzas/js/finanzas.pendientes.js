import "../../common/js/auth.js";
import { money, num, esc, createPagosUI } from "../../common/js/pagos.ui.js";
import { facturasPendientes } from "./finanzas.service.js";

let _pagosUI = null;

async function _load() {
  const tbodyPend = document.getElementById("tbodyPend");
  const pendSearch = document.getElementById("pendSearch");
  const search = pendSearch?.value?.trim() || "";

  if (!tbodyPend) return;

  tbodyPend.innerHTML = `<tr><td colspan="7" class="text-muted p-3 text-center">Cargando…</td></tr>`;
  document.getElementById("footPendSaldo").textContent = "—";
  document.getElementById("footPendPagado").textContent = "—";

  try {
    const data = await facturasPendientes({ search });
    const rows = data.data || [];

    if (!rows.length) {
      tbodyPend.innerHTML = `<tr><td colspan="7" class="text-center text-muted p-4">
        <i class="bi bi-check2-circle text-success d-block fs-3 mb-1"></i>Sin facturas pendientes. ¡Todo al día!</td></tr>`;
      document.getElementById("footPendSaldo").textContent = money(0);
      document.getElementById("footPendPagado").textContent = money(0);
      return;
    }

    let sumPagado = 0;
    let sumSaldo = 0;

    tbodyPend.innerHTML = rows.map(f => {
      const total = num(f.total);
      const pagado = num(f.total_pagado);
      const saldo = num(f.saldo);
      
      sumPagado += pagado;
      sumSaldo += saldo;

      return `<tr>
        <td class="fw-semibold">
          <a href="../facturas/factura-view.html?id=${f.id}" class="text-decoration-none">${esc(f.numero)}</a>
         </td>
        <td>${esc(f.cliente?.nombre_razon_social ?? "—")}</td>
        <td>${esc((f.fecha ?? "").substring(0, 10))}</td>
        <td class="text-end">${money(total)}</td>
        <td class="text-end text-success">${money(pagado)}</td>
        <td class="text-end text-danger fw-semibold">${money(saldo)}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-success" data-pend-pay="1"
            data-id="${f.id}" data-num="${esc(f.numero)}"
            data-total="${total}" data-saldo="${saldo}"
            data-pagado="${pagado}"
            data-cliente="${f.cliente_id}" title="Cobrar">
            <i class="bi bi-cash-coin"></i> Cobrar
          </button>
        </td>
      </tr>`;
    }).join("");

    document.getElementById("footPendPagado").textContent = money(sumPagado);
    document.getElementById("footPendSaldo").textContent = money(sumSaldo);
  } catch (e) {
    console.error("Error loading pendientes:", e);
    tbodyPend.innerHTML = `<tr><td colspan="7" class="text-danger p-3">${esc(e.message)}</td></tr>`;
  }
}

function initPendientes() {
  // Inicializar UI de pagos
  _pagosUI = createPagosUI({
    onPagoOk: async (data, facturaCtx) => {
      // Recargar la lista después de un pago exitoso
      await _load();
    },
  });

  _pagosUI.boot();

  const tbodyPend = document.getElementById("tbodyPend");
  const pendSearch = document.getElementById("pendSearch");
  const btnRefresh = document.getElementById("btnPendRefresh");

  let timer = null;
  if (pendSearch) {
    pendSearch.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(_load, 300);
    });
  }

  if (btnRefresh) {
    btnRefresh.addEventListener("click", _load);
  }

  if (tbodyPend) {
    tbodyPend.addEventListener("click", e => {
      const btn = e.target.closest("[data-pend-pay]");
      if (!btn) return;

      if (!_pagosUI) {
        initPendientes();
      }

      const facturaId = btn.dataset.id;
      const numero = btn.dataset.num;
      const total = num(btn.dataset.total);
      const pagado = num(btn.dataset.pagado);
      const saldo = num(btn.dataset.saldo);
      const clienteId = btn.dataset.cliente;

      _pagosUI.openPagoModal({
        facturaId: facturaId,
        numero: numero,
        total: total,
        pagado: pagado,
        saldo: saldo,
        clienteId: clienteId
      });
    });
  }

  _load();
}

// Iniciar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPendientes);
} else {
  initPendientes();
}