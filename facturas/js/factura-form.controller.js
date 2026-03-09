import {
  buscarClientes, buscarItems,
  obtenerFactura, crearFactura, actualizarFactura,
  emitirFactura, anularFactura,
} from "./facturas.service.js";
import { showToast, showConfirm } from "../../common/js/ui.utils.js";

const qs = new URLSearchParams(location.search);
const id = qs.get("id");

// ── refs ──────────────────────────────────────────────────────
const title           = document.getElementById("title");
const msg             = document.getElementById("msg");
const clienteSearch   = document.getElementById("cliente_search");
const clienteId       = document.getElementById("cliente_id");
const clienteDropdown = document.getElementById("cliente_dropdown");
const fecha           = document.getElementById("fecha");
const cotizacionRef   = document.getElementById("cotizacion_ref");
const cotizacionIdInp = document.getElementById("cotizacion_id");
const notas           = document.getElementById("notas");
const btnAddLinea     = document.getElementById("btnAddLinea");
const tbodyLineas     = document.getElementById("tbodyLineas");
const thIvaPct        = document.getElementById("thIvaPct");
const ivaGlobal       = document.getElementById("ivaGlobal");
const wrapIvaGlobal   = document.getElementById("wrapIvaGlobal");
const tSubtotal       = document.getElementById("tSubtotal");
const tDesc           = document.getElementById("tDesc");
const tIva            = document.getElementById("tIva");
const tTotal          = document.getElementById("tTotal");
const btnGuardar      = document.getElementById("btnGuardar");
const btnEmitir       = document.getElementById("btnEmitir");
const btnAnular       = document.getElementById("btnAnular");

// ── helpers ───────────────────────────────────────────────────
function escHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, m =>
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

// ── Modo IVA ──────────────────────────────────────────────────
function getModoIva() {
  return document.querySelector('input[name="modoIva"]:checked')?.value ?? "global";
}
function applyModoIva() {
  const global = getModoIva() === "global";
  wrapIvaGlobal.style.display = global ? "" : "none";
  thIvaPct.classList.toggle("d-none", global);
  tbodyLineas.querySelectorAll("[data-k='iva_pct_wrap']").forEach(td =>
    td.classList.toggle("d-none", global)
  );
  refreshPreview();
}
document.querySelectorAll('input[name="modoIva"]').forEach(r => r.addEventListener("change", applyModoIva));
ivaGlobal.addEventListener("input", refreshPreview);
ivaGlobal.addEventListener("change", () => {
  let v = parseFloat(ivaGlobal.value);
  if (isNaN(v) || v < 0) v = 0;
  if (v > 100) v = 100;
  ivaGlobal.value = v;
  refreshPreview();
});

// ── Autocomplete genérico ─────────────────────────────────────
function buildDropdown(wrapper) {
  const d = document.createElement("div");
  d.className = "ac-dropdown";
  wrapper.appendChild(d);
  return d;
}
function showAc(dropdown, items, onSelect, createHref = null) {
  dropdown.innerHTML = "";
  if (!items.length) {
    const d = document.createElement("div");
    d.className = "ac-item text-muted"; d.textContent = "Sin resultados.";
    dropdown.appendChild(d);
  } else {
    items.forEach(item => {
      const d = document.createElement("div");
      d.className = "ac-item"; d.textContent = item._label;
      d.addEventListener("mousedown", e => { e.preventDefault(); onSelect(item); });
      dropdown.appendChild(d);
    });
  }
  if (createHref) {
    const hr = document.createElement("div"); hr.className = "ac-divider"; dropdown.appendChild(hr);
    const a  = document.createElement("a");   a.className  = "ac-link";    a.href = createHref;
    a.innerHTML = `<i class="bi bi-plus-circle me-1"></i>Crear nuevo`; dropdown.appendChild(a);
  }
  dropdown.style.display = "block";
}
function hideAc(dropdown) { dropdown.style.display = "none"; }

// ── Autocomplete CLIENTE ──────────────────────────────────────
let clienteTimer = null;

function selectCliente(c) {
  clienteId.value     = c.id;
  clienteSearch.value = c._label;
  clienteSearch.classList.remove("is-invalid");
  hideAc(clienteDropdown);
}

clienteSearch.addEventListener("input", () => {
  clienteId.value = "";
  const q = clienteSearch.value.trim();
  clearTimeout(clienteTimer);
  if (q.length < 1) { hideAc(clienteDropdown); return; }
  clienteTimer = setTimeout(async () => {
    try {
      const list = (await buscarClientes(q)).map(c => ({
        ...c, _label: `${c.nombre_razon_social}${c.num_documento ? " · " + c.num_documento : ""}`,
      }));
      showAc(clienteDropdown, list, selectCliente, "../clientes/cliente-form.html");
    } catch { hideAc(clienteDropdown); }
  }, 150);
});
clienteSearch.addEventListener("blur", () => {
  setTimeout(() => {
    hideAc(clienteDropdown);
    if (clienteSearch.value.trim() && !clienteId.value)
      clienteSearch.classList.add("is-invalid");
  }, 150);
});
document.addEventListener("click", e => {
  if (!clienteSearch.contains(e.target) && !clienteDropdown.contains(e.target))
    hideAc(clienteDropdown);
});

