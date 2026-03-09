import { obtenerCotizacion } from "./cotizaciones.service.js";

const qs = new URLSearchParams(location.search);
const id = qs.get("id");

if (!id) {
  document.getElementById("docSheet").innerHTML =
    `<div class="text-danger p-4">No se especificó una cotización.</div>`;
}

// ── helpers ──────────────────────────────────────────────────────────────────
function esc(str) {
  return String(str ?? "").replace(/[&<>"']/g, m =>
    ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[m])
  );
}

function money(n) {
  return Number(n || 0).toLocaleString("es-CO", { style:"currency", currency:"COP" });
}

function fmtDate(iso) {
  if (!iso) return "—";
  // iso puede venir como "2025-03-01" o "2025-03-01T..."
  const [y, m, d] = String(iso).substring(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

const ESTADO_STYLE = {
  BORRADOR:  { bg:"#e9ecef",   color:"#495057" },
  EMITIDA:   { bg:"#d1e7dd",   color:"#0f5132" },
  VENCIDA:   { bg:"#fff3cd",   color:"#664d03" },
  FACTURADA: { bg:"#cfe2ff",   color:"#084298" },
  ANULADA:   { bg:"#f8d7da",   color:"#842029" },
};

// ── Cargar ────────────────────────────────────────────────────────────────────
async function load() {
  try {
    const cot = await obtenerCotizacion(id);

    // ── Botón editar
    document.getElementById("btnEditar").href = `cotizacion-form.html?id=${id}`;

    // ── Empresa (usamos los datos del usuario autenticado si están disponibles,
    //    o los que vengan embebidos en la cotización — aquí usamos cot.empresa si existe)
    const emp = cot.empresa ?? {};
    document.getElementById("empresaNombre").textContent = emp.nombre   ?? "Mi Empresa";
    document.getElementById("empresaNit").textContent    = emp.nit      ? `NIT: ${emp.nit}`       : "";
    document.getElementById("empresaTel").textContent    = emp.telefono ? `Tel: ${emp.telefono}`   : "";
    document.getElementById("empresaEmail").textContent  = emp.email    ?? "";
    document.getElementById("empresaDir").textContent    = emp.direccion ?? "";

    // ── Número y estado
    document.getElementById("docNumero").textContent = cot.numero ?? `#${id}`;

    const eStyle = ESTADO_STYLE[cot.estado] ?? { bg:"#e9ecef", color:"#495057" };
    document.getElementById("docEstadoBadge").innerHTML =
      `<span class="estado-badge" style="background:${eStyle.bg};color:${eStyle.color};">${esc(cot.estado)}</span>`;

    // ── Cliente
    const cli = cot.cliente ?? {};
    document.getElementById("clienteNombre").textContent = cli.nombre_razon_social ?? `Cliente ${cot.cliente_id}`;
    document.getElementById("clienteDoc").textContent    = cli.num_documento
      ? `${cli.tipo_documento ?? "Doc"}: ${cli.num_documento}` : "";
    document.getElementById("clienteEmail").textContent  = cli.email    ?? "";
    document.getElementById("clienteTel").textContent    = cli.telefono ?? "";
    document.getElementById("clienteDir").textContent    = cli.direccion ?? "";

    // ── Fechas
    document.getElementById("docFecha").textContent = fmtDate(cot.fecha);
    document.getElementById("docVence").textContent = fmtDate(cot.fecha_vencimiento);

    // ── Usuario
    const usr = cot.usuario ?? {};
    const usrNombre = usr.nombres
      ? `${usr.nombres} ${usr.apellidos ?? ""}`.trim()
      : "—";
    document.getElementById("docUsuario").textContent = usrNombre;

    // ── Líneas
    const lineas = cot.lineas ?? [];
    if (!lineas.length) {
      document.getElementById("tbodyLineas").innerHTML =
        `<tr><td colspan="7" class="text-muted">Sin líneas.</td></tr>`;
    } else {
      document.getElementById("tbodyLineas").innerHTML = lineas.map((l, i) => {
        const desc = l.descripcion_manual
          ? l.descripcion_manual
          : (l.item?.nombre ?? `Item ${l.item_id ?? ""}`);
        return `
          <tr>
            <td class="text-muted">${i + 1}</td>
            <td>${esc(desc)}</td>
            <td class="text-end">${Number(l.cantidad).toLocaleString("es-CO")}</td>
            <td class="text-end">${money(l.valor_unitario)}</td>
            <td class="text-end text-danger">${l.descuento > 0 ? money(l.descuento) : "—"}</td>
            <td class="text-end">${Number(l.iva_pct ?? 0).toFixed(0)} %</td>
            <td class="text-end fw-semibold">${money(l.total_linea)}</td>
          </tr>`;
      }).join("");
    }

    // ── Totales
    document.getElementById("tSubtotal").textContent = money(cot.subtotal);
    document.getElementById("tDesc").textContent     = cot.total_descuentos > 0
      ? `- ${money(cot.total_descuentos)}` : "—";
    document.getElementById("tIva").textContent      = money(cot.total_iva);
    document.getElementById("tTotal").textContent    = money(cot.total);

    // ── Notas
    if (cot.notas) {
      document.getElementById("docNotas").style.display = "";
      document.getElementById("docNotasTexto").textContent = cot.notas;
    }

    // Título de la pestaña
    document.title = `Cotización ${cot.numero ?? id} · SYS Comercial`;

  } catch (e) {
    document.getElementById("docSheet").innerHTML =
      `<div class="text-danger p-4"><i class="bi bi-exclamation-triangle me-2"></i>${esc(e.message || "Error al cargar la cotización.")}</div>`;
  }
}

load();
