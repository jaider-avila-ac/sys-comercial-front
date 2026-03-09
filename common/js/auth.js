export function getUser() {
  const raw = localStorage.getItem("user");
  return raw ? JSON.parse(raw) : null;
}

export function setUser(user) {
  localStorage.setItem("user", JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem("user");
}

export function hasRole(...roles) {
  const u = getUser();
  return u ? roles.includes(u.rol) : false;
}