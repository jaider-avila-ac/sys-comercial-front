// ajustes/js/usuarios.service.js
import { apiFetch, csrfCookie } from "../../common/js/api.js";

async function safeJson(res) {
  try { return await res.json(); } catch { return null; }
}

/** Lista paginada de usuarios */
export async function listarUsuarios({ search = "", activo = "", rol = "", empresa_id = "", page = 1 } = {}) {
  const params = new URLSearchParams();
  if (search)     params.set("search",     search);
  if (activo !== "") params.set("activo",  activo);
  if (rol)        params.set("rol",        rol);
  if (empresa_id) params.set("empresa_id", empresa_id);
  params.set("page", page);

  const res  = await apiFetch(`/usuarios?${params}`);
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data?.message || "No se pudo listar usuarios");
  return data;
}

/** Ver un usuario */
export async function getUsuario(id) {
  const res  = await apiFetch(`/usuarios/${id}`);
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data?.message || "No se pudo cargar el usuario");
  return data.usuario;
}

/** Crear usuario */
export async function crearUsuario(payload) {
  await csrfCookie();
  const res  = await apiFetch("/usuarios", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data?.message || "No se pudo crear el usuario");
  return data.usuario;
}

/** Editar usuario (datos generales + email + rol) */
export async function editarUsuario(id, payload) {
  await csrfCookie();
  const res  = await apiFetch(`/usuarios/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data?.message || "No se pudo actualizar el usuario");
  return data.usuario;
}

/** Habilitar / deshabilitar */
export async function toggleUsuario(id) {
  await csrfCookie();
  const res  = await apiFetch(`/usuarios/${id}/toggle`, { method: "PATCH" });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data?.message || "No se pudo cambiar el estado");
  return data.usuario;
}

/** Cambiar contraseña */
export async function cambiarPassword(id, password, password_confirmation) {
  await csrfCookie();
  const res  = await apiFetch(`/usuarios/${id}/password`, {
    method: "PATCH",
    body: JSON.stringify({ password, password_confirmation }),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data?.message || "No se pudo cambiar la contraseña");
  return data;
}

/** Historial de auditoría de un usuario */
export async function getAuditoria(id, { tipo = "sobre", page = 1 } = {}) {
  const res  = await apiFetch(`/usuarios/${id}/auditoria?tipo=${tipo}&page=${page}`);
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data?.message || "No se pudo cargar la auditoría");
  return data;
}

/** Usuarios activos ahora (últimos N minutos) */
export async function activosAhora(minutos = 30) {
  const res  = await apiFetch(`/usuarios/activos-ahora?minutos=${minutos}`);
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data?.message || "Error");
  return data;
}
