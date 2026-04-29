import { apiFetch, csrfCookie } from "../../common/js/api.js";
import { showToast, showConfirm } from "../../common/js/ui.utils.js";

let modalIngreso = null;

function money(n) {
  return Number(n || 0).toLocaleString("es-CO", {
    style: "currency", currency: "COP", minimumFractionDigits: 0
  });
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, m =>
    ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[m])
  );
}

function fmtDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = String(iso).substring(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

async function cargarIngresos() {
  const tbody = document.getElementById("tbodyIngresos");
  const totalSpan = document.getElementById("totalIngresos");
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="7" class="text-muted text-center py-3">Cargando…</td></tr>`;

  try {
    const search = document.getElementById("ingresosSearch")?.value || "";
    const tipo = document.getElementById("ingresoTipo")?.value || "";
    const estado = document.getElementById("ingresosEstado")?.value || "";
    const desde = document.getElementById("ingresosDesde")?.value || "";
    const hasta = document.getElementById("ingresosHasta")?.value || "";

    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (tipo) params.set("tipo", tipo);
    if (estado) params.set("estado", estado);
    if (desde) params.set("desde", desde);
    if (hasta) params.set("hasta", hasta);
    params.set("per_page", "100");

    const res = await apiFetch(`/ingresos/unificados?${params}`);
    const data = await res.json();
    const rows = data.data || [];

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-muted text-center py-4">Sin registros. </td></tr>`;
      if (totalSpan) totalSpan.innerHTML = money(0);
      return;
    }

    let total = 0;
    tbody.innerHTML = "";

    rows.forEach(item => {
      total += item.monto;
      const anulado = item.estado === "ANULADO";
      const estadoBadge = anulado
        ? `<span class="badge bg-danger-subtle text-danger border border-danger-subtle">ANULADO</span>`
        : `<span class="badge bg-success-subtle text-success border border-success-subtle">ACTIVO</span>`;

      const tipoLabel = item.tipo_label || item.tipo;
      const tipoIcono = item.tipo_icono ? `<i class="bi ${item.tipo_icono} me-1"></i>` : "";
      const concepto = item.cliente_nombre || item.notas || "—";

      const tr = document.createElement("tr");
      if (anulado) tr.classList.add("table-danger");

      tr.innerHTML = `
        <td class="fw-semibold text-nowrap">${esc(item.recibo || "—")}</td>
        <td class="text-nowrap">${fmtDate(item.fecha)}</td>
        <td>
          <div>${tipoIcono} ${tipoLabel}</div>
          <div class="mt-1">${estadoBadge}</div>
          <div class="small text-muted">${esc(concepto)}</div>
        </td>
        <td>${esc(item.forma_pago || "—")}</td>
        <td class="text-muted small">${esc(item.referencia || "—")}</td>
        <td class="text-end text-success fw-semibold">${money(item.monto)}</td>
        <td class="text-end text-nowrap">
          ${item.tipo === "INGRESO_MANUAL" && !anulado ? `
            <button class="btn btn-sm btn-outline-secondary me-1" data-edit-ingreso="${item.id}" title="Editar">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-sm btn-outline-warning" data-anular-ingreso="${item.id}" title="Anular">
              <i class="bi bi-slash-circle"></i>
            </button>
          ` : item.tipo === "INGRESO_MANUAL" && anulado ? `
            <span class="text-muted small">—</span>
          ` : `
            <span class="text-muted small">—</span>
          `}
        </td>
      `;

      if (item.tipo === "INGRESO_MANUAL") {
        const editBtn = tr.querySelector("[data-edit-ingreso]");
        const anularBtn = tr.querySelector("[data-anular-ingreso]");
        if (editBtn) editBtn._data = item;
        if (anularBtn) anularBtn._data = item;
      }

      tbody.appendChild(tr);
    });

    if (totalSpan) totalSpan.innerHTML = money(total);

  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-danger text-center py-3">${e.message || "Error al cargar ingresos."} </td></tr>`;
  }
}

function setMsg(id, text, kind = "danger") {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.className   = `small mt-2 text-${kind}`;
}

