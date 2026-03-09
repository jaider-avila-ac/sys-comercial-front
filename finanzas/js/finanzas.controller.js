import "../../common/js/auth.js";

import { showToast, showConfirm }    from "../../common/js/ui.utils.js";
import {
  getResumen,
  getIngresos,  crearIngreso,  actualizarIngreso,  eliminarIngreso,
  getEgresos,   crearEgreso,   actualizarEgreso,   eliminarEgreso,
  getPagos,
} from "./finanzas.service.js";



// ── helpers ───────────────────────────────────────────────────
function money(n) {
  return Number(n || 0).toLocaleString("es-CO", { style: "currency", currency: "COP" });
}
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function setMsgEl(id, text, kind = "danger") {
  const el = document.getElementById(id);
  el.textContent = text;
  el.className   = `small mt-2 text-${kind}`;
}

// ── Filtro fechas ─────────────────────────────────────────────
const filtroDesde = document.getElementById("filtroDesde");
const filtroHasta = document.getElementById("filtroHasta");
filtroDesde.value = `${new Date().getFullYear()}-01-01`;
filtroHasta.value = todayISO();

document.getElementById("btnFiltrar").addEventListener("click", () => cargarTodo());
document.getElementById("btnLimpiarFiltro").addEventListener("click", () => {
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
const paneles = {
  ingresos: document.getElementById("panelIngresos"),
  pagos:    document.getElementById("panelPagos"),
  egresos:  document.getElementById("panelEgresos"),
};

document.querySelectorAll("[data-tab]").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("[data-tab]").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.tab;
    Object.entries(paneles).forEach(([key, el]) => {
      el.style.display = key === tab ? "" : "none";
    });
  });
});

// ── Resumen KPIs ──────────────────────────────────────────────
async function cargarResumen() {
  try {
    const r = await getResumen(filtroParams());
    document.getElementById("cardPagos").textContent    = money(r.ingresos_pagos);
    document.getElementById("cardManuales").textContent = money(r.ingresos_manuales);
    document.getElementById("cardEgresos").textContent  = money(r.total_egresos);
    const balEl   = document.getElementById("cardBalance");
    const wrapEl  = document.getElementById("cardBalanceWrap");
    balEl.textContent = money(r.balance);
    // Cambiar color del KPI según balance positivo/negativo
    wrapEl.style.background = r.balance >= 0
      ? "linear-gradient(135deg,#198754,#2fb380)"
      : "linear-gradient(135deg,#dc3545,#e8606e)";
  } catch { /* silencioso, no romper la UI */ }
}

// ── Tabla Ingresos manuales ───────────────────────────────────
const tbodyIngresos = document.getElementById("tbodyIngresos");

async function cargarIngresos() {
  tbodyIngresos.innerHTML = `<tr><td colspan="5" class="text-muted text-center py-3">Cargando…</td></tr>`;
  try {
    const list = await getIngresos(filtroParams());
    tbodyIngresos.innerHTML = "";
    if (!list.length) {
      tbodyIngresos.innerHTML = `<tr><td colspan="5" class="text-muted text-center py-4">Sin registros.</td></tr>`;
      return;
    }
    list.forEach(i => {
      const tr = document.createElement("tr");
      // Serializar sin comillas simples problemáticas en el atributo HTML
      tr.innerHTML = `
        <td class="text-nowrap">${i.fecha ?? "—"}</td>
        <td>${i.descripcion}</td>
        <td class="text-muted small">${i.notas ?? "—"}</td>
        <td class="text-end text-success fw-semibold">${money(i.monto)}</td>
        <td class="text-end text-nowrap">
          <button class="btn btn-sm btn-outline-secondary me-1" data-edit-ingreso="${i.id}">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger" data-del-ingreso="${i.id}">
            <i class="bi bi-trash"></i>
          </button>
        </td>`;
      // Guardar el objeto en el dataset para no tener problemas de escape
      tr.querySelector("[data-edit-ingreso]")._data = i;
      tbodyIngresos.appendChild(tr);
    });
  } catch (e) {
    tbodyIngresos.innerHTML = `<tr><td colspan="5" class="text-danger text-center py-3">${e.message}</td></tr>`;
  }
}

