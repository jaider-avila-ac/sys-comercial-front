import { obtenerProveedor, crearProveedor, actualizarProveedor } from "./proveedores.service.js";
import { showToast } from "../../common/js/ui.utils.js";

const qs = new URLSearchParams(location.search);
const id = qs.get("id");

const titulo      = document.getElementById("titulo");
const form        = document.getElementById("form");
const msg         = document.getElementById("msg");
const btnEliminar = document.getElementById("btnEliminar");

// campos
const nombre              = document.getElementById("nombre");
const nit                 = document.getElementById("nit");
const contacto            = document.getElementById("contacto");
const telefono            = document.getElementById("telefono");
const email               = document.getElementById("email");
const ciudad              = document.getElementById("ciudad");
const direccion           = document.getElementById("direccion");
const tiempo_entrega_dias = document.getElementById("tiempo_entrega_dias");
const notas               = document.getElementById("notas");
const is_activo           = document.getElementById("is_activo");

// panel de items habituales (solo en edición)
const seccionItems  = document.getElementById("seccionItems");
const tbodyItems    = document.getElementById("tbodyItems");
const resumenCompras = document.getElementById("resumenCompras");

function setMsg(text, kind = "muted") {
  msg.textContent = text;
  msg.className   = `small text-${kind}`;
}

function money(n) {
  return Number(n || 0).toLocaleString("es-CO", { style: "currency", currency: "COP" });
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, m =>
    ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[m])
  );
}

// ── Cargar si edición ──────────────────────────────────────────
async function load() {
  if (!id) return;

  titulo.textContent = `Editar Proveedor`;
  btnEliminar?.classList.remove("d-none");
  setMsg("Cargando…");

  try {
    const { proveedor, items, resumen_compras } = await obtenerProveedor(id);

    nombre.value              = proveedor.nombre || "";
    nit.value                 = proveedor.nit    || "";
    contacto.value            = proveedor.contacto || "";
    telefono.value            = proveedor.telefono || "";
    email.value               = proveedor.email    || "";
    ciudad.value              = proveedor.ciudad   || "";
    direccion.value           = proveedor.direccion || "";
    tiempo_entrega_dias.value = proveedor.tiempo_entrega_dias ?? "";
    notas.value               = proveedor.notas   || "";
    is_activo.value           = proveedor.is_activo ? "1" : "0";

    // Mostrar items habituales
    if (seccionItems) {
      seccionItems.classList.remove("d-none");

      if (items?.length) {
        tbodyItems.innerHTML = items.map(it => `
          <tr>
            <td>${esc(it.nombre)}</td>
            <td><span class="badge bg-secondary">${esc(it.tipo)}</span></td>
            <td>${esc(it.unidad || "—")}</td>
            <td class="text-end">${money(it.precio_compra)}</td>
            <td>
              ${it.controla_inventario
                ? `<span class="badge bg-success">Sí</span>`
                : `<span class="badge bg-light text-dark">No</span>`}
            </td>
            <td>
              <a class="btn btn-sm btn-outline-secondary"
                 href="../catalogo/item-form.html?id=${it.id}">
                <i class="bi bi-pencil"></i>
              </a>
            </td>
          </tr>`).join("");
      } else {
        tbodyItems.innerHTML = `<tr><td colspan="6" class="text-muted">Sin items asignados.</td></tr>`;
      }
    }

    // Resumen de compras
    if (resumenCompras && resumen_compras) {
      const rc = resumen_compras;
      resumenCompras.innerHTML = `
        <div class="d-flex gap-4 flex-wrap">
          <div>
            <div class="text-muted small">Compras confirmadas</div>
            <div class="fw-semibold">${rc.total_compras ?? 0}</div>
          </div>
          <div>
            <div class="text-muted small">Monto total</div>
            <div class="fw-semibold">${money(rc.monto_total)}</div>
          </div>
          <div>
            <div class="text-muted small">Deuda pendiente</div>
            <div class="fw-semibold ${Number(rc.deuda_total) > 0 ? "text-danger" : "text-success"}">
              ${money(rc.deuda_total)}
            </div>
          </div>
          <div>
            <a class="btn btn-sm btn-outline-primary"
               href="../compras/compras.html?proveedor_id=${id}">
              <i class="bi bi-cart3 me-1"></i> Ver compras
            </a>
          </div>
        </div>`;
    }

    setMsg("");
  } catch (e) {
    setMsg(e.message || "Error al cargar.", "danger");
  }
}

// ── Submit ─────────────────────────────────────────────────────
form.addEventListener("submit", async e => {
  e.preventDefault();
  setMsg("Guardando…");

  const payload = {
    nombre:               nombre.value.trim(),
    nit:                  nit.value.trim()       || null,
    contacto:             contacto.value.trim()  || null,
    telefono:             telefono.value.trim()  || null,
    email:                email.value.trim()     || null,
    ciudad:               ciudad.value.trim()    || null,
    direccion:            direccion.value.trim() || null,
    tiempo_entrega_dias:  tiempo_entrega_dias.value !== "" ? Number(tiempo_entrega_dias.value) : null,
    notas:                notas.value.trim()     || null,
    ...(id ? { is_activo: is_activo.value === "1" } : {}),
  };

  if (!payload.nombre) {
    setMsg("El nombre es obligatorio.", "danger");
    nombre.focus();
    return;
  }

  try {
    if (id) {
      await actualizarProveedor(id, payload);
      setMsg("✓ Guardado.", "success");
    } else {
      const nuevo = await crearProveedor(payload);
      showToast("Proveedor creado.", "success");
      location.href = `proveedor-form.html?id=${nuevo.id}`;
    }
  } catch (e) {
    setMsg(e.message || "Error al guardar.", "danger");
  }
});

load();