function initModal() {
  const modalEl = document.getElementById("modalIngresoManual");
  if (!modalEl) return;

  modalIngreso = new bootstrap.Modal(modalEl);

  const archivoInput = document.getElementById("ingresoArchivo");
  const archivoActualWrap = document.getElementById("ingresoArchivoActual");
  const archivoActualLink = document.getElementById("ingresoArchivoLink");

  function abrirModal(data = null) {
    document.getElementById("ingresoManualId").value = data?.id ?? "";
    document.getElementById("ingresoManualDescripcion").value = data?.descripcion ?? "";
    document.getElementById("ingresoManualMonto").value = data?.monto ?? "";
    document.getElementById("ingresoNotas").value = data?.notas ?? "";

    if (archivoInput) archivoInput.value = "";

    if (data?.archivo_url) {
      archivoActualWrap?.classList.remove("d-none");
      if (archivoActualLink) {
        archivoActualLink.href = data.archivo_url;
        archivoActualLink.textContent = data.archivo_nombre ?? "Ver archivo";
      }
    } else {
      archivoActualWrap?.classList.add("d-none");
    }

    document.getElementById("modalIngresoTitle").textContent =
      data ? "Editar ingreso manual" : "Nuevo ingreso manual";

    const msgEl = document.getElementById("ingresoMsg");
    if (msgEl) { msgEl.textContent = ""; msgEl.className = "small mt-2"; }

    modalIngreso.show();
  }

  document.getElementById("btnNuevoIngresoManual")?.addEventListener("click", () => abrirModal());

  document.getElementById("btnGuardarIngresoManual")?.addEventListener("click", async () => {
    const id = document.getElementById("ingresoManualId").value;
    const descripcion = document.getElementById("ingresoManualDescripcion").value.trim();
    const monto = parseFloat(document.getElementById("ingresoManualMonto").value);
    const notas = document.getElementById("ingresoNotas").value.trim();
    const file = archivoInput?.files[0];
    const msgEl = document.getElementById("ingresoMsg");

    if (!descripcion) { setMsg("ingresoMsg", "La descripción es obligatoria."); return; }
    if (!monto || monto <= 0) { setMsg("ingresoMsg", "Ingresa un monto válido."); return; }

    setMsg("ingresoMsg", "Guardando…", "secondary");

    try {
      await csrfCookie();
      
      if (id) {
        if (file) {
          const fd = new FormData();
          fd.append("descripcion", descripcion);
          fd.append("monto", monto);
          if (notas) fd.append("notas", notas);
          fd.append("archivo", file);
          fd.append("_method", "PUT");
          await fetch(`/api/ingresos/manuales/${id}`, {
            method: "POST",
            body: fd,
            credentials: "include"
          });
        } else {
          await fetch(`/api/ingresos/manuales/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ descripcion: descripcion, monto, notas: notas || null }),
            credentials: "include"
          });
        }
        showToast("Ingreso actualizado.", "success");
      } else {
        if (file) {
          const fd = new FormData();
          fd.append("descripcion", descripcion);
          fd.append("monto", monto);
          if (notas) fd.append("notas", notas);
          fd.append("archivo", file);
          await fetch("/api/ingresos/manuales", {
            method: "POST",
            body: fd,
            credentials: "include"
          });
        } else {
          await fetch("/api/ingresos/manuales", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ descripcion: descripcion, monto, notas: notas || null }),
            credentials: "include"
          });
        }
        showToast("Ingreso registrado.", "success");
      }

      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      modalIngreso.hide();
      cargarIngresos();

    } catch (e) {
      setMsg("ingresoMsg", e.message || "Error al guardar.");
    }
  });
}

function initEvents() {
  let timer = null;
  document.getElementById("ingresosSearch")?.addEventListener("input", () => {
    clearTimeout(timer); timer = setTimeout(cargarIngresos, 300);
  });
  document.getElementById("ingresoTipo")?.addEventListener("change", cargarIngresos);
  document.getElementById("ingresosEstado")?.addEventListener("change", cargarIngresos);
  document.getElementById("ingresosDesde")?.addEventListener("change", cargarIngresos);
  document.getElementById("ingresosHasta")?.addEventListener("change", cargarIngresos);
  document.getElementById("btnIngresosRefresh")?.addEventListener("click", cargarIngresos);
}

// Eventos para editar/anular
document.getElementById("tbodyIngresos")?.addEventListener("click", async (e) => {
  const btnEdit = e.target.closest("[data-edit-ingreso]");
  const btnAnular = e.target.closest("[data-anular-ingreso]");

  if (btnEdit) {
    const row = btnEdit._data;
    document.getElementById("ingresoManualId").value = row.id;
    document.getElementById("ingresoManualDescripcion").value = row.descripcion;
    document.getElementById("ingresoManualMonto").value = row.monto;
    document.getElementById("ingresoNotas").value = row.notas || "";
    if (row.archivo_url) {
      const wrap = document.getElementById("ingresoArchivoActual");
      const link = document.getElementById("ingresoArchivoLink");
      if (wrap && link) {
        wrap.classList.remove("d-none");
        link.href = row.archivo_url;
        link.textContent = row.archivo_nombre ?? "Ver archivo";
      }
    }
    document.getElementById("modalIngresoTitle").textContent = "Editar ingreso manual";
    modalIngreso.show();
    return;
  }

  if (btnAnular) {
    const row = btnAnular._data;
    const ok = await showConfirm(
      `¿Anular el ingreso "${row.descripcion}"?`,
      { title: "Anular ingreso", okLabel: "Sí, anular", okVariant: "btn-warning" }
    );
    if (!ok) return;

    try {
      await fetch(`/api/ingresos/manuales/${btnAnular.dataset.anularIngreso}/anular`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include"
      });
      showToast("Ingreso anulado.", "warning");
      cargarIngresos();
    } catch (e) {
      showToast(e.message || "Error al anular.", "danger");
    }
  }
});

initModal();
initEvents();
cargarIngresos();