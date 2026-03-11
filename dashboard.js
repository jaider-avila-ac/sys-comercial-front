import { bootLayout } from "./common/js/layout.js";
import { apiFetch }   from "./common/js/api.js";
import { getUser }    from "./common/js/auth.js";

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
function num(v) { const x = Number(v); return Number.isFinite(x) ? x : 0; }
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
    const res  = await apiFetch("/dashboard");
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Error al cargar dashboard");

    const { kpi, ultimas_facturas, facturas_pendientes, ultimos_pagos } = data;

    // KPIs
    document.getElementById("kClientes").textContent  = shortNum(kpi.total_clientes);
    document.getElementById("kItems").textContent     = shortNum(kpi.total_items);
    document.getElementById("kCotiz").textContent     = shortNum(kpi.cotizaciones_activas);
    document.getElementById("kBorrador").textContent  = shortNum(kpi.facturas_borrador);
    document.getElementById("kRecaudado").textContent = money(kpi.total_recaudado);
    document.getElementById("kSaldo").textContent     = money(kpi.saldo_pendiente);

    // Últimas facturas
    const tbF = document.getElementById("tbodyFacturas");
    if (!ultimas_facturas?.length) {
      tbF.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-3">Sin facturas aún.</td></tr>';
    } else {
      tbF.innerHTML = ultimas_facturas.map(f => {
        const saldo = num(f.saldo);
        return `<tr>
          <td>
            <a href="facturas/factura-view.html?id=${f.id}"
               class="fw-semibold text-decoration-none text-primary">${esc(f.numero)}</a>
          </td>
          <td class="text-truncate" style="max-width:130px">
            ${esc(f.cliente?.nombre_razon_social ?? "—")}
          </td>
          <td><span class="est-badge est-${esc(f.estado)}">${esc(f.estado)}</span></td>
          <td class="text-end">${money(f.total)}</td>
          <td class="text-end ${saldo > 0 ? 'saldo-hi' : 'pagado-hi'}">
            ${saldo > 0 ? money(saldo) : '<i class="bi bi-check2-circle me-1"></i>Pagada'}
          </td>
        </tr>`;
      }).join("");
    }

    // Facturas pendientes
    const tbP = document.getElementById("tbodyPendientes");
    const footer = document.getElementById("pendientesFooter");
    if (!facturas_pendientes?.length) {
      tbP.innerHTML = `<tr><td colspan="4" class="text-center py-3">
        <span class="text-success fw-semibold">
          <i class="bi bi-check2-circle me-1"></i>¡Todo al día!
        </span>
      </td></tr>`;
      footer.style.setProperty("display", "none", "important");
    } else {
      let sumSaldo = 0;
      tbP.innerHTML = facturas_pendientes.map(f => {
        const saldo = num(f.saldo);
        sumSaldo += saldo;
        return `<tr>
          <td>
            <a href="facturas/factura-view.html?id=${f.id}"
               class="fw-semibold text-decoration-none text-danger">${esc(f.numero)}</a>
          </td>
          <td class="text-truncate" style="max-width:130px">
            ${esc(f.cliente?.nombre_razon_social ?? "—")}
          </td>
          <td class="text-end">${money(f.total)}</td>
          <td class="text-end saldo-hi">${money(saldo)}</td>
        </tr>`;
      }).join("");
      document.getElementById("totalSaldoPend").textContent = money(sumSaldo);
      footer.style.removeProperty("display");
      footer.style.display = "flex";
    }

    // Últimos pagos
    const tbPagos = document.getElementById("tbodyPagos");
    if (!ultimos_pagos?.length) {
      tbPagos.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-3">Sin pagos registrados aún.</td></tr>';
    } else {
      tbPagos.innerHTML = ultimos_pagos.map(p => {
        const monto = num(p.total_aplicado ?? p.total_pagado);
        return `<tr>
          <td class="fw-semibold">${esc(p.numero_recibo)}</td>
          <td>${esc((p.fecha ?? "").substring(0, 10))}</td>
          <td class="text-truncate" style="max-width:160px">
            ${esc(p.cliente?.nombre_razon_social ?? "—")}
          </td>
          <td>
            <span class="badge bg-light text-dark border" style="font-size:.7rem">
              ${esc(FORMAS[p.forma_pago] ?? p.forma_pago)}
            </span>
          </td>
          <td class="text-end pagado-hi fw-semibold">${money(monto)}</td>
        </tr>`;
      }).join("");
    }

  } catch (e) {
    document.getElementById("tbodyFacturas").innerHTML =
      `<tr><td colspan="5" class="text-danger py-2 px-3">${esc(e.message)}</td></tr>`;
    document.getElementById("tbodyPendientes").innerHTML =
      `<tr><td colspan="4" class="text-danger py-2 px-3">${esc(e.message)}</td></tr>`;
    document.getElementById("tbodyPagos").innerHTML =
      `<tr><td colspan="5" class="text-danger py-2 px-3">${esc(e.message)}</td></tr>`;
  }
}

loadDashboard();
