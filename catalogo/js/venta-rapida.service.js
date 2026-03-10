import { apiFetch } from "../../common/js/api.js";

// ── Buscar items CON stock — usa el endpoint de inventario
//    que ya hace JOIN con inventarios y devuelve cantidad_actual
export function buscarItems({ search = "", tipo = "", page = 1, empresa_id = null } = {}) {
  const p = new URLSearchParams({ page });
  if (search)     p.set("search", search);
  if (tipo)       p.set("tipo", tipo);
  if (empresa_id) p.set("empresa_id", String(empresa_id));
  // /api/inventario devuelve: id, nombre, tipo, controla_inventario,
  // cantidad_actual, stock_minimo, precio_venta_sugerido, unidad
  return apiFetch(`/inventario?${p.toString()}`);
}

// ── Registrar venta rápida
export function registrarVentaRapida(payload) {
  return apiFetch("/ventas-rapidas", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ── Historial de ventas rápidas del día
export function getVentasRapidas({ desde, hasta } = {}) {
  const p = new URLSearchParams();
  if (desde) p.set("desde", desde);
  if (hasta) p.set("hasta", hasta);
  return apiFetch(`/ventas-rapidas?${p.toString()}`);
}