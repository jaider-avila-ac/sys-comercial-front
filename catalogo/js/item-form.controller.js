import { getUser } from "../../common/js/auth.js";
import { getItem, createItem, updateItem, deleteItem } from "./items.service.js";

const user = getUser();

const titulo              = document.getElementById("titulo");
const form                = document.getElementById("form");
const msg                 = document.getElementById("msg");
const btnEliminar         = document.getElementById("btnEliminar");

const tipo                  = document.getElementById("tipo");
const nombre                = document.getElementById("nombre");
const descripcion           = document.getElementById("descripcion");
const precio_compra         = document.getElementById("precio_compra");
const precio_venta_sugerido = document.getElementById("precio_venta_sugerido");
const unidad                = document.getElementById("unidad");
const controla_inventario   = document.getElementById("controla_inventario");
const stock_minimo          = document.getElementById("stock_minimo");
const cantidad_inicial      = document.getElementById("cantidad_inicial");
const is_activo             = document.getElementById("is_activo");

const qs = new URLSearchParams(location.search);
const id = qs.get("id");

// ── Forzar campos de stock como enteros en el HTML ──────────────────────────
stock_minimo.setAttribute("step", "1");
stock_minimo.setAttribute("min", "0");
cantidad_inicial.setAttribute("step", "1");
cantidad_inicial.setAttribute("min", "0");

// En modo edición renombrar etiqueta cantidad_inicial → "Stock actual"
if (id) {
  const labelCol = cantidad_inicial.closest(".col-12");
  const lbl = labelCol?.querySelector("label");
  if (lbl) lbl.textContent = "Stock actual";
  cantidad_inicial.placeholder = "Cantidad en bodega";
}

// ── helpers ──────────────────────────────────────────────────────────────────
function setMsg(text, kind = "muted") {
  msg.textContent = text;
  msg.className   = `small text-${kind}`;
}

function tieneDecimales(valor) {
  if (valor === "" || valor === null || valor === undefined) return false;
  return !Number.isInteger(Number(valor));
}

function validarEnteros() {
  const errores = [];

  if (controla_inventario.value === "1") {
    const smDec  = stock_minimo.value    !== "" && tieneDecimales(stock_minimo.value);
    const ciDec  = cantidad_inicial.value !== "" && tieneDecimales(cantidad_inicial.value);
    const ciLabel = id ? "Stock actual" : "Cantidad inicial";

    stock_minimo.classList.toggle("is-invalid", smDec);
    cantidad_inicial.classList.toggle("is-invalid", ciDec);

    if (smDec)  errores.push("Stock mínimo");
    if (ciDec)  errores.push(ciLabel);
  }

  if (errores.length > 0) {
    setMsg(
      `${errores.join(" y ")} debe${errores.length > 1 ? "n" : ""} ser entero${errores.length > 1 ? "s" : ""} (sin decimales).`,
      "danger"
    );
    return false;
  }

  stock_minimo.classList.remove("is-invalid");
  cantidad_inicial.classList.remove("is-invalid");
  return true;
}

function enableInvFields() {
  const on = controla_inventario.value === "1";
  stock_minimo.disabled    = !on;
  cantidad_inicial.disabled = !on;
  if (!on) {
    stock_minimo.value    = "";
    cantidad_inicial.value = "";
    stock_minimo.classList.remove("is-invalid");
    cantidad_inicial.classList.remove("is-invalid");
  }
}

// Validación en tiempo real
stock_minimo.addEventListener("input", () => {
  stock_minimo.classList.toggle("is-invalid", tieneDecimales(stock_minimo.value));
});

cantidad_inicial.addEventListener("input", () => {
  cantidad_inicial.classList.toggle("is-invalid", tieneDecimales(cantidad_inicial.value));
});

controla_inventario.addEventListener("change", enableInvFields);

