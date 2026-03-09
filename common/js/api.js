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

export async function apiFetch(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  const xsrf = getCookie("XSRF-TOKEN");
  if (xsrf) headers["X-XSRF-TOKEN"] = xsrf;

 const p = path.startsWith("/") ? path : `/${path}`;
return fetch(`${API_BASE_URL}${p}`, {
    ...options,
    headers,
    credentials: "include",
  });
}

export async function csrfCookie() {
  return fetch(`${API_ORIGIN}/sanctum/csrf-cookie`, {
    method: "GET",
    credentials: "include",
  });
}