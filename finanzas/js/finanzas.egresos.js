import "../../common/js/auth.js";
import { money, esc, showToast, showConfirm } from "../../common/js/pagos.ui.js";
import { apiFetch } from "../../common/js/api.js";

let _filtroParams = () => ({});
let _onDataChange = null;

function getLocalFilters() {
  return {
    search: document.getElementById("egresosSearch")?.value?.trim() || "",
    tipo: document.getElementById("egresosTipo")?.value || "",
    estado: document.getElementById("egresosEstado")?.value || "",
    desde: document.getElementById("egresosDesde")?.value || "",
    hasta: document.getElementById("egresosHasta")?.value || "",
  };
}

async function _load() {
  const tbody = document.getElementById("tbodyEgresos");
  const totalSpan = document.getElementById("totalEgresos");
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="8" class="text-muted text-center py-3">Cargando…</td></tr>`;

  try {
    const params = getLocalFilters();
    const qs = new URLSearchParams();
    if (params.search) qs.set("search", params.search);
    if (params.tipo) qs.set("tipo", params.tipo);
    if (params.estado) qs.set("estado", params.estado);
    if (params.desde) qs.set("desde", params.desde);
    if (params.hasta) qs.set("hasta", params.hasta);
    qs.set("per_page", "100");

    const res = await apiFetch(`/egresos/unificados?${qs}`);
    const data = await res.json();
    const rows = data.data || [];

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-muted text-center py-4">Sin registros.</td></tr>`;
      if (totalSpan) totalSpan.innerHTML = money(0);
      return;
    }

    let total = 0;
    tbody.innerHTML = "";

    rows.forEach(item => {
      total += item.monto;
      const anulado = item.estado === "ANULADO";
      const archivoUrl = item.archivo_url ?? null;
      const archivoNombre = item.archivo_nombre ?? "Ver archivo";

      const archivoHtml = archivoUrl
        ? `<a href="${archivoUrl}" target="_blank" class="small text-primary text-truncate d-inline-block"
              style="max-width:140px" title="${esc(archivoNombre)}">
            <i class="bi bi-paperclip me-1"></i>${esc(archivoNombre)}
           </a>`
        : `<span class="text-muted small">—</span>`;

      const estadoBadge = anulado
        ? `<span class="badge bg-danger-subtle text-danger border border-danger-subtle">ANULADO</span>`
        : `<span class="badge bg-success-subtle text-success border border-success-subtle">ACTIVO</span>`;

      const tipoLabel = item.tipo_label || (item.tipo === "EGRESO_COMPRA" ? "Compra" : "Manual");
      const tipoIcono = item.tipo_icono ? `<i class="bi ${item.tipo_icono} me-1"></i>` : "";

      const proveedorHtml = item.proveedor_nombre 
        ? `<div class="small text-muted">${esc(item.proveedor_nombre)}</div>` 
        : "";

      const tr = document.createElement("tr");
      if (anulado) tr.classList.add("table-danger");

      tr.innerHTML = `
        <td class="fw-semibold text-nowrap">${esc(item.recibo || "—")}</td>
        <td class="text-nowrap">${item.fecha || "—"}</td>
        <td>
          <div>${esc(item.descripcion || "—")}</div>
          <div class="mt-1">${estadoBadge}</div>
          ${proveedorHtml}
        </td>
        <td>${archivoHtml}</td>
        <td class="small text-muted">${esc(item.notas || "—")}</td>
        <td>${tipoIcono} ${tipoLabel}</td>
        <td class="text-end text-danger fw-semibold">${money(item.monto)}</td>
        <td class="text-end text-nowrap">
          ${item.tipo === "EGRESO_MANUAL" && !anulado ? `
            <button class="btn btn-sm btn-outline-secondary me-1" data-edit-egreso="${item.id}" title="Editar">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-sm btn-outline-warning" data-anular-egreso="${item.id}" title="Anular">
              <i class="bi bi-slash-circle"></i>
            </button>
          ` : item.tipo === "EGRESO_MANUAL" && anulado ? `
            <span class="text-muted small">—</span>
          ` : `
            <span class="text-muted small">—</span>
          `}
        </td>
      `;

      if (item.tipo === "EGRESO_MANUAL") {
        const editBtn = tr.querySelector("[data-edit-egreso]");
        const anularBtn = tr.querySelector("[data-anular-egreso]");
        if (editBtn) editBtn._data = item;
        if (anularBtn) anularBtn._data = item;
      }

      tbody.appendChild(tr);
    });

    if (totalSpan) totalSpan.innerHTML = money(total);

  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-danger text-center py-3">${e.message || "Error al cargar egresos."}</td></tr>`;
  }
}

function setMsg(id, text, kind = "danger") {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.className   = `small mt-2 text-${kind}`;
}

