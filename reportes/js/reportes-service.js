// reportes/js/reportes-service.js
import { apiFetch } from "../../common/js/api.js";

function buildQuery(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    const s = String(v).trim();
    if (!s) return;
    qs.set(k, s);
  });
  return qs.toString();
}

async function getJsonOrThrow(res, defaultMsg) {
  let data = null;
  try { data = await res.json(); } catch { data = null; }
  if (!res.ok) throw new Error(data?.message || defaultMsg || "Error");
  return data;
}

export async function getVentasResumen({ desde, hasta, empresa_id } = {}) {
  const qs = buildQuery({ desde, hasta, empresa_id });
  const res = await apiFetch(`/reportes/ventas-resumen?${qs}`);
  return getJsonOrThrow(res, "Error cargando ventas-resumen");
}

export async function getRecaudosResumen({ desde, hasta, empresa_id } = {}) {
  const qs = buildQuery({ desde, hasta, empresa_id });
  const res = await apiFetch(`/reportes/recaudos-resumen?${qs}`);
  return getJsonOrThrow(res, "Error cargando recaudos-resumen");
}

export async function getSaldoAlCierre({ desde, hasta, cierre, empresa_id } = {}) {
  const qs = buildQuery({ desde, hasta, cierre, empresa_id });
  const res = await apiFetch(`/reportes/saldo-al-cierre?${qs}`);
  return getJsonOrThrow(res, "Error cargando saldo-al-cierre");
}

export async function getVentasLineas({ desde, hasta, empresa_id, page = 1 } = {}) {
  const qs = buildQuery({ desde, hasta, empresa_id, page });
  const res = await apiFetch(`/reportes/ventas-lineas?${qs}`);
  return getJsonOrThrow(res, "Error cargando ventas-lineas");
}

export async function getFlujoMensual({ desde, hasta, empresa_id } = {}) {
  const qs = buildQuery({ desde, hasta, empresa_id });
  const res = await apiFetch(`/reportes/flujo-mensual?${qs}`);
  return getJsonOrThrow(res, "Error cargando flujo-mensual");
}