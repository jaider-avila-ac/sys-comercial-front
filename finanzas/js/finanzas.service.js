import { apiFetch, API_BASE_URL, csrfCookie } from "../../common/js/api.js";

// ── helper interno ────────────────────────────────────────────
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
    Object.fromEntries(Object.entries(params).filter(([, v]) => v !== "" && v != null))
  ).toString();
  return s ? `?${s}` : "";
}

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return decodeURIComponent(parts.pop().split(";").shift());
  return null;
}

async function fetchMultipart(url, formData) {
  await csrfCookie();
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

// ── Resumen KPIs ──────────────────────────────────────────────
// Devuelve: ingresos_facturas, ingresos_mostrador, ingresos_manuales,
//           total_en_caja, total_ingresos, total_egresos, balance_real
export const getResumen = (params = {}) =>
  apiFetch(`/ingresos/resumen${qs(params)}`).then(json);

// ── Historial de pagos (con aplicaciones.factura) ─────────────
// Usa PagoController::index → GET /pagos
export async function listarPagos({
  search = "", formaPago = "", fechaDesde = "", fechaHasta = ""
} = {}) {
  return apiFetch(`/pagos${qs({
    search,
    forma_pago: formaPago,
    fecha_desde: fechaDesde,
    fecha_hasta: fechaHasta,
  })}`).then(json);
}

// ── Facturas pendientes ───────────────────────────────────────
export async function facturasPendientes({ search = "" } = {}) {
  return apiFetch(`/pagos/facturas-pendientes${qs({ search })}`).then(json);
}

// ── Buscar factura por número exacto ──────────────────────────
export async function buscarFacturaPorNumero(numero) {
  const data = await apiFetch(
    `/facturas${qs({ search: numero, estado: "EMITIDA" })}`
  ).then(json);
  const rows = data.data || [];
  return rows.find(f => f.numero?.toLowerCase() === numero.toLowerCase()) ?? null;
}

// ── Ingresos manuales ─────────────────────────────────────────
export const getIngresos       = (params = {}) => apiFetch(`/ingresos/manuales${qs(params)}`).then(json);
export const crearIngreso      = (data)        => apiFetch("/ingresos/manuales", { method: "POST", body: JSON.stringify(data) }).then(json);
export const actualizarIngreso = (id, data)    => apiFetch(`/ingresos/manuales/${id}`, { method: "PUT", body: JSON.stringify(data) }).then(json);
export const eliminarIngreso   = (id)          => apiFetch(`/ingresos/manuales/${id}`, { method: "DELETE" }).then(json);

// ── Egresos ───────────────────────────────────────────────────
export const getEgresos        = (params = {}) => apiFetch(`/egresos${qs(params)}`).then(json);
export const crearEgreso       = (fd)          => fetchMultipart(`${API_BASE_URL}/egresos`, fd);
export const actualizarEgreso  = (id, fd)      => fetchMultipart(`${API_BASE_URL}/egresos/${id}`, fd);
export const eliminarEgreso    = (id)          => apiFetch(`/egresos/${id}`, { method: "DELETE" }).then(json);