export function initEgresos(getFiltroParams, onDataChangeCallback) {
  _filtroParams = getFiltroParams;
  _onDataChange = onDataChangeCallback;

  const tbody             = document.getElementById("tbodyEgresos");
  const archivoInput      = document.getElementById("egresoArchivo");
  const archivoActualWrap = document.getElementById("egresoArchivoActual");
  const archivoActualLink = document.getElementById("egresoArchivoLink");
  const modalEl           = document.getElementById("modalEgreso");

  if (!modalEl) return;

  const modalEgreso = new bootstrap.Modal(modalEl);

  function abrirModal(data = null) {
    document.getElementById("egresoId").value          = data?.id ?? "";
    document.getElementById("egresoDescripcion").value = data?.descripcion ?? "";
    document.getElementById("egresoMonto").value       = data?.monto ?? "";
    document.getElementById("egresoNotas").value       = data?.notas ?? "";

    if (archivoInput) archivoInput.value = "";

    if (data?.archivo_url) {
      archivoActualWrap?.classList.remove("d-none");
      if (archivoActualLink) {
        archivoActualLink.href        = data.archivo_url;
        archivoActualLink.textContent = data.archivo_nombre ?? "Ver archivo";
      }
    } else {
      archivoActualWrap?.classList.add("d-none");
    }

    document.getElementById("modalEgresoTitle").textContent =
      data ? "Editar egreso manual" : "Nuevo egreso manual";

    const msgEl = document.getElementById("egresoMsg");
    if (msgEl) { msgEl.textContent = ""; msgEl.className = "small mt-2"; }

    modalEgreso.show();
  }

  tbody?.addEventListener("click", async (e) => {
    const btnEdit   = e.target.closest("[data-edit-egreso]");
    const btnAnular = e.target.closest("[data-anular-egreso]");

    if (btnEdit) {
      abrirModal(btnEdit._data);
      return;
    }

    if (btnAnular) {
      const row = btnAnular._data;
      const ok  = await showConfirm(
        `¿Anular el egreso "${row.descripcion}"?`,
        { title: "Anular egreso", okLabel: "Sí, anular", okVariant: "btn-warning" }
      );
      if (!ok) return;

      try {
        await fetch(`/api/egresos/manuales/${btnAnular.dataset.anularEgreso}/anular`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include"
        });
        showToast("Egreso anulado.", "warning");
        if (_onDataChange) await _onDataChange();
      } catch (e) {
        showToast(e.message || "Error al anular.", "danger");
      }
    }
  });

  document.getElementById("btnNuevoEgreso")?.addEventListener("click", () => abrirModal());

  document.getElementById("btnGuardarEgreso")?.addEventListener("click", async () => {
    const id    = document.getElementById("egresoId").value;
    const desc  = document.getElementById("egresoDescripcion").value.trim();
    const monto = parseFloat(document.getElementById("egresoMonto").value);
    const notas = document.getElementById("egresoNotas").value.trim();
    const file  = archivoInput?.files[0];

    if (!desc)           { setMsg("egresoMsg", "La descripción es obligatoria."); return; }
    if (!monto || monto <= 0) { setMsg("egresoMsg", "Ingresa un monto válido."); return; }

    setMsg("egresoMsg", "Guardando…", "secondary");

    try {
      if (id) {
        if (file) {
          const fd = new FormData();
          fd.append("descripcion", desc);
          fd.append("monto", monto);
          if (notas) fd.append("notas", notas);
          fd.append("archivo", file);
          fd.append("_method", "PUT");
          await fetch(`/api/egresos/manuales/${id}`, {
            method: "POST",
            body: fd,
            credentials: "include"
          });
        } else {
          await fetch(`/api/egresos/manuales/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ descripcion: desc, monto, notas: notas || null }),
            credentials: "include"
          });
        }
        showToast("Egreso actualizado.", "success");
      } else {
        if (file) {
          const fd = new FormData();
          fd.append("descripcion", desc);
          fd.append("monto", monto);
          if (notas) fd.append("notas", notas);
          fd.append("archivo", file);
          await fetch("/api/egresos/manuales", {
            method: "POST",
            body: fd,
            credentials: "include"
          });
        } else {
          await fetch("/api/egresos/manuales", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ descripcion: desc, monto, notas: notas || null }),
            credentials: "include"
          });
        }
        showToast("Egreso registrado.", "success");
      }

      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      modalEgreso.hide();
      if (_onDataChange) await _onDataChange();

    } catch (e) {
      setMsg("egresoMsg", e.message || "Error al guardar.");
    }
  });

  let timer = null;
  document.getElementById("egresosSearch")?.addEventListener("input", () => {
    clearTimeout(timer); timer = setTimeout(_load, 300);
  });
  document.getElementById("egresosTipo")?.addEventListener("change", _load);
  document.getElementById("egresosEstado")?.addEventListener("change", _load);
  document.getElementById("egresosDesde")?.addEventListener("change", _load);
  document.getElementById("egresosHasta")?.addEventListener("change", _load);
  document.getElementById("btnEgresosRefresh")?.addEventListener("click", _load);
}

export function cargarEgresos() { return _load(); }

function filtroParams()    { return {}; }
async function onDataChange() { await cargarEgresos(); }

initEgresos(filtroParams, onDataChange);
cargarEgresos();