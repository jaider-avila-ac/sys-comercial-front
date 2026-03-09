import { apiFetch, csrfCookie }
  from "../../common/js/api.js";

const form = document.getElementById("form");
const msg = document.getElementById("msg");

const params = new URLSearchParams(location.search);
const id = params.get("id");

const inp = {
  nombre: document.getElementById("nombre"),
  tipo_documento: document.getElementById("tipo_documento"),
  num_documento: document.getElementById("num_documento"),
  contacto: document.getElementById("contacto"),
  email: document.getElementById("email"),
  telefono: document.getElementById("telefono"),
  direccion: document.getElementById("direccion"),
};

if (id) cargar();

async function cargar() {
  const res = await apiFetch(`/clientes/${id}`);
  const data = await res.json();
  const c = data.cliente;

  inp.nombre.value = c.nombre_razon_social || "";
  inp.tipo_documento.value = c.tipo_documento;
  inp.num_documento.value = c.num_documento;
  inp.contacto.value = c.contacto || "";
  inp.email.value = c.email || "";
  inp.telefono.value = c.telefono || "";
  inp.direccion.value = c.direccion || "";
}

form.addEventListener("submit", async e => {
  e.preventDefault();
  msg.textContent = "";

  const payload = {
    nombre_razon_social: inp.nombre.value.trim(),
    tipo_documento: inp.tipo_documento.value,
    num_documento: inp.num_documento.value.trim(),
    contacto: inp.contacto.value.trim(),
    email: inp.email.value.trim(),
    telefono: inp.telefono.value.trim(),
    direccion: inp.direccion.value.trim(),
  };

  await csrfCookie();

  const res = await apiFetch(
    id ? `/clientes/${id}` : `/clientes`,
    {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(payload),
    }
  );

  if (!res.ok) {
    msg.textContent = "Error al guardar";
    return;
  }

  location.href = "clientes.html";
});