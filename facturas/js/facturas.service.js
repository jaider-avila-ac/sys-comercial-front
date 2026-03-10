import { apiFetch, csrfCookie } from "../../common/js/api.js";

export async function buscarClientes(search = "") {
  const res  = await apiFetch(`/clientes?search=${encodeURIComponent(search)}&activos=1&page=1`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Error al buscar clientes");
  return data.data || [];
}

export async function buscarItems(search = "") {
  const res  = await apiFetch(`/items?search=${encodeURIComponent(search)}&activos=1&page=1`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Error al buscar items");
  return data.data || [];
}

export async function listarFacturas({ search = "", estado = "" } = {}) {
  const qs = new URLSearchParams();
  if (search) qs.set("search", search);
  if (estado) qs.set("estado", estado);
  const res  = await apiFetch(`/facturas?${qs}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Error al listar");
  return data;
}

export async function obtenerFactura(id) {
  const res  = await apiFetch(`/facturas/${id}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Error al cargar factura");
  return data.factura;
}

export async function crearFactura(payload) {
  await csrfCookie();
  const res  = await apiFetch("/facturas", { method:"POST", body: JSON.stringify(payload) });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Error al crear factura");
  return data.factura;
}

export async function actualizarFactura(id, payload) {
  await csrfCookie();
  const res  = await apiFetch(`/facturas/${id}`, { method:"PUT", body: JSON.stringify(payload) });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Error al actualizar factura");
  return data.factura;
}

export async function eliminarFactura(id) {
  await csrfCookie();
  const res  = await apiFetch(`/facturas/${id}`, { method:"DELETE" });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "No se pudo eliminar");
  return data;
}

export async function emitirFactura(id) {
  await csrfCookie();
  const res  = await apiFetch(`/facturas/${id}/emitir`, { method:"POST" });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "No se pudo emitir");
  return data.factura;
}

export async function anularFactura(id) {
  await csrfCookie();
  const res  = await apiFetch(`/facturas/${id}/anular`, { method:"POST" });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "No se pudo anular");
  return data.factura;
}

export async function registrarPago(id, payload) {
  await csrfCookie();
  const res  = await apiFetch(`/facturas/${id}/pagos`, { method:"POST", body: JSON.stringify(payload) });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Error al registrar pago");
  return data;
}

export async function obtenerPagos(id) {
  const res  = await apiFetch(`/facturas/${id}/pagos`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Error al obtener pagos");
  return data.pagos || [];
}

export async function verificarStock(items = []) {
  const res  = await apiFetch("/stock/verificar", {
    method: "POST",
    body: JSON.stringify({ items }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Error al verificar stock");
  return data; // { ok, items: [...] }
}

