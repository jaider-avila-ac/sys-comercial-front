import { getUser } from "../../common/js/auth.js";
import { getItem, createItem, updateItem, deleteItem } from "./items.service.js";
import { apiFetch } from "../../common/js/api.js";

const user = getUser();

// ── refs formulario ───────────────────────────────────────────
const titulo = document.getElementById("titulo");
const form = document.getElementById("form");
const msg = document.getElementById("msg");
const btnEliminar = document.getElementById("btnEliminar");

const tipo = document.getElementById("tipo");
const nombre = document.getElementById("nombre");
const descripcion = document.getElementById("descripcion");
const precio_compra = document.getElementById("precio_compra");
const precio_venta_sugerido = document.getElementById("precio_venta_sugerido");
const controla_inventario = document.getElementById("controla_inventario");
const stock_minimo = document.getElementById("stock_minimo");
const cantidad_inicial = document.getElementById("cantidad_inicial");
const is_activo = document.getElementById("is_activo");
const abono_inicial = document.getElementById("abono_inicial");
const condicion_pago = document.getElementById("condicion_pago");
const archivoInput = document.getElementById("archivo");
const archivoNombre = document.getElementById("archivoNombre");
const avisoCredito = document.getElementById("avisoCredito");
const avisoLibre = document.getElementById("avisoLibre");
const wrapAbonoInicial = document.getElementById("wrapAbonoInicial");
const wrapArchivo = document.getElementById("wrapArchivo");
const seccionPago = document.getElementById("seccionPago");
const costoEstimado = document.getElementById("costoEstimado");
const costoDetalle = document.getElementById("costoDetalle");

// ── refs proveedor ────────────────────────────────────────────
const proveedorSearch = document.getElementById("proveedor_search");
const proveedorId = document.getElementById("proveedor_id");
const proveedorDropdown = document.getElementById("proveedor_dropdown");

const qs = new URLSearchParams(location.search);
const id = qs.get("id");

function lockInput(input, onClear) {
  input.disabled = true;
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
  const btn = input.parentElement.querySelector(".btn-clear-ac");
  if (btn) btn.remove();
}

if (id) {
  const lbl = document.getElementById("labelCantidadInicial");
  if (lbl) lbl.textContent = "Stock actual";
  cantidad_inicial.placeholder = "Cantidad en bodega";
  seccionPago.classList.add("d-none");
}

function setMsg(text, kind = "muted") {
  msg.textContent = text;
  msg.className = `small text-${kind}`;
}

function money(n) {
  return Number(n || 0).toLocaleString("es-CO", { style: "currency", currency: "COP" });
}

function tieneDecimales(valor) {
  if (valor === "" || valor === null || valor === undefined) return false;
  return !Number.isInteger(Number(valor));
}

function validarEnteros() {
  const errores = [];

  if (controla_inventario.value === "1") {
    const smDec = stock_minimo.value !== "" && tieneDecimales(stock_minimo.value);
    const ciDec = cantidad_inicial.value !== "" && tieneDecimales(cantidad_inicial.value);
    const ciLabel = id ? "Stock actual" : "Cantidad inicial";

    stock_minimo.classList.toggle("is-invalid", smDec);
    cantidad_inicial.classList.toggle("is-invalid", ciDec);

    if (smDec) errores.push("Stock mínimo");
    if (ciDec) errores.push(ciLabel);
  }

  if (errores.length) {
    setMsg(`${errores.join(" y ")} debe${errores.length > 1 ? "n" : ""} ser entero${errores.length > 1 ? "s" : ""} (sin decimales).`, "danger");
    return false;
  }

  stock_minimo.classList.remove("is-invalid");
  cantidad_inicial.classList.remove("is-invalid");
  return true;
}

function enableInvFields() {
  const on = controla_inventario.value === "1";
  stock_minimo.disabled = !on;
  cantidad_inicial.disabled = !on;
  if (!on) {
    stock_minimo.value = "";
    cantidad_inicial.value = "";
    stock_minimo.classList.remove("is-invalid");
    cantidad_inicial.classList.remove("is-invalid");
  }
  updateSeccionPago();
}

function updateSeccionPago() {
  if (id) {
    seccionPago.classList.add("d-none");
    return;
  }
  const ctrl = controla_inventario.value === "1";
  const cant = parseFloat(cantidad_inicial.value) || 0;
  const prec = parseFloat(precio_compra.value) || 0;
  const debeMostrar = ctrl && cant > 0 && prec > 0;
  seccionPago.classList.toggle("d-none", !debeMostrar);
  if (debeMostrar) {
    const costo = cant * prec;
    costoEstimado.textContent = money(costo);
    costoDetalle.textContent = `${cant} uds. × ${money(prec)}`;
  }
}

