import { bootLayout } from "./common/js/layout.js";
import { apiFetch } from "./common/js/api.js";
import { getUser } from "./common/js/auth.js";

await bootLayout({ title: "Dashboard · SYS Comercial", verify: true });

// ── Helpers ───────────────────────────────────────────────────
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, m =>
    ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[m])
  );
}

function money(n) {
  return Number(n || 0).toLocaleString("es-CO", {
    style: "currency", currency: "COP", maximumFractionDigits: 0
  });
}

function num(v) { 
  const x = Number(v); 
  return Number.isFinite(x) ? x : 0; 
}

function shortNum(n) {
  const v = num(n);
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + "M";
  if (v >= 1_000)     return (v / 1_000).toFixed(0) + "k";
  return String(v);
}

const FORMAS = {
  EFECTIVO: "Efectivo", TRANSFERENCIA: "Transferencia",
  TARJETA: "Tarjeta",   BILLETERA: "Billetera", OTRO: "Otro",
};

// ── Bienvenida ────────────────────────────────────────────────
const user = getUser();
document.getElementById("welcomeName").textContent =
  user?.nombres || user?.name || user?.email || "—";
document.getElementById("welcomeDate").innerHTML =
  new Date().toLocaleDateString("es-CO", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });

// ── Carga principal ───────────────────────────────────────────
async function loadDashboard() {
  try {
    const res = await apiFetch("/dashboard");
    const data = await res.json();
    
    if (!res.ok) throw new Error(data?.message || "Error al cargar dashboard");

    const resumen = data.resumen || {};
    const ultimasFacturas = data.ultimas_facturas || [];
    const ultimosPagos = data.ultimos_pagos || [];

    // ── KPIs usando los datos del resumen ──
    document.getElementById("kClientes").textContent = shortNum(resumen.total_clientes || 0);
    document.getElementById("kItems").textContent = shortNum(resumen.total_items || 0);
    document.getElementById("kCotiz").textContent = shortNum(resumen.cotizaciones_activas || 0);
    document.getElementById("kBorrador").textContent = shortNum(resumen.facturas_borrador || 0);
    document.getElementById("kRecaudado").textContent = money(resumen.total_en_caja || 0);
    document.getElementById("kSaldo").textContent = money(resumen.saldo_pendiente || 0);

    // ── Últimas facturas ──
    const tbF = document.getElementById("tbodyFacturas");
    if (!ultimasFacturas.length) {
      tbF.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-3">Sin facturas aún.</td></tr>';
    } else {
      tbF.innerHTML = ultimasFacturas.map(f => {
        const saldo = num(f.saldo);
        const estadoBadge = f.estado === "EMITIDA" 
          ? '<span class="est-badge est-EMITIDA">EMITIDA</span>'
          : '<span class="est-badge est-BORRADOR">BORRADOR</span>';
        
        return `
          <tr>
            <td>
              <a href="facturas/factura-view.html?id=${f.id}"
                 class="fw-semibold text-decoration-none text-primary">${esc(f.numero)}</a>
            </td>
            <td class="text-truncate" style="max-width:130px">
              ${esc(f.cliente?.nombre_razon_social ?? "—")}
            </td>
            <td>${estadoBadge}</td>
            <td class="text-end">${money(f.total)}</td>
            <td class="text-end ${saldo > 0 ? 'text-danger' : 'text-success'}">
              ${saldo > 0 ? money(saldo) : '<i class="bi bi-check2-circle me-1"></i>Pagada'}
            </td>
          </tr>
        `;
      }).join("");
    }

    // ── Facturas pendientes (saldo > 0) ──
    const facturasPendientes = ultimasFacturas.filter(f => num(f.saldo) > 0);
    const tbP = document.getElementById("tbodyPendientes");
    const footer = document.getElementById("pendientesFooter");
    
    if (!facturasPendientes.length) {
      tbP.innerHTML = `<tr><td colspan="4" class="text-center py-3">
        <span class="text-success fw-semibold">
          <i class="bi bi-check2-circle me-1"></i>¡Todo al día!
        </span>
      </tr>`;
      if (footer) footer.style.display = "none";
    } else {
      let sumSaldo = 0;
      tbP.innerHTML = facturasPendientes.map(f => {
        const saldo = num(f.saldo);
        sumSaldo += saldo;
        return `
          <tr>
            <td>
              <a href="facturas/factura-view.html?id=${f.id}"
                 class="fw-semibold text-decoration-none text-danger">${esc(f.numero)}</a>
            </td>
            <td class="text-truncate" style="max-width:130px">
              ${esc(f.cliente?.nombre_razon_social ?? "—")}
            </td>
            <td class="text-end">${money(f.total)}</td>
            <td class="text-end text-danger fw-semibold">${money(saldo)}</td>
          </tr>
        `;
      }).join("");
      const totalSaldoEl = document.getElementById("totalSaldoPend");
      if (totalSaldoEl) totalSaldoEl.textContent = money(sumSaldo);
      if (footer) footer.style.display = "flex";
    }

    // ── Últimos pagos ──
    const tbPagos = document.getElementById("tbodyPagos");
    if (!ultimosPagos.length) {
      tbPagos.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-3">Sin pagos registrados aún.</td></tr>';
    } else {
      tbPagos.innerHTML = ultimosPagos.map(p => {
        const monto = num(p.monto || 0);
        const cliente = p.cliente_nombre || "—";
        const forma = FORMAS[p.forma_pago] || p.forma_pago || "—";
        const fecha = p.fecha ? String(p.fecha).substring(0, 10) : "—";
        const numero = p.numero || "—";
        
        return `
          <tr>
            <td class="fw-semibold">${esc(numero)}</td>
            <td>${esc(fecha)}</td>
            <td class="text-truncate" style="max-width:160px">${esc(cliente)}</td>
            <td>
              <span class="badge bg-light text-dark border" style="font-size:.7rem">
                ${esc(forma)}
              </span>
            </td>
            <td class="text-end text-success fw-semibold">${money(monto)}</td>
          </tr>
        `;
      }).join("");
    }

  } catch (e) {
    console.error("Dashboard error:", e);
    const errorMsg = `<tr><td colspan="5" class="text-danger py-2 px-3">${esc(e.message)}</td></tr>`;
    const tbodyF = document.getElementById("tbodyFacturas");
    const tbodyPend = document.getElementById("tbodyPendientes");
    const tbodyPagos = document.getElementById("tbodyPagos");
    if (tbodyF) tbodyF.innerHTML = errorMsg;
    if (tbodyPend) tbodyPend.innerHTML = errorMsg;
    if (tbodyPagos) tbodyPagos.innerHTML = errorMsg;
  }
}

loadDashboard();