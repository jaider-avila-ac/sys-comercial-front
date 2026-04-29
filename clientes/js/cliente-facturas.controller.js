import { apiFetch } from "../../common/js/api.js";
import { showToast } from "../../common/js/ui.utils.js";
import { createPagosUI } from "../../common/js/pagos.ui.js";

const qs = new URLSearchParams(location.search);
const clienteId = qs.get("id");

if (!clienteId) {
    location.href = "clientes.html";
}

let clienteData = null;
let pagosUI = null;

function money(n) {
    return Number(n || 0).toLocaleString("es-CO", {
        style: "currency", currency: "COP", minimumFractionDigits: 0, maximumFractionDigits: 0
    });
}

function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, m =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m])
    );
}

function formatDate(iso) {
    if (!iso) return "—";
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
}

function getEstadoBadge(estado, saldo) {
    if (estado === "ANULADA") return '<span class="status-badge status-ANULADA">ANULADA</span>';
    if (saldo <= 0) return '<span class="status-badge status-PAGADA">PAGADA</span>';
    if (estado === "EMITIDA" && saldo > 0) return '<span class="status-badge status-PARCIAL">PARCIAL</span>';
    return `<span class="status-badge status-${estado}">${estado}</span>`;
}

async function loadCliente() {
    try {
        const res = await apiFetch(`/clientes/${clienteId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.message);
        clienteData = data.cliente;
        document.getElementById("clienteInfo").innerHTML = `
            <strong>${esc(clienteData.nombre_razon_social)}</strong>
            ${clienteData.num_documento ? ` · ${clienteData.tipo_documento || "Doc"}: ${clienteData.num_documento}` : ""}
            ${clienteData.email ? ` · ${clienteData.email}` : ""}
            ${clienteData.telefono ? ` · Tel: ${clienteData.telefono}` : ""}
        `;
    } catch (e) {
        document.getElementById("clienteInfo").innerHTML = `<span class="text-danger">${esc(e.message)}</span>`;
    }
}

async function loadFacturas() {
    const tbody = document.getElementById("tbodyFacturas");
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">Cargando facturas...</td></tr>`;

    try {
        const res = await apiFetch(`/facturas?cliente_id=${clienteId}&estado=EMITIDA`);
        const data = await res.json();
        const facturas = data.data || [];

        if (!facturas.length) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">No hay facturas para este cliente</td></tr>`;
            document.getElementById("totalFacturado").innerHTML = money(0);
            document.getElementById("totalPagado").innerHTML = money(0);
            document.getElementById("totalSaldo").innerHTML = money(0);
            return;
        }

        let totalFacturado = 0;
        let totalPagado = 0;
        let totalSaldo = 0;

        tbody.innerHTML = facturas.map(f => {
            const saldo = f.saldo || 0;
            totalFacturado += f.total || 0;
            totalPagado += f.total_pagado || 0;
            totalSaldo += saldo;

            return `
                <tr>
                    <td>
                        <a href="../facturas/factura-view.html?id=${f.id}&return_to=cliente&cliente_id=${clienteId}" class="text-decoration-none fw-semibold">
                            ${esc(f.numero || "—")}
                        </a>
                    </td>
                    <td>${formatDate(f.fecha)}</td>
                    <td class="text-end">${money(f.total)}</td>
                    <td class="text-end text-green">${money(f.total_pagado)}</td>
                    <td class="text-end ${saldo > 0 ? 'text-red fw-semibold' : ''}">${money(saldo)}</td>
                    <td>${getEstadoBadge(f.estado, saldo)}</td>
                    <td class="text-nowrap">
                        ${saldo > 0 ? `
                            <button class="btn btn-sm btn-pagar btn-pagar-factura" 
                                    data-id="${f.id}" 
                                    data-numero="${esc(f.numero)}"
                                    data-total="${f.total}"
                                    data-pagado="${f.total_pagado}"
                                    data-saldo="${saldo}"
                                    data-cliente-id="${clienteId}"
                                    title="Registrar pago">
                                <i class="bi bi-cash-coin me-1"></i>Pagar
                            </button>
                        ` : ''}
                        <a href="../facturas/factura-view.html?id=${f.id}&return_to=cliente&cliente_id=${clienteId}" class="btn btn-sm btn-outline-secondary" title="Ver detalle">
                            <i class="bi bi-eye"></i>
                        </a>
                    </td>
                </tr>
            `;
        }).join("");

        document.getElementById("totalFacturado").innerHTML = money(totalFacturado);
        document.getElementById("totalPagado").innerHTML = money(totalPagado);
        document.getElementById("totalSaldo").innerHTML = money(totalSaldo);

    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger py-4">${esc(e.message)}</td></tr>`;
    }
}

// Inicializar UI de pagos unificada
function initPagosUI() {
    pagosUI = createPagosUI({
        onPagoOk: async (data, facturaCtx) => {
            // Recargar las facturas después de un pago exitoso
            await loadFacturas();
            await loadCliente(); // Para actualizar el saldo a favor del cliente
            showToast("Pago registrado correctamente", "success");
        }
    });
    pagosUI.boot();
}

function setupEventListeners() {
    const tbody = document.getElementById("tbodyFacturas");
    if (!tbody) return;

    tbody.addEventListener("click", (e) => {
        const btn = e.target.closest(".btn-pagar-factura");
        if (!btn) return;

        if (!pagosUI) {
            initPagosUI();
        }

        const facturaId = btn.dataset.id;
        const numero = btn.dataset.numero;
        const total = parseFloat(btn.dataset.total);
        const pagado = parseFloat(btn.dataset.pagado);
        const saldo = parseFloat(btn.dataset.saldo);
        const clienteIdFactura = btn.dataset.clienteId;

        pagosUI.openPagoModal({
            facturaId: facturaId,
            numero: numero,
            total: total,
            pagado: pagado,
            saldo: saldo,
            clienteId: clienteIdFactura
        });
    });
}

// Inicializar
setupEventListeners();
loadCliente();
loadFacturas();