// ── Líneas ────────────────────────────────────────────────────
let activeItemDropdown = null;

function closeAllItemDropdowns() {
  tbodyLineas.querySelectorAll(".ac-dropdown").forEach(d => hideAc(d));
  activeItemDropdown = null;
}

function addLineaRow(data = {}) {
  document.getElementById("trVacio")?.remove();
  const tr = document.createElement("tr");
  const globalMode = getModoIva() === "global";

  tr.innerHTML = `
    <td class="col-item-search">
      <div class="position-relative">
        <input class="form-control form-control-sm" data-k="item_search"
               placeholder="Buscar producto/servicio…" autocomplete="off"
               value="${escHtml(data._item_label ?? "")}"/>
        <input type="hidden" data-k="item_id" value="${escHtml(data.item_id ?? "")}"/>
      </div>
    </td>
    <td>
      <input class="form-control form-control-sm" data-k="descripcion_manual"
             placeholder="Opcional" value="${escHtml(data.descripcion_manual ?? "")}"/>
    </td>
    <td>
      <input class="form-control form-control-sm" data-k="cantidad"
             type="number" step="1" min="1" inputmode="numeric"
             value="${escHtml(data.cantidad ?? 1)}"/>
    </td>
    <td>
      <input class="form-control form-control-sm" data-k="valor_unitario"
             type="number" step="0.01" min="0" inputmode="decimal"
             value="${escHtml(data.valor_unitario ?? 0)}"/>
    </td>
    <td>
      <input class="form-control form-control-sm" data-k="descuento"
             type="number" step="0.01" min="0" inputmode="decimal"
             value="${escHtml(data.descuento ?? 0)}"/>
    </td>
    <td data-k="iva_pct_wrap" ${globalMode ? 'class="d-none"' : ''}>
      <input class="form-control form-control-sm" data-k="iva_pct"
             type="number" step="0.01" min="0" max="100" inputmode="decimal"
             value="${escHtml(data.iva_pct ?? 0)}"/>
    </td>
    <td class="text-end text-nowrap">
      <span class="small text-secondary" data-k="total_view">—</span>
    </td>
    <td class="text-end">
      <button class="btn btn-sm btn-outline-danger" data-del-row type="button">
        <i class="bi bi-x-lg"></i>
      </button>
    </td>`;

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
    });
  });

  const wrapper   = tr.querySelector("[data-k='item_search']").parentElement;
  const searchInp = tr.querySelector("[data-k='item_search']");
  const hiddenInp = tr.querySelector("[data-k='item_id']");
  const ddiv      = buildDropdown(wrapper);
  let itemTimer   = null;

  searchInp.addEventListener("input", () => {
    // Al escribir manualmente se limpia el id seleccionado
    hiddenInp.value = "";
    searchInp.classList.remove("is-invalid");
    const q = searchInp.value.trim();
    clearTimeout(itemTimer);
    closeAllItemDropdowns();
    if (q.length < 1) return;
    itemTimer = setTimeout(async () => {
      try {
        const list = (await buscarItems(q)).map(it => ({
          ...it, _label: `${it.nombre}${it.unidad ? " ["+it.unidad+"]" : ""} — ${it.tipo}`,
        }));
        showAc(ddiv, list, item => {
          hiddenInp.value = item.id;
          searchInp.value = item.nombre;
          searchInp.classList.remove("is-invalid");
          const valInp = tr.querySelector("[data-k='valor_unitario']");
          if (item.precio_venta_sugerido && (!valInp.value || Number(valInp.value) === 0))
            valInp.value = item.precio_venta_sugerido;
          hideAc(ddiv);
          refreshPreview();
        }, "../catalogo/item-form.html");
        activeItemDropdown = ddiv;
        ddiv.style.display = "block";
      } catch { hideAc(ddiv); }
    }, 150);
  });

  // Al salir del campo: si hay texto pero no hay id, marcar inválido
  searchInp.addEventListener("blur", () => {
    setTimeout(() => {
      hideAc(ddiv);
      if (searchInp.value.trim() && !hiddenInp.value)
        searchInp.classList.add("is-invalid");
    }, 160);
  });

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

// ── Leer líneas ───────────────────────────────────────────────
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

  const trs = Array.from(tbodyLineas.querySelectorAll("tr:not(#trVacio)"));

  for (let i = 0; i < lineas.length; i++) {
    const l          = lineas[i];
    const tr         = trs[i];
    const searchInp  = tr?.querySelector("[data-k='item_search']");
    const hayTexto   = searchInp?.value?.trim();
    const hayId      = !!l.item_id;

    // Escribió algo en el buscador pero no seleccionó del catálogo
    if (hayTexto && !hayId) {
      searchInp.classList.add("is-invalid");
      return `Línea #${i+1}: selecciona el producto de la lista del catálogo.`;
    }

    // Sin item de catálogo y sin descripción manual
    if (!l.item_id && !l.descripcion_manual) {
      return `Línea #${i+1}: selecciona un producto del catálogo o escribe una descripción manual.`;
    }

    if (l.cantidad < 1) return `Cantidad inválida en línea #${i+1}.`;
  }
  return null;
}