// ── Reset formulario (solo al crear) ─────────────────────────────────────────
function resetForm() {
  tipo.value                  = "PRODUCTO";
  nombre.value                = "";
  descripcion.value           = "";
  precio_compra.value         = "";
  precio_venta_sugerido.value = "";
  unidad.value                = "";
  controla_inventario.value   = "0";
  is_activo.value             = "1";
  stock_minimo.value          = "";
  cantidad_inicial.value      = "";
  stock_minimo.classList.remove("is-invalid");
  cantidad_inicial.classList.remove("is-invalid");
  enableInvFields();
  nombre.focus();
}

// ── Cargar datos al editar ───────────────────────────────────────────────────
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

  const res  = await getItem(id);
  const data = await res.json();

  if (!res.ok) {
    setMsg(data?.message || "No se pudo cargar.", "danger");
    return;
  }

  const it  = data.item;
  const inv = data.inventario;

  tipo.value                  = it.tipo || "PRODUCTO";
  nombre.value                = it.nombre || "";
  descripcion.value           = it.descripcion || "";
  precio_compra.value         = it.precio_compra ?? "";
  precio_venta_sugerido.value = it.precio_venta_sugerido ?? "";
  unidad.value                = it.unidad ?? "";
  controla_inventario.value   = it.controla_inventario ? "1" : "0";
  is_activo.value             = it.is_activo ? "1" : "0";

  enableInvFields();

  // Cargar inventario: redondear a entero por si la BD aún tiene decimales
  if (inv) {
    stock_minimo.value    = inv.stock_minimo    != null ? String(Math.round(Number(inv.stock_minimo)))    : "";
    cantidad_inicial.value = inv.cantidad_actual != null ? String(Math.round(Number(inv.cantidad_actual))) : "";
  }

  setMsg("");
}

// ── Submit ───────────────────────────────────────────────────────────────────
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!validarEnteros()) return;

  setMsg("Guardando…");

  const payload = {
    tipo:                  tipo.value,
    nombre:                nombre.value.trim(),
    descripcion:           descripcion.value.trim() || null,
    precio_compra:         precio_compra.value         !== "" ? Number(precio_compra.value)         : null,
    precio_venta_sugerido: precio_venta_sugerido.value !== "" ? Number(precio_venta_sugerido.value) : null,
    unidad:                unidad.value.trim() || null,
    controla_inventario:   controla_inventario.value === "1",
    is_activo:             is_activo.value === "1",
  };

  if (controla_inventario.value === "1") {
    if (stock_minimo.value !== "") {
      payload.stock_minimo = Math.round(Number(stock_minimo.value));
    }

    if (!id) {
      // CREAR
      if (cantidad_inicial.value !== "") {
        payload.cantidad_inicial = Math.round(Number(cantidad_inicial.value));
      }
    } else {
      // EDITAR: el backend registra AJUSTE + movimiento
      if (cantidad_inicial.value !== "") {
        payload.cantidad_actual = Math.round(Number(cantidad_inicial.value));
      }
    }
  }

  try {
    const res  = id ? await updateItem(id, payload) : await createItem(payload);
    const data = await res.json();

    if (!res.ok) {
      setMsg(data?.message || "No se pudo guardar.", "danger");
      return;
    }

    if (!id) {
      // CREAR: limpiar para ingresar otro item
      setMsg("✓ Item guardado. Puedes ingresar otro.", "success");
      resetForm();
    } else {
      setMsg("✓ Guardado.", "success");
    }
  } catch {
    setMsg("Error de conexión.", "danger");
  }
});

// ── Eliminar (desactivar) ────────────────────────────────────────────────────
btnEliminar.addEventListener("click", async () => {
  if (!id) return;
  if (!confirm("¿Desactivar este item?")) return;

  setMsg("Procesando…");
  try {
    const res  = await deleteItem(id);
    const data = await res.json();

    if (!res.ok) {
      setMsg(data?.message || "No se pudo desactivar.", "danger");
      return;
    }

    setMsg("Item desactivado.", "success");
    setTimeout(() => (location.href = "catalogo.html"), 600);
  } catch {
    setMsg("Error de conexión.", "danger");
  }
});

load();