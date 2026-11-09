"use strict";

import { escapeHTML } from "../core.js";

export function openModal(content) {
    const root = document.getElementById("modal-root");

    root.innerHTML = `
        <div class="modal-overlay" data-action="cerrar-modal">

            <section
                class="modal-panel"
                role="dialog"
                aria-modal="true"
                aria-label="Formulario">

                <div class="modal-handle"></div>

                ${content}

            </section>

        </div>
    `;

    document.body.style.overflow = "hidden";

    root.querySelector("input, select, textarea, button")?.focus();
}


export function closeModal() {
    document.getElementById("modal-root").innerHTML = "";
    document.body.style.overflow = "";
}

export function confirmAction(title, description, confirmLabel, action) {
    openModal(`
        <div class="modal-header">

            <div>
                <h2>${escapeHTML(title)}</h2>
                <p>${escapeHTML(description)}</p>
            </div>

            <button
                class="modal-close"
                type="button"
                data-action="cerrar-modal"
                aria-label="Cerrar">
                ×
            </button>

        </div>

        <div class="modal-actions">

            <button
                type="button"
                class="button button-secondary"
                data-action="cerrar-modal">
                Cancelar
            </button>

            <button
                type="button"
                class="button button-primary"
                data-action="${escapeHTML(action)}">
                ${escapeHTML(confirmLabel)}
            </button>

        </div>
    `);
}