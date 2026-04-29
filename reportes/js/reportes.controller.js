import { getReporteFinanciero } from "./reportes-service.js";

function money(value) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value || 0);
}

function number(value) {
  return new Intl.NumberFormat("es-CO").format(value || 0);
}

function setStatus(loading, message, isError = false) {
  const dot = document.getElementById("statusDot");
  const text = document.getElementById("statusText");
  
  if (loading) {
    dot.className = "status-dot loading";
    text.textContent = message || "Cargando...";
  } else if (isError) {
    dot.className = "status-dot error";
    text.textContent = message || "Error";
  } else {
    dot.className = "status-dot ok";
    text.textContent = message || "Listo";
  }
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = value;
}

async function loadReport() {
  const desde = document.getElementById("desde")?.value;
  const hasta = document.getElementById("hasta")?.value;

  if (!desde || !hasta) {
    setStatus(false, "Seleccione fecha desde y hasta", true);
    return;
  }

  setStatus(true, "Consultando datos...");

  try {
    const data = await getReporteFinanciero({ desde, hasta });

    if (!data) {
      throw new Error("No se recibieron datos");
    }

    // KPIs principales
    setText("totalFacturado", money(data.total_facturado));
    setText("totalCobrado", money(data.total_cobrado));
    setText("saldoPendiente", money(data.saldo_pendiente));
    setText("totalEgresos", money(data.total_egresos));
    setText("balanceReal", money(data.balance_real));
    
    // Desglose egresos
    setText("egresosCompras", money(data.egresos_compras));
    setText("egresosManuales", money(data.egresos_manuales));
    setText("comprasContado", money(data.compras_contado || 0));
    setText("creditoPendiente", money(data.credito_pendiente || 0));

    // Contador de facturas
    const facturasCount = data.facturas?.length || 0;
    const badge = document.getElementById("facturasCount");
    if (badge) badge.textContent = `${number(facturasCount)} factura${facturasCount !== 1 ? 's' : ''}`;

    // Tabla de facturas
    const tbody = document.getElementById("tbodyFacturas");
    
    if (!data.facturas || data.facturas.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-5">
        <i class="bi bi-inbox fs-4 d-block mb-2"></i>
        No hay facturas en el período seleccionado
      </td></tr>`;
      setText("footIva", money(0));
      setText("footTotal", money(0));
      setText("footPagado", money(0));
      setText("footSaldo", money(0));
      setStatus(false, `${facturasCount} facturas encontradas`);
      return;
    }

    let totalIva = 0;
    let totalGeneral = 0;
    let totalPagadoGeneral = 0;
    let totalSaldoGeneral = 0;

    tbody.innerHTML = data.facturas.map(f => {
      totalIva += f.iva || 0;
      totalGeneral += f.total || 0;
      totalPagadoGeneral += f.pagado || 0;
      totalSaldoGeneral += f.saldo || 0;
      
      const saldoClass = (f.saldo || 0) > 0 ? 'text-red' : '';
      
      return `
        <tr>
          <td><span class="fw-semibold">${f.numero || "—"}</span></td>
          <td>${f.fecha || "—"}</td>
          <td>${f.cliente || "—"}</td>
          <td class="text-end">${money(f.subtotal || 0)}</td>
          <td class="text-end">${money(f.iva || 0)}</td>
          <td class="text-end fw-semibold">${money(f.total || 0)}</td>
          <td class="text-end text-green">${money(f.pagado || 0)}</td>
          <td class="text-end ${saldoClass}">${money(f.saldo || 0)}</td>
        </tr>
      `;
    }).join("");

    setText("footIva", money(totalIva));
    setText("footTotal", money(totalGeneral));
    setText("footPagado", money(totalPagadoGeneral));
    setText("footSaldo", money(totalSaldoGeneral));

    setStatus(false, `${facturasCount} factura${facturasCount !== 1 ? 's' : ''} encontradas`);

  } catch (err) {
    console.error("Error:", err);
    setStatus(false, `Error: ${err.message}`, true);
    const tbody = document.getElementById("tbodyFacturas");
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger py-5">
        <i class="bi bi-exclamation-triangle-fill fs-4 d-block mb-2"></i>
        ${err.message || "Error al cargar los datos"}
      </td></tr>`;
    }
  }
}

function initDates() {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  
  const desde = document.getElementById("desde");
  const hasta = document.getElementById("hasta");
  
  if (desde && !desde.value) {
    desde.value = firstDay.toISOString().split("T")[0];
  }
  if (hasta && !hasta.value) {
    hasta.value = lastDay.toISOString().split("T")[0];
  }
}

function bindEvents() {
  const btnGenerar = document.getElementById("btnGenerar");
  const btnRefresh = document.getElementById("btnRefresh");
  
  if (btnGenerar) btnGenerar.addEventListener("click", loadReport);
  if (btnRefresh) btnRefresh.addEventListener("click", loadReport);
}

(function init() {
  initDates();
  bindEvents();
  loadReport();
})();