tbodyIngresos.addEventListener("click", async e => {
  const btnEdit = e.target.closest("[data-edit-ingreso]");
  const btnDel  = e.target.closest("[data-del-ingreso]");
  if (btnEdit) { abrirModalIngreso(btnEdit._data); return; }
  if (btnDel) {
    const ok = await showConfirm("¿Eliminar este ingreso? Esta acción no se puede deshacer.",
      { title: "Eliminar ingreso", okLabel: "Sí, eliminar", okVariant: "btn-danger" });
    if (!ok) return;
    try {
      await eliminarIngreso(btnDel.dataset.delIngreso);
      showToast("Ingreso eliminado.", "warning");
      cargarTodo();
    } catch (e) { showToast(e.message || "Error al eliminar.", "danger"); }
  }
});

// ── Modal Ingreso ─────────────────────────────────────────────
const modalIngreso = new bootstrap.Modal(document.getElementById("modalIngreso"));

function abrirModalIngreso(data = null) {
  document.getElementById("ingresoId").value          = data?.id ?? "";
  document.getElementById("ingresoDescripcion").value = data?.descripcion ?? "";
  document.getElementById("ingresoMonto").value       = data?.monto ?? "";
  document.getElementById("ingresoFecha").value       = data?.fecha ?? todayISO();
  document.getElementById("ingresoNotas").value       = data?.notas ?? "";
  document.getElementById("modalIngresoTitle").textContent =
    data ? "Editar ingreso manual" : "Nuevo ingreso manual";
  setMsgEl("ingresoMsg", "");
  modalIngreso.show();
}

document.getElementById("btnNuevoIngreso").addEventListener("click", () => abrirModalIngreso());

document.getElementById("btnGuardarIngreso").addEventListener("click", async () => {
  const id    = document.getElementById("ingresoId").value;
  const desc  = document.getElementById("ingresoDescripcion").value.trim();
  const monto = parseFloat(document.getElementById("ingresoMonto").value);
  const fecha = document.getElementById("ingresoFecha").value;
  const notas = document.getElementById("ingresoNotas").value.trim();

  if (!desc)             { setMsgEl("ingresoMsg", "La descripción es obligatoria."); return; }
  if (!monto || monto <= 0) { setMsgEl("ingresoMsg", "Ingresa un monto válido."); return; }
  if (!fecha)            { setMsgEl("ingresoMsg", "La fecha es obligatoria."); return; }

  setMsgEl("ingresoMsg", "Guardando…", "secondary");
  try {
    const payload = { descripcion: desc, monto, fecha, notas: notas || null };
    if (id) {
      await actualizarIngreso(id, payload);
      showToast("Ingreso actualizado.", "success");
    } else {
      await crearIngreso(payload);
      showToast("Ingreso registrado.", "success");
    }
    modalIngreso.hide();
    cargarTodo();
  } catch (e) { setMsgEl("ingresoMsg", e.message || "Error al guardar."); }
});

// ── Tabla Pagos recibidos ─────────────────────────────────────
const tbodyPagosRec = document.getElementById("tbodyPagosRec");

