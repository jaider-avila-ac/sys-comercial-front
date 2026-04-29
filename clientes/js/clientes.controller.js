import { listarClientes, eliminarCliente } from "./clientes.service.js";
import { showToast, showConfirm } from "../../common/js/ui.utils.js";

const tbody = document.getElementById("tbody");
const search = document.getElementById("search");

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, m =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m])
  );
}

function money(n) {
  return Number(n || 0).toLocaleString("es-CO", {
    style: "currency", currency: "COP", maximumFractionDigits: 0,
  });
}

async function load(q = "") {
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="6" class="text-muted p-3 text-center">Cargando…</td><tr>`;

  try {
    const data = await listarClientes(q);
    const rows = data.data || [];

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-muted p-3 text-center">Sin resultados.</td><tr>`;
      return;
    }

    tbody.innerHTML = rows.map(c => {
      const saldo = Number(c.saldo_a_favor || 0);
      const saldoHtml = saldo > 0
        ? `<span class="text-success fw-semibold">${money(saldo)}</span>`
        : `<span class="text-muted">—</span>`;

      return `
        <tr data-cliente-id="${c.id}">
          <td>
            <div class="fw-semibold">${esc(c.nombre_razon_social)}</div>
            ${c.empresa ? `<div class="text-muted small">${esc(c.empresa)}</div>` : ""}
          </td>
          <td>${esc(c.tipo_documento || "—")} ${esc(c.num_documento ?? "—")}</td>
          <td>${esc(c.telefono ?? "—")}</td>
          <td>${esc(c.email ?? "—")}</td>
          <td class="text-end">${saldoHtml}</td>
          <td class="text-end text-nowrap">
            <div class="btn-group btn-group-sm" role="group">
              <a class="btn btn-sm btn-outline-secondary" href="cliente-form.html?id=${c.id}" title="Editar">
                <i class="bi bi-pencil"></i>
              </a>
              <a class="btn btn-sm btn-outline-info" href="cliente-facturas.html?id=${c.id}" title="Ver facturas del cliente">
                <i class="bi bi-receipt"></i>
              </a>
              <button class="btn btn-sm btn-outline-danger btn-del"
                      data-id="${c.id}"
                      data-nombre="${esc(c.nombre_razon_social)}"
                      title="Eliminar">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join("");

  } catch (e) {
    console.error("Error loading clients:", e);
    tbody.innerHTML = `<tr><td colspan="6" class="text-danger p-3">${esc(e.message)}</td></tr>`;
  }
}

let timer;
if (search) {
  search.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => load(search.value.trim()), 300);
  });
}

if (tbody) {
  tbody.addEventListener("click", async e => {
    const btnDel = e.target.closest(".btn-del");
    if (btnDel) {
      const ok = await showConfirm(
        `¿Eliminar a <strong>${btnDel.dataset.nombre}</strong>? Esta acción no se puede deshacer.`,
        { title: "Eliminar cliente", okLabel: "Sí, eliminar", okVariant: "btn-danger" }
      );
      if (!ok) return;

      try {
        await eliminarCliente(btnDel.dataset.id);
        showToast("Cliente eliminado.", "success");
        load(search?.value.trim() || "");
      } catch (err) {
        showToast(err.message || "No se pudo eliminar.", "danger");
      }
    }
  });
}

// Cargar clientes al inicio
load();