import "../../common/js/auth.js";
import { initKPIs, cargarKpis } from "./finanzas.kpis.js";

const filtroDesde = document.getElementById("filtroDesde");
const filtroHasta = document.getElementById("filtroHasta");

if (filtroDesde) filtroDesde.value = `${new Date().getFullYear()}-01-01`;

if (filtroHasta) {
  const d = new Date();
  filtroHasta.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function filtroParams() {
  const p = {};
  if (filtroDesde?.value) p.desde = filtroDesde.value;
  if (filtroHasta?.value) p.hasta = filtroHasta.value;
  return p;
}

initKPIs(filtroParams);

document.getElementById("btnFiltrar")?.addEventListener("click", () => {
  cargarKpis();
});

document.getElementById("btnLimpiarFiltro")?.addEventListener("click", () => {
  if (filtroDesde) filtroDesde.value = "";
  if (filtroHasta) filtroHasta.value = "";
  cargarKpis();
});

cargarKpis();