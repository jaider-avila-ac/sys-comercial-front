import { getUser } from "../../common/js/auth.js";
import { listItems, ajustarInventario } from "./items.service.js";

const user = getUser();

const search = document.getElementById("search");
const tipo = document.getElementById("tipo");
const soloControla = document.getElementById("soloControla");
const btnRefrescar = document.getElementById("btnRefrescar");
const btnNuevo = document.getElementById("btnNuevo");

const tbody = document.getElementById("tbody");
const pageInfo = document.getElementById("pageInfo");
const btnPrev = document.getElementById("btnPrev");
const btnNext = document.getElementById("btnNext");

const modalEl = document.getElementById("modalAjuste");
const modal = new bootstrap.Modal(modalEl);
const formAjuste = document.getElementById("formAjuste");
const aj_itemNombre = document.getElementById("aj_itemNombre");
const aj_tipo = document.getElementById("aj_tipo");
const aj_cantidad = document.getElementById("aj_cantidad");
const aj_motivo = document.getElementById("aj_motivo");
const aj_stockMinimo = document.getElementById("aj_stockMinimo");
const aj_msg = document.getElementById("aj_msg");

let currentPage = 1;
let lastPage = 1;
let currentEmpresaId = null;

if (user?.rol === "OPERATIVO") {
  btnNuevo?.classList.add("d-none");
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[m]));
}

function fmtNum(n) {
  return Number(n ?? 0).toLocaleString("es-CO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
}

function badgeTipo(t) {
  const map = {
    PRODUCTO: "bg-primary",
    INSUMO: "bg-warning text-dark",
    SERVICIO: "bg-secondary",
  };
  return `<span class="badge ${map[t] || "bg-secondary"}">${escapeHtml(t)}</span>`;
}

function badgeInv(flag) {
  return flag
    ? `<span class="badge bg-success">Sí</span>`
    : `<span class="badge bg-light text-dark border">No</span>`;
}

function stockClass(stock, min) {
  const s = Number(stock ?? 0);
  const m = Number(min ?? 0);

  if (m > 0 && s <= m) return "text-danger fw-semibold";
  if (m > 0 && s <= m * 1.5) return "text-warning fw-semibold";
  return "";
}

function stockBadge(stock, min) {
  const s = Number(stock ?? 0);
  const m = Number(min ?? 0);

  let icon = "bi-check-circle text-success";
  let title = "Stock OK";

  if (m > 0 && s <= m) {
    icon = "bi-exclamation-triangle-fill text-danger";
    title = "Stock bajo mínimo";
  } else if (m > 0 && s <= m * 1.5) {
    icon = "bi-exclamation-circle text-warning";
    title = "Stock cerca del mínimo";
  }

  return `<i class="bi ${icon} ms-1" title="${title}"></i>`;
}

async function load(page = 1) {
  currentPage = page;
  tbody.innerHTML = `<tr><td colspan="7" class="text-muted p-3">Cargando…</td></tr>`;

  try {
    const data = await listItems({
      page,
      search: search.value.trim(),
      tipo: tipo.value,
      solo_controla: soloControla.value,
    });

    lastPage = data.last_page || 1;
    const rows = data.data || [];

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-muted p-3">Sin resultados.</td></tr>`;
      pageInfo.textContent = "0 registros";
      btnPrev.disabled = true;
      btnNext.disabled = true;
      return;
    }

    tbody.innerHTML = rows.map((r) => {
      // ✅ CORREGIDO: usar los nombres correctos del backend
      const inventario = r.inventario || {};
      const stock = inventario.unidades_actuales || 0;
      const min = inventario.unidades_minimas || 0;
      const controla = r.controla_inventario === 1 || r.controla_inventario === true;
      const vendidoTotal = r.total_vendido || 0;

      const canAdjust = controla && (
        user?.rol === "SUPER_ADMIN" ||
        user?.rol === "EMPRESA_ADMIN" ||
        user?.rol === "OPERATIVO"
      );

      return `
        <tr data-id="${r.id}">
          <td class="col-item">
            <div class="fw-semibold item-nombre">${escapeHtml(r.nombre)}</div>
            <div class="text-muted item-meta">ID: ${r.id}</div>
            ${r.descripcion ? `<div class="text-muted small">${escapeHtml(r.descripcion.substring(0, 60))}</div>` : ''}
          </td>
          <td class="col-tipo text-nowrap">${badgeTipo(r.tipo)}</td>
          <td class="col-stock text-end text-nowrap">
            <span class="${stockClass(stock, min)}">${fmtNum(stock)}</span>
            ${controla ? stockBadge(stock, min) : ""}
          </td>
          <td class="col-minimo text-end text-nowrap">${controla ? fmtNum(min) : "—"}</td>
          <td class="col-inventario text-nowrap">${badgeInv(controla)}</td>
          <td class="col-vendidas text-end text-nowrap">${controla ? fmtNum(vendidoTotal) : "—"}</td>
          <td class="col-acciones text-end text-nowrap">
            <a class="btn btn-sm btn-outline-secondary" href="item-form.html?id=${r.id}" title="Editar item">
              <i class="bi bi-pencil"></i>
            </a>
            ${canAdjust ? `
              <button class="btn btn-sm btn-outline-primary ms-1" data-ajustar="1" 
                data-id="${r.id}" 
                data-nombre="${escapeHtml(r.nombre)}" 
                data-stock="${stock}" 
                data-min="${min}" 
                title="Ajustar inventario">
                <i class="bi bi-box-seam"></i>
              </button>
            ` : ""}
          </td>
        </tr>
      `;
    }).join("");

    pageInfo.textContent = `Página ${data.current_page} de ${data.last_page} · ${data.total} registros`;
    btnPrev.disabled = data.current_page <= 1;
    btnNext.disabled = data.current_page >= data.last_page;

  } catch (error) {
    console.error(error);
    tbody.innerHTML = `<tr><td colspan="7" class="text-danger p-3">Error de conexión.</td></tr>`;
    pageInfo.textContent = "—";
  }
}

