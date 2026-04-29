import { apiFetch } from "../../common/js/api.js";

function buildQuery(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    const s = String(v).trim();
    if (s === "") return;
    qs.set(k, s);
  });
  return qs.toString();
}

async function getJsonOrThrow(res, defaultMsg) {
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    throw new Error(data?.message || defaultMsg || `Error ${res.status}`);
  }
  return data;
}

/**
 * Obtiene el reporte financiero completo por rango de fechas
 * @param {Object} params - { desde, hasta, empresa_id }
 * @returns {Promise<Object>} Datos del reporte
 */
export async function getReporteFinanciero({ desde, hasta, empresa_id } = {}) {
  const qs = buildQuery({ desde, hasta, empresa_id });
  const res = await apiFetch(`/reportes/financiero?${qs}`);
  return getJsonOrThrow(res, "Error cargando reporte financiero");
}