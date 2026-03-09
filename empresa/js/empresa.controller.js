import { getUser } from "../../common/js/auth.js";
import { API_ORIGIN } from "../../common/js/api.js";
import {
  listarEmpresas, eliminarEmpresa,
  miEmpresa, actualizarEmpresa, subirLogo, quitarLogo,
} from "./empresa.service.js";
import { showToast, showConfirm } from "../../common/js/ui.utils.js";

const user = getUser();

const logoUrl = (path) => (path ? `${API_ORIGIN}/storage/${path}` : "");

function show(el) { el?.classList.remove("d-none"); }
function hide(el) { el?.classList.add("d-none"); }
function escHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, m =>
    ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[m])
  );
}
function fmtDatetime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CO", { dateStyle:"short", timeStyle:"short" });
}

// ── router por rol ────────────────────────────────────────────
if (user?.rol === "SUPER_ADMIN") {
  show(document.getElementById("btnNueva"));
  show(document.getElementById("vistaListado"));
  initListadoUI();
} else if (user?.rol === "EMPRESA_ADMIN") {
  show(document.getElementById("vistaMiEmpresa"));
  initMiEmpresaUI();
} else {
  showToast("No autorizado.", "danger");
  setTimeout(() => { location.href = "../index.html"; }, 1500);
}

// ═════════════════════════════════════════════════════════════
// SUPER_ADMIN: LISTADO
// ═════════════════════════════════════════════════════════════
function initListadoUI() {
  const tbody  = document.getElementById("tbodyListado");
  const search = document.getElementById("search");

  async function render(q = "") {
    tbody.innerHTML = `<tr><td colspan="7" class="text-muted">Cargando…</td></tr>`;
    try {
      const page = await listarEmpresas({ search: q });
      const rows = page.data || [];

      if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-muted">Sin resultados.</td></tr>`;
        return;
      }

      tbody.innerHTML = rows.map(e => {
        const logoHtml = e.logo_path
          ? `<img src="${logoUrl(escHtml(e.logo_path))}" alt="logo"
                  style="width:36px;height:36px;object-fit:contain;border-radius:4px;"/>`
          : `<i class="bi bi-building text-muted" style="font-size:1.4rem;"></i>`;
        const estadoBadge = e.is_activa
          ? `<span class="badge bg-success">Activa</span>`
          : `<span class="badge bg-secondary">Inactiva</span>`;

        return `
          <tr>
            <td class="text-center">${logoHtml}</td>
            <td class="fw-semibold">${escHtml(e.nombre)}</td>
            <td>${escHtml(e.nit ?? "—")}</td>
            <td>${escHtml(e.email ?? "—")}</td>
            <td>${escHtml(e.telefono ?? "—")}</td>
            <td>${estadoBadge}</td>
            <td class="text-end">
              <div class="btn-group btn-group-sm">
                <a class="btn btn-outline-primary"
                   href="empresa-form.html?id=${e.id}" title="Editar">
                  <i class="bi bi-pencil"></i>
                </a>
                <button class="btn btn-outline-danger ms-1"
                        data-del="${e.id}"
                        data-nombre="${escHtml(e.nombre)}"
                        title="Eliminar">
                  <i class="bi bi-trash"></i>
                </button>
              </div>
            </td>
          </tr>`;
      }).join("");

    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-danger">${escHtml(err.message)}</td></tr>`;
    }
  }

  let t = null;
  search.addEventListener("input", () => {
    clearTimeout(t);
    t = setTimeout(() => render(search.value.trim()), 300);
  });

  tbody.addEventListener("click", async e => {
    const btn = e.target.closest("[data-del]");
    if (!btn) return;

    const ok = await showConfirm(
      `¿Eliminar la empresa <strong>${btn.dataset.nombre}</strong>? Esta acción no se puede deshacer.`,
      { title: "Eliminar empresa", okLabel: "Sí, eliminar", okVariant: "btn-danger" }
    );
    if (!ok) return;

    try {
      await eliminarEmpresa(btn.dataset.del);
      showToast("Empresa eliminada.", "success");
      render(search.value.trim());
    } catch (err) {
      showToast(err.message || "No se pudo eliminar.", "danger");
    }
  });

  render();
}

