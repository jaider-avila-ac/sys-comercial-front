import { listarCompras, obtenerCompra, confirmarCompra, anularCompra, registrarPagoCompra } from "./compras.service.js";
import { showToast, showConfirm } from "../../common/js/ui.utils.js";

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, m =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m])
  );
}

function money(n) {
  return Number(n || 0).toLocaleString("es-CO", { style: "currency", currency: "COP" });
}

function fmtDate(iso) {
  if (!iso) return "—";
  return iso.substring(0, 10);
}

function getEstadoBadge(estado, saldo) {
  const badges = {
    'PENDIENTE': '<span class="badge bg-warning text-dark">PENDIENTE</span>',
    'PARCIAL': '<span class="badge bg-info text-dark">PARCIAL</span>',
    'PAGADA': '<span class="badge bg-success">PAGADA</span>',
    'ANULADA': '<span class="badge bg-danger">ANULADA</span>'
  };
  return badges[estado] || `<span class="badge bg-secondary">${estado}</span>`;
}

function el(id) { return document.getElementById(id); }

let currentPage = 1, lastPage = 1, compraActual = null;
let bsDetalle = null, bsPago = null;

const params = new URLSearchParams(location.search);
const proveedorId = params.get("proveedor_id");

if (proveedorId) {
  const titleEl = document.querySelector("h4.mb-0");
  if (titleEl) titleEl.innerHTML = '<i class="bi bi-bag-check me-2 text-primary"></i>Compras del Proveedor';
}

