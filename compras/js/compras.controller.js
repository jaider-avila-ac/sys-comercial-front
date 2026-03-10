import {
  listarCompras,
  obtenerCompra,
  confirmarCompra,
  anularCompra,
  registrarPagoCompra,
  cuentasPorPagar,
} from "./compras.service.js";
import { showToast, showConfirm } from "../../common/js/ui.utils.js";

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (m) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m])
  );
}

function money(n) {
  return Number(n || 0).toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
  });
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtDate(iso) {
  if (!iso) return "—";
  return String(iso).substring(0, 10);
}

function diasBadge(fechaStr) {
  if (!fechaStr) return "—";

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const f = new Date(fechaStr);
  f.setHours(0, 0, 0, 0);

  const dias = Math.ceil((f - hoy) / 86400000);

  if (dias < 0) return `<span class="badge bg-danger">Vencida hace ${Math.abs(dias)}d</span>`;
  if (dias === 0) return `<span class="badge bg-warning text-dark">Vence hoy</span>`;
  if (dias <= 5) return `<span class="badge bg-warning text-dark">${dias}d restantes</span>`;
  return `<span class="badge bg-light text-dark border">${dias}d</span>`;
}

function detalleCompraHtml(c) {
  const det = c?.detalle_item;
  if (!det) return `<span class="text-muted small">Sin detalle</span>`;

  const unidad = det.unidad ? ` ${esc(det.unidad)}` : "";

  return `
    <div class="small fw-semibold">${esc(det.nombre || "—")}</div>
    <div class="small text-muted">
      ${esc(det.cantidad)}${unidad} × ${money(det.precio_unitario)} = ${money(det.subtotal)}
    </div>
  `;
}

function condicionHtml(c) {
  if (c.condicion_pago === "CREDITO") {
    return `<span class="badge bg-warning text-dark">Crédito</span>`;
  }
  return `<span class="badge bg-light text-dark border">Contado</span>`;
}

function el(id) {
  return document.getElementById(id);
}

function on(id, ev, fn) {
  const node = el(id);
  if (node) node.addEventListener(ev, fn);
}

function setText(id, text) {
  const node = el(id);
  if (node) node.textContent = text;
}

function setHTML(id, html) {
  const node = el(id);
  if (node) node.innerHTML = html;
}

let currentPage = 1;
let lastPage = 1;
let compraActual = null;
let bsDetalle = null;
let bsPago = null;

function getPagoSaldoMax() {
  return Number(el("pagoSaldoMax")?.value || 0);
}

function validarMontoPago() {
  const input = el("pagoMonto");
  const msg = el("pagoMsg");
  const btn = el("btnPagoOk");
  const saldoMax = getPagoSaldoMax();

  if (!input || !msg || !btn) return true;

  const valorRaw = input.value.trim();
  const monto = Number(valorRaw);

  input.classList.remove("is-invalid");
  msg.textContent = "";

  if (valorRaw === "") {
    btn.disabled = false;
    return false;
  }

  if (!Number.isFinite(monto) || monto <= 0) {
    input.classList.add("is-invalid");
    msg.textContent = "Monto inválido.";
    btn.disabled = true;
    return false;
  }

  if (saldoMax > 0 && monto > saldoMax) {
    input.classList.add("is-invalid");
    msg.textContent = `El monto no puede ser mayor al saldo pendiente (${money(saldoMax)}).`;
    btn.disabled = true;
    return false;
  }

  btn.disabled = false;
  return true;
}

