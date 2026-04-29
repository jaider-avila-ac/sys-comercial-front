import { apiFetch, API_BASE_URL, csrfCookie } from "../../common/js/api.js";

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

function qs(params = {}) {
  const s = new URLSearchParams(
    Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== "" && v != null)
    )
  ).toString();

  return s ? `?${s}` : "";
}

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return decodeURIComponent(parts.pop().split(";").shift());
  }
  return null;
}

async function fetchMultipart(url, formData) {
  await csrfCookie();

  const token = localStorage.getItem("access_token");
  const xsrf = getCookie("XSRF-TOKEN");

  const headers = {
    Accept: "application/json",
    ...(xsrf ? { "X-XSRF-TOKEN": xsrf } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  return fetch(url, {
    method: "POST",
    credentials: "include",
    headers,
    body: formData,
  }).then(json);
}

export const getResumen = async (params = {}) => {
  const response = await apiFetch(`/dashboard${qs(params)}`);
  const data = await json(response);
  return data.resumen || data;
};

export async function listarPagos({
  search = "",
  formaPago = "",
  fechaDesde = "",
  fechaHasta = "",
} = {}) {
  return apiFetch(`/pagos${qs({
    search,
    forma_pago: formaPago,
    fecha_desde: fechaDesde,
    fecha_hasta: fechaHasta,
  })}`).then(json);
}

export async function facturasPendientes({ search = "" } = {}) {
  return apiFetch(`/facturas${qs({
    search,
    estado: "EMITIDA",
    pendiente: "true",
  })}`).then(json);
}

export async function buscarFacturaPorNumero(numero) {
  const data = await apiFetch(
    `/facturas${qs({ search: numero, estado: "EMITIDA" })}`
  ).then(json);

  const rows = data.data || [];
  return rows.find(f => f.numero?.toLowerCase() === numero.toLowerCase()) ?? null;
}

// ── INGRESOS ────────────────────────────────────────────────
export const getIngresos = (params = {}) =>
  apiFetch(`/ingresos/manuales${qs(params)}`).then(json);

export const crearIngreso = (data) => {
  if (data instanceof FormData) {
    return fetchMultipart(`${API_BASE_URL}/ingresos/manuales`, data);
  }

  return apiFetch("/ingresos/manuales", {
    method: "POST",
    body: JSON.stringify(data),
  }).then(json);
};

export const actualizarIngreso = (id, data) => {
  if (data instanceof FormData) {
    return fetchMultipart(`${API_BASE_URL}/ingresos/manuales/${id}`, data);
  }

  return apiFetch(`/ingresos/manuales/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  }).then(json);
};

export const anularIngreso = (id) =>
  apiFetch(`/ingresos/manuales/${id}/anular`, {
    method: "POST",
  }).then(json);

// ── EGRESOS ────────────────────────────────────────────────
export const getEgresos = (params = {}) =>
  apiFetch(`/egresos/manuales${qs(params)}`).then(json);

export const crearEgreso = (data) => {
  if (data instanceof FormData) {
    return fetchMultipart(`${API_BASE_URL}/egresos/manuales`, data);
  }

  return apiFetch("/egresos/manuales", {
    method: "POST",
    body: JSON.stringify(data),
  }).then(json);
};

export const actualizarEgreso = (id, data) => {
  if (data instanceof FormData) {
    return fetchMultipart(`${API_BASE_URL}/egresos/manuales/${id}`, data);
  }

  return apiFetch(`/egresos/manuales/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  }).then(json);
};

export const anularEgreso = (id) =>
  apiFetch(`/egresos/manuales/${id}/anular`, {
    method: "POST",
  }).then(json);