condicion_pago.addEventListener("change", () => {
  const valor = condicion_pago.value;
  const esCredito = valor === "CREDITO";
  const esLibre = valor === "LIBRE";
  
  avisoCredito.classList.toggle("d-none", !esCredito);
  avisoLibre.classList.toggle("d-none", !esLibre);
  wrapAbonoInicial.classList.toggle("d-none", !esCredito);
  wrapArchivo.classList.toggle("d-none", esLibre);
  
  if (!esCredito) abono_inicial.value = "";
  if (esLibre && archivoInput) archivoInput.value = "";
});

archivoInput.addEventListener("change", () => {
  archivoNombre.textContent = archivoInput.files[0]?.name || "Sin archivo";
});

function resetForm() {
  tipo.value = "PRODUCTO";
  nombre.value = "";
  descripcion.value = "";
  precio_compra.value = "";
  precio_venta_sugerido.value = "";
  controla_inventario.value = "0";
  is_activo.value = "1";
  stock_minimo.value = "";
  cantidad_inicial.value = "";
  proveedorSearch.value = "";
  proveedorId.value = "";
  condicion_pago.value = "CONTADO";
  abono_inicial.value = "";
  archivoInput.value = "";
  archivoNombre.textContent = "Sin archivo";
  avisoCredito.classList.add("d-none");
  avisoLibre.classList.add("d-none");
  wrapAbonoInicial.classList.add("d-none");
  wrapArchivo.classList.remove("d-none");
  proveedorSearch.classList.remove("is-invalid");
  stock_minimo.classList.remove("is-invalid");
  cantidad_inicial.classList.remove("is-invalid");
  enableInvFields();
  nombre.focus();
}

stock_minimo.addEventListener("input", () => {
  stock_minimo.classList.toggle("is-invalid", tieneDecimales(stock_minimo.value));
});

cantidad_inicial.addEventListener("input", () => {
  cantidad_inicial.classList.toggle("is-invalid", tieneDecimales(cantidad_inicial.value));
  updateSeccionPago();
});

precio_compra.addEventListener("input", updateSeccionPago);
controla_inventario.addEventListener("change", enableInvFields);

// ── Autocomplete proveedor ────────────────────────────────────
let provTimer = null;

function showDropdown(items) {
  proveedorDropdown.innerHTML = "";
  if (!items.length) {
    const d = document.createElement("div");
    d.className = "ac-item text-muted";
    d.textContent = "Sin resultados.";
    proveedorDropdown.appendChild(d);
  } else {
    items.forEach(p => {
      const d = document.createElement("div");
      d.className = "ac-item";
      d.textContent = p._label;
      d.addEventListener("mousedown", e => { e.preventDefault(); selectProveedor(p); });
      proveedorDropdown.appendChild(d);
    });
  }
  const hr = document.createElement("div");
  hr.className = "ac-divider";
  proveedorDropdown.appendChild(hr);
  const a = document.createElement("a");
  a.className = "ac-link";
  a.href = "../proveedores/proveedor-form.html";
  a.innerHTML = `<i class="bi bi-plus-circle me-1"></i> Crear nuevo proveedor`;
  proveedorDropdown.appendChild(a);
  proveedorDropdown.style.display = "block";
}

function hideDropdown() { proveedorDropdown.style.display = "none"; }

function selectProveedor(p) {
  proveedorId.value = p.id;
  proveedorSearch.value = p._label;
  proveedorSearch.classList.remove("is-invalid");
  hideDropdown();
  lockInput(proveedorSearch, () => {
    proveedorId.value = "";
    unlockInput(proveedorSearch);
    proveedorSearch.value = "";
  });
}

proveedorSearch.addEventListener("input", () => {
  if (proveedorSearch.disabled) return;
  proveedorId.value = "";
  const q = proveedorSearch.value.trim();
  clearTimeout(provTimer);
  if (q.length < 1) { hideDropdown(); return; }
  provTimer = setTimeout(async () => {
    try {
      const res = await apiFetch(`/proveedores?search=${encodeURIComponent(q)}`);
      const data = await res.json();
      const list = (data.data || []).map(p => ({
        ...p,
        _label: `${p.nombre}${p.nit ? " · " + p.nit : ""}${p.ciudad ? " (" + p.ciudad + ")" : ""}`,
      }));
      showDropdown(list);
    } catch { hideDropdown(); }
  }, 200);
});

proveedorSearch.addEventListener("blur", () => {
  setTimeout(() => {
    hideDropdown();
    if (proveedorSearch.value.trim() && !proveedorId.value && !proveedorSearch.disabled)
      proveedorSearch.classList.add("is-invalid");
  }, 160);
});

document.addEventListener("click", e => {
  if (!proveedorSearch.contains(e.target) && !proveedorDropdown.contains(e.target)) hideDropdown();
});

