import { apiFetch, csrfCookie, API_BASE_URL, API_ORIGIN } from "../../common/js/api.js";

export async function listItems({ page = 1, search = "", tipo = "", activos = "1", empresa_id = null } = {}) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  if (search) params.set("search", search);
  if (tipo) params.set("tipo", tipo);
  if (activos !== null && activos !== undefined) params.set("activos", String(activos));
  if (empresa_id) params.set("empresa_id", String(empresa_id));

  return apiFetch(`/items?${params.toString()}`);
}

export async function getItem(id, { empresa_id = null } = {}) {
  const params = new URLSearchParams();
  if (empresa_id) params.set("empresa_id", String(empresa_id));
  const q = params.toString() ? `?${params.toString()}` : "";
  return apiFetch(`/items/${id}${q}`);
}

export async function createItem(formData) {
  await csrfCookie();
  const xsrf = getCookie("XSRF-TOKEN");
  const headers = {
    "Accept": "application/json",  // ← faltaba esto
  };
  if (xsrf) headers["X-XSRF-TOKEN"] = xsrf;

  return fetch(`${API_BASE_URL}/items`, {
    method: "POST",
    body: formData,
    headers,
    credentials: "include",
  });
}

export async function updateItem(id, payload) {
  await csrfCookie();
  return apiFetch(`/items/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteItem(id, payload = null) {
  await csrfCookie();
  return apiFetch(`/items/${id}`, {
    method: "DELETE",
    body: payload ? JSON.stringify(payload) : null,
  });
}

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return decodeURIComponent(parts.pop().split(";").shift());
  return null;
}