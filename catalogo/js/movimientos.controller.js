import { movimientosInventario } from "./inventario.service.js";

const itemId  = document.getElementById("itemId");
const desde   = document.getElementById("desde");
const hasta   = document.getElementById("hasta");
const btnBuscar = document.getElementById("btnBuscar");
const tbody   = document.getElementById("tbody");
const pageInfo = document.getElementById("pageInfo");
const btnPrev = document.getElementById("btnPrev");
const btnNext = document.getElementById("btnNext");

let currentPage = 1;
let lastPage    = 1;

const COLS = 8; // actualizado al agregar columna Usuario

function esc(str) {
  return String(str ?? "").replace(/[&<>"']/g, m =>
    ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[m])
  );
}

function fmtNum(n) {
  return Number(n ?? 0).toLocaleString("es-CO", {
    minimumFractionDigits: 0, maximumFractionDigits: 3,
  });
}

function fmtDate(dt) {
  if (!dt) return "—";
  return String(dt).replace("T", " ").slice(0, 19);
}

function badgeTipo(t) {
  const map = {
    ENTRADA: "bg-success",
    SALIDA:  "bg-danger",
    AJUSTE:  "bg-warning text-dark",
  };
  return `<span class="badge ${map[t] ?? "bg-secondary"}">${esc(t)}</span>`;
}

function fmtUsuario(m) {
  // Con el join, los campos vienen planos: usuario_nombres, usuario_apellidos, usuario_email
  const nombre = [m.usuario_nombres, m.usuario_apellidos].filter(Boolean).join(" ")
               || m.usuario_email
               || `ID ${m.usuario_id ?? "—"}`;
  const email  = m.usuario_email ?? "";
  return `<span title="${esc(email)}">${esc(nombre)}</span>`;
}

async function load(page = 1) {
  currentPage = page;
  tbody.innerHTML = `<tr><td colspan="${COLS}" class="text-muted p-3">Cargando…</td></tr>`;

  try {
    const res  = await movimientosInventario({
      page,
      item_id: itemId.value.trim(),
      desde:   desde.value,
      hasta:   hasta.value,
    });
    const data = await res.json();

    if (!res.ok) {
      tbody.innerHTML = `<tr><td colspan="${COLS}" class="text-danger p-3">${esc(data?.message || "Error al cargar")}</td></tr>`;
      pageInfo.textContent = "—";
      return;
    }

    lastPage = data.last_page || 1;
    const rows = data.data || [];

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="${COLS}" class="text-muted p-3 text-center">Sin resultados para los filtros aplicados.</td></tr>`;
      pageInfo.textContent = "0 registros";
      btnPrev.disabled = true;
      btnNext.disabled = true;
      return;
    }

    tbody.innerHTML = rows.map(m => `
      <tr>
        <td class="text-nowrap small">${esc(fmtDate(m.ocurrido_en))}</td>
        <td>${badgeTipo(m.tipo)}</td>
        <td class="text-end">${fmtNum(m.cantidad)}</td>
        <td class="text-end">${fmtNum(m.saldo_resultante)}</td>
        <td class="small">${fmtUsuario(m)}</td>
        <td class="small text-muted">${esc(m.motivo || "—")}</td>
        <td class="text-nowrap small">
          ${esc(m.referencia_tipo || "—")}${m.referencia_id ? " #" + m.referencia_id : ""}
        </td>
        <td class="text-end small">${esc(m.item_id)}</td>
      </tr>
    `).join("");

    pageInfo.textContent = `Página ${data.current_page} de ${data.last_page} · ${data.total} registros`;
    btnPrev.disabled = data.current_page <= 1;
    btnNext.disabled = data.current_page >= data.last_page;

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="${COLS}" class="text-danger p-3">${esc(err.message)}</td></tr>`;
  }
}

btnBuscar.addEventListener("click", () => load(1));
btnPrev.addEventListener("click",   () => load(Math.max(1, currentPage - 1)));
btnNext.addEventListener("click",   () => load(Math.min(lastPage, currentPage + 1)));

load(1);