async function load() {
  enableInvFields();
  if (user?.rol === "OPERATIVO") {
    setMsg("No autorizado para gestionar items.", "danger");
    form.querySelectorAll("input,select,textarea,button").forEach(el => el.disabled = true);
    return;
  }
  if (!id) return;
  titulo.textContent = `Editar item #${id}`;
  btnEliminar.classList.remove("d-none");
  setMsg("Cargando…");
  try {
    const data = await getItem(id);
    const it = data.item;
    const inv = data.inventario;
    tipo.value = it.tipo || "PRODUCTO";
    nombre.value = it.nombre || "";
    descripcion.value = it.descripcion || "";
    precio_compra.value = it.precio_compra ?? "";
    precio_venta_sugerido.value = it.precio_venta_sugerido ?? "";
    controla_inventario.value = it.controla_inventario ? "1" : "0";
    is_activo.value = it.is_activo ? "1" : "0";
    if (it.proveedor_id && it.proveedor) {
      proveedorId.value = it.proveedor_id;
      proveedorSearch.value = it.proveedor.nombre;
      lockInput(proveedorSearch, () => {
        proveedorId.value = "";
        unlockInput(proveedorSearch);
        proveedorSearch.value = "";
      });
    }
    enableInvFields();
    if (inv) {
      stock_minimo.value = inv.unidades_minimas != null ? String(Math.round(Number(inv.unidades_minimas))) : "";
      cantidad_inicial.value = inv.unidades_actuales != null ? String(Math.round(Number(inv.unidades_actuales))) : "";
    }
    setMsg("");
  } catch (error) {
    setMsg(error.message || "No se pudo cargar.", "danger");
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (proveedorSearch.value.trim() && !proveedorId.value && !proveedorSearch.disabled) {
    proveedorSearch.classList.add("is-invalid");
    setMsg("Selecciona el proveedor de la lista.", "danger");
    proveedorSearch.focus();
    return;
  }
  proveedorSearch.classList.remove("is-invalid");
  if (!validarEnteros()) return;
  setMsg("Guardando…");
  if (id) {
    const payload = {
      tipo: tipo.value,
      nombre: nombre.value.trim(),
      descripcion: descripcion.value.trim() || null,
      precio_compra: precio_compra.value !== "" ? Number(precio_compra.value) : null,
      precio_venta_sugerido: precio_venta_sugerido.value !== "" ? Number(precio_venta_sugerido.value) : null,
      controla_inventario: controla_inventario.value === "1",
      is_activo: is_activo.value === "1",
      proveedor_id: proveedorId.value ? Number(proveedorId.value) : null,
    };
    if (controla_inventario.value === "1") {
      if (stock_minimo.value !== "") payload.unidades_minimas = Math.round(Number(stock_minimo.value));
      if (cantidad_inicial.value !== "") payload.cantidad_actual = Math.round(Number(cantidad_inicial.value));
    }
    try {
      await updateItem(id, payload);
      setMsg("✓ Guardado.", "success");
    } catch (error) {
      setMsg(error.message || "No se pudo guardar.", "danger");
    }
    return;
  }
  const ctrl = controla_inventario.value === "1";
  const cant = ctrl ? Math.round(Number(cantidad_inicial.value) || 0) : 0;
  const prec = parseFloat(precio_compra.value) || 0;
  const fd = new FormData();
  fd.append("tipo", tipo.value);
  fd.append("nombre", nombre.value.trim());
  fd.append("descripcion", descripcion.value.trim() || "");
  fd.append("controla_inventario", ctrl ? "1" : "0");
  fd.append("is_activo", is_activo.value);
  if (precio_compra.value !== "") fd.append("precio_compra", prec);
  if (precio_venta_sugerido.value !== "") fd.append("precio_venta_sugerido", Number(precio_venta_sugerido.value));
  if (proveedorId.value) fd.append("proveedor_id", proveedorId.value);
  if (ctrl) {
    if (stock_minimo.value !== "") fd.append("unidades_minimas", Math.round(Number(stock_minimo.value)));
    if (cant > 0) fd.append("cantidad_inicial", cant);
    if (cant > 0 && prec > 0) {
      fd.append("condicion_pago", condicion_pago.value);
      if (condicion_pago.value === "CREDITO" && abono_inicial.value !== "")
        fd.append("abono_inicial", Number(abono_inicial.value));
      if (archivoInput.files[0] && condicion_pago.value !== "LIBRE") 
        fd.append("archivo", archivoInput.files[0]);
    }
  }
  try {
    const data = await createItem(fd);
    setMsg("✓ Item guardado.", "success");
    resetForm();
  } catch (error) {
    setMsg(error.message || "Error al guardar.", "danger");
  }
});

btnEliminar.addEventListener("click", async () => {
  if (!id) return;
  if (!confirm("¿Desactivar este item?")) return;
  setMsg("Procesando…");
  try {
    await deleteItem(id);
    setMsg("Item desactivado.", "success");
    setTimeout(() => { location.href = "catalogo.html"; }, 600);
  } catch (error) {
    setMsg(error.message || "Error de conexión.", "danger");
  }
});

load();