export const API_ORIGIN =
  (location.hostname === "127.0.0.1" || location.hostname === "localhost")
    ? "http://127.0.0.1:8000"
    : "https://weight-hottest-sas-album.trycloudflare.com";

export const API_BASE_URL = `${API_ORIGIN}/api`;

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return decodeURIComponent(parts.pop().split(";").shift());
  return null;
}

function getAccessToken() {
  // 🔥 CORREGIDO: Leer directamente de localStorage
  const token = localStorage.getItem("access_token");
  if (token) return token;
  
  // Fallback: intentar leer del objeto user
  const user = localStorage.getItem("user");
  if (!user) return null;
  try {
    const parsed = JSON.parse(user);
    return parsed.access_token || null;
  } catch {
    return null;
  }
}

export async function apiFetch(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    "Accept": "application/json",
    ...(options.headers || {}),
  };

  const token = getAccessToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  } else {
    console.log("⚠️ No hay token disponible para:", path);
  }

  const xsrf = getCookie("XSRF-TOKEN");
  if (xsrf) headers["X-XSRF-TOKEN"] = xsrf;

  const p = path.startsWith("/") ? path : `/${path}`;
  
  const response = await fetch(`${API_BASE_URL}${p}`, {
    ...options,
    headers,
    credentials: "include",
  });
  
  if (response.status === 401 && !path.includes("/auth/")) {
    console.warn("⚠️ 401 Unauthorized en:", path);
    // No limpiar el token aquí, solo mostrar warning
  }
  
  return response;
}

export async function csrfCookie() {
  const response = await fetch(`${API_ORIGIN}/sanctum/csrf-cookie`, {
    method: "GET",
    credentials: "include",
  });
  return response;
}

export function basePath() {
  const parts = location.pathname.split("/").filter(Boolean);
  if (parts.length <= 1) return "";
  return "../".repeat(parts.length - 1);
}