function init() {
  on("pagoArchivo", "change", () => {
    const f = el("pagoArchivo")?.files?.[0];
    setText("pagoArchivoNombre", f?.name || "Sin archivo");
  });

  on("pagoMonto", "input", validarMontoPago);
  on("pagoMonto", "change", validarMontoPago);

  const modalDetalleEl = el("modalDetalle");
  const modalPagoEl = el("modalPago");

  if (modalDetalleEl) bsDetalle = new bootstrap.Modal(modalDetalleEl);
  if (modalPagoEl) bsPago = new bootstrap.Modal(modalPagoEl);

  document.querySelectorAll("[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-tab]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      const tab = btn.dataset.tab;
      const pH = el("panelHistorial");
      const pC = el("panelCuentas");

      if (pH) pH.classList.toggle("d-none", tab !== "historial");
      if (pC) pC.classList.toggle("d-none", tab !== "cuentas");

      if (tab === "cuentas") loadCuentas();
    });
  });

  on("filtroEstado", "change", () => loadHistorial(1));
  on("filtroDesde", "change", () => loadHistorial(1));
  on("filtroHasta", "change", () => loadHistorial(1));
  on("filtroPend", "change", () => loadHistorial(1));
  on("btnRefrescar", "click", () => loadHistorial(currentPage));
  on("btnPrev", "click", () => loadHistorial(Math.max(1, currentPage - 1)));
  on("btnNext", "click", () => loadHistorial(Math.min(lastPage, currentPage + 1)));

  const tbodyH = el("tbodyHistorial");
  if (tbodyH) {
    tbodyH.addEventListener("click", async (e) => {
      const btnVer = e.target.closest(".btn-ver, .btn-toggle");
      if (btnVer) {
        const row = btnVer.closest("[data-id]");
        if (row) abrirDetalle(row.dataset.id);
        return;
      }

      const btnConf = e.target.closest(".btn-confirmar");
      if (btnConf) {
        const { id, numero } = btnConf.dataset;
        const ok = await showConfirm(
          `¿Confirmar compra <strong>${numero}</strong>?<br>
           <span class="text-muted small">Se moverá el inventario y se registrará el egreso de caja.</span>`,
          { title: "Confirmar compra", okLabel: "Sí, confirmar", okVariant: "btn-success" }
        );
        if (!ok) return;

        btnConf.disabled = true;
        try {
          await confirmarCompra(id);
          showToast(`Compra ${numero} confirmada.`, "success");
          loadHistorial(currentPage);
        } catch (er) {
          showToast(er.message || "No se pudo confirmar.", "danger");
          btnConf.disabled = false;
        }
        return;
      }

      const btnAnul = e.target.closest(".btn-anular");
      if (btnAnul) {
        const { id, numero } = btnAnul.dataset;
        const ok = await showConfirm(
          `¿Anular la compra <strong>${numero}</strong>? Se revertirá el inventario y el egreso.`,
          { title: "Anular compra", okLabel: "Sí, anular", okVariant: "btn-danger" }
        );
        if (!ok) return;

        btnAnul.disabled = true;
        try {
          await anularCompra(id);
          showToast(`Compra ${numero} anulada.`, "warning");
          loadHistorial(currentPage);
        } catch (er) {
          showToast(er.message || "No se pudo anular.", "danger");
          btnAnul.disabled = false;
        }
        return;
      }

      const btnPag = e.target.closest(".btn-pagar");
      if (btnPag) {
        abrirPago(btnPag.dataset.id, Number(btnPag.dataset.saldo));
      }
    });
  }

  on("btnDetalleConfirmar", "click", async () => {
    if (!compraActual) return;

    const ok = await showConfirm(
      `¿Confirmar <strong>${compraActual.numero}</strong>?<br>
       <span class="text-muted small">Se registrará el egreso y se moverá el inventario.</span>`,
      { title: "Confirmar compra", okLabel: "Sí, confirmar", okVariant: "btn-success" }
    );
    if (!ok) return;

    try {
      await confirmarCompra(compraActual.id);
      showToast("Compra confirmada.", "success");
      bsDetalle?.hide();
      loadHistorial(currentPage);
    } catch (er) {
      setText("detalleMsg", er.message || "Error.");
    }
  });

  on("btnDetalleAnular", "click", async () => {
    if (!compraActual) return;

    const ok = await showConfirm(
      `¿Anular <strong>${compraActual.numero}</strong>? Se revertirá el inventario y el egreso.`,
      { title: "Anular compra", okLabel: "Sí, anular", okVariant: "btn-danger" }
    );
    if (!ok) return;

    try {
      await anularCompra(compraActual.id);
      showToast("Compra anulada.", "warning");
      bsDetalle?.hide();
      loadHistorial(currentPage);
    } catch (er) {
      setText("detalleMsg", er.message || "Error.");
    }
  });

  on("btnDetallePagar", "click", () => {
    if (!compraActual) return;
    bsDetalle?.hide();
    abrirPago(compraActual.id, Number(compraActual.saldo_pendiente));
  });

  on("btnPagoOk", "click", async () => {
    setText("pagoMsg", "");

    const id = el("pagoCompraId")?.value;
    const fecha = el("pagoFecha")?.value;
    const monto = Number(el("pagoMonto")?.value);
    const medio = el("pagoMedio")?.value;
    const notas = el("pagoNotas")?.value.trim() || "";
    const archivo = el("pagoArchivo")?.files?.[0] || null;
    const saldoMax = getPagoSaldoMax();

    if (!fecha) {
      setText("pagoMsg", "Fecha requerida.");
      return;
    }

    if (monto <= 0 || !Number.isFinite(monto)) {
      setText("pagoMsg", "Monto inválido.");
      return;
    }

    if (saldoMax > 0 && monto > saldoMax) {
      const input = el("pagoMonto");
      if (input) input.classList.add("is-invalid");
      setText("pagoMsg", `El monto no puede ser mayor al saldo pendiente (${money(saldoMax)}).`);
      return;
    }

    if (!validarMontoPago()) return;

    const fd = new FormData();
    fd.append("fecha", fecha);
    fd.append("monto", String(monto));
    fd.append("medio_pago", medio || "");
    fd.append("notas", notas);
    if (archivo) fd.append("archivo", archivo);

    const btn = el("btnPagoOk");
    if (btn) btn.disabled = true;

    try {
      const r = await registrarPagoCompra(id, fd);
      showToast(`Pago registrado. Saldo: ${money(r.saldo_pendiente)}`, "success");
      bsPago?.hide();
      loadHistorial(currentPage);

      const pC = el("panelCuentas");
      if (pC && !pC.classList.contains("d-none")) loadCuentas();
    } catch (er) {
      setText("pagoMsg", er.message || "Error.");
    } finally {
      if (btn) btn.disabled = false;
    }
  });

  const tbodyC = el("tbodyCuentas");
  if (tbodyC) {
    tbodyC.addEventListener("click", (e) => {
      const btnPagC = e.target.closest(".btn-pagar-cuenta");
      if (btnPagC) {
        abrirPago(btnPagC.dataset.id, Number(btnPagC.dataset.saldo));
        return;
      }

      const btnVerC = e.target.closest(".btn-ver-cuenta");
      if (btnVerC) {
        el("tabBtnHistorial")?.click();
        setTimeout(() => abrirDetalle(btnVerC.dataset.id), 120);
      }
    });
  }

  loadHistorial(1);
}

