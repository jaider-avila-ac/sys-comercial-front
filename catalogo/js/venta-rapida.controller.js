import { buscarItems, registrarVentaRapida, getVentasRapidas } from "./venta-rapida.service.js";

function money(n) {
  return Number(n || 0).toLocaleString("es-CO", { style: "currency", currency: "COP" });
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function setMsg(text, kind = "muted") {
  msg.textContent = text;
  msg.className = `small mb-2 text-${kind}`;
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
const msg            = document.getElementById("msg");

const tbodyHistorial = document.getElementById("tbodyHistorial");
const kpiTotal       = document.getElementById("kpiTotal");
const kpiCount       = document.getElementById("kpiCount");
const btnRefresh     = document.getElementById("btnRefresh");

let itemSeleccionado = null;
let searchTimer      = null;

// ── Autocomplete ──────────────────────────────────────────────
function showDropdown(items) {
  itemDropdown.innerHTML = "";

  if (!items.length) {
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
      <div class="fw-semibold">${it.nombre}</div>
      <div class="d-flex gap-2 align-items-center">
        <span class="ac-meta">${stockTxt}</span>
        <span class="ac-meta">${precioTxt}</span>
      </div>`;

    d.addEventListener("mousedown", e => { e.preventDefault(); selectItem(it); });
    itemDropdown.appendChild(d);
  });

  itemDropdown.style.display = "block";
}

function hideDropdown() { itemDropdown.style.display = "none"; }

function selectItem(it) {
  itemSeleccionado = it;
  itemId.value     = it.id;

  infoNombre.textContent = it.nombre;
  infoTipo.textContent   = it.tipo || "—";

  if (it.controla_inventario) {
    const stock = Number(it.cantidad_actual ?? 0);
    infoStock.innerHTML = stock <= 0
      ? `<span class="text-danger fw-semibold"><i class="bi bi-exclamation-triangle me-1"></i>Sin stock disponible</span>`
      : `<span class="text-success"><i class="bi bi-check-circle me-1"></i>Disponible: <strong>${stock.toLocaleString("es-CO")}</strong></span>`;
  } else {
    infoStock.innerHTML = `<span class="text-muted"><i class="bi bi-infinity me-1"></i>No controla inventario</span>`;
  }

  itemInfo.classList.remove("d-none");
  itemSearch.classList.add("d-none");
  hideDropdown();

  cantidad.disabled      = false;
  valorUnitario.disabled = false;

  valorUnitario.value = it.precio_venta_sugerido ?? "";
  cantidad.value      = "";
  updateTotal();
  cantidad.focus();
}

function clearItem() {
  itemSeleccionado       = null;
  itemId.value           = "";
  itemSearch.value       = "";
  cantidad.value         = "";
  valorUnitario.value    = "";
  cantidad.disabled      = true;
  valorUnitario.disabled = true;
  btnRegistrar.disabled  = true;

  itemInfo.classList.add("d-none");
  itemSearch.classList.remove("d-none");
  updateTotal();
  itemSearch.focus();
}

itemSearch.addEventListener("input", () => {
  itemId.value = "";
  const q = itemSearch.value.trim();
  clearTimeout(searchTimer);
  if (q.length < 1) { hideDropdown(); return; }

  searchTimer = setTimeout(async () => {
    try {
      const res  = await buscarItems({ search: q });
      const data = await res.json();
      showDropdown(data.data || []);
    } catch { hideDropdown(); }
  }, 200);
});

itemSearch.addEventListener("blur",    () => setTimeout(hideDropdown, 160));
itemSearch.addEventListener("keydown", e => { if (e.key === "Escape") clearItem(); });
document.addEventListener("click", e => {
  if (!itemSearch.contains(e.target) && !itemDropdown.contains(e.target)) hideDropdown();
});
btnClearItem.addEventListener("click", clearItem);

// ── Total ─────────────────────────────────────────────────────
function canSubmit() {
  const cant  = parseFloat(cantidad.value) || 0;
  const vUnit = parseFloat(valorUnitario.value) || 0;
  return itemSeleccionado && cant > 0 && vUnit >= 0 && formaPago.value !== "";
}

function updateTotal() {
  const cant  = parseFloat(cantidad.value) || 0;
  const vUnit = parseFloat(valorUnitario.value) || 0;
  const total = cant * vUnit;

  totalDisplay.textContent = money(total);
  totalDetalle.textContent = (cant > 0 && vUnit >= 0)
    ? `${cant} uds. × ${money(vUnit)}`
    : "—";

  btnRegistrar.disabled = !canSubmit();
}

cantidad.addEventListener("input",      updateTotal);
valorUnitario.addEventListener("input", updateTotal);
formaPago.addEventListener("change",    updateTotal);

// ── Registrar ─────────────────────────────────────────────────
btnRegistrar.addEventListener("click", async () => {
  const cant  = parseFloat(cantidad.value);
  const vUnit = parseFloat(valorUnitario.value);

  if (!itemSeleccionado)    { setMsg("Selecciona un item primero.", "danger"); return; }
  if (!cant || cant <= 0)   { setMsg("La cantidad debe ser mayor a 0.", "danger"); return; }
  if (vUnit < 0)            { setMsg("El valor unitario no puede ser negativo.", "danger"); return; }
  if (!formaPago.value)     { setMsg("Selecciona la forma de pago.", "danger"); return; }

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
    const res  = await registrarVentaRapida({
      item_id:        itemSeleccionado.id,
      cantidad:       cant,
      valor_unitario: vUnit,
      forma_pago:     formaPago.value,         // ← .value del select
      referencia:     referencia.value.trim() || null, // ← .value del input
    });

    const data = await res.json();

   if (!res.ok) {
  console.error("Error venta rápida:", data);
  setMsg(data?.error || data?.message || "Error al registrar.", "danger");
  btnRegistrar.disabled = false;
  return;
}

    setMsg(`✓ ${data.numero_recibo} — ${money(data.total)} registrado`, "success");

    clearItem();
    referencia.value = "";
    formaPago.value  = "";
    cargarHistorial();

  } catch {
    setMsg("Error de conexión.", "danger");
    btnRegistrar.disabled = false;
  }
});

// ── Historial ─────────────────────────────────────────────────
async function cargarHistorial() {
  const hoy = todayISO();
  tbodyHistorial.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-3">Cargando…</td></tr>`;

  try {
    const res  = await getVentasRapidas({ desde: hoy, hasta: hoy });
    const data = await res.json();
    const rows = data.data || [];

    if (!rows.length) {
      tbodyHistorial.innerHTML = `
        <tr>
          <td colspan="5" class="text-center text-muted py-4">
            <i class="bi bi-inbox fs-4 d-block mb-1 opacity-50"></i>
            Sin ventas hoy todavía.
          </td>
        </tr>`;
      kpiTotal.textContent = money(0);
      kpiCount.textContent = "0";
      return;
    }

    const totalDia = rows.reduce((acc, r) => acc + Number(r.total_pagado || 0), 0);
    kpiTotal.textContent = money(totalDia);
    kpiCount.textContent = rows.length;

    const badgeFP = {
      EFECTIVO:      "bg-success",
      TRANSFERENCIA: "bg-info text-dark",
      TARJETA:       "bg-primary",
      BILLETERA:     "bg-warning text-dark",
      OTRO:          "bg-secondary",
    };

    tbodyHistorial.innerHTML = rows.map(r => {
      // Parsear descripción: "Venta rápida: Nombre (X uds × $Y)"
      const matchNombre = r.notas?.match(/Venta rápida: (.+?) \(/);
      const matchDet    = r.notas?.match(/\(([0-9.,]+)[^×]*×\s*\$([0-9.,]+)\)/);

      const nombre    = matchNombre ? matchNombre[1] : (r.notas ?? "—");
      const cantTxt   = matchDet ? matchDet[1] : "—";
      const vUnitTxt  = matchDet ? `$${matchDet[2]}` : "—";

      return `
        <tr>
          <td>
            <div class="fw-semibold small">${nombre}</div>
            <div class="text-muted" style="font-size:.72rem">${r.numero_recibo}</div>
          </td>
          <td class="text-end text-muted small">${cantTxt}</td>
          <td class="text-end text-muted small">${vUnitTxt}</td>
          <td class="text-center">
            <span class="badge ${badgeFP[r.forma_pago] || "bg-secondary"}">${r.forma_pago}</span>
          </td>
          <td class="text-end text-success fw-semibold small">${money(r.total_pagado)}</td>
        </tr>`;
    }).join("");

  } catch {
    tbodyHistorial.innerHTML = `<tr><td colspan="5" class="text-danger text-center py-3">Error al cargar.</td></tr>`;
  }
}

btnRefresh.addEventListener("click", cargarHistorial);
cargarHistorial();