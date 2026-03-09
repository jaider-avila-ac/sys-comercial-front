// common/js/ui.utils.js

// ─── Toast container ──────────────────────────────────────────
(function injectToastContainer() {
  if (document.getElementById("toastContainer")) return;
  const div = document.createElement("div");
  div.id = "toastContainer";
  div.className = "toast-container position-fixed bottom-0 end-0 p-3";
  div.style.zIndex = 1100;
  document.body.appendChild(div);
})();

/**
 * Muestra un toast Bootstrap.
 * @param {string} msg
 * @param {"success"|"danger"|"warning"|"info"} type
 */
export function showToast(msg, type = "success") {
  const icons = {
    success: "bi-check-circle-fill",
    danger:  "bi-x-circle-fill",
    warning: "bi-exclamation-triangle-fill",
    info:    "bi-info-circle-fill",
  };
  const el = document.createElement("div");
  el.className = `toast align-items-center text-bg-${type} border-0`;
  el.setAttribute("role", "alert");
  el.setAttribute("aria-live", "assertive");
  el.setAttribute("aria-atomic", "true");
  el.innerHTML = `
    <div class="d-flex">
      <div class="toast-body d-flex align-items-center gap-2">
        <i class="bi ${icons[type] ?? "bi-info-circle-fill"}"></i>
        ${msg}
      </div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto"
              data-bs-dismiss="toast" aria-label="Cerrar"></button>
    </div>`;
  document.getElementById("toastContainer").appendChild(el);
  const t = new bootstrap.Toast(el, { delay: 4000 });
  t.show();
  el.addEventListener("hidden.bs.toast", () => el.remove());
}

// ─── Modal confirm ────────────────────────────────────────────
(function injectConfirmModal() {
  if (document.getElementById("modalConfirm")) return;
  const div = document.createElement("div");
  div.innerHTML = `
    <div class="modal fade" id="modalConfirm" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered modal-sm">
        <div class="modal-content">
          <div class="modal-header py-2">
            <h6 class="modal-title mb-0" id="modalConfirmTitle">Confirmar</h6>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body" id="modalConfirmBody"></div>
          <div class="modal-footer py-2">
            <button type="button" class="btn btn-outline-secondary btn-sm"
                    data-bs-dismiss="modal">Cancelar</button>
            <button type="button" class="btn btn-sm" id="modalConfirmOk">Confirmar</button>
          </div>
        </div>
      </div>
    </div>`;
  document.body.appendChild(div.firstElementChild);
})();

/**
 * Reemplaza confirm(). Devuelve Promise<boolean>.
 * @param {string} body
 * @param {{ title?, okLabel?, okVariant? }} opts
 */
export function showConfirm(body, {
  title     = "Confirmar acción",
  okLabel   = "Confirmar",
  okVariant = "btn-primary",
} = {}) {
  return new Promise((resolve) => {
    const modalEl = document.getElementById("modalConfirm");
    document.getElementById("modalConfirmTitle").textContent = title;
    document.getElementById("modalConfirmBody").innerHTML    = body;

    const okBtn = document.getElementById("modalConfirmOk");
    okBtn.textContent = okLabel;
    okBtn.className   = `btn btn-sm ${okVariant}`;

    // Clonar para limpiar listeners anteriores
    const freshOk = okBtn.cloneNode(true);
    okBtn.replaceWith(freshOk);

    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);

    freshOk.addEventListener("click", () => { modal.hide(); resolve(true); }, { once: true });
    modalEl.addEventListener("hidden.bs.modal", () => resolve(false), { once: true });

    modal.show();
  });
}

// ─── Modal prompt ─────────────────────────────────────────────
(function injectPromptModal() {
  if (document.getElementById("modalPrompt")) return;
  const div = document.createElement("div");
  div.innerHTML = `
    <div class="modal fade" id="modalPrompt" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered modal-sm">
        <div class="modal-content">
          <div class="modal-header py-2">
            <h6 class="modal-title mb-0" id="modalPromptTitle">Ingresar valor</h6>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <label class="form-label small" id="modalPromptLabel"></label>
            <input id="modalPromptInput" class="form-control form-control-sm"/>
          </div>
          <div class="modal-footer py-2">
            <button type="button" class="btn btn-outline-secondary btn-sm"
                    data-bs-dismiss="modal">Cancelar</button>
            <button type="button" class="btn btn-primary btn-sm"
                    id="modalPromptOk">Aceptar</button>
          </div>
        </div>
      </div>
    </div>`;
  document.body.appendChild(div.firstElementChild);
})();

/**
 * Reemplaza prompt(). Devuelve Promise<string|null>.
 * @param {string} label
 * @param {{ title?, defaultValue? }} opts
 */
export function showPrompt(label, { title = "Ingresar valor", defaultValue = "" } = {}) {
  return new Promise((resolve) => {
    const modalEl = document.getElementById("modalPrompt");
    document.getElementById("modalPromptTitle").textContent = title;
    document.getElementById("modalPromptLabel").textContent = label;
    const input = document.getElementById("modalPromptInput");
    input.value = defaultValue;

    const okBtn   = document.getElementById("modalPromptOk");
    const freshOk = okBtn.cloneNode(true);
    okBtn.replaceWith(freshOk);

    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);

    freshOk.addEventListener("click", () => {
      const val = input.value.trim();
      modal.hide();
      resolve(val || null);
    }, { once: true });

    modalEl.addEventListener("hidden.bs.modal", () => resolve(null), { once: true });
    modalEl.addEventListener("shown.bs.modal",  () => input.focus(),  { once: true });

    modal.show();
  });
}