// ✅ Sin import de pagos.ui.js — KPIs no tiene relación con pagos
import { getResumen, facturasPendientes } from "./finanzas.service.js";

function money(n) {
  return Number(n || 0).toLocaleString("es-CO", {
    style: "currency", currency: "COP",
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}

let _filtroParams = () => ({});

export function initKPIs(getFiltroParams) {
  _filtroParams = getFiltroParams;
  document.getElementById("btnRefreshKpi")?.addEventListener("click", cargarKpis);
}

export async function cargarKpis() {
  try {
    const r = await getResumen(_filtroParams());
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = money(val); };
    set("kpiFacturas",         r.ingresos_facturas  || 0);
    set("kpiMostrador",        r.ingresos_mostrador || 0);
    set("kpiCaja",             r.total_en_caja      || 0);
    set("kpiIngresosManuales", r.ingresos_manuales  || 0);
    set("kpiEgresos",          r.total_egresos      || 0);

    const balEl  = document.getElementById("kpiBalanceReal");
    const wrapEl = document.getElementById("kpiBalanceWrap");
    if (balEl)  balEl.textContent = money(r.balance_real || 0);
    if (wrapEl) wrapEl.style.background = (r.balance_real || 0) >= 0
      ? "linear-gradient(135deg,#198754,#2fb380)"
      : "linear-gradient(135deg,#dc3545,#e8606e)";

    const pendData  = await facturasPendientes();
    const pendCount = Array.isArray(pendData.data) ? pendData.data.length : 0;
    const badge     = document.getElementById("badgePendientes");
    if (badge) { badge.textContent = pendCount; badge.style.display = pendCount > 0 ? "" : "none"; }
  } catch (e) {
    console.error("KPIs:", e);
  }
}