async function load(page = 1) {
  currentPage = page;
  const tbody = el("tbodyCompras");
  if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="text-muted p-3 text-center">Cargando…</td></tr>';

  try {
    const filtros = {
      estado: el("estadoFilter")?.value || "",
      desde: el("desdeFilter")?.value || "",
      hasta: el("hastaFilter")?.value || "",
      page,
    };
    if (proveedorId) filtros.proveedor_id = proveedorId;
    if (el("searchInput")?.value) filtros.search = el("searchInput").value;

    const data = await listarCompras(filtros);
    lastPage = data.last_page || 1;
    const rows = data.data || [];

    if (!rows.length) {
      if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="text-muted p-3 text-center">Sin resultados.</td></tr>';
      el("pageInfo").textContent = "0 registros";
      return;
    }

    let html = "";
    for (const c of rows) {
      const saldo = Number(c.saldo_pendiente || 0);
      const puedePagar = (c.estado === "PENDIENTE" || c.estado === "PARCIAL") && saldo > 0;

      html += `
        <tr data-id="${c.id}">
          <td class="fw-semibold">${esc(c.numero || "—")}</td>
          <td>${esc(c.proveedor?.nombre || "—")}</td>
          <td class="small text-muted">${esc(c.items?.[0]?.item?.nombre || "Sin detalle")}</td>
          <td class="text-nowrap">${fmtDate(c.fecha)}</td>
          <td class="text-end">${money(c.total)}</td>
          <td class="text-end ${saldo > 0 ? 'text-danger fw-semibold' : 'text-success'}">${money(saldo)}</td>
          <td>${getEstadoBadge(c.estado, saldo)}</td>
          <td class="text-end">
            <button class="btn btn-sm btn-outline-secondary btn-ver" data-id="${c.id}" title="Ver detalle">
              <i class="bi bi-eye"></i>
            </button>
            ${puedePagar ? `
              <button class="btn btn-sm btn-pagar ms-1" data-id="${c.id}" data-saldo="${saldo}" title="Registrar pago">
                <i class="bi bi-cash-coin"></i> Pagar
              </button>
            ` : ''}
            ${c.estado === "PENDIENTE" || c.estado === "PARCIAL" ? `
              <button class="btn btn-sm btn-outline-danger ms-1 btn-anular" data-id="${c.id}" data-numero="${esc(c.numero)}" title="Anular">
                <i class="bi bi-x-circle"></i>
              </button>
            ` : ''}
          </td>
        </tr>
      `;
    }
    if (tbody) tbody.innerHTML = html;

    el("pageInfo").textContent = `Página ${data.current_page} de ${data.last_page} · ${data.total} registros`;
    el("btnPrev").disabled = page <= 1;
    el("btnNext").disabled = page >= lastPage;
  } catch (e) {
    console.error(e);
    if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="text-danger p-3">${esc(e.message)}</td></tr>`;
  }
}

async function abrirDetalle(id) {
  if (!bsDetalle) bsDetalle = new bootstrap.Modal(el("modalDetalle"));
  bsDetalle.show();

  try {
    const c = await obtenerCompra(id);
    compraActual = c;

    el("detalleNumero").textContent = c.numero || "—";
    el("detalleProv").textContent = c.proveedor?.nombre || "—";
    el("detalleFecha").textContent = fmtDate(c.fecha);
    el("detalleCondicion").textContent = c.condicion_pago || "—";

    let lineasHtml = "";
    if (c.items && c.items.length) {
      lineasHtml = c.items.map(l => `
        <tr><td>${esc(l.item?.nombre || "—")}</td><td class="text-end">${l.cantidad}</td><td class="text-end">${money(l.precio_unitario)}</td><td class="text-end">${money(l.subtotal)}</td></tr>
      `).join("");
    } else {
      lineasHtml = '<tr><td colspan="4" class="text-muted">Sin líneas</td></tr>';
    }
    el("detalleLineas").innerHTML = lineasHtml;

    el("detalleSubtotal").textContent = money(c.subtotal);
    el("detalleImpuestos").textContent = money(c.impuestos);
    el("detalleTotal").innerHTML = money(c.total);
    el("detalleSaldo").innerHTML = money(c.saldo_pendiente);

    const saldo = Number(c.saldo_pendiente);
    const puedePagar = (c.estado === "PENDIENTE" || c.estado === "PARCIAL") && saldo > 0;
    const puedeConfirmar = c.estado === "PENDIENTE" && !c.numero;

    el("btnDetalleConfirmar").classList.toggle("d-none", !puedeConfirmar);
    el("btnDetallePagar").classList.toggle("d-none", !puedePagar);
  } catch (e) {
    showToast(e.message, "danger");
  }
}

function abrirPago(id, saldo) {
  if (!bsPago) bsPago = new bootstrap.Modal(el("modalPago"));
  el("pagoCompraId").value = id;
  el("pagoSaldoRef").textContent = money(saldo);
  el("pagoFecha").value = new Date().toISOString().split("T")[0];
  el("pagoMonto").value = "";
  el("pagoMonto").max = saldo;
  el("pagoMedio").value = "TRANSFERENCIA";
  el("pagoNotas").value = "";
  el("pagoMsg").textContent = "";
  bsPago.show();
}

async function registrarPago() {
  const id = el("pagoCompraId").value;
  const fecha = el("pagoFecha").value;
  const monto = parseFloat(el("pagoMonto").value);
  const medio = el("pagoMedio").value;
  const notas = el("pagoNotas").value;

  if (!fecha) { showToast("La fecha es obligatoria", "danger"); return; }
  if (!monto || monto <= 0) { showToast("El monto debe ser mayor a 0", "danger"); return; }

  const btn = el("btnPagoOk");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Guardando...';

  try {
    await registrarPagoCompra(id, { fecha, monto, medio_pago: medio, notas });
    showToast("Pago registrado correctamente", "success");
    bsPago.hide();
    load(currentPage);
  } catch (e) {
    showToast(e.message || "Error al registrar pago", "danger");
  } finally {
    btn.disabled = false;
    btn.innerHTML = "Registrar pago";
  }
}

async function confirmarCompraHandler(id) {
  const ok = await showConfirm("¿Confirmar esta compra? Se registrará en inventario.", { title: "Confirmar compra" });
  if (!ok) return;
  try {
    await confirmarCompra(id);
    showToast("Compra confirmada", "success");
    load(currentPage);
    bsDetalle?.hide();
  } catch (e) {
    showToast(e.message, "danger");
  }
}

async function anularCompraHandler(id, numero) {
  const ok = await showConfirm(`¿Anular la compra ${numero}?`, { title: "Anular compra", okVariant: "btn-danger" });
  if (!ok) return;
  try {
    await anularCompra(id);
    showToast("Compra anulada", "warning");
    load(currentPage);
    bsDetalle?.hide();
  } catch (e) {
    showToast(e.message, "danger");
  }
}

function setupEventListeners() {
  el("btnRefrescar")?.addEventListener("click", () => load(1));
  el("searchInput")?.addEventListener("input", () => { setTimeout(() => load(1), 300); });
  el("estadoFilter")?.addEventListener("change", () => load(1));
  el("desdeFilter")?.addEventListener("change", () => load(1));
  el("hastaFilter")?.addEventListener("change", () => load(1));
  el("btnPrev")?.addEventListener("click", () => load(currentPage - 1));
  el("btnNext")?.addEventListener("click", () => load(currentPage + 1));
  el("btnPagoOk")?.addEventListener("click", registrarPago);
  el("btnDetalleConfirmar")?.addEventListener("click", () => compraActual && confirmarCompraHandler(compraActual.id));
  el("btnDetallePagar")?.addEventListener("click", () => compraActual && abrirPago(compraActual.id, compraActual.saldo_pendiente));

  document.addEventListener("click", (e) => {
    const btnVer = e.target.closest(".btn-ver");
    if (btnVer) abrirDetalle(btnVer.dataset.id);
    const btnPagar = e.target.closest(".btn-pagar");
    if (btnPagar) abrirPago(btnPagar.dataset.id, parseFloat(btnPagar.dataset.saldo));
    const btnAnular = e.target.closest(".btn-anular");
    if (btnAnular) anularCompraHandler(btnAnular.dataset.id, btnAnular.dataset.numero);
  });
}

setupEventListeners();
load(1);