async function loadHistorial(page = 1) {
  currentPage = page;
  setHTML("tbodyHistorial", `<tr><td colspan="8" class="text-muted p-3">Cargando…</td></tr>`);

  try {
    const data = await listarCompras({
      estado: el("filtroEstado")?.value || "",
      desde: el("filtroDesde")?.value || "",
      hasta: el("filtroHasta")?.value || "",
      pendientes: el("filtroPend")?.checked ? "1" : "0",
      page,
    });

    lastPage = data.last_page || 1;
    const rows = data.data || [];

    if (!rows.length) {
      setHTML("tbodyHistorial", `<tr><td colspan="8" class="text-muted p-3">Sin resultados.</td></tr>`);
      setText("pageInfo", "0 registros");
      updateBadge([]);
      return;
    }

    const html = rows.map((c) => {
      const saldo = Number(c.saldo_pendiente || 0);

      return `
        <tr data-id="${c.id}">
          <td>
            <button class="btn btn-sm btn-link p-0 text-muted btn-toggle" title="Ver detalle">
              <i class="bi bi-eye"></i>
            </button>
          </td>
          <td class="fw-semibold small">${esc(c.numero)}</td>
          <td>${detalleCompraHtml(c)}</td>
          <td class="text-nowrap small">${fmtDate(c.fecha)}</td>
          <td class="text-end small">${money(c.total)}</td>
          <td class="text-end fw-semibold small ${saldo > 0 ? "text-danger" : "text-success"}">${money(saldo)}</td>
          <td class="small text-nowrap text-muted">${condicionHtml(c)}</td>
          <td class="text-end text-nowrap">
            ${c.estado === "BORRADOR" ? `
              <button class="btn btn-sm btn-outline-success btn-confirmar"
                      data-id="${c.id}" data-numero="${esc(c.numero)}" title="Confirmar">
                <i class="bi bi-check2-circle"></i>
              </button>
              <button class="btn btn-sm btn-outline-danger ms-1 btn-anular"
                      data-id="${c.id}" data-numero="${esc(c.numero)}" title="Anular">
                <i class="bi bi-x-circle"></i>
              </button>` : ""}

            ${c.estado === "CONFIRMADA" && saldo > 0 ? `
              <button class="btn btn-sm btn-outline-primary ms-1 btn-pagar"
                      data-id="${c.id}" data-saldo="${saldo}" title="Registrar pago">
                <i class="bi bi-cash-coin"></i>
              </button>` : ""}

            ${c.estado === "CONFIRMADA" ? `
              <button class="btn btn-sm btn-outline-danger ms-1 btn-anular"
                      data-id="${c.id}" data-numero="${esc(c.numero)}" title="Anular">
                <i class="bi bi-x-circle"></i>
              </button>` : ""}
          </td>
        </tr>
      `;
    }).join("");

    setHTML("tbodyHistorial", html);
    setText("pageInfo", `Página ${data.current_page} de ${data.last_page} · ${data.total} registros`);

    const btnP = el("btnPrev");
    const btnN = el("btnNext");
    if (btnP) btnP.disabled = page <= 1;
    if (btnN) btnN.disabled = page >= lastPage;

    updateBadge(rows);
  } catch (e) {
    setHTML("tbodyHistorial", `<tr><td colspan="8" class="text-danger p-3">${esc(e.message)}</td></tr>`);
  }
}

