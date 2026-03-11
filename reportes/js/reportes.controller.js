import {
  getVentasResumen,
  getRecaudosResumen,
  getSaldoAlCierre,
  getVentasLineas,
  getFlujoMensual
} from "./reportes-service.js";

function money(n) {
  return Number(n || 0).toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function num(n) {
  return Number(n || 0).toLocaleString("es-CO");
}

function pct(a, b) {
  return (!b || b === 0) ? 0 : Math.min(100, Math.round((a / b) * 100));
}

function fmtDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = String(iso).substring(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function fmtPeriod(iso) {
  if (!iso || iso.length < 7) return iso;
  const [y, m] = iso.split("-");
  const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  return `${meses[parseInt(m, 10) - 1] || m} ${y}`;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function setStatus(text, state = "idle") {
  const dot = document.getElementById("statusDot");
  const msg = document.getElementById("msg");
  if (dot) dot.className = `status-dot${state !== "idle" ? " " + state : ""}`;
  if (msg) msg.textContent = text || "";
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function monthStartISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function monthEndISO() {
  const last = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
}

function contains(hay, needle) {
  return String(hay || "").toLowerCase().includes(String(needle || "").toLowerCase());
}

function bootTabs() {
  const container = document.getElementById("tabsReportes");
  if (!container) return;

  container.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-tab]");
    if (!btn) return;

    container.querySelectorAll(".report-tab").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    const tab = btn.dataset.tab;
    ["resumen", "lineas", "mensual"].forEach((t) => {
      const el = document.getElementById(`tab-${t}`);
      if (el) el.style.display = t === tab ? "" : "none";
    });
  });
}

const state = {
  page: 1,
  lineasRaw: [],
  lineasMeta: null,
  filtroLineas: ""
};

const DASH = "—";

function skeletonKPIs() {
  [
    "kFacturado", "kAplicado", "kSaldoCierre", "kDiferencia",
    "rFacturas", "rSubtotal", "rIva", "rTotalFacturado",
    "pFacturas", "pMostrador", "pIngresosManualesSolo", "pTotalCaja",
    "pPagosCaja", "pAplicadoCaja", "pMostradorCaja", "pIngresosManuales", "pEgresos", "pBalanceReal",
    "cTotalFacturado", "cPagadoActual", "cSaldoActual", "cSaldoCierre"
  ].forEach((id) => setText(id, DASH));
}

function skeletonTables() {
  const empty = (cols, msg = "Cargando…") =>
    `<tr><td colspan="${cols}"><div class="empty-state"><i class="bi bi-hourglass"></i><span>${msg}</span></div></td></tr>`;

  const tL = document.getElementById("tbodyLineas");
  if (tL) tL.innerHTML = empty(8);

  setText("footLineasTotal", DASH);
  setText("lineasPagerInfo", DASH);

  const tM = document.getElementById("tbodyMensual");
  if (tM) tM.innerHTML = empty(10);

  [
    "mTotFacturado",
    "mTotFacturas",
    "mTotMostrador",
    "mTotAplicado",
    "mTotDiff",
    "mTotIngManuales",
    "mTotEgresos",
    "mTotBalanceCaja"
  ].forEach((id) => setText(id, DASH));
}

function renderLineas() {
  const tbody = document.getElementById("tbodyLineas");
  if (!tbody) return;

  const f = state.filtroLineas.trim();
  const rows = f
    ? state.lineasRaw.filter((r) =>
      contains(r.factura_numero, f) ||
      contains(r.item_nombre, f) ||
      contains(r.descripcion_manual, f) ||
      contains(r.item_id, f)
    )
    : state.lineasRaw;

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><i class="bi bi-inbox"></i><span>Sin registros para el período seleccionado.</span></div></td></tr>`;
    setText("footLineasTotal", money(0));
    return;
  }

  let total = 0;

  tbody.innerHTML = rows.map((r) => {
    const t = Number(r.total_linea || 0);
    total += t;

    const itemNombre = r.item_nombre
      ? r.item_nombre
      : `<span class="text-muted fst-italic small">(descripción manual)</span>`;

    return `<tr>
      <td>
        <div class="label-inv">${r.factura_numero ?? DASH}</div>
        <div class="date-sub">${fmtDate(r.factura_fecha)}</div>
      </td>
      <td><span class="mono">${r.item_id ?? ""}</span></td>
      <td>${itemNombre}</td>
      <td class="text-muted" style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.8rem">${r.descripcion_manual ?? ""}</td>
      <td class="text-num">${num(r.cantidad)}</td>
      <td class="text-num">${money(r.valor_unitario)}</td>
      <td class="text-num">
        <div>${money(r.iva_valor)}</div>
        <div class="text-muted" style="font-size:.68rem">${num(r.iva_pct)}%</div>
      </td>
      <td class="text-num fw-semibold">${money(r.total_linea)}</td>
    </tr>`;
  }).join("");

  setText("footLineasTotal", money(total));

  if (state.lineasMeta) {
    const m = state.lineasMeta;
    setText("lineasPagerInfo", `Página ${m.current_page} de ${m.last_page} · ${num(m.total)} registros`);
  }
}

function renderMensual(data = []) {
  const tbody = document.getElementById("tbodyMensual");
  if (!tbody) return;

  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="10"><div class="empty-state"><i class="bi bi-inbox"></i><span>Sin registros para el período seleccionado.</span></div></td></tr>`;
    [
      "mTotFacturado",
      "mTotFacturas",
      "mTotMostrador",
      "mTotAplicado",
      "mTotDiff",
      "mTotIngManuales",
      "mTotEgresos",
      "mTotBalanceCaja"
    ].forEach((id) => setText(id, money(0)));
    return;
  }

  const maxFac = Math.max(...data.map((r) => Number(r.facturado || 0)), 1);

  let tf = 0;
  let tif = 0;
  let timo = 0;
  let ttc = 0;
  let td = 0;
  let tim = 0;
  let teg = 0;
  let tbc = 0;

  tbody.innerHTML = data.map((r) => {
    const f = Number(r.facturado || 0);
    const ifa = Number(r.ingresos_facturas || 0);
    const imo = Number(r.ingresos_mostrador || 0);
    const tc = Number(r.total_en_caja || 0);
    const d = Number(r.diferencia || 0);
    const im = Number(r.ingresos_manuales || 0);
    const eg = Number(r.egresos || 0);
    const bc = Number(r.balance_caja || 0);

    tf += f;
    tif += ifa;
    timo += imo;
    ttc += tc;
    td += d;
    tim += im;
    teg += eg;
    tbc += bc;

    const cobertura = pct(tc, f);
    const barColor = cobertura >= 100
      ? "var(--green)"
      : cobertura >= 60
        ? "var(--amber)"
        : "var(--red)";

    const diffClass = d > 0 ? "text-debit" : d < 0 ? "text-credit" : "";
    const bcClass = bc >= 0 ? "text-credit" : "text-debit";

    return `<tr>
      <td>
        <div class="period-name">${fmtPeriod(r.periodo)}</div>
        <div class="period-bar"><div class="period-bar-fill" style="width:${pct(f, maxFac)}%"></div></div>
      </td>
      <td class="text-num fw-semibold">${money(f)}</td>
      <td class="text-num text-credit">${money(ifa)}</td>
      <td class="text-num">${money(imo)}</td>
      <td class="text-num fw-semibold text-credit">${money(tc)}</td>
      <td class="text-num fw-semibold ${diffClass}">${money(d)}</td>
      <td class="text-num text-credit">${money(im)}</td>
      <td class="text-num text-debit">${money(eg)}</td>
      <td class="text-num fw-semibold ${bcClass}">${money(bc)}</td>
      <td>
        <div class="d-flex align-items-center gap-2">
          <div style="flex:1;background:#e9ecef;border-radius:2px;height:6px;overflow:hidden">
            <div style="width:${cobertura}%;height:100%;background:${barColor};border-radius:2px"></div>
          </div>
          <span class="text-muted" style="font-size:.68rem;min-width:30px;text-align:right">${cobertura}%</span>
        </div>
      </td>
    </tr>`;
  }).join("");

  setText("mTotFacturado", money(tf));
  setText("mTotFacturas", money(tif));
  setText("mTotMostrador", money(timo));
  setText("mTotAplicado", money(ttc));
  setText("mTotDiff", money(td));
  setText("mTotIngManuales", money(tim));
  setText("mTotEgresos", money(teg));
  setText("mTotBalanceCaja", money(tbc));
}

