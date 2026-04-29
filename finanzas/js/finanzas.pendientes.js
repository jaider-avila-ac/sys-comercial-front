import "../../common/js/auth.js";
import { money, num, esc, createPagosUI } from "../../common/js/pagos.ui.js";
import { facturasPendientes } from "./finanzas.service.js";

let _pagosUI = null;

async function _load() {
  const tbodyPend = document.getElementById("tbodyPend");
  const pendSearch = document.getElementById("pendSearch");
  const search = pendSearch?.value?.trim() || "";

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
      sumPagado += num(f.total_pagado);
      sumSaldo += num(f.saldo);

      return `<tr>
        <td class="fw-semibold">
          <a href="../facturas/factura-view.html?id=${f.id}" class="text-decoration-none">${esc(f.numero)}</a>
        </td>
        <td>${esc(f.cliente?.nombre_razon_social ?? "—")}</td>
        <td>${esc((f.fecha ?? "").substring(0, 10))}</td>
        <td class="text-end">${money(f.total)}</td>
        <td class="text-end text-success">${money(f.total_pagado)}</td>
        <td class="text-end text-danger fw-semibold">${money(f.saldo)}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-success" data-pend-pay="1"
            data-id="${f.id}" data-num="${esc(f.numero)}"
            data-total="${num(f.total)}" data-saldo="${num(f.saldo)}"
            data-cliente="${f.cliente_id}" title="Cobrar">
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

function initPendientes() {
  _pagosUI = createPagosUI({
    onPagoOk: async () => {
      await _load();
    },
  });

  _pagosUI.boot();

  const tbodyPend = document.getElementById("tbodyPend");
  const pendSearch = document.getElementById("pendSearch");

  let timer = null;
  pendSearch?.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(_load, 300);
  });

  document.getElementById("btnPendRefresh")?.addEventListener("click", _load);

  tbodyPend?.addEventListener("click", e => {
    const btn = e.target.closest("[data-pend-pay]");
    if (!btn) return;

    _pagosUI.openPagoModal({
      facturaId: btn.dataset.id,
      numero: btn.dataset.num,
      total: num(btn.dataset.total),
      saldo: num(btn.dataset.saldo),
      clienteId: btn.dataset.cliente,
    });
  });

  _load();
}

initPendientes();