function refreshPreview() {
  const lineas = readLineas();
  let subtotal = 0, desc = 0, iva = 0, total = 0;
  const trs = Array.from(tbodyLineas.querySelectorAll("tr:not(#trVacio)"));
  lineas.forEach((l, i) => {
    const base = l.cantidad * l.valor_unitario;
    const neta = Math.max(0, base - l.descuento);
    const ivaV = neta * (l.iva_pct / 100);
    const tot  = neta + ivaV;
    subtotal += base; desc += l.descuento; iva += ivaV; total += tot;
    const sp = trs[i]?.querySelector("[data-k='total_view']");
    if (sp) sp.textContent = money(tot);
  });
  tSubtotal.textContent = money(subtotal);
  tDesc.textContent     = money(desc);
  tIva.textContent      = money(iva);
  tTotal.textContent    = money(total);
}

// ── Cargar si es edición ──────────────────────────────────────
async function loadIfEdit() {
  applyModoIva();
  if (!id) { fecha.value = todayISO(); addLineaRow(); return; }

  title.textContent = `Editar Factura #${id}`;
  setMsg("Cargando…");

  const fac = await obtenerFactura(id);

  if (fac.cliente_id) {
    clienteId.value     = fac.cliente_id;
    clienteSearch.value = fac.cliente?.nombre_razon_social ?? "";
  }
  fecha.value = (fac.fecha ?? "").substring(0, 10);
  if (fac.cotizacion_id) {
    cotizacionRef.value   = fac.cotizacion?.numero ?? `#${fac.cotizacion_id}`;
    cotizacionIdInp.value = fac.cotizacion_id;
  }
  notas.value = fac.notas ?? "";

  const lineas  = fac.lineas || [];
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
    lineas.forEach(l => addLineaRow({
  ...l,
  _item_label: l.item?.nombre || l.nombre || l.descripcion_manual || "",
}));
  }

  tSubtotal.textContent = money(fac.subtotal);
  tDesc.textContent     = money(fac.total_descuentos);
  tIva.textContent      = money(fac.total_iva);
  tTotal.textContent    = money(fac.total);
  refreshPreview();
  setMsg("");
}

// ── Guardar ───────────────────────────────────────────────────
btnGuardar.addEventListener("click", async () => {
  setMsg("");
  if (!clienteId.value) {
    clienteSearch.classList.add("is-invalid");
    setMsg("Selecciona un cliente de la lista.", "danger");
    clienteSearch.focus(); return;
  }
  clienteSearch.classList.remove("is-invalid");

  const lineas = readLineas();
  const err = validateLineas(lineas);
  if (err) { setMsg(err, "danger"); return; }
  if (!fecha.value) { setMsg("La fecha es obligatoria.", "danger"); return; }

  const payload = {
    cliente_id:    Number(clienteId.value),
    cotizacion_id: cotizacionIdInp.value ? Number(cotizacionIdInp.value) : null,
    fecha:         fecha.value,
    notas:         notas.value.trim() || null,
    lineas,
  };

  setMsg("Guardando…");
  try {
    let saved;
    if (!id) {
      saved = await crearFactura(payload);
      location.href = `factura-form.html?id=${saved.id}`;
      return;
    } else {
      saved = await actualizarFactura(id, payload);
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

// ── Emitir ────────────────────────────────────────────────────
btnEmitir.addEventListener("click", async () => {
  if (!id) { showToast("Primero guarda la factura.", "warning"); return; }
  const ok = await showConfirm(
    "¿Emitir factura? <span class='text-muted small'>Se descontará el inventario de productos.</span>",
    { title: "Emitir factura", okLabel: "Sí, emitir", okVariant: "btn-success" }
  );
  if (!ok) return;
  try {
    await emitirFactura(id);
    showToast("Factura emitida correctamente.", "success");
    setTimeout(() => location.reload(), 1200);
  } catch (e) {
    showToast(e.message || "No se pudo emitir.", "danger");
  }
});

// ── Anular ────────────────────────────────────────────────────
btnAnular.addEventListener("click", async () => {
  if (!id) return;
  const ok = await showConfirm(
    "¿Anular esta factura? Esta acción no se puede deshacer.",
    { title: "Anular factura", okLabel: "Sí, anular", okVariant: "btn-danger" }
  );
  if (!ok) return;
  try {
    await anularFactura(id);
    showToast("Factura anulada.", "warning");
    setTimeout(() => location.reload(), 1200);
  } catch (e) {
    showToast(e.message || "No se pudo anular.", "danger");
  }
});

loadIfEdit().catch(e => setMsg(e.message || "Error al cargar.", "danger"));