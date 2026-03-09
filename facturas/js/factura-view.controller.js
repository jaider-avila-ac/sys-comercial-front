import { obtenerFactura, obtenerPagos, registrarPago } from "./facturas.service.js";

const qs = new URLSearchParams(location.search);
const id = qs.get("id");

if (!id) {
  document.getElementById("docSheet").innerHTML =
    `<div class="text-danger p-4">No se especificó una factura.</div>`;
}

// ── helpers ───────────────────────────────────────────────────────────────────
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
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

const ESTADO_STYLE = {
  BORRADOR: { bg:"#e9ecef", color:"#495057" },
  EMITIDA:  { bg:"#d1e7dd", color:"#0f5132" },
  ANULADA:  { bg:"#f8d7da", color:"#842029" },
};

const FORMAS_PAGO = {
  EFECTIVO:     "Efectivo",
  TRANSFERENCIA:"Transferencia",
  TARJETA:      "Tarjeta",
  BILLETERA:    "Billetera digital",
  OTRO:         "Otro",
};

// ── Estado global ──────────────────────────────────────────────────────────────
let factura = null;
let modalPago = null;

// ── Cargar factura ────────────────────────────────────────────────────────────
async function load() {
  try {
    factura = await obtenerFactura(id);
    renderFactura(factura);
    renderSaldo(factura);
    await cargarPagos();
  } catch (e) {
    document.getElementById("docSheet").innerHTML =
      `<div class="text-danger p-4"><i class="bi bi-exclamation-triangle me-2"></i>${esc(e.message)}</div>`;
  }
}

function renderFactura(fac) {
  document.getElementById("btnEditar").href = `factura-form.html?id=${id}`;
  document.title = `Factura ${fac.numero ?? id} · SYS Comercial`;

  // Badge estado
  const eStyle = ESTADO_STYLE[fac.estado] ?? { bg:"#e9ecef", color:"#495057" };
  const badge  = document.getElementById("badgeEstado");
  badge.textContent = fac.estado;
  badge.style.background = eStyle.bg;
  badge.style.color       = eStyle.color;

  // Empresa
  const emp = fac.empresa ?? {};
  document.getElementById("empresaNombre").textContent = emp.nombre ?? "Mi Empresa";
  document.getElementById("empresaNit").textContent    = emp.nit ? `NIT: ${emp.nit}` : "";
  document.getElementById("empresaTel").textContent    = emp.telefono ? `Tel: ${emp.telefono}` : "";
  document.getElementById("empresaEmail").textContent  = emp.email ?? "";
  document.getElementById("empresaDir").textContent    = emp.direccion ?? "";

  // Número
  document.getElementById("docNumero").textContent = fac.numero ?? `#${id}`;

  // Cotización origen
  if (fac.cotizacion_id) {
    document.getElementById("cotizacionOrigen").textContent =
      `Origen: cotización ${fac.cotizacion?.numero ?? "#"+fac.cotizacion_id}`;
  }

  // Cliente
  const cli = fac.cliente ?? {};
  document.getElementById("clienteNombre").textContent = cli.nombre_razon_social ?? `Cliente ${fac.cliente_id}`;
  document.getElementById("clienteDoc").textContent    = cli.num_documento
    ? `${cli.tipo_documento ?? "Doc"}: ${cli.num_documento}` : "";
  document.getElementById("clienteEmail").textContent  = cli.email ?? "";
  document.getElementById("clienteTel").textContent    = cli.telefono ?? "";
  document.getElementById("clienteDir").textContent    = cli.direccion ?? "";

  // Fechas
  document.getElementById("docFecha").textContent  = fmtDate(fac.fecha);

  // Usuario
  const usr = fac.usuario ?? {};
  document.getElementById("docUsuario").textContent = usr.nombres
    ? `${usr.nombres} ${usr.apellidos ?? ""}`.trim() : "—";

  // Líneas
  const lineas = fac.lineas ?? [];
  if (!lineas.length) {
    document.getElementById("tbodyLineas").innerHTML =
      `<tr><td colspan="7" class="text-muted">Sin líneas.</td></tr>`;
  } else {
    document.getElementById("tbodyLineas").innerHTML = lineas.map((l, i) => {
      const desc = l.descripcion_manual
        ? l.descripcion_manual
        : (l.item?.nombre ?? `Item ${l.item_id ?? ""}`);
      return `
        <tr>
          <td class="text-muted">${i + 1}</td>
          <td>${esc(desc)}</td>
          <td class="text-end">${Number(l.cantidad).toLocaleString("es-CO")}</td>
          <td class="text-end">${money(l.valor_unitario)}</td>
          <td class="text-end text-danger">${l.descuento > 0 ? money(l.descuento) : "—"}</td>
          <td class="text-end">${Number(l.iva_pct ?? 0).toFixed(0)} %</td>
          <td class="text-end fw-semibold">${money(l.total_linea)}</td>
        </tr>`;
    }).join("");
  }

  // Totales doc
  document.getElementById("tSubtotal").textContent = money(fac.subtotal);
  document.getElementById("tDesc").textContent     = fac.total_descuentos > 0
    ? `- ${money(fac.total_descuentos)}` : "—";
  document.getElementById("tIva").textContent      = money(fac.total_iva);
  document.getElementById("tTotal").textContent    = money(fac.total);

  // Notas
  if (fac.notas) {
    document.getElementById("docNotas").style.display = "";
    document.getElementById("docNotasTexto").textContent = fac.notas;
  }

  // Botón nuevo pago: solo si EMITIDA y saldo > 0
  const btnNuevoPago = document.getElementById("btnNuevoPago");
  if (fac.estado === "EMITIDA" && (float(fac.saldo)) > 0.009) {
    btnNuevoPago.style.display = "inline-flex";
  }
}