let searchTimer = null;

search.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => load(1), 350);
});

tipo.addEventListener("change", () => load(1));
soloControla.addEventListener("change", () => load(1));
btnRefrescar.addEventListener("click", () => load(currentPage));

btnPrev.addEventListener("click", () => load(Math.max(1, currentPage - 1)));
btnNext.addEventListener("click", () => load(Math.min(lastPage, currentPage + 1)));

tbody.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-ajustar]");
  if (!btn) return;

  const { id, nombre, stock, min } = btn.dataset;

  formAjuste.dataset.itemId = id;
  aj_itemNombre.textContent = nombre;
  aj_tipo.value = "ENTRADA";
  aj_cantidad.value = "";
  aj_motivo.value = "";
  aj_stockMinimo.value = String(min ?? "");
  aj_msg.textContent = "";
  aj_msg.className = "small mt-2";

  const stockActualEl = document.getElementById("aj_stockActual");
  if (stockActualEl) {
    const s = Number(stock ?? 0);
    const m = Number(min ?? 0);
    const cls = (m > 0 && s <= m) ? "text-danger fw-semibold" : "text-success";

    stockActualEl.innerHTML = `
      <span class="text-muted">Stock actual:</span>
      <span class="${cls} ms-1">${fmtNum(s)}</span>
      ${m > 0 ? `<span class="text-muted ms-2">· Mínimo: ${fmtNum(m)}</span>` : ""}
    `;
  }

  modal.show();
  setTimeout(() => aj_cantidad.focus(), 300);
});

formAjuste.addEventListener("submit", async (e) => {
  e.preventDefault();

  const cantidad = Number(aj_cantidad.value);
  if (!cantidad || cantidad <= 0) {
    aj_msg.textContent = "La cantidad debe ser mayor a 0.";
    aj_msg.className = "small mt-2 text-danger";
    return;
  }

  aj_msg.textContent = "Guardando…";
  aj_msg.className = "small mt-2 text-muted";

  const payload = {
    item_id: Number(formAjuste.dataset.itemId),
    tipo: aj_tipo.value,
    cantidad,
    motivo: aj_motivo.value.trim() || null,
    stock_minimo: aj_stockMinimo.value !== "" ? Number(aj_stockMinimo.value) : null,
  };

  try {
    const data = await ajustarInventario(payload);

    aj_msg.textContent = `✓ Nuevo stock: ${fmtNum(data.cantidad_actual)}`;
    aj_msg.className = "small mt-2 text-success";

    setTimeout(() => {
      modal.hide();
      load(currentPage);
    }, 700);

  } catch (error) {
    aj_msg.textContent = error.message || "Error de conexión.";
    aj_msg.className = "small mt-2 text-danger";
  }
});

load(1);