async function loadKPIs() {
  const desde = document.getElementById("desde").value;
  const hasta = document.getElementById("hasta").value;
  const cierre = document.getElementById("cierre").value;

  setStatus("Consultando datos del período…", "loading");

  try {
    const [ventas, recaudos, cierreRow] = await Promise.all([
      getVentasResumen({ desde, hasta }),
      getRecaudosResumen({ desde, hasta }),
      getSaldoAlCierre({ desde, hasta, cierre }),
    ]);

    const facturado = Number(ventas.total_facturado || 0);
    const ingresosFacturas = Number(recaudos.ingresos_facturas || 0);
    const ingresosMostrador = Number(recaudos.ingresos_mostrador || 0);
    const ingresosManuales = Number(recaudos.ingresos_manuales || 0);
    const totalEnCaja = Number(recaudos.total_en_caja || 0);

    // Facturación
    setText("rFacturas", `${num(ventas.facturas)} facturas`);
    setText("rSubtotal", money(ventas.subtotal));
    setText("rIva", money(ventas.total_iva));
    setText("rTotalFacturado", money(ventas.total_facturado));

    // Cartera
    setText("cTotalFacturado", money(ventas.total_facturado));
    setText("cPagadoActual", money(ventas.total_pagado_actual));
    setText("cSaldoActual", money(ventas.saldo_actual));
    setText("cSaldoCierre", money(cierreRow.saldo_al_cierre));
    setText("cCierreDate", fmtDate(cierre));

    // Recaudos e ingresos
    setText("pFacturas", money(ingresosFacturas));
    setText("pMostrador", money(ingresosMostrador));
    setText("pIngresosManualesSolo", money(ingresosManuales));
    setText("pTotalCaja", money(totalEnCaja));

    // Balance real de caja
    setText("pPagosCaja", `${num((recaudos.pagos_facturas || 0) + (recaudos.pagos_mostrador || 0))} pagos`);
    setText("pAplicadoCaja", money(ingresosFacturas));
    setText("pMostradorCaja", money(ingresosMostrador));
    setText("pIngresosManuales", money(ingresosManuales));
    setText("pEgresos", money(recaudos.total_egresos));
    setText("pBalanceReal", money(recaudos.balance_real));

    // KPIs superiores
    setText("kFacturado", money(facturado));

    setText("kAplicado", money(totalEnCaja));
    setText("kAplicadoFacturas", money(ingresosFacturas));   // ← agregar
    setText("kAplicadoMostrador", money(ingresosMostrador));
    setText("kSaldoCierre", money(cierreRow.saldo_al_cierre));
    setText("kDiferencia", money(facturado - totalEnCaja));
    setText("periodBadge", `${fmtDate(desde)} — ${fmtDate(hasta)}`);
    setText("kCierreDate", fmtDate(cierre));

    setStatus(
      `Reporte generado · ${num(ventas.facturas)} facturas emitidas entre ${fmtDate(desde)} y ${fmtDate(hasta)}.`,
      "ok"
    );
  } catch (err) {
    setStatus(err?.message || "Error al cargar el reporte.", "error");
  }
}