function updateBadge(rows) {
  const badge = el("badgePendientes");
  if (!badge) return;

  const n = rows.filter((c) => c.estado === "CONFIRMADA" && Number(c.saldo_pendiente) > 0).length;
  badge.textContent = n;
  badge.classList.toggle("d-none", n === 0);
}

async function abrirDetalle(id) {
  if (!bsDetalle) return;

  setText("detalleNumero", "Cargando…");
  setText("detalleEstadoBadge", "—");
  setText("detalleMsg", "");
  setHTML("detalleLineas", `<tr><td colspan="4" class="text-muted small">Cargando…</td></tr>`);
  setHTML("detallePagos", "");
  el("secDetallePagos")?.classList.add("d-none");
  el("wrapDetalleArchivo")?.classList.add("d-none");
  el("btnDetalleConfirmar")?.classList.add("d-none");
  el("btnDetallePagar")?.classList.add("d-none");
  el("btnDetalleAnular")?.classList.add("d-none");

  bsDetalle.show();

  try {
    const c = await obtenerCompra(id);
    compraActual = c;

    setText("detalleNumero", c.numero);

    const badge = el("detalleEstadoBadge");
    if (badge) {
      const mapCls = {
        BORRADOR: "bg-secondary",
        CONFIRMADA: "bg-success",
        ANULADA: "bg-danger",
      };
      badge.textContent = c.estado;
      badge.className = `badge ms-2 ${mapCls[c.estado] ?? "bg-secondary"}`;
    }

    setText("detalleProv", c.proveedor?.nombre || "Sin proveedor");
    setText("detalleFecha", fmtDate(c.fecha));
    setText("detalleCondicion", c.condicion_pago || "—");

    const pagosConAdjunto = (c.pagos || []).filter((p) => p.archivo_url);
    if (pagosConAdjunto.length) {
      const primero = pagosConAdjunto[0];
      el("wrapDetalleArchivo")?.classList.remove("d-none");
      const link = el("detalleArchivoLink");
      if (link) {
        link.href = primero.archivo_url;
        link.innerHTML = `<i class="bi bi-paperclip"></i>`;
        link.title = "Ver adjunto";
      }
    }

    const lineas = (c.items || []).map((l) => `
      <tr>
        <td class="small">${esc(l.item?.nombre || "—")}</td>
        <td class="text-end small">${esc(l.cantidad)}</td>
        <td class="text-end small">${money(l.precio_unitario)}</td>
        <td class="text-end fw-semibold small">${money(l.subtotal)}</td>
      </tr>
    `).join("") || `<tr><td colspan="4" class="text-muted small">Sin líneas.</td></tr>`;

    setHTML("detalleLineas", lineas);

    setText("detalleSubtotal", money(c.subtotal));
    setText("detalleImpuestos", money(c.impuestos));
    setText("detalleTotal", money(c.total));

    const saldo = Number(c.saldo_pendiente);
    const saldoEl = el("detalleSaldo");
    if (saldoEl) {
      saldoEl.textContent = money(saldo);
      saldoEl.className = `fw-bold h5 mb-0 ${saldo > 0 ? "text-danger" : "text-success"}`;
    }

    const pagos = c.pagos || [];
    if (pagos.length) {
      el("secDetallePagos")?.classList.remove("d-none");
      setHTML("detallePagos", pagos.map((p) => `
        <tr>
          <td class="small">${fmtDate(p.fecha)}</td>
          <td class="small">${esc(p.medio_pago || "—")}</td>
          <td class="text-end fw-semibold small">${money(p.monto)}</td>
          <td class="small">
            <div>${esc(p.notas || "")}</div>
            ${p.archivo_url
              ? `<a href="${p.archivo_url}" target="_blank" class="text-primary" title="Ver adjunto">
                   <i class="bi bi-paperclip"></i>
                 </a>`
              : `<span class="text-muted small">—</span>`
            }
          </td>
        </tr>
      `).join(""));
    }

    if (c.estado === "BORRADOR") el("btnDetalleConfirmar")?.classList.remove("d-none");
    if (c.estado !== "ANULADA") el("btnDetalleAnular")?.classList.remove("d-none");
    if (c.estado === "CONFIRMADA" && saldo > 0) el("btnDetallePagar")?.classList.remove("d-none");
  } catch (er) {
    setText("detalleMsg", er.message || "Error al cargar.");
  }
}

