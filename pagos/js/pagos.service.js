import { apiFetch, csrfCookie } from "../../common/js/api.js";

// ── Facturas (lo que necesita el módulo de pagos) ─────────────────────────────

export async function listarFacturas({ search = "", estado = "" } = {}) {
  const qs = new URLSearchParams();
  if (search) qs.set("search", search);
  if (estado) qs.set("estado", estado);
  const res  = await apiFetch(`/facturas?${qs}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Error al listar facturas");
  return data;
}

export async function registrarPago(id, payload) {
  await csrfCookie();
  const res  = await apiFetch(`/facturas/${id}/pagos`, { method: "POST", body: JSON.stringify(payload) });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Error al registrar pago");
  return data;
}

// ── Módulo Pagos ──────────────────────────────────────────────────────────────

export async function resumenPagos() {
  const res  = await apiFetch("/pagos/resumen");
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Error al cargar resumen");
  return data;
}

export async function listarPagos({ search = "", clienteId = "", formaPago = "", fechaDesde = "", fechaHasta = "" } = {}) {
  const qs = new URLSearchParams();
  if (search)     qs.set("search", search);
  if (clienteId)  qs.set("cliente_id", clienteId);
  if (formaPago)  qs.set("forma_pago", formaPago);
  if (fechaDesde) qs.set("fecha_desde", fechaDesde);
  if (fechaHasta) qs.set("fecha_hasta", fechaHasta);
  const res  = await apiFetch(`/pagos?${qs}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Error al listar pagos");
  return data;
}

export async function facturasPendientes({ search = "", clienteId = "" } = {}) {
  const qs = new URLSearchParams();
  if (search)    qs.set("search", search);
  if (clienteId) qs.set("cliente_id", clienteId);
  const res  = await apiFetch(`/pagos/facturas-pendientes?${qs}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Error al cargar pendientes");
  return data;
}

export async function buscarFacturaPorNumero(numero) {
  const qs = new URLSearchParams({ search: numero, estado: "EMITIDA" });
  const res  = await apiFetch(`/facturas?${qs}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Error al buscar");
  const rows = data.data || [];
  return rows.find(f => f.numero?.toLowerCase() === numero.toLowerCase()) ?? null;
}
