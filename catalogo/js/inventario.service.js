import { apiFetch, csrfCookie } from "../../common/js/api.js";

export async function listInventario({ page = 1, search = "", tipo = "", solo_controla = "1", empresa_id = null } = {}) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  if (search) params.set("search", search);
  if (tipo) params.set("tipo", tipo);
  if (solo_controla !== null && solo_controla !== undefined) params.set("solo_controla", String(solo_controla));
  if (empresa_id) params.set("empresa_id", String(empresa_id)); // para SUPER_ADMIN

  return apiFetch(`/inventario?${params.toString()}`);
}

export async function ajustarInventario(payload) {
  await csrfCookie();
  return apiFetch(`/inventario/ajustar`, { method: "POST", body: JSON.stringify(payload) });
}

export async function movimientosInventario({ page = 1, item_id = "", desde = "", hasta = "", empresa_id = null } = {}) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  if (item_id) params.set("item_id", String(item_id));
  if (desde) params.set("desde", desde);
  if (hasta) params.set("hasta", hasta);
  if (empresa_id) params.set("empresa_id", String(empresa_id)); // para SUPER_ADMIN

  return apiFetch(`/inventario/movimientos?${params.toString()}`);
}