import { obtenerFactura, obtenerPagos } from "./facturas.service.js";
import { apiFetch } from "../../common/js/api.js";
import { createPagosUI } from "../../common/js/pagos.ui.js";

const qs = new URLSearchParams(location.search);
const id = qs.get("id");
const returnTo = qs.get("return_to");
const clienteId = qs.get("cliente_id");

if (!id) {
  document.getElementById("docSheet").innerHTML =
    `<div class="text-danger p-4">No se especificó una factura.</div>`;
}

// ── helpers ───────────────────────────────────────────────────
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, m =>
    ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[m])
  );
}

function money(n) {
  return Number(n || 0).toLocaleString("es-CO", { style:"currency", currency:"COP" });
}

function fmtDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = String(iso).substring(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function float(v) { 
  return Number(v || 0); 
}

const ESTADO_STYLE = {
  BORRADOR: { bg:"#e9ecef", color:"#495057" },
  EMITIDA:  { bg:"#d1e7dd", color:"#0f5132" },
  ANULADA:  { bg:"#f8d7da", color:"#842029" },
};

let factura = null;
let empresaData = null;
let pagosUI = null;

// ── Función para obtener la empresa actual ───────────────────
async function obtenerEmpresaActual() {
  try {
    const res = await apiFetch("/empresa/me");
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Error al cargar empresa");
    return data.empresa;
  } catch (e) {
    console.warn("No se pudo cargar la empresa:", e);
    return null;
  }
}

// ── Configurar botón volver ───────────────────────────────────
function setupBackButton() {
  const backBtn = document.getElementById("btnVolver");
  if (!backBtn) return;

  if (returnTo === 'cliente' && clienteId) {
    backBtn.href = `../clientes/cliente-facturas.html?id=${clienteId}`;
    backBtn.innerHTML = '<i class="bi bi-arrow-left me-1"></i> Volver al cliente';
  } else {
    backBtn.href = 'facturas.html';
    backBtn.innerHTML = '<i class="bi bi-arrow-left me-1"></i> Volver a facturas';
  }
}

// ── Configurar botón editar ───────────────────────────────────
function setupEditButton() {
  const editBtn = document.getElementById("btnEditar");
  if (!editBtn) return;
  
  let url = `factura-form.html?id=${id}`;
  if (returnTo === 'cliente' && clienteId) {
    url += `&return_to=cliente&cliente_id=${clienteId}`;
  }
  editBtn.href = url;
}

// ── Función para renderizar la factura en el HTML ─────────────
function renderFacturaToHTML(factura, empresa) {
  const emp = empresa || {};
  const eStyle = ESTADO_STYLE[factura.estado] ?? { bg: "#e9ecef", color: "#495057" };
  const cli = factura.cliente ?? {};
  const lineas = factura.lineas ?? [];
  
  let subtotal = 0, descuentos = 0, iva = 0, total = 0;
  
  const lineasHTML = lineas.map((l, i) => {
    const totalLinea = (l.cantidad * l.valor_unitario) - (l.descuento || 0);
    subtotal += l.cantidad * l.valor_unitario;
    descuentos += (l.descuento || 0);
    iva += (totalLinea * (l.iva_pct || 0) / 100);
    total += totalLinea + (totalLinea * (l.iva_pct || 0) / 100);
    
    const desc = l.descripcion_manual || l.item?.nombre || `Item ${l.item_id}`;
    return `<tr>
      <td class="text-muted">${i + 1}</td>
      <td>${esc(desc)}</td>
      <td class="text-end">${Number(l.cantidad).toLocaleString("es-CO")}</td>
      <td class="text-end">${money(l.valor_unitario)}</td>
      <td class="text-end ${l.descuento > 0 ? 'text-danger' : ''}">${l.descuento > 0 ? money(l.descuento) : "—"}</td>
      <td class="text-end">${Number(l.iva_pct ?? 0).toFixed(0)}%</td>
      <td class="text-end fw-semibold">${money(totalLinea + (totalLinea * (l.iva_pct || 0) / 100))}</td>
    </tr>`;
  }).join("");
  
  const pagado = factura.total_pagado || 0;
  const saldo = factura.saldo || (total - pagado);
  
  // Logo URL
  let logoUrl = '';
  if (emp.logo_path) {
    if (emp.logo_path.startsWith('http')) {
      logoUrl = emp.logo_path;
    } else {
      logoUrl = `http://127.0.0.1:8000/storage/${emp.logo_path.replace(/^\/?storage\//, '')}`;
    }
  }
  
  const logoHTML = logoUrl ? `<div class="empresa-logo mb-2"><img src="${logoUrl}" alt="Logo" style="max-height:60px; width:auto;"></div>` : '';
  
  return `
    <div class="invoice-header">
      <div class="row align-items-start">
        <div class="col-7">
          ${logoHTML}
          <h5 class="mb-0">${esc(emp.nombre ?? "Mi Empresa")}</h5>
          <div class="small text-muted">${emp.nit ? `NIT: ${emp.nit}` : ""}</div>
          <div class="small text-muted">${emp.direccion ?? ""}</div>
          <div class="small text-muted">${emp.telefono ? `Tel: ${emp.telefono}` : ""} ${emp.email ? `· ${emp.email}` : ""}</div>
        </div>
        <div class="col-5 text-end">
          <div class="mb-2">
            <span class="status-badge" style="background:${eStyle.bg};color:${eStyle.color}">${factura.estado}</span>
          </div>
          <h4 class="mb-0">FACTURA</h4>
          <div class="text-muted small">N° ${factura.numero ?? `#${factura.id}`}</div>
          <div class="text-muted small">Fecha: ${fmtDate(factura.fecha)}</div>
        </div>
      </div>
    </div>
    
    <div style="padding: 1.5rem">
      <div class="row mb-4">
        <div class="col-7">
          <div class="text-muted small mb-1">CLIENTE</div>
          <div class="fw-semibold">${esc(cli.nombre_razon_social ?? `Cliente ${factura.cliente_id}`)}</div>
          <div class="small text-muted">${cli.num_documento ? `${cli.tipo_documento ?? "Doc"}: ${cli.num_documento}` : ""}</div>
          <div class="small text-muted">${cli.direccion ?? ""}</div>
          <div class="small text-muted">${cli.telefono ? `Tel: ${cli.telefono}` : ""} ${cli.email ? `· ${cli.email}` : ""}</div>
        </div>
        <div class="col-5 text-end">
          <div class="text-muted small mb-1">USUARIO</div>
          <div>${factura.usuario?.nombres ? `${factura.usuario.nombres} ${factura.usuario.apellidos ?? ""}` : "—"}</div>
        </div>
      </div>
      
      <div class="table-responsive">
        <table class="table doc-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Descripción</th>
              <th class="text-end">Cant.</th>
              <th class="text-end">Vlr. Unit.</th>
              <th class="text-end">Descuento</th>
              <th class="text-end">IVA %</th>
              <th class="text-end">Total</th>
            </tr>
          </thead>
          <tbody>
            ${lineasHTML || '<tr><td colspan="7" class="text-muted">Sin líneas. </td></tr>'}
          </tbody>
        </table>
      </div>
      
      <div class="row justify-content-end">
        <div class="col-md-4">
          <table class="totales w-100">
            <tr><td class="text-muted">Subtotal</td><td class="text-end">${money(subtotal)}</td></tr>
            ${descuentos > 0 ? `<tr><td class="text-muted">Descuentos</td><td class="text-end text-danger">- ${money(descuentos)}</td></tr>` : ''}
            <tr><td class="text-muted">IVA</td><td class="text-end">${money(iva)}</td></tr>
            <tr class="border-top"><td class="fw-semibold">TOTAL</td><td class="text-end fw-semibold">${money(total)}</td></tr>
            <td><td class="text-muted">Pagado</td><td class="text-end text-success">${money(pagado)}</td></tr>
            <tr class="border-top"><td class="fw-semibold">Saldo</td><td class="text-end fw-semibold ${saldo > 0 ? 'text-danger' : 'text-success'}">${money(saldo)}</td></tr>
          </table>
        </div>
      </div>
      
      ${factura.notas ? `<div class="mt-3"><hr><div class="small text-muted">Notas: ${esc(factura.notas)}</div></div>` : ''}
      
      <div class="mt-4">
        <h6 class="mb-2"><i class="bi bi-cash-stack me-1"></i>Historial de pagos</h6>
        <div id="pagosContainer">Cargando pagos...</div>
      </div>
    </div>
  `;
}

function renderPagos(pagos) {
  const container = document.getElementById("pagosContainer");
  if (!container) return;
  
  if (!pagos || !pagos.length) {
    container.innerHTML = '<div class="text-muted small">No hay pagos registrados.</div>';
    return;
  }
  
  container.innerHTML = `
    <div class="table-responsive">
      <table class="table table-sm">
        <thead>
          <tr>
            <th>Recibo</th>
            <th>Fecha</th>
            <th>Forma de pago</th>
            <th>Referencia</th>
            <th class="text-end">Monto</th>
          </tr>
        </thead>
        <tbody>
          ${pagos.map(p => `
            <tr>
              <td class="fw-semibold">${esc(p.numero_recibo || "—")}</td>
              <td>${p.fecha ? fmtDate(p.fecha) : "—"}</td>
              <td>${esc(p.forma_pago || "—")}</td>
              <td class="text-muted small">${esc(p.referencia || "—")}</td>
              <td class="text-end text-success fw-semibold">${money(p.monto)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

// ── Inicializar UI de pagos ───────────────────────────────────
function initPagosUI() {
  pagosUI = createPagosUI({
    onPagoOk: async (data, facturaCtx) => {
      // Recargar la factura después de un pago exitoso
      await load();
    }
  });
  pagosUI.boot();
}

// ── Abrir modal de pago ───────────────────────────────────────
function abrirModalPago() {
  if (!pagosUI) {
    initPagosUI();
  }
  
  pagosUI.openPagoModal({
    facturaId: factura.id,
    numero: factura.numero || `#${factura.id}`,
    total: factura.total,
    pagado: factura.total_pagado || 0,
    saldo: factura.saldo || (factura.total - (factura.total_pagado || 0)),
    clienteId: factura.cliente_id,
  });
}

// ── Cargar factura ────────────────────────────────────────────
async function load() {
  try {
    const docSheet = document.getElementById("docSheet");
    if (docSheet) {
      docSheet.innerHTML = '<div class="text-center p-5">Cargando factura...</div>';
    }
    
    // Cargar empresa y factura en paralelo
    const [empresa, facturaData] = await Promise.all([
      obtenerEmpresaActual(),
      obtenerFactura(id)
    ]);
    
    empresaData = empresa;
    factura = facturaData;
    
    const html = renderFacturaToHTML(factura, empresaData);
    if (docSheet) {
      docSheet.innerHTML = html;
    }
    
    // Cargar pagos después de renderizar
    const pagos = await obtenerPagos(id);
    renderPagos(pagos);
    
    setupBackButton();
    setupEditButton();
    
    // Inicializar UI de pagos si no está inicializada
    if (!pagosUI) {
      initPagosUI();
    }
    
    // Configurar botón de nuevo pago
    const btnNuevoPago = document.getElementById("btnNuevoPago");
    if (btnNuevoPago) {
      // Remover event listener anterior si existe
      if (btnNuevoPago._listener) {
        btnNuevoPago.removeEventListener("click", btnNuevoPago._listener);
      }
      
      if (factura.estado === "EMITIDA" && float(factura.saldo) > 0.009) {
        btnNuevoPago.style.display = "inline-flex";
        const clickHandler = () => abrirModalPago();
        btnNuevoPago.addEventListener("click", clickHandler);
        btnNuevoPago._listener = clickHandler;
      } else {
        btnNuevoPago.style.display = "none";
      }
    }
    
    document.title = `Factura ${factura.numero ?? id} · SYS Comercial`;
  } catch (e) {
    console.error("Error loading factura:", e);
    const docSheet = document.getElementById("docSheet");
    if (docSheet) {
      docSheet.innerHTML = `<div class="text-danger p-4"><i class="bi bi-exclamation-triangle me-2"></i>${esc(e.message)}</div>`;
    }
  }
}

// Iniciar carga
load();