import { listarClientes, eliminarCliente } from "./clientes.service.js";
import { showToast, showConfirm } from "../../common/js/ui.utils.js";

const tbody  = document.getElementById("tbody");
const search = document.getElementById("search");

function escHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, m =>
    ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[m])
  );
}

async function load(q = "") {
  tbody.innerHTML = `<tr><td colspan="5" class="text-muted p-3">Cargando…</td></tr>`;

  try {
    const data = await listarClientes(q);
    const rows = data.data || [];

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-muted p-3">Sin resultados.</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map(c => {
  const saldo = Number(c.saldo_a_favor || 0);
  const saldoHtml = saldo > 0
    ? `<span class="text-success fw-semibold">${money(saldo)}</span>`
    : `<span class="text-muted">—</span>`;

  return `
    <tr>
      <td>${escHtml(c.nombre_razon_social)}</td>
      <td>${escHtml(c.tipo_documento)} ${escHtml(c.num_documento)}</td>
      <td>${escHtml(c.telefono ?? "—")}</td>
      <td>${escHtml(c.email ?? "—")}</td>
      <td class="text-end">${saldoHtml}</td>
      <td class="text-end">
        <div class="btn-group btn-group-sm">
          <a class="btn btn-outline-secondary"
             href="cliente-form.html?id=${c.id}" title="Editar">
            <i class="bi bi-pencil"></i>
          </a>
          <button class="btn btn-outline-danger"
                  data-del="${c.id}"
                  data-nombre="${escHtml(c.nombre_razon_social)}"
                  title="Eliminar">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </td>
    </tr>`;
}).join("");

  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-danger p-3">${escHtml(e.message)}</td></tr>`;
  }
}

function money(n) {
  return Number(n || 0).toLocaleString("es-CO", {
    style: "currency", currency: "COP", maximumFractionDigits: 0
  });
}

search.addEventListener("input", () => load(search.value.trim()));

tbody.addEventListener("click", async e => {
  const btn = e.target.closest("[data-del]");
  if (!btn) return;

  const ok = await showConfirm(
    `¿Eliminar al cliente <strong>${btn.dataset.nombre}</strong>? Esta acción no se puede deshacer.`,
    { title: "Eliminar cliente", okLabel: "Sí, eliminar", okVariant: "btn-danger" }
  );
  if (!ok) return;

  try {
    await eliminarCliente(btn.dataset.del);
    showToast("Cliente eliminado.", "success");
    load(search.value.trim());
  } catch (err) {
    showToast(err.message || "No se pudo eliminar.", "danger");
  }
});

load();