async function loadLineas(page = 1) {
  const desde = document.getElementById("desde").value;
  const hasta = document.getElementById("hasta").value;

  try {
    const pageSize = Number(document.getElementById("lineasPageSize")?.value || 100);
    const res = await getVentasLineas({ desde, hasta, page, per_page: pageSize });

    state.lineasRaw = Array.isArray(res.data) ? res.data : [];
    state.lineasMeta = {
      current_page: res.current_page ?? page,
      last_page: res.last_page ?? 1,
      total: res.total ?? state.lineasRaw.length,
    };
    state.page = state.lineasMeta.current_page;

    renderLineas();
  } catch (err) {
    const tbody = document.getElementById("tbodyLineas");
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><i class="bi bi-exclamation-circle text-danger"></i><span>${err?.message || "Error cargando líneas"}</span></div></td></tr>`;
    }
    setText("footLineasTotal", DASH);
    setText("lineasPagerInfo", DASH);
  }
}

async function loadMensual() {
  const desde = document.getElementById("desde").value;
  const hasta = document.getElementById("hasta").value;

  try {
    const res = await getFlujoMensual({ desde, hasta });
    renderMensual(res.data || []);
  } catch (err) {
    const tbody = document.getElementById("tbodyMensual");
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="10"><div class="empty-state"><i class="bi bi-exclamation-circle text-danger"></i><span>${err?.message || "Error cargando mensual"}</span></div></td></tr>`;
    }
    [
      "mTotFacturado",
      "mTotFacturas",
      "mTotMostrador",
      "mTotAplicado",
      "mTotDiff",
      "mTotIngManuales",
      "mTotEgresos",
      "mTotBalanceCaja"
    ].forEach((id) => setText(id, DASH));
  }
}

function bootEvents() {
  async function runAll() {
    skeletonKPIs();
    skeletonTables();
    await loadKPIs();
    await loadLineas(1);
    await loadMensual();
  }

  document.getElementById("btnAplicar")?.addEventListener("click", runAll);

  document.getElementById("btnRefrescar")?.addEventListener("click", async () => {
    skeletonKPIs();
    skeletonTables();
    await loadKPIs();
    await loadLineas(state.page || 1);
    await loadMensual();
  });

  document.getElementById("btnLineasRefresh")?.addEventListener("click", () => loadLineas(state.page || 1));

  document.getElementById("lineasPageSize")?.addEventListener("change", () => loadLineas(1));

  document.getElementById("lineasSearch")?.addEventListener("input", (e) => {
    state.filtroLineas = e.target.value || "";
    renderLineas();
  });

  document.getElementById("btnPrev")?.addEventListener("click", () => {
    const cur = state.lineasMeta?.current_page ?? 1;
    if (cur > 1) loadLineas(cur - 1);
  });

  document.getElementById("btnNext")?.addEventListener("click", () => {
    const cur = state.lineasMeta?.current_page ?? 1;
    const last = state.lineasMeta?.last_page ?? 1;
    if (cur < last) loadLineas(cur + 1);
  });
}

(function init() {
  bootTabs();
  bootEvents();

  const dDesde = document.getElementById("desde");
  const dHasta = document.getElementById("hasta");
  const dCierre = document.getElementById("cierre");

  if (dDesde && !dDesde.value) {
    dDesde.value = monthStartISO();
  }

  if (dHasta && !dHasta.value) {
    dHasta.value = monthEndISO();
  }

  if (dCierre && !dCierre.value) {
    dCierre.value = dHasta?.value || todayISO();
  }

  skeletonKPIs();
  skeletonTables();

  loadKPIs();
  loadLineas(1);
  loadMensual();
})();