async function cargarPagosRecibidos() {
  tbodyPagosRec.innerHTML = `<tr><td colspan="6" class="text-muted text-center py-3">Cargando…</td></tr>`;
  try {
    const list = await getPagos(filtroParams());
    tbodyPagosRec.innerHTML = "";
    if (!list.length) {
      tbodyPagosRec.innerHTML = `<tr><td colspan="6" class="text-muted text-center py-4">Sin registros.</td></tr>`;
      return;
    }
    const badges = {
      EFECTIVO: "bg-success", TRANSFERENCIA: "bg-primary",
      TARJETA: "bg-info text-dark", BILLETERA: "bg-warning text-dark", OTRO: "bg-secondary",
    };
    list.forEach(p => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="text-nowrap small fw-semibold">${p.numero_recibo ?? "—"}</td>
        <td class="text-nowrap">${p.fecha ?? "—"}</td>
        <td>${p.cliente}</td>
        <td><span class="badge ${badges[p.forma_pago] ?? "bg-secondary"}">${p.forma_pago}</span></td>
        <td class="text-muted small">${p.referencia ?? "—"}</td>
        <td class="text-end text-success fw-semibold">${money(p.total_pagado)}</td>`;
      tbodyPagosRec.appendChild(tr);
    });
  } catch (e) {
    tbodyPagosRec.innerHTML = `<tr><td colspan="6" class="text-danger text-center py-3">${e.message}</td></tr>`;
  }
}

// ── Tabla Egresos ─────────────────────────────────────────────
const tbodyEgresos = document.getElementById("tbodyEgresos");

async function cargarEgresos() {
  tbodyEgresos.innerHTML = `<tr><td colspan="5" class="text-muted text-center py-3">Cargando…</td></tr>`;
  try {
    const list = await getEgresos(filtroParams());
    tbodyEgresos.innerHTML = "";
    if (!list.length) {
      tbodyEgresos.innerHTML = `<tr><td colspan="5" class="text-muted text-center py-4">Sin registros.</td></tr>`;
      return;
    }
    list.forEach(eg => {
      const archivoHtml = eg.archivo_url
        ? `<a href="${eg.archivo_url}" target="_blank" class="small text-primary text-truncate d-inline-block"
              style="max-width:140px" title="${eg.archivo_nombre ?? ""}">
            <i class="bi bi-paperclip me-1"></i>${eg.archivo_nombre ?? "Ver archivo"}
           </a>`
        : `<span class="text-muted small">—</span>`;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="text-nowrap">${eg.fecha ?? "—"}</td>
        <td>${eg.descripcion}</td>
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

tbodyEgresos.addEventListener("click", async e => {
  const btnEdit = e.target.closest("[data-edit-egreso]");
  const btnDel  = e.target.closest("[data-del-egreso]");
  if (btnEdit) { abrirModalEgreso(btnEdit._data); return; }
  if (btnDel) {
    const ok = await showConfirm("¿Eliminar este egreso? Esta acción no se puede deshacer.",
      { title: "Eliminar egreso", okLabel: "Sí, eliminar", okVariant: "btn-danger" });
    if (!ok) return;
    try {
      await eliminarEgreso(btnDel.dataset.delEgreso);
      showToast("Egreso eliminado.", "warning");
      cargarTodo();
    } catch (e) { showToast(e.message || "Error al eliminar.", "danger"); }
  }
});

// ── Modal Egreso ──────────────────────────────────────────────
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
    const link       = document.getElementById("egresoArchivoLink");
    link.href        = data.archivo_url;
    link.textContent = data.archivo_nombre ?? "Ver archivo";
  } else {
    wrapActual.classList.add("d-none");
  }

  setMsgEl("egresoMsg", "");
  modalEgreso.show();
}

document.getElementById("btnNuevoEgreso").addEventListener("click", () => abrirModalEgreso());

document.getElementById("btnGuardarEgreso").addEventListener("click", async () => {
  const id    = document.getElementById("egresoId").value;
  const desc  = document.getElementById("egresoDescripcion").value.trim();
  const monto = parseFloat(document.getElementById("egresoMonto").value);
  const fecha = document.getElementById("egresoFecha").value;
  const file  = document.getElementById("egresoArchivo").files[0];

  if (!desc)             { setMsgEl("egresoMsg", "La descripción es obligatoria."); return; }
  if (!monto || monto <= 0) { setMsgEl("egresoMsg", "Ingresa un monto válido."); return; }
  if (!fecha)            { setMsgEl("egresoMsg", "La fecha es obligatoria."); return; }

  const fd = new FormData();
  fd.append("descripcion", desc);
  fd.append("monto", monto);
  fd.append("fecha", fecha);
  if (file) fd.append("archivo", file);

  setMsgEl("egresoMsg", "Guardando…", "secondary");
  try {
    if (id) {
      await actualizarEgreso(id, fd);
      showToast("Egreso actualizado.", "success");
    } else {
      await crearEgreso(fd);
      showToast("Egreso registrado.", "success");
    }
    modalEgreso.hide();
    cargarTodo();
  } catch (e) { setMsgEl("egresoMsg", e.message || "Error al guardar."); }
});

// ── init ──────────────────────────────────────────────────────
function cargarTodo() {
  cargarResumen();
  cargarIngresos();
  cargarPagosRecibidos();
  cargarEgresos();
}

cargarTodo();