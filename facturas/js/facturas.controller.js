import {
  listarFacturas,
  emitirFactura,
  anularFactura,
} from "./facturas.service.js";
import { showToast, showConfirm, createPagosUI } from "../../common/js/pagos.ui.js";
import { apiFetch } from "../../common/js/api.js";

const tbody = document.getElementById("tbody");
const msg = document.getElementById("msg");
const searchInp = document.getElementById("search");
const estadoSel = document.getElementById("estado");
const clienteSel = document.getElementById("cliente_id");
const btnRefrescar = document.getElementById("btnRefrescar");

const pagosUI = createPagosUI({
  onPagoOk: async (data, facturaCtx) => {
    // Recargar la lista de facturas después de un pago exitoso
    await loadFacturas(currentPage);
    showToast("Pago registrado correctamente", "success");
  }
});

pagosUI.boot();

function money(n) {
  return Number(n || 0).toLocaleString("es-CO", {
    style: "currency", currency: "COP", maximumFractionDigits: 2,
  });
}

function escHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, m =>
    ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[m])
  );
}

function setMsg(text, kind = "muted") {
  msg.className = `small mt-2 text-${kind}`;
  msg.textContent = text;
}

function badgeEstado(estado) {
  switch (estado) {
    case "BORRADOR": return `<span class="badge text-bg-secondary">BORRADOR</span>`;
    case "EMITIDA": return `<span class="badge text-bg-success">EMITIDA</span>`;
    case "ANULADA": return `<span class="badge text-bg-danger">ANULADA</span>`;
    default: return `<span class="badge text-bg-light text-dark">${escHtml(estado || "—")}</span>`;
  }
}

async function cargarClientes() {
  if (!clienteSel) return;
  try {
    const res = await apiFetch('/clientes?per_page=1000');
    const data = await res.json();
    const clientes = data.data || [];
    clienteSel.innerHTML = '<option value="">Todos los clientes</option>';
    clientes.forEach(c => {
      clienteSel.innerHTML += `<option value="${c.id}">${escHtml(c.nombre_razon_social)}</option>`;
    });
    const urlParams = new URLSearchParams(location.search);
    const clienteId = urlParams.get("cliente_id");
    if (clienteId) clienteSel.value = clienteId;
  } catch (e) {
    console.error("Error cargando clientes:", e);
  }
}

