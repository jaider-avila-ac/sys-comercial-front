import { buscarItems, registrarVentaRapida, getVentasRapidas } from "./venta-rapida.service.js";

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, m =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m])
  );
}

function money(n) {
  return Number(n || 0).toLocaleString("es-CO", { style: "currency", currency: "COP" });
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function setMsg(text, kind = "muted") {
  const msgEl = document.getElementById("msg");
  if (msgEl) {
    msgEl.textContent = text;
    msgEl.className = `small mb-2 text-${kind}`;
  }
}

// ── refs ──────────────────────────────────────────────────────
const itemSearch   = document.getElementById("itemSearch");
const itemId       = document.getElementById("itemId");
const itemDropdown = document.getElementById("itemDropdown");
const itemInfo     = document.getElementById("itemInfo");
const infoNombre   = document.getElementById("infoNombre");
const infoTipo     = document.getElementById("infoTipo");
const infoStock    = document.getElementById("infoStock");
const btnClearItem = document.getElementById("btnClearItem");

const cantidad       = document.getElementById("cantidad");
const valorUnitario  = document.getElementById("valorUnitario");
const formaPago      = document.getElementById("formaPago");
const referencia     = document.getElementById("referencia");
const totalDisplay   = document.getElementById("totalDisplay");
const totalDetalle   = document.getElementById("totalDetalle");
const btnRegistrar   = document.getElementById("btnRegistrar");

const tbodyHistorial = document.getElementById("tbodyHistorial");
const kpiTotal       = document.getElementById("kpiTotal");
const kpiCount       = document.getElementById("kpiCount");
const btnRefresh     = document.getElementById("btnRefresh");
const fechaSelector  = document.getElementById("fechaSelector");

let itemSeleccionado = null;
let searchTimer      = null;

// ── Autocomplete ──────────────────────────────────────────────
function showDropdown(items) {
  if (!itemDropdown) return;
  itemDropdown.innerHTML = "";

  if (!items || !items.length) {
    const d = document.createElement("div");
    d.className = "ac-item text-muted";
    d.textContent = "Sin resultados.";
    itemDropdown.appendChild(d);
    itemDropdown.style.display = "block";
    return;
  }

  items.forEach(it => {
    const d = document.createElement("div");
    d.className = "ac-item";

    const stockTxt = it.controla_inventario
      ? `Stock: ${Number(it.cantidad_actual ?? 0).toLocaleString("es-CO")}`
      : "Sin control de stock";

    const precioTxt = it.precio_venta_sugerido
      ? `· ${money(it.precio_venta_sugerido)}`
      : "";

    d.innerHTML = `
      <div class="fw-semibold">${esc(it.nombre)}</div>
      <div class="d-flex gap-2 align-items-center">
        <span class="ac-meta">${stockTxt}</span>
        <span class="ac-meta">${precioTxt}</span>
      </div>`;

    d.addEventListener("mousedown", (e) => { 
      e.preventDefault(); 
      selectItem(it); 
    });
    itemDropdown.appendChild(d);
  });

  itemDropdown.style.display = "block";
}

function hideDropdown() { 
  if (itemDropdown) itemDropdown.style.display = "none"; 
}

function selectItem(it) {
  itemSeleccionado = it;
  if (itemId) itemId.value = it.id;
  if (infoNombre) infoNombre.textContent = it.nombre;
  if (infoTipo) infoTipo.textContent = it.tipo || "—";

  if (it.controla_inventario) {
    const stock = Number(it.cantidad_actual ?? 0);
    if (infoStock) {
      infoStock.innerHTML = stock <= 0
        ? `<span class="text-danger fw-semibold"><i class="bi bi-exclamation-triangle me-1"></i>Sin stock disponible</span>`
        : `<span class="text-success"><i class="bi bi-check-circle me-1"></i>Disponible: <strong>${stock.toLocaleString("es-CO")}</strong></span>`;
    }
  } else {
    if (infoStock) infoStock.innerHTML = `<span class="text-muted"><i class="bi bi-infinity me-1"></i>No controla inventario</span>`;
  }

  if (itemInfo) itemInfo.classList.remove("d-none");
  if (itemSearch) {
    itemSearch.value = it.nombre;
    itemSearch.disabled = false;
    itemSearch.classList.remove("d-none");
  }
  hideDropdown();

  if (cantidad) {
    cantidad.disabled = false;
    cantidad.value = "";
    cantidad.focus();
  }
  if (valorUnitario) {
    valorUnitario.disabled = false;
    valorUnitario.value = it.precio_venta_sugerido ?? "";
  }
  
  updateTotal();
}

function clearItem() {
  itemSeleccionado = null;
  if (itemId) itemId.value = "";
  if (itemSearch) {
    itemSearch.value = "";
    itemSearch.disabled = false;
    itemSearch.classList.remove("d-none");
    itemSearch.focus();
  }
  if (cantidad) {
    cantidad.value = "";
    cantidad.disabled = true;
  }
  if (valorUnitario) {
    valorUnitario.value = "";
    valorUnitario.disabled = true;
  }
  if (btnRegistrar) btnRegistrar.disabled = true;
  if (itemInfo) itemInfo.classList.add("d-none");
  
  updateTotal();
}

// Eventos del buscador
if (itemSearch) {
  itemSearch.addEventListener("input", () => {
    if (itemId) itemId.value = "";
    const q = itemSearch.value.trim();
    clearTimeout(searchTimer);
    if (q.length < 2) { 
      hideDropdown(); 
      return; 
    }

    searchTimer = setTimeout(async () => {
      try {
        const items = await buscarItems({ search: q });
        showDropdown(items);
      } catch (e) {
        console.error("Error buscando items:", e);
        hideDropdown();
      }
    }, 300);
  });

  itemSearch.addEventListener("blur", () => setTimeout(hideDropdown, 200));
  itemSearch.addEventListener("keydown", e => { if (e.key === "Escape") clearItem(); });
}

if (btnClearItem) btnClearItem.addEventListener("click", clearItem);

// Cerrar dropdown al hacer clic fuera
document.addEventListener("click", e => {
  if (itemSearch && itemDropdown && !itemSearch.contains(e.target) && !itemDropdown.contains(e.target)) {
    hideDropdown();
  }
});

// ── Total ─────────────────────────────────────────────────────
function canSubmit() {
  const cant = parseFloat(cantidad?.value) || 0;
  const vUnit = parseFloat(valorUnitario?.value) || 0;
  return itemSeleccionado && cant > 0 && vUnit >= 0 && formaPago?.value !== "";
}

function updateTotal() {
  const cant = parseFloat(cantidad?.value) || 0;
  const vUnit = parseFloat(valorUnitario?.value) || 0;
  const total = cant * vUnit;

  if (totalDisplay) totalDisplay.textContent = money(total);
  if (totalDetalle) {
    totalDetalle.textContent = (cant > 0 && vUnit >= 0)
      ? `${cant} uds. × ${money(vUnit)}`
      : "—";
  }
  if (btnRegistrar) btnRegistrar.disabled = !canSubmit();
}

if (cantidad) cantidad.addEventListener("input", updateTotal);
if (valorUnitario) valorUnitario.addEventListener("input", updateTotal);
if (formaPago) formaPago.addEventListener("change", updateTotal);

// ── Registrar ─────────────────────────────────────────────────
if (btnRegistrar) {
  btnRegistrar.addEventListener("click", async () => {
    const cant = parseFloat(cantidad?.value) || 0;
    const vUnit = parseFloat(valorUnitario?.value) || 0;

    if (!itemSeleccionado) { setMsg("Selecciona un item primero.", "danger"); return; }
    if (!cant || cant <= 0) { setMsg("La cantidad debe ser mayor a 0.", "danger"); return; }
    if (vUnit < 0) { setMsg("El valor unitario no puede ser negativo.", "danger"); return; }
    if (!formaPago?.value) { setMsg("Selecciona la forma de pago.", "danger"); return; }

    if (itemSeleccionado.controla_inventario) {
      const disponible = Number(itemSeleccionado.cantidad_actual ?? 0);
      if (cant > disponible) {
        setMsg(`Stock insuficiente. Disponible: ${disponible.toLocaleString("es-CO")}`, "danger");
        return;
      }
    }

    setMsg("Registrando…", "muted");
    btnRegistrar.disabled = true;

    try {
      const res = await registrarVentaRapida({
        item_id: itemSeleccionado.id,
        cantidad: cant,
        valor_unitario: vUnit,
        forma_pago: formaPago.value,
        referencia: referencia?.value.trim() || null,
      });

      const data = await res.json();

      if (!res.ok) {
        console.error("Error venta rápida:", data);
        setMsg(data?.message || data?.error || "Error al registrar.", "danger");
        btnRegistrar.disabled = false;
        return;
      }

      setMsg(`✓ ${data.numero} — ${money(data.monto)} registrado`, "success");
      clearItem();
      if (referencia) referencia.value = "";
      if (formaPago) formaPago.value = "";
      cargarHistorial();

    } catch (e) {
      console.error("Error:", e);
      setMsg("Error de conexión.", "danger");
      btnRegistrar.disabled = false;
    }
  });
}

// ── Cargar historial por fecha específica ──
async function cargarHistorialPorFecha(fecha) {
  if (!tbodyHistorial) return;
  
  tbodyHistorial.innerHTML = `<td><td colspan="5" class="text-center text-muted py-3">Cargando...</td></td>`;

  try {
    const rows = await getVentasRapidas({ desde: fecha, hasta: fecha });

    if (!rows || !rows.length) {
      tbodyHistorial.innerHTML = `
        <tr>
          <td colspan="5" class="text-center text-muted py-4">
            <i class="bi bi-inbox fs-4 d-block mb-1 opacity-50"></i>
            No hay ventas el día ${fecha}
          </td>
        </tr>`;
      if (kpiTotal) kpiTotal.textContent = money(0);
      if (kpiCount) kpiCount.textContent = "0";
      return;
    }

    const totalDia = rows.reduce((acc, r) => acc + Number(r.total_pagado || 0), 0);
    if (kpiTotal) kpiTotal.textContent = money(totalDia);
    if (kpiCount) kpiCount.textContent = rows.length;

    const badgeFP = {
      EFECTIVO: "bg-success",
      TRANSFERENCIA: "bg-info text-dark",
      TARJETA: "bg-primary",
      BILLETERA: "bg-warning text-dark",
      OTRO: "bg-secondary",
    };

    tbodyHistorial.innerHTML = rows.map(r => {
      const nombre = r.item_nombre || (r.notas?.substring(0, 30) || "—");
      const cantTxt = r.cantidad || "—";
      const vUnitTxt = r.valor_unitario ? money(r.valor_unitario) : "—";

      return `
        <tr>
          <td>
            <div class="fw-semibold small">${esc(nombre)}</div>
            <div class="text-muted" style="font-size:.72rem">${r.numero_recibo}</div>
          </td>
          <td class="text-end text-muted small">${cantTxt}</td>
          <td class="text-end text-muted small">${vUnitTxt}</td>
          <td class="text-center">
            <span class="badge ${badgeFP[r.forma_pago] || "bg-secondary"}">${r.forma_pago || "—"}</span>
          </td>
          <td class="text-end text-success fw-semibold small">${money(r.total_pagado)}</td>
        </tr>`;
    }).join("");

  } catch (e) {
    console.error("Error cargando historial:", e);
    tbodyHistorial.innerHTML = `<td><td colspan="5" class="text-danger text-center py-3">Error al cargar.</td></tr>`;
  }
}

// ── Historial (wrapper que usa la fecha seleccionada) ──
async function cargarHistorial() {
  const fecha = fechaSelector ? fechaSelector.value : todayISO();
  await cargarHistorialPorFecha(fecha);
}

// ── Eventos ──
if (fechaSelector) {
  fechaSelector.value = todayISO();
  fechaSelector.addEventListener("change", () => cargarHistorial());
}

if (btnRefresh) btnRefresh.addEventListener("click", () => cargarHistorial());

// ── Inicializar ──
cargarHistorial();