//util.js Devuelve "../" si estás dentro de /empresa/, o "" si estás en raíz. 
export function basePath() {
  const parts = location.pathname.split("/").filter(Boolean);
  // ejemplo: /sys-comercial/empresa/empresas.html -> parts length >= 2 (empresa + archivo)
  // si estás en /index.html -> length = 1 (archivo)
  if (parts.length <= 1) return "";
  return "../".repeat(parts.length - 1);
}