function abrirPago(id, saldo) {
  if (!bsPago) return;

  const cid = el("pagoCompraId");
  const pf = el("pagoFecha");
  const pm = el("pagoMonto");
  const pme = el("pagoMedio");
  const pn = el("pagoNotas");
  const pa = el("pagoArchivo");
  const saldoMax = el("pagoSaldoMax");

  if (cid) cid.value = id;
  if (pf) pf.value = todayISO();
  if (pm) {
    pm.value = "";
    pm.min = "0.01";
    pm.max = String(Number(saldo || 0).toFixed(2));
    pm.classList.remove("is-invalid");
  }
  if (pme) pme.value = "TRANSFERENCIA";
  if (pn) pn.value = "";
  if (pa) pa.value = "";
  if (saldoMax) saldoMax.value = String(Number(saldo || 0));

  setText("pagoSaldoRef", money(saldo));
  setText("pagoMsg", "");
  setText("pagoArchivoNombre", "Sin archivo");

  const btn = el("btnPagoOk");
  if (btn) btn.disabled = false;

  bsPago.show();
}

async function loadCuentas() {
  setHTML("tbodyCuentas", `<tr><td colspan="8" class="text-muted p-3">Cargando…</td></tr>`);

  try {
    const rows = await cuentasPorPagar();

    if (!rows.length) {
      setHTML("tbodyCuentas", `
        <tr><td colspan="8" class="text-muted p-3 text-center">
          <i class="bi bi-check-circle text-success me-1"></i>Sin cuentas pendientes.
        </td></tr>`);
      setText("kpiDeuda", money(0));
      return;
    }

    let total = 0;

    const html = rows.map((c) => {
      total += Number(c.saldo_pendiente);

      return `
        <tr>
          <td class="fw-semibold small">${esc(c.numero)}</td>
          <td>${detalleCompraHtml(c)}</td>
          <td class="text-nowrap small">${fmtDate(c.fecha)}</td>
          <td>${diasBadge(c.fecha_vencimiento)}</td>
          <td class="text-end small">${money(c.total)}</td>
          <td class="text-end fw-semibold text-danger small">${money(c.saldo_pendiente)}</td>
          <td class="small text-nowrap">${condicionHtml(c)}</td>
          <td class="text-end text-nowrap">
            <button class="btn btn-sm btn-outline-secondary me-1 btn-ver-cuenta"
                    data-id="${c.id}" title="Ver detalle">
              <i class="bi bi-eye"></i>
            </button>
            <button class="btn btn-sm btn-outline-primary btn-pagar-cuenta"
                    data-id="${c.id}" data-saldo="${c.saldo_pendiente}">
              <i class="bi bi-cash-coin me-1"></i>Pagar
            </button>
          </td>
        </tr>
      `;
    }).join("");

    setHTML("tbodyCuentas", html);
    setText("kpiDeuda", money(total));
  } catch (er) {
    setHTML("tbodyCuentas", `<tr><td colspan="8" class="text-danger p-3">${esc(er.message)}</td></tr>`);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}