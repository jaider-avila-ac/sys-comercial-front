import { apiFetch } from "../../common/js/api.js";

// ── Buscar items — usa el endpoint /items que ya existe
export async function buscarItems({ search = "", tipo = "", page = 1 } = {}) {
  const p = new URLSearchParams({ page, per_page: 20 });
  if (search) p.set("search", search);
  if (tipo) p.set("tipo", tipo);
  
  const res = await apiFetch(`/items?${p.toString()}`);
  const data = await res.json();
  
  const items = (data.data || []).map(item => ({
    id: item.id,
    nombre: item.nombre,
    tipo: item.tipo,
    controla_inventario: item.controla_inventario || false,
    cantidad_actual: item.inventario?.unidades_actuales ?? 0,
    precio_venta_sugerido: item.precio_venta_sugerido || 0,
    unidad: item.unidad || "UND"
  }));
  
  return items;
}

// ── Registrar venta rápida (usa ingreso mostrador)
export async function registrarVentaRapida(payload) {
  const data = {
    fecha: new Date().toISOString().split('T')[0],
    descripcion: `Venta rápida: ${payload.item_id}`,
    item_id: payload.item_id,
    cantidad: payload.cantidad,
    precio_unitario: payload.valor_unitario,
    iva_pct: 0,
    forma_pago: payload.forma_pago,
    referencia: payload.referencia || null,
    notas: `Venta rápida de mostrador`
  };
  
  const res = await apiFetch("/ingresos/mostrador", {
    method: "POST",
    body: JSON.stringify(data),
  });
  
  return res;
}

// ── Historial de ventas rápidas del día (usa ingreso mostrador)
export async function getVentasRapidas({ desde, hasta } = {}) {
  const p = new URLSearchParams();
  if (desde) p.set("desde", desde);
  if (hasta) p.set("hasta", hasta);
  
  const res = await apiFetch(`/ingresos/mostrador?${p.toString()}`);
  const data = await res.json();
  
  let items = [];
  if (data.data && Array.isArray(data.data)) {
    items = data.data;
  } else if (Array.isArray(data)) {
    items = data;
  }
  
  const rows = items.map(item => ({
    id: item.id,
    numero_recibo: item.numero,
    total_pagado: item.monto,
    forma_pago: item.forma_pago,
    notas: item.descripcion || item.notas,
    item_nombre: item.item?.nombre || "Producto",
    cantidad: item.cantidad,
    valor_unitario: item.precio_unitario
  }));
  
  return rows;
}