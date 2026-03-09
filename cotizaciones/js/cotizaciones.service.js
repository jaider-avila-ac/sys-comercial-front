import { apiFetch, csrfCookie } from "../../common/js/api.js";

// ─── Clientes autocomplete ───────────────────────────────────────────────────
export async function buscarClientes(search = "") {
  const params = new URLSearchParams({ search, activos: "1", page: "1" });
  const res  = await apiFetch(`/clientes?${params}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Error al buscar clientes");
  return data.data || [];
}

// ─── Items autocomplete ──────────────────────────────────────────────────────
export async function buscarItems(search = "", tipo = "") {
  const params = new URLSearchParams({ search, activos: "1", page: "1" });
  if (tipo) params.set("tipo", tipo);
  const res  = await apiFetch(`/items?${params}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Error al buscar items");
  return data.data || [];
}

// ─── Cotizaciones ────────────────────────────────────────────────────────────
export async function listarCotizaciones({ search = "", estado = "" } = {}) {
  const qs = new URLSearchParams();
  if (search) qs.set("search", search);
  if (estado) qs.set("estado", estado);
  const res  = await apiFetch(`/cotizaciones?${qs}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Error al listar cotizaciones");
  return data;
}

export async function obtenerCotizacion(id) {
  const res  = await apiFetch(`/cotizaciones/${id}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Error al cargar cotización");
  return data.cotizacion;
}

export async function crearCotizacion(payload) {
  await csrfCookie();
  const res  = await apiFetch(`/cotizaciones`, { method: "POST", body: JSON.stringify(payload) });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Error al crear cotización");
  return data.cotizacion;
}

export async function actualizarCotizacion(id, payload) {
  await csrfCookie();
  const res  = await apiFetch(`/cotizaciones/${id}`, { method: "PUT", body: JSON.stringify(payload) });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Error al actualizar cotización");
  return data.cotizacion;
}

export async function eliminarCotizacion(id) {
  await csrfCookie();
  const res  = await apiFetch(`/cotizaciones/${id}`, { method: "DELETE" });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "No se pudo eliminar");
  return data;
}

export async function emitirCotizacion(id) {
  await csrfCookie();
  const res  = await apiFetch(`/cotizaciones/${id}/emitir`, { method: "POST" });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "No se pudo emitir");
  return data.cotizacion;
}

export async function anularCotizacion(id) {
  await csrfCookie();
  const res  = await apiFetch(`/cotizaciones/${id}/anular`, { method: "POST" });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "No se pudo anular");
  return data.cotizacion;
}

export async function confirmarVigencia(id, fecha_vencimiento) {
  await csrfCookie();
  const res  = await apiFetch(`/cotizaciones/${id}/confirmar-vigencia`, {
    method: "POST", body: JSON.stringify({ fecha_vencimiento }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "No se pudo confirmar vigencia");
  return data.cotizacion;
}

export async function convertirAFactura(id) {
  await csrfCookie();

  const res = await apiFetch(`/cotizaciones/${id}/convertir-factura`, {
    method: "POST",
    headers: { "Accept": "application/json" }, // ✅ CLAVE: evita HTML
  });

  // ✅ Lee el body según lo que venga (JSON o HTML)
  const ct = (res.headers.get("content-type") || "").toLowerCase();

  let data;
  if (ct.includes("application/json")) {
    data = await res.json();
  } else {
    const text = await res.text();
    throw new Error(
      `El servidor NO devolvió JSON (status ${res.status}). ` +
      `Inicio respuesta: ${text.slice(0, 120)}`
    );
  }

  if (!res.ok) throw new Error(data?.message || "No se pudo convertir");
  return data;
}