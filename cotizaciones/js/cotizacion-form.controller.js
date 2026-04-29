import {
  buscarClientes,
  buscarItems,
  obtenerCotizacion,
  crearCotizacion,
  actualizarCotizacion,
  emitirCotizacion,
  anularCotizacion,
  confirmarVigencia,
  convertirAFactura,
} from "./cotizaciones.service.js";
import { showToast, showConfirm, showPrompt } from "../../common/js/ui.utils.js";

// ── refs DOM ─────────────────────────────────────────────────────────────────
const qs = new URLSearchParams(location.search);
const id = qs.get("id");

const title              = document.getElementById("title");
const msg                = document.getElementById("msg");
const clienteSearch      = document.getElementById("cliente_search");
const clienteId          = document.getElementById("cliente_id");
const clienteDropdown    = document.getElementById("cliente_dropdown");
const fecha              = document.getElementById("fecha");
const fecha_vencimiento  = document.getElementById("fecha_vencimiento");
const notas              = document.getElementById("notas");
const btnAddLinea        = document.getElementById("btnAddLinea");
const tbodyLineas        = document.getElementById("tbodyLineas");
const trVacio            = document.getElementById("trVacio");
const thIvaPct           = document.getElementById("thIvaPct");
const ivaGlobal          = document.getElementById("ivaGlobal");
const wrapIvaGlobal      = document.getElementById("wrapIvaGlobal");
const tSubtotal          = document.getElementById("tSubtotal");
const tDesc              = document.getElementById("tDesc");
const tIva               = document.getElementById("tIva");
const tTotal             = document.getElementById("tTotal");
const btnGuardar         = document.getElementById("btnGuardar");
const btnEmitir          = document.getElementById("btnEmitir");
const btnAnular          = document.getElementById("btnAnular");
const btnConfirmarVig    = document.getElementById("btnConfirmarVigencia");
const btnConvertir       = document.getElementById("btnConvertir");

// ── Helper: bloquear input con botón de cambio ──────────────────────────────
function lockInput(input, onClear) {
  input.disabled = true;
  // Quitar botón anterior si existe
  input.parentElement.querySelector(".btn-clear-ac")?.remove();
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn btn-sm btn-outline-secondary btn-clear-ac mt-1";
  btn.innerHTML = `<i class="bi bi-x-lg"></i> Cambiar`;
  btn.addEventListener("click", () => {
    input.disabled = false;
    input.value = "";
    if (onClear) onClear();
    btn.remove();
    input.focus();
  });
  input.parentElement.appendChild(btn);
}

function unlockInput(input) {
  input.disabled = false;
  input.parentElement.querySelector(".btn-clear-ac")?.remove();
}

// ── modo IVA ─────────────────────────────────────────────────────────────────
function getModoIva() {
  return document.querySelector('input[name="modoIva"]:checked')?.value ?? "global";
}

function applyModoIva() {
  const global = getModoIva() === "global";
  wrapIvaGlobal.style.display = global ? "" : "none";
  thIvaPct.classList.toggle("d-none", global);
  tbodyLineas.querySelectorAll("[data-k='iva_pct_wrap']").forEach(td => {
    td.classList.toggle("d-none", global);
  });
  refreshPreview();
}

document.querySelectorAll('input[name="modoIva"]').forEach(r =>
  r.addEventListener("change", applyModoIva)
);
ivaGlobal.addEventListener("input", refreshPreview);
ivaGlobal.addEventListener("keydown", e => {
  const allowed = ["Backspace","Delete","Tab","ArrowLeft","ArrowRight","."];
  if (allowed.includes(e.key) || /^\d$/.test(e.key)) return;
  e.preventDefault();
});
ivaGlobal.addEventListener("change", () => {
  let v = parseFloat(ivaGlobal.value);
  if (isNaN(v) || v < 0) v = 0;
  if (v > 100) v = 100;
  ivaGlobal.value = v;
  refreshPreview();
});

// ── helpers ───────────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, m =>
    ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[m])
  );
}

