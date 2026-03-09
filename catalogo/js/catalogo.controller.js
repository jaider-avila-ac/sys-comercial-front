import { getUser } from "../../common/js/auth.js";
import { listInventario, ajustarInventario } from "./inventario.service.js";

const user = getUser();

const search = document.getElementById("search");
const tipo = document.getElementById("tipo");
const soloControla = document.getElementById("soloControla");
const btnRefrescar = document.getElementById("btnRefrescar");

const tbody = document.getElementById("tbody");
const pageInfo = document.getElementById("pageInfo");
const btnPrev = document.getElementById("btnPrev");
const btnNext = document.getElementById("btnNext");

const btnNuevo = document.getElementById("btnNuevo");

// modal
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
let currentEmpresaId = null; // si SUPER_ADMIN quieres elegir empresa, aquí lo pasarías

// permisos UI: OPERATIVO NO crea items (según tu backend)
if (user?.rol === "OPERATIVO") {
  btnNuevo.classList.add("d-none");
}

// ========= helpers =========
function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (m) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}

function fmtNum(n) {
  const x = Number(n ?? 0);
  return x.toLocaleString("es-CO", { minimumFractionDigits: 0, maximumFractionDigits: 3 });
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
  return flag ? `<span class="badge bg-success">Sí</span>` : `<span class="badge bg-light text-dark">No</span>`;
}

function stockWarn(stock, min) {
  const s = Number(stock ?? 0);
  const m = Number(min ?? 0);
  if (m > 0 && s <= m) return "text-danger fw-semibold";
  return "";
}

// ========= load =========
async function load(page = 1) {
  currentPage = page;
  tbody.innerHTML = `<tr><td colspan="7" class="text-muted">Cargando…</td></tr>`;

  const q = search.value.trim();
  const t = tipo.value;
  const sc = soloControla.value;

  const res = await listInventario({
    page,
    search: q,
    tipo: t,
    solo_controla: sc,
    empresa_id: currentEmpresaId,
  });

  const data = await res.json();

  if (!res.ok) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-danger">Error al cargar</td></tr>`;
    pageInfo.textContent = "—";
    return;
  }

  lastPage = data.last_page || 1;

  const rows = (data.data || []).map(r => {
    const stock = r.cantidad_actual;
    const min = r.stock_minimo;

    const canAdjust = (user?.rol === "SUPER_ADMIN" || user?.rol === "EMPRESA_ADMIN" || user?.rol === "OPERATIVO")
      && Number(r.controla_inventario) === 1;

    return `
      <tr>
        <td>
          <div class="fw-semibold">${escapeHtml(r.nombre)}</div>
          <div class="text-muted small">ID: ${r.id}</div>
        </td>
        <td>${badgeTipo(r.tipo)}</td>
        <td class="text-nowrap">${escapeHtml(r.unidad || "—")}</td>
        <td class="text-end ${stockWarn(stock, min)}">${fmtNum(stock)}</td>
        <td class="text-end">${fmtNum(min)}</td>
        <td>${badgeInv(Number(r.controla_inventario) === 1)}</td>
        <td class="text-end text-nowrap">
          <a class="btn btn-sm btn-outline-secondary" href="item-form.html?id=${r.id}">
            <i class="bi bi-pencil"></i>
          </a>
          ${canAdjust ? `
            <button class="btn btn-sm btn-outline-primary ms-1"
              data-ajustar="1"
              data-id="${r.id}"
              data-nombre="${escapeHtml(r.nombre)}"
              data-min="${r.stock_minimo ?? 0}">
              <i class="bi bi-box-seam"></i>
            </button>
          ` : ``}
        </td>
      </tr>
    `;
  }).join("");

  tbody.innerHTML = rows || `<tr><td colspan="7" class="text-muted">Sin resultados</td></tr>`;

  pageInfo.textContent = `Página ${data.current_page} de ${data.last_page} · ${data.total} registros`;

  btnPrev.disabled = (data.current_page || 1) <= 1;
  btnNext.disabled = (data.current_page || 1) >= (data.last_page || 1);
}

// ========= events =========
let t = null;
search.addEventListener("input", () => {
  clearTimeout(t);
  t = setTimeout(() => load(1), 350);
});

tipo.addEventListener("change", () => load(1));
soloControla.addEventListener("change", () => load(1));
btnRefrescar.addEventListener("click", () => load(currentPage));

btnPrev.addEventListener("click", () => load(Math.max(1, currentPage - 1)));
btnNext.addEventListener("click", () => load(Math.min(lastPage, currentPage + 1)));

tbody.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-ajustar]");
  if (!btn) return;

  // abre modal
  const id = btn.dataset.id;
  const nombre = btn.dataset.nombre;
  const min = btn.dataset.min;

  formAjuste.dataset.itemId = id;
  aj_itemNombre.textContent = nombre;

  aj_tipo.value = "ENTRADA";
  aj_cantidad.value = "";
  aj_motivo.value = "";
  aj_stockMinimo.value = String(min ?? "");
  aj_msg.textContent = "";
  aj_msg.className = "small mt-2";

  modal.show();
});

formAjuste.addEventListener("submit", async (e) => {
  e.preventDefault();

  aj_msg.textContent = "Guardando…";
  aj_msg.className = "small mt-2 text-muted";

  const item_id = Number(formAjuste.dataset.itemId);
  const payload = {
    item_id,
    tipo: aj_tipo.value,
    cantidad: Number(aj_cantidad.value),
    motivo: aj_motivo.value.trim() || null,
    stock_minimo: aj_stockMinimo.value !== "" ? Number(aj_stockMinimo.value) : null,
    // empresa_id solo si SUPER_ADMIN y decides usar selector
    ...(currentEmpresaId ? { empresa_id: currentEmpresaId } : {}),
  };

  try {
    const res = await ajustarInventario(payload);
    const data = await res.json();

    if (!res.ok) {
      aj_msg.textContent = data?.message || "No se pudo ajustar.";
      aj_msg.className = "small mt-2 text-danger";
      return;
    }

    aj_msg.textContent = `OK. Nuevo stock: ${fmtNum(data.cantidad_actual)}`;
    aj_msg.className = "small mt-2 text-success";

    setTimeout(() => {
      modal.hide();
      load(currentPage);
    }, 500);
  } catch {
    aj_msg.textContent = "Error de conexión.";
    aj_msg.className = "small mt-2 text-danger";
  }
});

// init
load(1);