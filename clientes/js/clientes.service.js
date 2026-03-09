import { apiFetch, csrfCookie } from "../../common/js/api.js";

export async function listarClientes(search = "") {
  const res = await apiFetch(`/clientes?search=${encodeURIComponent(search)}`);
  return res.json();
}

export async function eliminarCliente(id) {
  await csrfCookie();
  return apiFetch(`/clientes/${id}`, { method: "DELETE" });
}