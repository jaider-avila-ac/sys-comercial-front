import { apiFetch, csrfCookie } from "../../common/js/api.js";

export async function listItems({ page = 1, search = "", tipo = "", activos = "1", empresa_id = null } = {}) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  if (search) params.set("search", search);
  if (tipo) params.set("tipo", tipo);
  if (activos !== null && activos !== undefined) params.set("activos", String(activos));
  if (empresa_id) params.set("empresa_id", String(empresa_id)); // para SUPER_ADMIN

  return apiFetch(`/items?${params.toString()}`);
}

export async function getItem(id, { empresa_id = null } = {}) {
  const params = new URLSearchParams();
  if (empresa_id) params.set("empresa_id", String(empresa_id));
  const q = params.toString() ? `?${params.toString()}` : "";
  return apiFetch(`/items/${id}${q}`);
}

export async function createItem(payload) {
  await csrfCookie();
  return apiFetch(`/items`, { method: "POST", body: JSON.stringify(payload) });
}

export async function updateItem(id, payload) {
  await csrfCookie();
  return apiFetch(`/items/${id}`, { method: "PUT", body: JSON.stringify(payload) });
}

export async function deleteItem(id, payload = null) {
  // delete lógico (desactivar) en backend
  await csrfCookie();
  return apiFetch(`/items/${id}`, {
    method: "DELETE",
    body: payload ? JSON.stringify(payload) : null,
  });
}