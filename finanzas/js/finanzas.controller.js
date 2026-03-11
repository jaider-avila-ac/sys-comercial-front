import "../../common/js/auth.js";
import { showToast, showConfirm } from "../../common/js/ui.utils.js";
import { createPagosUI, money }   from "../../common/js/pagos.ui.js";

import {
  getResumen,
  listarPagos,
  facturasPendientes,
  buscarFacturaPorNumero,
  getIngresos,  crearIngreso,  actualizarIngreso,  eliminarIngreso,
  getEgresos,   crearEgreso,   actualizarEgreso,   eliminarEgreso,
} from "./finanzas.service.js";

// ── helpers ───────────────────────────────────────────────────
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, m =>
    ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[m])
  );
}

function num(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function setMsg(id, text, kind = "danger") {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.className   = `small mt-2 text-${kind}`;
}

const FORMAS = {
  EFECTIVO: "Efectivo", TRANSFERENCIA: "Transferencia",
  TARJETA: "Tarjeta",   BILLETERA: "Billetera", OTRO: "Otro",
};

const BADGE_FORMA = {
  EFECTIVO: "bg-success", TRANSFERENCIA: "bg-primary",
  TARJETA: "bg-info text-dark", BILLETERA: "bg-warning text-dark", OTRO: "bg-secondary",
};

// ── Filtro global de fechas ───────────────────────────────────
const filtroDesde = document.getElementById("filtroDesde");
const filtroHasta = document.getElementById("filtroHasta");
filtroDesde.value = `${new Date().getFullYear()}-01-01`;
filtroHasta.value = todayISO();

document.getElementById("btnFiltrar")?.addEventListener("click", cargarTodo);
document.getElementById("btnLimpiarFiltro")?.addEventListener("click", () => {
  filtroDesde.value = "";
  filtroHasta.value = "";
  cargarTodo();
});

function filtroParams() {
  const p = {};
  if (filtroDesde.value) p.desde = filtroDesde.value;
  if (filtroHasta.value) p.hasta = filtroHasta.value;
  return p;
}

// ── Tabs ──────────────────────────────────────────────────────
const TABS = ["cobro", "pendientes", "historial", "ingresos", "egresos"];
let activeTab = "cobro";

document.querySelectorAll("[data-tab]").forEach(btn => {
  btn.addEventListener("click", async () => {
    activeTab = btn.dataset.tab;
    document.querySelectorAll("[data-tab]").forEach(b =>
      b.classList.toggle("active", b === btn)
    );
    TABS.forEach(t => {
      const el = document.getElementById(`tab-${t}`);
      if (el) el.style.display = t === activeTab ? "" : "none";
    });
    if (activeTab === "pendientes") await loadPendientes();
    if (activeTab === "historial")  await loadHistorial();
    if (activeTab === "ingresos")   await cargarIngresos();
    if (activeTab === "egresos")    await cargarEgresos();
  });
});

// ── KPIs ──────────────────────────────────────────────────────
async function cargarKpis() {
  try {
    const [r, pendData] = await Promise.all([
      getResumen(filtroParams()),
      facturasPendientes(),
    ]);

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    set("kpiFacturas",       money(r.ingresos_facturas));
    set("kpiMostrador",      money(r.ingresos_mostrador));
    set("kpiCaja",           money(r.total_en_caja));
    set("kpiIngresosManuales", money(r.ingresos_manuales));
    set("kpiEgresos",        money(r.total_egresos));

    const balEl  = document.getElementById("kpiBalanceReal");
    const wrapEl = document.getElementById("kpiBalanceWrap");
    if (balEl) balEl.textContent = money(r.balance_real);
    if (wrapEl) {
      wrapEl.style.background = r.balance_real >= 0
        ? "linear-gradient(135deg,#198754,#2fb380)"
        : "linear-gradient(135deg,#dc3545,#e8606e)";
    }

    const pendCount = Array.isArray(pendData?.data) ? pendData.data.length : 0;
    const badge = document.getElementById("badgePendientes");
    if (badge) {
      badge.textContent   = pendCount;
      badge.style.display = pendCount > 0 ? "" : "none";
    }
  } catch (e) {
    console.error("KPIs:", e);
  }
}

document.getElementById("btnRefreshKpi")?.addEventListener("click", cargarKpis);

// ── Pagos UI (modal registrar pago) ──────────────────────────
const pagosUI = createPagosUI({
  onPagoOk: async () => {
    await cargarKpis();
    if (activeTab === "pendientes") await loadPendientes();
    if (activeTab === "historial")  await loadHistorial();
    if (activeTab === "cobro" && cobroFactura?.numero) {
      try {
        const fac2 = await buscarFacturaPorNumero(cobroFactura.numero);
        if (fac2 && num(fac2.saldo) > 0) renderCobroResult(fac2);
        else limpiarCobro();
      } catch (_) {}
    }
  },
});
pagosUI.boot();

// ── TAB: COBRO RÁPIDO ─────────────────────────────────────────
let cobroFactura = null;
const cobroInput  = document.getElementById("cobroInput");
const cobroResult = document.getElementById("cobroResult");
const cobroMsg    = document.getElementById("cobroMsg");

function limpiarCobro() {
  if (cobroInput)  cobroInput.value = "";
  if (cobroResult) cobroResult.style.display = "none";
  if (cobroMsg)    cobroMsg.textContent = "";
  document.getElementById("cobroOk")?.classList.add("d-none");
  document.getElementById("cobroErr")?.classList.add("d-none");
  cobroFactura = null;
}

function renderCobroResult(fac) {
  cobroFactura = fac;
  document.getElementById("cobroNum").textContent     = fac.numero;
  document.getElementById("cobroCliente").textContent = fac.cliente?.nombre_razon_social ?? `Cliente ${fac.cliente_id}`;
  document.getElementById("cobroTotal").textContent   = money(fac.total);
  document.getElementById("cobroPagado").textContent  = money(fac.total_pagado);
  document.getElementById("cobroSaldo").textContent   = money(fac.saldo);
  document.getElementById("cobroVerLink").href        = `../facturas/factura-view.html?id=${fac.id}`;
  cobroResult.style.display = "";
  document.getElementById("cobroOk")?.classList.add("d-none");
  document.getElementById("cobroErr")?.classList.add("d-none");
}

async function buscarCobro() {
  const val = cobroInput?.value?.trim() || "";
  if (!val) return;
  cobroMsg.textContent = "Buscando…";
  cobroMsg.className   = "small text-muted";
  cobroResult.style.display = "none";
  cobroFactura = null;
  try {
    const fac = await buscarFacturaPorNumero(val);
    if (!fac) {
      cobroMsg.textContent = "Factura no encontrada o no está EMITIDA.";
      cobroMsg.className   = "small text-danger";
      return;
    }
    if (num(fac.saldo) <= 0) {
      cobroMsg.textContent = `La factura ${fac.numero} ya está pagada en su totalidad. ✓`;
      cobroMsg.className   = "small text-success";
      return;
    }
    cobroMsg.textContent = "";
    renderCobroResult(fac);
  } catch (e) {
    cobroMsg.textContent = e.message || "Error al buscar.";
    cobroMsg.className   = "small text-danger";
  }
}

document.getElementById("btnBuscarFactura")?.addEventListener("click", buscarCobro);
cobroInput?.addEventListener("keydown", e => e.key === "Enter" && buscarCobro());
document.getElementById("btnLimpiarCobro")?.addEventListener("click", limpiarCobro);
document.getElementById("btnCobroAbrirPago")?.addEventListener("click", () => {
  if (!cobroFactura) return;
  pagosUI.openPagoModal({
    facturaId: cobroFactura.id,
    numero:    cobroFactura.numero,
    total:     num(cobroFactura.total),
    saldo:     num(cobroFactura.saldo),
    clienteId: cobroFactura.cliente_id,
  });
});

// ── TAB: SALDOS PENDIENTES ────────────────────────────────────
const tbodyPend = document.getElementById("tbodyPend");

async function loadPendientes() {
  const search = document.getElementById("pendSearch")?.value?.trim() || "";
  tbodyPend.innerHTML = `<tr><td colspan="7" class="text-muted p-3 text-center">Cargando…</td></tr>`;
  document.getElementById("footPendSaldo").textContent  = "—";
  document.getElementById("footPendPagado").textContent = "—";

  try {
    const data = await facturasPendientes({ search });
    const rows = data.data || [];

    if (!rows.length) {
      tbodyPend.innerHTML = `<tr><td colspan="7" class="text-center text-muted p-4">
        <i class="bi bi-check2-circle text-success d-block fs-3 mb-1"></i>
        Sin facturas con saldo pendiente. ¡Todo al día!
      </td></tr>`;
      document.getElementById("footPendSaldo").textContent  = money(0);
      document.getElementById("footPendPagado").textContent = money(0);
      return;
    }

    let sumPagado = 0, sumSaldo = 0;
    tbodyPend.innerHTML = rows.map(f => {
      sumPagado += num(f.total_pagado);
      sumSaldo  += num(f.saldo);
      return `<tr>
        <td class="fw-semibold">
          <a href="../facturas/factura-view.html?id=${f.id}" class="text-decoration-none">${esc(f.numero)}</a>
        </td>
        <td>${esc(f.cliente?.nombre_razon_social ?? "—")}</td>
        <td>${esc((f.fecha ?? "").substring(0,10))}</td>
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
    document.getElementById("footPendSaldo").textContent  = money(sumSaldo);
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

tbodyPend?.addEventListener("click", e => {
  const btn = e.target.closest("[data-pend-pay]");
  if (!btn) return;
  pagosUI.openPagoModal({
    facturaId: btn.dataset.id,   numero: btn.dataset.num,
    total:     num(btn.dataset.total), saldo: num(btn.dataset.saldo),
    clienteId: btn.dataset.cliente,
  });
});

// ── TAB: HISTORIAL DE PAGOS ───────────────────────────────────
const tbodyHist = document.getElementById("tbodyHist");

async function loadHistorial() {
  tbodyHist.innerHTML = `<tr><td colspan="7" class="text-muted p-3 text-center">Cargando…</td></tr>`;
  document.getElementById("footHistAplicado").textContent = "—";

  try {
    const data = await listarPagos({
      search:     document.getElementById("histSearch")?.value?.trim() || "",
      formaPago:  document.getElementById("histForma")?.value  || "",
      fechaDesde: document.getElementById("histDesde")?.value  || "",
      fechaHasta: document.getElementById("histHasta")?.value  || "",
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
      const aplicado    = esMostrador
        ? num(p.total_pagado)
        : (p.aplicaciones || []).reduce((s, a) => s + num(a.monto), 0);
      sumAplicado += aplicado;

      const facturas = esMostrador
        ? `<span class="badge bg-light text-dark border">VENTA RÁPIDA</span>`
        : (p.aplicaciones || []).map(a =>
            a.factura
              ? `<a href="../facturas/factura-view.html?id=${a.factura.id}"
                   class="badge bg-light text-dark border text-decoration-none me-1">
                  ${esc(a.factura.numero)}</a>`
              : ""
          ).join("");

      return `<tr>
        <td class="fw-semibold">${esc(p.numero_recibo)}</td>
        <td>${esc((p.fecha ?? "").substring(0,10))}</td>
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

let histTimer = null;
document.getElementById("histSearch")?.addEventListener("input", () => {
  clearTimeout(histTimer); histTimer = setTimeout(loadHistorial, 300);
});
["histForma", "histDesde", "histHasta"].forEach(id =>
  document.getElementById(id)?.addEventListener("change", loadHistorial)
);
document.getElementById("btnHistRefresh")?.addEventListener("click", loadHistorial);

// ── TAB: INGRESOS MANUALES ────────────────────────────────────
const tbodyIngresos = document.getElementById("tbodyIngresos");

async function cargarIngresos() {
  tbodyIngresos.innerHTML = `<tr><td colspan="5" class="text-muted text-center py-3">Cargando…</td></tr>`;
  try {
    const list = await getIngresos(filtroParams());
    if (!list.length) {
      tbodyIngresos.innerHTML = `<tr><td colspan="5" class="text-muted text-center py-4">Sin registros.</td></tr>`;
      return;
    }
    tbodyIngresos.innerHTML = "";
    list.forEach(i => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="text-nowrap">${i.fecha ?? "—"}</td>
        <td>${esc(i.descripcion)}</td>
        <td class="text-muted small">${esc(i.notas ?? "—")}</td>
        <td class="text-end text-success fw-semibold">${money(i.monto)}</td>
        <td class="text-end text-nowrap">
          <button class="btn btn-sm btn-outline-secondary me-1" data-edit-ingreso="${i.id}">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger" data-del-ingreso="${i.id}">
            <i class="bi bi-trash"></i>
          </button>
        </td>`;
      tr.querySelector("[data-edit-ingreso]")._data = i;
      tbodyIngresos.appendChild(tr);
    });
  } catch (e) {
    tbodyIngresos.innerHTML = `<tr><td colspan="5" class="text-danger text-center py-3">${e.message}</td></tr>`;
  }
}

tbodyIngresos?.addEventListener("click", async e => {
  const btnEdit = e.target.closest("[data-edit-ingreso]");
  const btnDel  = e.target.closest("[data-del-ingreso]");
  if (btnEdit) { abrirModalIngreso(btnEdit._data); return; }
  if (btnDel) {
    const ok = await showConfirm("¿Eliminar este ingreso?",
      { title: "Eliminar ingreso", okLabel: "Sí, eliminar", okVariant: "btn-danger" });
    if (!ok) return;
    try {
      await eliminarIngreso(btnDel.dataset.delIngreso);
      showToast("Ingreso eliminado.", "warning");
      cargarTodo();
    } catch (e) { showToast(e.message || "Error al eliminar.", "danger"); }
  }
});

const modalIngreso = new bootstrap.Modal(document.getElementById("modalIngreso"));

function abrirModalIngreso(data = null) {
  document.getElementById("ingresoId").value          = data?.id ?? "";
  document.getElementById("ingresoDescripcion").value = data?.descripcion ?? "";
  document.getElementById("ingresoMonto").value       = data?.monto ?? "";
  document.getElementById("ingresoFecha").value       = data?.fecha ?? todayISO();
  document.getElementById("ingresoNotas").value       = data?.notas ?? "";
  document.getElementById("modalIngresoTitle").textContent =
    data ? "Editar ingreso manual" : "Nuevo ingreso manual";
  setMsg("ingresoMsg", "");
  modalIngreso.show();
}

document.getElementById("btnNuevoIngreso")?.addEventListener("click", () => abrirModalIngreso());

document.getElementById("btnGuardarIngreso")?.addEventListener("click", async () => {
  const id    = document.getElementById("ingresoId").value;
  const desc  = document.getElementById("ingresoDescripcion").value.trim();
  const monto = parseFloat(document.getElementById("ingresoMonto").value);
  const fecha = document.getElementById("ingresoFecha").value;
  const notas = document.getElementById("ingresoNotas").value.trim();

  if (!desc)          { setMsg("ingresoMsg", "La descripción es obligatoria."); return; }
  if (!monto || monto <= 0) { setMsg("ingresoMsg", "Ingresa un monto válido.");   return; }
  if (!fecha)         { setMsg("ingresoMsg", "La fecha es obligatoria.");         return; }

  setMsg("ingresoMsg", "Guardando…", "secondary");
  try {
    const payload = { descripcion: desc, monto, fecha, notas: notas || null };
    if (id) { await actualizarIngreso(id, payload); showToast("Ingreso actualizado.", "success"); }
    else    { await crearIngreso(payload);           showToast("Ingreso registrado.", "success"); }
    modalIngreso.hide();
    cargarTodo();
  } catch (e) { setMsg("ingresoMsg", e.message || "Error al guardar."); }
});

// ── TAB: EGRESOS ──────────────────────────────────────────────
const tbodyEgresos = document.getElementById("tbodyEgresos");

async function cargarEgresos() {
  tbodyEgresos.innerHTML = `<tr><td colspan="5" class="text-muted text-center py-3">Cargando…</td></tr>`;
  try {
    const list = await getEgresos(filtroParams());
    if (!list.length) {
      tbodyEgresos.innerHTML = `<tr><td colspan="5" class="text-muted text-center py-4">Sin registros.</td></tr>`;
      return;
    }
    tbodyEgresos.innerHTML = "";
    list.forEach(eg => {
      const archivoHtml = eg.archivo_url
        ? `<a href="${eg.archivo_url}" target="_blank" class="small text-primary text-truncate d-inline-block"
              style="max-width:140px" title="${esc(eg.archivo_nombre ?? "")}">
            <i class="bi bi-paperclip me-1"></i>${esc(eg.archivo_nombre ?? "Ver archivo")}
           </a>`
        : `<span class="text-muted small">—</span>`;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="text-nowrap">${eg.fecha ?? "—"}</td>
        <td>${esc(eg.descripcion)}</td>
        <td>${archivoHtml}</td>
        <td class="text-end text-danger fw-semibold">${money(eg.monto)}</td>
        <td class="text-end text-nowrap">
          <button class="btn btn-sm btn-outline-secondary me-1" data-edit-egreso="${eg.id}">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger" data-del-egreso="${eg.id}">
            <i class="bi bi-trash"></i>
          </button>
        </td>`;
      tr.querySelector("[data-edit-egreso]")._data = eg;
      tbodyEgresos.appendChild(tr);
    });
  } catch (e) {
    tbodyEgresos.innerHTML = `<tr><td colspan="5" class="text-danger text-center py-3">${e.message}</td></tr>`;
  }
}

tbodyEgresos?.addEventListener("click", async e => {
  const btnEdit = e.target.closest("[data-edit-egreso]");
  const btnDel  = e.target.closest("[data-del-egreso]");
  if (btnEdit) { abrirModalEgreso(btnEdit._data); return; }
  if (btnDel) {
    const ok = await showConfirm("¿Eliminar este egreso?",
      { title: "Eliminar egreso", okLabel: "Sí, eliminar", okVariant: "btn-danger" });
    if (!ok) return;
    try {
      await eliminarEgreso(btnDel.dataset.delEgreso);
      showToast("Egreso eliminado.", "warning");
      cargarTodo();
    } catch (e) { showToast(e.message || "Error al eliminar.", "danger"); }
  }
});

const modalEgreso = new bootstrap.Modal(document.getElementById("modalEgreso"));

function abrirModalEgreso(data = null) {
  document.getElementById("egresoId").value          = data?.id ?? "";
  document.getElementById("egresoDescripcion").value = data?.descripcion ?? "";
  document.getElementById("egresoMonto").value       = data?.monto ?? "";
  document.getElementById("egresoFecha").value       = data?.fecha ?? todayISO();
  document.getElementById("egresoArchivo").value     = "";
  document.getElementById("modalEgresoTitle").textContent =
    data ? "Editar egreso" : "Nuevo egreso";

  const wrapActual = document.getElementById("egresoArchivoActual");
  if (data?.archivo_url) {
    wrapActual.classList.remove("d-none");
    const link = document.getElementById("egresoArchivoLink");
    link.href        = data.archivo_url;
    link.textContent = data.archivo_nombre ?? "Ver archivo";
  } else {
    wrapActual.classList.add("d-none");
  }
  setMsg("egresoMsg", "");
  modalEgreso.show();
}

document.getElementById("btnNuevoEgreso")?.addEventListener("click", () => abrirModalEgreso());

document.getElementById("btnGuardarEgreso")?.addEventListener("click", async () => {
  const id    = document.getElementById("egresoId").value;
  const desc  = document.getElementById("egresoDescripcion").value.trim();
  const monto = parseFloat(document.getElementById("egresoMonto").value);
  const fecha = document.getElementById("egresoFecha").value;
  const file  = document.getElementById("egresoArchivo").files[0];

  if (!desc)          { setMsg("egresoMsg", "La descripción es obligatoria."); return; }
  if (!monto || monto <= 0) { setMsg("egresoMsg", "Ingresa un monto válido.");   return; }
  if (!fecha)         { setMsg("egresoMsg", "La fecha es obligatoria.");         return; }

  const fd = new FormData();
  fd.append("descripcion", desc);
  fd.append("monto", monto);
  fd.append("fecha", fecha);
  if (file) fd.append("archivo", file);

  setMsg("egresoMsg", "Guardando…", "secondary");
  try {
    if (id) { await actualizarEgreso(id, fd); showToast("Egreso actualizado.", "success"); }
    else    { await crearEgreso(fd);           showToast("Egreso registrado.", "success"); }
    modalEgreso.hide();
    cargarTodo();
  } catch (e) { setMsg("egresoMsg", e.message || "Error al guardar."); }
});

// ── init ──────────────────────────────────────────────────────
function cargarTodo() {
  cargarKpis();
  // Recargar solo el tab activo para no saturar en el init
  if (activeTab === "historial")  loadHistorial();
  if (activeTab === "pendientes") loadPendientes();
  if (activeTab === "ingresos")   cargarIngresos();
  if (activeTab === "egresos")    cargarEgresos();
}

cargarKpis();