function money(n) {
  return Number(n || 0).toLocaleString("es-CO", { style:"currency", currency:"COP" });
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function setMsg(text, kind = "secondary") {
  msg.textContent = text;
  msg.className   = `small mt-2 text-${kind}`;
}

// ── Autocomplete genérico ─────────────────────────────────────────────────────
function buildAcDropdown(wrapper) {
  const ddiv = document.createElement("div");
  ddiv.className = "ac-dropdown";
  wrapper.appendChild(ddiv);
  return ddiv;
}

function showAc(dropdown, items, onSelect, createHref = null) {
  dropdown.innerHTML = "";
  if (!items.length) {
    const d = document.createElement("div");
    d.className = "ac-item text-muted";
    d.textContent = "Sin resultados.";
    dropdown.appendChild(d);
  } else {
    items.forEach(item => {
      const d = document.createElement("div");
      d.className = "ac-item";
      d.textContent = item._label;
      d.addEventListener("mousedown", e => { e.preventDefault(); onSelect(item); });
      dropdown.appendChild(d);
    });
  }
  if (createHref) {
    const hr = document.createElement("div");
    hr.className = "ac-divider";
    dropdown.appendChild(hr);
    const a = document.createElement("a");
    a.className = "ac-link";
    a.href = createHref;
    a.innerHTML = `<i class="bi bi-plus-circle me-1"></i>Crear nuevo`;
    dropdown.appendChild(a);
  }
  dropdown.style.display = "block";
}

function hideAc(dropdown) {
  dropdown.style.display = "none";
}

// ── Autocomplete CLIENTE ──────────────────────────────────────────────────────
let clienteTimer = null;

function selectCliente(c) {
  clienteId.value = c.id;
  clienteSearch.value = c._label;
  clienteSearch.classList.remove("is-invalid");
  hideAc(clienteDropdown);
  lockInput(clienteSearch, () => {
    clienteId.value = "";
    unlockInput(clienteSearch);
    clienteSearch.value = "";
    clienteSearch.focus();
  });
}

clienteSearch.readOnly = false;

clienteSearch.addEventListener("input", () => {
  if (clienteSearch.disabled) return;
  clienteId.value = "";
  const q = clienteSearch.value.trim();
  clearTimeout(clienteTimer);
  if (q.length < 1) { hideAc(clienteDropdown); return; }
  clienteTimer = setTimeout(async () => {
    try {
      const list = (await buscarClientes(q)).map(c => ({
        ...c,
        _label: `${c.nombre_razon_social}${c.num_documento ? " · " + c.num_documento : ""}`,
      }));
      showAc(clienteDropdown, list, selectCliente, "../clientes/cliente-form.html");
    } catch { hideAc(clienteDropdown); }
  }, 150);
});

clienteSearch.addEventListener("blur", () => {
  setTimeout(() => {
    hideAc(clienteDropdown);
    if (clienteSearch.value.trim() && !clienteId.value && !clienteSearch.disabled)
      clienteSearch.classList.add("is-invalid");
  }, 150);
});

document.addEventListener("click", e => {
  if (!clienteSearch.contains(e.target) && !clienteDropdown.contains(e.target))
    hideAc(clienteDropdown);
});

// ── Líneas con autocomplete de items ─────────────────────────────────────────
let activeItemDropdown = null;

function closeAllItemDropdowns() {
  tbodyLineas.querySelectorAll(".ac-dropdown").forEach(d => hideAc(d));
  activeItemDropdown = null;
}

function addLineaRow(data = {}) {
  trVacio?.remove();
  const tr = document.createElement("tr");
  const globalMode = getModoIva() === "global";

  const itemSearchValue = data._item_label || "";
  const itemIdValue = data.item_id ?? "";
  const descripcionManualValue = data.descripcion_manual ?? "";
  const cantidadValue = data.cantidad ?? 1;
  const valorUnitarioValue = data.valor_unitario ?? 0;
  const descuentoValue = data.descuento ?? 0;
  const ivaPctValue = data.iva_pct ?? 0;

  tr.innerHTML = `
    <td class="col-item-search">
      <div class="position-relative">
        <input class="form-control form-control-sm" data-k="item_search"
               placeholder="Buscar producto/servicio…" autocomplete="off"
               value="${escHtml(itemSearchValue)}"/>
        <input type="hidden" data-k="item_id" value="${escHtml(itemIdValue)}"/>
      </div>
      <small data-k="item_sel" style="font-size:.75rem;"></small>
    </td>
    <td>
      <input class="form-control form-control-sm" data-k="descripcion_manual"
             placeholder="Opcional"
             value="${escHtml(descripcionManualValue)}"/>
    </td>
    <td>
      <input class="form-control form-control-sm" data-k="cantidad"
             type="number" step="1" min="1" inputmode="numeric"
             value="${escHtml(cantidadValue)}"/>
    </td>
    <tr>
      <input class="form-control form-control-sm" data-k="valor_unitario"
             type="number" step="0.01" min="0" inputmode="decimal"
             value="${escHtml(valorUnitarioValue)}"/>
    </td>
    <td>
      <input class="form-control form-control-sm" data-k="descuento"
             type="number" step="0.01" min="0" inputmode="decimal"
             value="${escHtml(descuentoValue)}"/>
    </td>
    <td data-k="iva_pct_wrap" ${globalMode ? 'class="d-none"' : ''}>
      <input class="form-control form-control-sm" data-k="iva_pct"
             type="number" step="0.01" min="0" max="100" inputmode="decimal"
             value="${escHtml(ivaPctValue)}"/>
    </td>
    <td class="text-end text-nowrap">
      <span class="small text-secondary" data-k="total_view">—</span>
    </td>
    <td class="text-end">
      <button class="btn btn-sm btn-outline-danger" data-del-row type="button">
        <i class="bi bi-x-lg"></i>
      </button>
    </td>
  `;

  tbodyLineas.appendChild(tr);

  tr.querySelectorAll('input[type="number"]').forEach(inp => {
    inp.addEventListener("keydown", e => {
      const allowed = ["Backspace","Delete","Tab","ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End","."];
      if (allowed.includes(e.key) || /^\d$/.test(e.key)) return;
      if (inp.dataset.k === "cantidad" && e.key === ".") { e.preventDefault(); return; }
      e.preventDefault();
    });
    inp.addEventListener("change", () => {
      let v = parseFloat(inp.value);
      if (isNaN(v) || v < 0) v = 0;
      if (inp.dataset.k === "cantidad") v = Math.max(1, Math.floor(v));
      inp.value = v;
      refreshPreview();
    });
  });

  // Autocomplete item
  const wrapper   = tr.querySelector("[data-k='item_search']").parentElement;
  const searchInp = tr.querySelector("[data-k='item_search']");
  const hiddenInp = tr.querySelector("[data-k='item_id']");
  const ddiv      = buildAcDropdown(wrapper);
  let itemTimer   = null;

  // Si ya tiene item seleccionado (modo edición), bloquear
  if (data.item_id && data._item_label) {
    lockInput(searchInp, () => {
      hiddenInp.value = "";
      unlockInput(searchInp);
      searchInp.value = "";
      refreshPreview();
    });
  }

  searchInp.addEventListener("input", () => {
    if (searchInp.disabled) return;
    hiddenInp.value = "";
    searchInp.classList.remove("is-invalid");
    const q = searchInp.value.trim();
    clearTimeout(itemTimer);
    closeAllItemDropdowns();
    if (q.length < 1) return;
    itemTimer = setTimeout(async () => {
      try {
        const list = (await buscarItems(q)).map(it => ({
          ...it,
          _label: `${it.nombre}${it.unidad ? " [" + it.unidad + "]" : ""} — ${it.tipo}`,
        }));
        showAc(ddiv, list, item => {
          hiddenInp.value = item.id;
          searchInp.value = item.nombre;
          searchInp.classList.remove("is-invalid");
          const valInp = tr.querySelector("[data-k='valor_unitario']");
          if (item.precio_venta_sugerido && (!valInp.value || Number(valInp.value) === 0))
            valInp.value = item.precio_venta_sugerido;
          hideAc(ddiv);
          lockInput(searchInp, () => {
            hiddenInp.value = "";
            unlockInput(searchInp);
            searchInp.value = "";
            refreshPreview();
          });
          refreshPreview();
        }, "../catalogo/item-form.html");
        activeItemDropdown = ddiv;
        ddiv.style.display = "block";
      } catch { hideAc(ddiv); }
    }, 150);
  });

  searchInp.addEventListener("blur", () => setTimeout(() => hideAc(ddiv), 160));
  refreshPreview();
}

document.addEventListener("click", e => {
  if (!tbodyLineas.contains(e.target)) closeAllItemDropdowns();
});

tbodyLineas.addEventListener("input", refreshPreview);
tbodyLineas.addEventListener("click", e => {
  const btn = e.target.closest("[data-del-row]");
  if (!btn) return;
  btn.closest("tr").remove();
  if (!tbodyLineas.querySelector("tr")) {
    const empty = document.createElement("tr");
    empty.id = "trVacio";
    empty.innerHTML = `<td colspan="8" class="text-muted p-3">Sin líneas.</td>`;
    tbodyLineas.appendChild(empty);
  }
  refreshPreview();
});

btnAddLinea.addEventListener("click", () => addLineaRow());

// ── Leer líneas desde UI ──────────────────────────────────────────────────────
function readLineas() {
  const globalMode   = getModoIva() === "global";
  const ivaPctGlobal = Number(ivaGlobal.value || 0);
  return Array.from(tbodyLineas.querySelectorAll("tr:not(#trVacio)")).map(tr => {
    const g = k => tr.querySelector(`[data-k="${k}"]`)?.value ?? "";
    const itemIdVal = g("item_id").trim();
    return {
      item_id:            itemIdVal ? Number(itemIdVal) : null,
      descripcion_manual: g("descripcion_manual").trim() || null,
      cantidad:           Math.max(1, Math.floor(Number(g("cantidad") || 1))),
      valor_unitario:     Math.max(0, Number(g("valor_unitario") || 0)),
      descuento:          Math.max(0, Number(g("descuento") || 0)),
      iva_pct:            globalMode ? ivaPctGlobal : Number(g("iva_pct") || 0),
    };
  });
}

function validateLineas(lineas) {
  if (!lineas.length) return "Agrega al menos una línea.";
  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i];
    if (!l.item_id && !l.descripcion_manual)
      return `La línea #${i+1} debe tener un producto/servicio o descripción.`;
    if (!l.cantidad || l.cantidad < 1)
      return `Cantidad inválida en línea #${i+1} (mínimo 1).`;
    if (l.valor_unitario < 0)
      return `Valor unitario inválido en línea #${i+1}.`;
  }
  return null;
}

