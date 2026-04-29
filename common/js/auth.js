export function getUser() {
  const raw = localStorage.getItem("user");
  if (!raw || raw === "undefined" || raw === "null") return null;
  try {
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem("user");
    return null;
  }
}

export function setUser(user) {
  // Guardar usuario completo
  localStorage.setItem("user", JSON.stringify(user));
  // Si tiene token, guardarlo también por separado para fácil acceso
  if (user.access_token) {
    localStorage.setItem("access_token", user.access_token);
  }
}

export function clearAuth() {
  localStorage.removeItem("user");
  localStorage.removeItem("access_token");
}

export function hasRole(...roles) {
  const u = getUser();
  return u ? roles.includes(u.rol) : false;
}

export function getToken() {
  // Primero intentar desde almacenamiento directo
  const token = localStorage.getItem("access_token");
  if (token) return token;
  
  // Fallback desde user
  const u = getUser();
  return u?.access_token || null;
}