function renderRows(items) {
  if (!Array.isArray(items) || !items.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-muted p-3 text-center">No se encontraron facturas.</td></tr>`;
    return;
  }

  tbody.innerHTML = items.map(f => {
    const numero = f.numero?.trim() ? f.numero : '—';
    const cliente = f.cliente?.nombre_razon_social || "—";
    const fecha = f.fecha ? String(f.fecha).substring(0, 10) : "—";
    const total = money(f.total);
    const pagado = money(f.total_pagado);
    const saldo = money(f.saldo);
    const saldoNum = Number(f.saldo || 0);
    const canEmit = f.estado === "BORRADOR";
    const canAnular = f.estado !== "ANULADA";
    const puedePagar = f.estado === "EMITIDA";

    return `
      <tr data-id="${f.id}">
        <td class="fw-semibold">${numero !== '—' ? escHtml(numero) : '<span class="text-muted fst-italic">Sin número</span>'}</td>
        <td>${escHtml(cliente)}</td>
        <td>${badgeEstado(f.estado)}</td>
        <td>${escHtml(fecha)}</td>
        <td class="text-end">${total}</td>
        <td class="text-end">${pagado}</td>
        <td class="text-end ${saldoNum > 0 ? 'text-danger fw-semibold' : 'text-success'}">${saldo}</td>
        <td class="text-end text-nowrap">
          <div class="btn-group btn-group-sm" role="group">
            <a class="btn btn-outline-primary" href="factura-view.html?id=${f.id}" title="Ver detalle">
              <i class="bi bi-eye"></i>
            </a>
            <a class="btn btn-outline-secondary" href="factura-form.html?id=${f.id}" title="Editar">
              <i class="bi bi-pencil-square"></i>
            </a>
            ${puedePagar ? `
              <button class="btn btn-outline-success btn-pagar" 
                data-factura-id="${f.id}"
                data-factura-numero="${escHtml(numero)}"
                data-total="${f.total}"
                data-pagado="${f.total_pagado}"
                data-saldo="${f.saldo}"
                data-cliente-id="${f.cliente_id}"
                title="Pagos">
                <i class="bi bi-cash-stack"></i>
              </button>
            ` : ''}
            <button class="btn btn-outline-success" data-emitir="${f.id}" ${canEmit ? "" : "disabled"} title="Emitir">
              <i class="bi bi-check2-circle"></i>
            </button>
            <button class="btn btn-outline-danger" data-anular="${f.id}" ${canAnular ? "" : "disabled"} title="Anular">
              <i class="bi bi-x-circle"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function renderPaginationMeta(data) {
  if (!data || typeof data !== "object") { setMsg(""); return; }
  const total = Number(data.total || 0);
  const from = Number(data.from || 0);
  const to = Number(data.to || 0);
  if (!total) { setMsg("Sin resultados."); return; }
  setMsg(`Mostrando ${from} a ${to} de ${total} factura(s).`, "muted");
}

let currentPage = 1;
let searchTimer = null;

async function loadFacturas(page = 1) {
  currentPage = page;
  tbody.innerHTML = `<tr><td colspan="8" class="text-muted p-3 text-center">Cargando…</td></tr>`;
  setMsg("");
  try {
    const data = await listarFacturas({
      search: searchInp?.value.trim() || "",
      estado: estadoSel?.value || "",
      cliente_id: clienteSel?.value || "",
      page, per_page: 20,
    });
    const items = Array.isArray(data?.data) ? data.data : [];
    if (!items.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-muted p-3 text-center">No se encontraron facturas.</td></tr>`;
      renderPaginationMeta(data); return;
    }
    renderRows(items);
    renderPaginationMeta(data);
  } catch (e) {
    console.error(e);
    tbody.innerHTML = `<tr><td colspan="8" class="text-danger p-3 text-center">${escHtml(e.message || "Error al listar facturas")}</td></tr>`;
    setMsg(e.message || "Error al listar facturas.", "danger");
  }
}

// Event Listeners
if (searchInp) searchInp.addEventListener("input", () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => loadFacturas(1), 250); });
if (estadoSel) estadoSel.addEventListener("change", () => loadFacturas(1));
if (clienteSel) clienteSel.addEventListener("change", () => loadFacturas(1));
if (btnRefrescar) btnRefrescar.addEventListener("click", () => loadFacturas(currentPage));

if (tbody) {
  tbody.addEventListener("click", async (e) => {
    const btnEmitir = e.target.closest("[data-emitir]");
    const btnAnular = e.target.closest("[data-anular]");
    const btnPagar = e.target.closest(".btn-pagar");

    if (btnEmitir) {
      const ok = await showConfirm("¿Emitir esta factura?", { title: "Emitir factura", okLabel: "Sí, emitir", okVariant: "btn-success" });
      if (!ok) return;
      try { await emitirFactura(btnEmitir.dataset.emitir); showToast("Factura emitida", "success"); loadFacturas(currentPage); }
      catch (e) { showToast(e.message || "No se pudo emitir.", "danger"); }
      return;
    }

    if (btnAnular) {
      const ok = await showConfirm("¿Anular esta factura?", { title: "Anular factura", okLabel: "Sí, anular", okVariant: "btn-danger" });
      if (!ok) return;
      try { await anularFactura(btnAnular.dataset.anular); showToast("Factura anulada", "warning"); loadFacturas(currentPage); }
      catch (e) { showToast(e.message || "No se pudo anular.", "danger"); }
      return;
    }

    if (btnPagar) {
      pagosUI.openPagoModal({
        facturaId: btnPagar.dataset.facturaId,
        numero: btnPagar.dataset.facturaNumero,
        total: parseFloat(btnPagar.dataset.total),
        pagado: parseFloat(btnPagar.dataset.pagado),
        saldo: parseFloat(btnPagar.dataset.saldo),
        clienteId: btnPagar.dataset.clienteId,
      });
      return;
    }
  });
}

cargarClientes();
loadFacturas(1);