function float(v) { return Number(v || 0); }

function renderSaldo(fac) {
  const pagado  = float(fac.total_pagado);
  const saldo   = float(fac.saldo);
  const elPagado = document.getElementById("totalPagado");
  const elSaldo  = document.getElementById("saldoPendiente");

  elPagado.textContent = money(pagado);

  elSaldo.textContent = money(saldo);
  elSaldo.className   = "saldo-block " + (saldo > 0.009 ? "saldo-pendiente" : "saldo-pagado");
}

// ── Cargar historial de pagos ─────────────────────────────────────────────────
async function cargarPagos() {
  const tbody = document.getElementById("tbodyPagos");
  try {
    const pagos = await obtenerPagos(id);
    if (!pagos.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-muted p-3">Sin pagos registrados.</td></tr>`;
      return;
    }
    tbody.innerHTML = pagos.map(pa => {
      const pago = pa.pago ?? {};
      return `
        <tr>
          <td class="fw-semibold">${esc(pago.numero_recibo ?? "—")}</td>
          <td>${fmtDate(pago.fecha)}</td>
          <td>${esc(FORMAS_PAGO[pago.forma_pago] ?? pago.forma_pago ?? "—")}</td>
          <td class="text-muted small">${esc(pago.referencia ?? "—")}</td>
          <td class="text-end fw-semibold text-success">${money(pa.monto)}</td>
        </tr>`;
    }).join("");
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-danger p-3">${esc(e.message)}</td></tr>`;
  }
}

// ── Modal nuevo pago ──────────────────────────────────────────────────────────
document.getElementById("btnNuevoPago").addEventListener("click", () => {
  // Prellenar
  document.getElementById("pagoFecha").value  = todayISO();
  document.getElementById("pagoMonto").value  = Number(factura?.saldo || 0).toFixed(2);
  document.getElementById("pagoRef").value    = "";
  document.getElementById("pagoNotas").value  = "";
  document.getElementById("pagoMsg").textContent = "";
  document.getElementById("pagoSaldoInfo").textContent =
    `Saldo pendiente: ${money(factura?.saldo)}`;

  modalPago = new bootstrap.Modal(document.getElementById("modalPago"));
  modalPago.show();
});

document.getElementById("btnGuardarPago").addEventListener("click", async () => {
  const msgEl = document.getElementById("pagoMsg");
  msgEl.textContent = "";

  const pagoFecha = document.getElementById("pagoFecha").value;
  const pagoForma = document.getElementById("pagoForma").value;
  const pagoMonto = parseFloat(document.getElementById("pagoMonto").value);
  const pagoRef   = document.getElementById("pagoRef").value.trim() || null;
  const pagoNotas = document.getElementById("pagoNotas").value.trim() || null;

  if (!pagoFecha) { msgEl.textContent = "La fecha es obligatoria."; return; }
  if (!pagoMonto || pagoMonto <= 0) { msgEl.textContent = "El monto debe ser mayor a 0."; return; }

  const saldo = float(factura?.saldo);
  if (pagoMonto > saldo + 0.01) {
    msgEl.textContent = `El monto supera el saldo (${money(saldo)}).`;
    return;
  }

  try {
    msgEl.textContent = "Guardando…";
    msgEl.className = "small text-muted mt-2";

    const result = await registrarPago(id, {
      fecha:      pagoFecha,
      forma_pago: pagoForma,
      monto:      pagoMonto,
      referencia: pagoRef,
      notas:      pagoNotas,
    });

    factura = result.factura;
    modalPago.hide();
    renderSaldo(factura);

    // Actualizar botón nuevo pago
    const btnNuevoPago = document.getElementById("btnNuevoPago");
    if (float(factura.saldo) <= 0.009) btnNuevoPago.style.display = "none";

    await cargarPagos();
  } catch (e) {
    msgEl.textContent = e.message || "Error al registrar pago.";
    msgEl.className = "small text-danger mt-2";
  }
});

load();