// ── Preview totales ───────────────────────────────────────────────────────────
function refreshPreview() {
  const lineas = readLineas();
  let subtotal = 0, desc = 0, iva = 0, total = 0;
  const trs = Array.from(tbodyLineas.querySelectorAll("tr:not(#trVacio)"));
  lineas.forEach((l, i) => {
    const base     = l.cantidad * l.valor_unitario;
    const neta     = Math.max(0, base - l.descuento);
    const ivaVal   = neta * (l.iva_pct / 100);
    const linTotal = neta + ivaVal;
    subtotal += base; desc += l.descuento; iva += ivaVal; total += linTotal;
    const sp = trs[i]?.querySelector("[data-k='total_view']");
    if (sp) sp.textContent = money(linTotal);
  });
  tSubtotal.textContent = money(subtotal);
  tDesc.textContent     = money(desc);
  tIva.textContent      = money(iva);
  tTotal.textContent    = money(total);
}

// ── Cargar si es edición ──────────────────────────────────────────────────────
async function loadIfEdit() {
  applyModoIva();
  if (!id) {
    fecha.value = todayISO();
    const venc = new Date(); venc.setDate(venc.getDate() + 7);
    fecha_vencimiento.value =
      `${venc.getFullYear()}-${String(venc.getMonth()+1).padStart(2,"0")}-${String(venc.getDate()).padStart(2,"0")}`;
    addLineaRow();
    return;
  }

  title.textContent = `Editar Cotización #${id}`;
  setMsg("Cargando…");

  const cot = await obtenerCotizacion(id);

  if (cot.cliente_id) {
    clienteId.value = cot.cliente_id;
    clienteSearch.value = cot.cliente?.nombre_razon_social ?? "";
    lockInput(clienteSearch, () => {
      clienteId.value = "";
      unlockInput(clienteSearch);
      clienteSearch.value = "";
    });
  }

  fecha.value             = (cot.fecha ?? "").substring(0, 10);
  fecha_vencimiento.value = (cot.fecha_vencimiento ?? "").substring(0, 10);
  notas.value             = cot.notas ?? "";

  const lineas  = cot.lineas || [];
  const ivasPct = [...new Set(lineas.map(l => String(l.iva_pct ?? 0)))];
  if (ivasPct.length === 1 && ivasPct[0] !== "0") {
    document.getElementById("modoIvaGlobal").checked = true;
    ivaGlobal.value = ivasPct[0];
  } else if (ivasPct.length > 1) {
    document.getElementById("modoIvaLinea").checked = true;
  }
  applyModoIva();

  tbodyLineas.innerHTML = "";
  if (!lineas.length) {
    addLineaRow();
  } else {
    lineas.forEach(l => {
      let itemLabel = "";
      if (l.item_id && l.item) {
        itemLabel = l.item.nombre;
      } else if (l.descripcion_manual) {
        itemLabel = l.descripcion_manual;
      }
      addLineaRow({
        item_id: l.item_id,
        descripcion_manual: l.descripcion_manual,
        cantidad: l.cantidad,
        valor_unitario: l.valor_unitario,
        descuento: l.descuento,
        iva_pct: l.iva_pct,
        _item_label: itemLabel,
      });
    });
  }

  tSubtotal.textContent = money(cot.subtotal);
  tDesc.textContent     = money(cot.total_descuentos);
  tIva.textContent      = money(cot.total_iva);
  tTotal.textContent    = money(cot.total);
  refreshPreview();
  setMsg("");
}

