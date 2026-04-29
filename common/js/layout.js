import { getUser, clearAuth, hasRole } from "./auth.js";
import { apiFetch, csrfCookie } from "./api.js";
import { basePath } from "./util.js";

const BASE = basePath();

export function requireAuth() {
  const u = getUser();
  if (!u) {
    location.href = `${BASE}login/login.html`;
    throw new Error("No autenticado");
  }
  return u;
}

function initials(u) {
  const n = u.nombres || "";
  const a = u.apellidos || "";
  return ((n[0] || "") + (a[0] || "")).toUpperCase() || "?";
}

const ROL_LABEL = {
  SUPER_ADMIN:   { text: "Super Admin",  badge: "text-bg-danger" },
  EMPRESA_ADMIN: { text: "Admin",        badge: "text-bg-warning" },
  OPERATIVO:     { text: "Operativo",    badge: "text-bg-secondary" },
};

async function loadPartial(path) {
  const res = await fetch(`${BASE}${path}`, { cache: "no-cache" });
  if (!res.ok) throw new Error(`No se pudo cargar ${path}`);
  return res.text();
}

function applyRoleMenu(u) {
  document.querySelectorAll("#sidebarNav [data-roles]").forEach(el => {
    const allowed = el.dataset.roles.split(",").map(s => s.trim());
    if (!allowed.includes(u.rol)) el.remove();
  });

  if (!hasRole("SUPER_ADMIN", "EMPRESA_ADMIN")) {
    document.getElementById("seccionAdmin")?.remove();
  }
}

function setActiveNav() {
  const current = location.pathname.split("/").pop();
  document.querySelectorAll("#sidebarNav a[data-nav]").forEach(a => {
    const hrefFile = a.getAttribute("href").split("/").pop();
    const active = hrefFile === current;
    a.classList.toggle("active", active);
    a.classList.toggle("text-white", active);
    a.classList.toggle("text-white-50", !active);
  });
}

function renderUser(u) {
  const ini  = initials(u);
  const name = `${u.nombres} ${u.apellidos || ""}`.trim();
  const rol  = ROL_LABEL[u.rol] || { text: u.rol, badge: "text-bg-secondary" };

  const avatarHeader   = document.getElementById("avatarHeader");
  const userNameHeader = document.getElementById("userNameHeader");
  const userRolBadge   = document.getElementById("userRolBadge");

  if (avatarHeader)   avatarHeader.textContent  = ini;
  if (userNameHeader) userNameHeader.textContent = name;
  if (userRolBadge) {
    userRolBadge.textContent = rol.text;
    userRolBadge.className   = `badge ${rol.badge}`;
  }

  const avatarSidebar   = document.getElementById("avatarSidebar");
  const userNameSidebar = document.getElementById("userNameSidebar");
  const userRolSidebar  = document.getElementById("userRolSidebar");

  if (avatarSidebar)   avatarSidebar.textContent  = ini;
  if (userNameSidebar) userNameSidebar.textContent = name;
  if (userRolSidebar)  userRolSidebar.textContent  = rol.text;
}

function initSidebarToggle() {
  const sidebar = document.getElementById("appSidebar");
  const overlay = document.getElementById("sidebarOverlay");
  const btn     = document.getElementById("btnToggle");

  function open()  { sidebar.classList.add("open");    overlay.classList.add("open"); }
  function close() { sidebar.classList.remove("open"); overlay.classList.remove("open"); }

  let debounce = null;
  btn?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (debounce) return;
    debounce = setTimeout(() => { debounce = null; }, 300);
    sidebar.classList.contains("open") ? close() : open();
  });

  overlay?.addEventListener("click", close);

  document.querySelectorAll("#sidebarNav .nav-link:not(#btnLogout)").forEach(link => {
    link.addEventListener("click", () => {
      if (window.innerWidth < 992) close();
    });
  });
}

function bindLogout() {
  document.getElementById("btnLogout")?.addEventListener("click", async (e) => {
    e.preventDefault();
    try {
      await csrfCookie();
      await apiFetch("/auth/logout", { method: "POST" });
    } catch (_) {
      // igual limpiamos local
    } finally {
      clearAuth();
      location.href = `${BASE}login/login.html`;
    }
  });
}

// 🔥 VERIFY SESSION - SOLO 401 CIERRA SESIÓN, NADA MÁS
async function verifySession() {
  try {
    const res = await apiFetch("/auth/me");
    
    // SOLO 401 cierra sesión
    if (res.status === 401) {
      console.warn("401 No autorizado, redirigiendo al login");
      clearAuth();
      location.href = `${BASE}login/login.html`;
      return false;
    }
    
    // Cualquier otro error (403, 500, etc.) NO cierra sesión
    if (!res.ok) {
      console.warn(`verifySession: Error ${res.status} ignorado - modo desarrollo`);
      return true;
    }
    
    return true;
    
  } catch (error) {
    // Error de red, timeout, etc. - NUNCA cerrar sesión
    console.warn("verifySession: Error de red ignorado - modo desarrollo", error.message);
    return true;
  }
}

// 🔥 bootLayout - verify AHORA es false por defecto
export async function bootLayout({ title = "SYS Comercial", verify = false } = {}) {
  const u = requireAuth();

  const sidebarHtml = (await loadPartial("common/partials/sidebar.html")).replaceAll("{{BASE}}", BASE);
  const headerHtml  = (await loadPartial("common/partials/header.html")).replaceAll("{{BASE}}", BASE);

  document.getElementById("slotSidebar").innerHTML = sidebarHtml;
  document.getElementById("slotHeader").innerHTML  = headerHtml;

  document.title = title;
  const pageTitle = document.getElementById("pageTitle");
  if (pageTitle) pageTitle.textContent = title;

  renderUser(u);
  applyRoleMenu(u);
  setActiveNav();
  initSidebarToggle();
  bindLogout();

  // Solo verificar si explícitamente se pide
  if (verify) {
    await verifySession();
  }
}