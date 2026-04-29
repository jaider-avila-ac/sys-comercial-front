import { apiFetch, csrfCookie, API_BASE_URL } from "../../common/js/api.js";

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return decodeURIComponent(parts.pop().split(";").shift());
  return null;
}

export async function listItems({ page = 1, search = "", tipo = "", solo_controla = "0", empresa_id = null } = {}) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  if (search) params.set("search", search);
  if (tipo) params.set("tipo", tipo);
  if (solo_controla === "1") params.set("controla_inventario", "1");
  if (empresa_id) params.set("empresa_id", String(empresa_id));

  const res = await apiFetch(`/items?${params.toString()}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Error al listar items");
  return data;
}

export async function getItem(id) {
  const res = await apiFetch(`/items/${id}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Error al cargar item");
  return data;
}

export async function createItem(formData) {
  await csrfCookie();
  
  const token = localStorage.getItem("access_token");
  const xsrf = getCookie("XSRF-TOKEN");
  
  const headers = {
    "Accept": "application/json",
  };
  if (xsrf) headers["X-XSRF-TOKEN"] = xsrf;
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}/items`, {
    method: "POST",
    body: formData,
    headers,
    credentials: "include",
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Error al crear item");
  return data;
}

export async function updateItem(id, payload) {
  await csrfCookie();
  const res = await apiFetch(`/items/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Error al actualizar item");
  return data;
}

export async function deleteItem(id) {
  await csrfCookie();
  const res = await apiFetch(`/items/${id}`, { method: "DELETE" });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Error al eliminar item");
  return data;
}

export async function ajustarInventario(payload) {
  await csrfCookie();
  const res = await apiFetch("/stock/ajustar", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Error al ajustar inventario");
  return data;
}