// ═════════════════════════════════════════════════════════════
// EMPRESA_ADMIN: MI EMPRESA
// ═════════════════════════════════════════════════════════════
async function initMiEmpresaUI() {
  const msg  = document.getElementById("msgMiEmpresa");
  const form = document.getElementById("formMiEmpresa");

  const inp = {
    nombre:    document.getElementById("nombre"),
    nit:       document.getElementById("nit"),
    email:     document.getElementById("email"),
    telefono:  document.getElementById("telefono"),
    direccion: document.getElementById("direccion"),
    is_activa: document.getElementById("is_activa"),
  };

  const logoPreview     = document.getElementById("logoPreview");
  const logoImg         = document.getElementById("logoImg");
  const logoPlaceholder = document.getElementById("logoPlaceholder");
  const logoInput       = document.getElementById("logoInput");
  const btnSubirLogo    = document.getElementById("btnSubirLogo");
  const btnQuitarLogo   = document.getElementById("btnQuitarLogo");
  const logoStatus      = document.getElementById("logoStatus");

  function setMsg(text, type = "danger") {
    msg.className   = `small text-${type} align-self-center`;
    msg.textContent = text || "";
  }
  function setLogoStatus(text, type = "muted") {
    logoStatus.className   = `small text-${type}`;
    logoStatus.textContent = text || "";
  }
  function showLogo(url) {
    logoImg.src = url; logoImg.style.display = "block";
    logoPlaceholder.style.display = "none";
    btnQuitarLogo.style.display = "inline-flex";
  }
  function clearLogo() {
    logoImg.src = ""; logoImg.style.display = "none";
    logoPlaceholder.style.display = "";
    btnQuitarLogo.style.display = "none";
  }

  setMsg("");
  let empresa = null;

  try {
    empresa = await miEmpresa();
    inp.nombre.value    = empresa.nombre    ?? "";
    inp.nit.value       = empresa.nit       ?? "";
    inp.email.value     = empresa.email     ?? "";
    inp.telefono.value  = empresa.telefono  ?? "";
    inp.direccion.value = empresa.direccion ?? "";
    if (empresa.logo_path) showLogo(logoUrl(empresa.logo_path));
    else clearLogo();
    document.getElementById("infoCreatedAt").textContent = fmtDatetime(empresa.created_at);
    document.getElementById("infoUpdatedAt").textContent = fmtDatetime(empresa.updated_at);
  } catch (err) {
    setMsg(err.message || "No se pudo cargar.", "danger"); return;
  }

  // ── Logo ──────────────────────────────────────────────────
  logoPreview.addEventListener("click", () => logoInput.click());
  btnSubirLogo.addEventListener("click", () => logoInput.click());

  logoInput.addEventListener("change", async () => {
    const file = logoInput.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setLogoStatus("El archivo supera 2 MB.", "danger"); return; }
    if (!["image/png","image/jpeg","image/webp"].includes(file.type)) {
      setLogoStatus("Solo PNG, JPG o WEBP.", "danger"); return;
    }
    const reader = new FileReader();
    reader.onload = e => showLogo(e.target.result);
    reader.readAsDataURL(file);

    setLogoStatus("Subiendo…", "muted");
    try {
      empresa = await subirLogo(empresa.id, file);
      showLogo(logoUrl(empresa.logo_path));
      setLogoStatus("Logo actualizado.", "success");
      showToast("Logo actualizado correctamente.", "success");
      setTimeout(() => setLogoStatus(""), 2500);
    } catch (err) {
      setLogoStatus(err.message || "Error al subir.", "danger");
      if (empresa.logo_path) showLogo(logoUrl(empresa.logo_path)); else clearLogo();
    }
    logoInput.value = "";
  });

  btnQuitarLogo.addEventListener("click", async () => {
    const ok = await showConfirm(
      "¿Quitar el logo de la empresa?",
      { title: "Quitar logo", okLabel: "Sí, quitar", okVariant: "btn-danger" }
    );
    if (!ok) return;
    setLogoStatus("Eliminando…", "muted");
    try {
      empresa = await quitarLogo(empresa.id);
      clearLogo();
      setLogoStatus("Logo eliminado.", "success");
      showToast("Logo eliminado.", "success");
      setTimeout(() => setLogoStatus(""), 2500);
    } catch (err) {
      setLogoStatus(err.message || "Error al eliminar.", "danger");
    }
  });

  // ── Guardar datos ─────────────────────────────────────────
  form.addEventListener("submit", async e => {
    e.preventDefault();
    setMsg("");
    const payload = {
      nombre:    inp.nombre.value.trim(),
      nit:       inp.nit.value.trim()       || null,
      email:     inp.email.value.trim()     || null,
      telefono:  inp.telefono.value.trim()  || null,
      direccion: inp.direccion.value.trim() || null,
    };
    if (!payload.nombre) { setMsg("El nombre es obligatorio.", "danger"); return; }
    try {
      empresa = await actualizarEmpresa(empresa.id, payload);
      document.getElementById("infoUpdatedAt").textContent = fmtDatetime(empresa.updated_at);
      setMsg("Guardado.", "success");
      showToast("Datos de empresa guardados.", "success");
      setTimeout(() => setMsg(""), 2500);
    } catch (err) {
      setMsg(err.message || "No se pudo guardar.", "danger");
    }
  });
}