// ── Guardar ───────────────────────────────────────────────────────────────────
btnGuardar.addEventListener("click", async () => {
  setMsg("");
  if (!clienteId.value) {
    clienteSearch.classList.add("is-invalid");
    setMsg("Selecciona un cliente de la lista.", "danger");
    clienteSearch.focus(); return;
  }
  clienteSearch.classList.remove("is-invalid");

  const lineas = readLineas();
  const err    = validateLineas(lineas);
  if (err)                      { setMsg(err, "danger"); return; }
  if (!fecha.value)             { setMsg("La fecha es obligatoria.", "danger"); return; }
  if (!fecha_vencimiento.value) { setMsg("La fecha de vencimiento es obligatoria.", "danger"); return; }

  const payload = {
    cliente_id:        Number(clienteId.value),
    fecha:             fecha.value,
    fecha_vencimiento: fecha_vencimiento.value,
    notas:             notas.value.trim() || null,
    lineas,
  };

  setMsg("Guardando…");
  try {
    let saved;
    if (!id) {
      saved = await crearCotizacion(payload);
      location.href = `cotizacion-form.html?id=${saved.id}`;
      return;
    } else {
      saved = await actualizarCotizacion(id, payload);
    }
    setMsg("✓ Guardado.", "success");
    tSubtotal.textContent = money(saved.subtotal);
    tDesc.textContent     = money(saved.total_descuentos);
    tIva.textContent      = money(saved.total_iva);
    tTotal.textContent    = money(saved.total);
  } catch (e) {
    setMsg(e.message || "Error al guardar.", "danger");
  }
});

