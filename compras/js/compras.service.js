import { apiFetch, csrfCookie, API_BASE_URL } from "../../common/js/api.js";

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return decodeURIComponent(parts.pop().split(";").shift());
  return null;
}

async function parseJsonResponse(res) {
  const contentType = res.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return await res.json();
  }

  const text = await res.text();
  throw new Error(text || `Error HTTP ${res.status}`);
}

export async function listarCompras(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== null && v !== undefined && v !== "") qs.set(k, v);
  });

  const res = await apiFetch(`/compras?${qs.toString()}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "No se pudo listar compras.");
  return data;
}

export async function obtenerCompra(id) {
  const res = await apiFetch(`/compras/${id}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "No se pudo obtener la compra.");
  return data;
}

export async function confirmarCompra(id) {
  await csrfCookie();
  const res = await apiFetch(`/compras/${id}/confirmar`, { method: "POST" });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "No se pudo confirmar la compra.");
  return data;
}

export async function anularCompra(id) {
  await csrfCookie();
  const res = await apiFetch(`/compras/${id}/anular`, { method: "POST" });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "No se pudo anular la compra.");
  return data;
}

export async function registrarPagoCompra(id, formData) {
  await csrfCookie();

  const xsrf = getCookie("XSRF-TOKEN");
  const headers = {};
  if (xsrf) headers["X-XSRF-TOKEN"] = xsrf;

  const res = await fetch(`${API_BASE_URL}/compras/${id}/pagar`, {
    method: "POST",
    body: formData,
    headers,
    credentials: "include",
  });

  const data = await parseJsonResponse(res);

  if (!res.ok) {
    throw new Error(data?.message || "No se pudo registrar el pago.");
  }

  return data;
}

export async function cuentasPorPagar() {
  const res = await apiFetch(`/compras/cuentas-por-pagar`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "No se pudo consultar cuentas por pagar.");
  return data;
}