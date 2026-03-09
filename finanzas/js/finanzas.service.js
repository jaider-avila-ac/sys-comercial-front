import { apiFetch, API_BASE_URL, csrfCookie } from "../../common/js/api.js";

// ── helper ────────────────────────────────────────────────────
function json(r) {
  if (!r.ok) {
    return r.text().then(text => {
      try {
        const d = JSON.parse(text);
        return Promise.reject(new Error(d.message || `Error ${r.status}`));
      } catch {
        return Promise.reject(new Error(text || `Error ${r.status}`));
      }
    });
  }
  return r.json();
}

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return decodeURIComponent(parts.pop().split(";").shift());
  return null;
}

// ── Resumen ───────────────────────────────────────────────────
export function getResumen(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return apiFetch(`/ingresos/resumen${qs ? "?" + qs : ""}`).then(json);
}

// ── Ingresos manuales ─────────────────────────────────────────
export function getIngresos(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return apiFetch(`/ingresos/manuales${qs ? "?" + qs : ""}`).then(json);
}

export function crearIngreso(data) {
  return apiFetch("/ingresos/manuales", {
    method: "POST",
    body: JSON.stringify(data),
  }).then(json);
}

export function actualizarIngreso(id, data) {
  return apiFetch(`/ingresos/manuales/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  }).then(json);
}

export function eliminarIngreso(id) {
  return apiFetch(`/ingresos/manuales/${id}`, { method: "DELETE" }).then(json);
}

// ── Egresos ───────────────────────────────────────────────────
export function getEgresos(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return apiFetch(`/egresos${qs ? "?" + qs : ""}`).then(json);
}

// multipart/form-data SIN tocar api.js
function fetchMultipart(url, formData) {
  const xsrf = getCookie("XSRF-TOKEN");

  return fetch(url, {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(xsrf ? { "X-XSRF-TOKEN": xsrf } : {}),
    },
    body: formData,
  }).then(json);
}

export async function crearEgreso(formData) {
  await csrfCookie();
  return fetchMultipart(`${API_BASE_URL}/egresos`, formData);
}

export async function actualizarEgreso(id, formData) {
  await csrfCookie();
  return fetchMultipart(`${API_BASE_URL}/egresos/${id}`, formData);
}

export function eliminarEgreso(id) {
  return apiFetch(`/egresos/${id}`, { method: "DELETE" }).then(json);
}

// ── Pagos recibidos ───────────────────────────────────────────
export function getPagos(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return apiFetch(`/ingresos/pagos${qs ? "?" + qs : ""}`).then(json);
}