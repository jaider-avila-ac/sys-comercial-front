// empresa/js/empresa.service.js
import { apiFetch, csrfCookie, API_BASE_URL, API_ORIGIN } from "../../common/js/api.js";

async function safeJson(res) {
  try { return await res.json(); } catch { return null; }
}

/** SUPER_ADMIN: lista empresas paginadas */
export async function listarEmpresas({ search = "" } = {}) {
  const res  = await apiFetch(`/empresas?search=${encodeURIComponent(search)}`);
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data?.message || "No se pudo listar empresas");
  return data;
}

/** EMPRESA_ADMIN: datos de mi empresa — devuelve el objeto empresa directo */
export async function miEmpresa() {
  const res  = await apiFetch("/empresa/me");
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data?.message || "No se pudo cargar la empresa");
  if (!data?.empresa) throw new Error("No hay empresa asociada");
  return data.empresa; // ← desenvuelve el wrapper {empresa:{...}}
}

/** SUPER_ADMIN o EMPRESA_ADMIN: actualiza datos — devuelve el objeto empresa directo */
export async function actualizarEmpresa(id, payload) {
  await csrfCookie();
  const res  = await apiFetch(`/empresas/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data?.message || "No se pudo actualizar");
  return data.empresa; // ← desenvuelve el wrapper
}

/**
 * Subir logo — POST /api/empresas/{id}/logo
 *
 * NO usa apiFetch porque ese helper fuerza Content-Type: application/json,
 * lo que rompe la subida multipart. Aquí usamos fetch() directamente para
 * que el browser calcule el boundary correcto del FormData.
 */
export async function subirLogo(id, file) {
  await csrfCookie();

  // Leer cookie XSRF manualmente (misma lógica que apiFetch)
  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return decodeURIComponent(parts.pop().split(";").shift());
    return null;
  }

  const form = new FormData();
  form.append("logo", file);

  const headers = {};
  const xsrf = getCookie("XSRF-TOKEN");
  if (xsrf) headers["X-XSRF-TOKEN"] = xsrf;
  // Content-Type se omite a propósito → el browser lo pone con multipart boundary

  const res = await fetch(`${API_BASE_URL}/empresas/${id}/logo`, {
    method: "POST",
    body: form,
    headers,
    credentials: "include",
  });

  const data = await safeJson(res);
  if (!res.ok) throw new Error(data?.message || "No se pudo subir el logo");
  return data.empresa; // ← desenvuelve el wrapper
}

/** Quitar logo — DELETE /api/empresas/{id}/logo */
export async function quitarLogo(id) {
  await csrfCookie();
  const res  = await apiFetch(`/empresas/${id}/logo`, { method: "DELETE" });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data?.message || "No se pudo quitar el logo");
  return data.empresa; // ← desenvuelve el wrapper
}

/** SUPER_ADMIN: elimina empresa */
export async function eliminarEmpresa(id) {
  await csrfCookie();
  const res  = await apiFetch(`/empresas/${id}`, { method: "DELETE" });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data?.message || "No se pudo eliminar");
  return data;
}