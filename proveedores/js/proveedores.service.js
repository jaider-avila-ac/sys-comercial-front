import { apiFetch, csrfCookie } from "../../common/js/api.js";

export async function listarProveedores({ search = "", activos = "1" } = {}) {
  const qs = new URLSearchParams();
  if (search)        qs.set("search", search);
  if (activos !== "1") qs.set("activos", activos);
  const res  = await apiFetch(`/proveedores?${qs}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Error al listar proveedores");
  return data;
}

export async function obtenerProveedor(id) {
  const res  = await apiFetch(`/proveedores/${id}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Error al cargar proveedor");
  return data; // { proveedor, items, resumen_compras }
}

export async function crearProveedor(payload) {
  await csrfCookie();
  const res  = await apiFetch("/proveedores", { method: "POST", body: JSON.stringify(payload) });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Error al crear proveedor");
  return data;
}

export async function actualizarProveedor(id, payload) {
  await csrfCookie();
  const res  = await apiFetch(`/proveedores/${id}`, { method: "PUT", body: JSON.stringify(payload) });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Error al actualizar proveedor");
  return data;
}

export async function eliminarProveedor(id) {
  await csrfCookie();
  const res  = await apiFetch(`/proveedores/${id}`, { method: "DELETE" });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Error al desactivar proveedor");
  return data;
}