// ── Acciones de estado ────────────────────────────────────────────────────────
btnEmitir.addEventListener("click", async () => {
  if (!id) { showToast("Primero guarda la cotización.", "warning"); return; }
  const ok = await showConfirm(
    "¿Emitir esta cotización?",
    { title: "Emitir cotización", okLabel: "Sí, emitir", okVariant: "btn-success" }
  );
  if (!ok) return;
  try {
    await emitirCotizacion(id);
    showToast("Cotización emitida.", "success");
    setTimeout(() => location.reload(), 1200);
  } catch (e) { showToast(e.message || "No se pudo emitir.", "danger"); }
});

btnAnular.addEventListener("click", async () => {
  if (!id) return;
  const ok = await showConfirm(
    "¿Anular esta cotización? Esta acción no se puede deshacer.",
    { title: "Anular cotización", okLabel: "Sí, anular", okVariant: "btn-danger" }
  );
  if (!ok) return;
  try {
    await anularCotizacion(id);
    showToast("Cotización anulada.", "warning");
    setTimeout(() => location.reload(), 1200);
  } catch (e) { showToast(e.message || "No se pudo anular.", "danger"); }
});

btnConfirmarVig.addEventListener("click", async () => {
  if (!id) return;
  const nueva = await showPrompt("Nueva fecha de vencimiento (YYYY-MM-DD):", {
    title:        "Confirmar vigencia",
    defaultValue: fecha_vencimiento.value || "",
  });
  if (!nueva) return;
  try {
    await confirmarVigencia(id, nueva);
    showToast("Vigencia confirmada.", "success");
    setTimeout(() => location.reload(), 1200);
  } catch (e) { showToast(e.message || "No se pudo confirmar.", "danger"); }
});

btnConvertir.addEventListener("click", async () => {
  if (!id) { showToast("Primero guarda la cotización.", "warning"); return; }
  const ok = await showConfirm("¿Convertir esta cotización a factura?", {
    title: "Convertir a factura", okLabel: "Sí, convertir", okVariant: "btn-primary",
  });
  if (!ok) return;
  try {
    const data = await convertirAFactura(id);
    showToast(data.message || "Cotización convertida a factura.", "success");
    if (data.factura && data.factura.id) {
      setTimeout(() => {
        location.href = `../facturas/factura-view.html?id=${data.factura.id}`;
      }, 1500);
    } else {
      setTimeout(() => location.reload(), 1500);
    }
  } catch (e) { 
    showToast(e.message || "No se pudo convertir.", "danger"); 
  }
});

// ── init ──────────────────────────────────────────────────────────────────────
loadIfEdit().catch(e => setMsg(e.message || "Error al cargar.", "danger"));