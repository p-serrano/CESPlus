"use strict";

import {
    data,
    money,
    getFamily,
    createId,
    escapeHTML,
    showToast
} from "../core.js";

import { openModal } from "./modals.js";

import { getFamilyAccessCodeManager } from "../managers.js";


export function updateNewFamilyTotal() {
    const rows = document.querySelectorAll(
        "#new-family-members-list .member-edit-row"
    );

    let total = 0;

    rows.forEach(row => {
        const input = row.querySelector('[name="memberFee"]');
        const amount = Number(input?.value);

        if (Number.isFinite(amount) && amount >= 0) {
            total += Math.round(amount * 100);
        }
    });

    const output = document.getElementById("new-family-total");

    if (output) {
        output.textContent = money(total);
    }
}


export function updateFamilyEditTotal() {
    const rows = document.querySelectorAll(
        "#manage-members-list .member-edit-row"
    );

    let total = 0;

    rows.forEach(row => {
        const input = row.querySelector('[name="memberFee"]');
        const amount = Number(input?.value);

        if (Number.isFinite(amount) && amount >= 0) {
            total += Math.round(amount * 100);
        }
    });

    const output = document.getElementById("family-edit-total");

    if (output) {
        output.textContent = money(total);
    }
}


export function updateMemberFeeByType(select) {
    const row = select.closest(".member-edit-row");

    if (!row) return;

    const feeInput = row.querySelector('[name="memberFee"]');

    if (!feeInput) return;

    const type = select.value;

    const feeCents = type === "child"
        ? data.settings.childFeeCents
        : data.settings.adultFeeCents;

    feeInput.value = (feeCents / 100).toFixed(2);

    const form = select.closest("form");

    if (form?.id === "new-family-form") {
        updateNewFamilyTotal();
    } else {
        updateFamilyEditTotal();
        checkFamilyFeeChanges(form);
    }
}


export function checkFamilyFeeChanges(form) {
    if (!form) return;

    const family = getFamily(form.dataset.familyId);

    if (!family) return;

    const originalMembers = family.memberList || [];
    const rows = form.querySelectorAll(".member-edit-row");

    let requiresReason = false;

    rows.forEach(row => {
        const memberId = row.dataset.memberId;

        const original = originalMembers.find(
            member => member.id === memberId
        );

        if (!original) return;

        const type = row.querySelector('[name="memberType"]').value;

        const amount = Number(
            row.querySelector('[name="memberFee"]').value
        );

        if (!Number.isFinite(amount)) return;

        const newFeeCents = Math.round(amount * 100);

        if (original.monthlyFeeCents !== newFeeCents) {
            const standardFeeForNewType = type === "child"
                ? data.settings.childFeeCents
                : data.settings.adultFeeCents;

            const automaticTypeChange =
                original.type !== type &&
                newFeeCents === standardFeeForNewType;

            if (!automaticTypeChange) {
                requiresReason = true;
            }
        }
    });

    const reasonGroup = document.getElementById(
        "fee-change-reason-group"
    );

    const reasonInput = form.querySelector(
        '[name="feeChangeReason"]'
    );

    if (reasonGroup) {
        reasonGroup.hidden = !requiresReason;
    }

    if (reasonInput) {
        reasonInput.required = requiresReason;

        if (!requiresReason) {
            reasonInput.value = "";
        }
    }
}

/* =====================================================
   FORMULARIOS DE FAMILIAS Y GASTOS
   ===================================================== */

export function openNewFamily() {
    const memberId = createId("member");

    openModal(`
        <div class="modal-header">

            <div>
                <h2>Nueva familia</h2>
                <p>Registra una familia y sus miembros.</p>
            </div>

            <button
                class="modal-close"
                type="button"
                data-action="cerrar-modal"
                aria-label="Cerrar">
                ×
            </button>

        </div>

        <form id="new-family-form">

            <div class="form-group">
                <label for="family-name">Nombre de la familia</label>

                <input
                    id="family-name"
                    name="name"
                    type="text"
                    maxlength="100"
                    required
                    placeholder="Ej. García">
            </div>

            <div class="section-heading">

                <div>
                    <h3>Miembros</h3>
                    <p>Añade los integrantes de la familia.</p>
                </div>

                <button
                    type="button"
                    class="button button-secondary"
                    data-action="anadir-miembro">
                    + Añadir miembro
                </button>

            </div>

            <div id="new-family-members-list">

                <div class="member-edit-row" data-member-id="${memberId}">

                    <div class="form-group member-name-field">
                        <label>Nombre</label>

                        <input
                            type="text"
                            name="memberName"
                            maxlength="100"
                            required
                            placeholder="Nombre del miembro">
                    </div>

                    <div class="form-group member-type-field">
                        <label>Tipo</label>

                        <select name="memberType">
                            <option value="adult" selected>Adulto</option>
                            <option value="child">Niño</option>
                        </select>
                    </div>

                    <div class="form-group member-fee-field">
                        <label>Cuota (€)</label>

                        <input
                            type="number"
                            name="memberFee"
                            min="0"
                            max="100000"
                            step="0.01"
                            inputmode="decimal"
                            required
                            value="${(data.settings.adultFeeCents / 100).toFixed(2)}">
                    </div>

                    <button
                        type="button"
                        class="member-remove-button"
                        data-action="eliminar-miembro"
                        aria-label="Eliminar miembro">
                        ×
                    </button>

                </div>

            </div>

            <div class="family-edit-total">
                <span>Cuota mensual de la familia</span>
                <strong id="new-family-total">0,00 €</strong>
            </div>

            <p class="form-help">
                Las cuotas individuales se sumarán automáticamente
                para calcular la cuota mensual de la familia.
            </p>

            <div class="modal-actions">

                <button
                    type="button"
                    class="button button-secondary"
                    data-action="cerrar-modal">
                    Cancelar
                </button>

                <button
                    type="submit"
                    class="button button-primary">
                    Crear familia
                </button>

            </div>

        </form>
    `);

    updateNewFamilyTotal();
}


export function openNewExpense() {
    const userRole = document.documentElement.dataset.userRole;

    if (!["admin", "treasurer"].includes(userRole)) {
        showToast("No tienes permisos para registrar gastos.");
        return;
    }

    openModal(`
        <div class="modal-header">

            <div>
                <h2>Registrar gasto</h2>
                <p>Anota una salida de dinero de la peña.</p>
            </div>

            <button
                class="modal-close"
                type="button"
                data-action="cerrar-modal"
                aria-label="Cerrar">
                ×
            </button>

        </div>

        <form id="new-expense-form">

            <div class="form-group">
                <label for="expense-concept">Concepto</label>

                <input
                    id="expense-concept"
                    name="concept"
                    type="text"
                    maxlength="120"
                    placeholder="Ej. Factura de electricidad"
                    required>
            </div>

            <div class="form-group">
                <label for="expense-amount">Importe (€)</label>

                <input
                    id="expense-amount"
                    name="amount"
                    type="number"
                    inputmode="decimal"
                    min="0.01"
                    max="100000"
                    step="0.01"
                    required
                    placeholder="0,00">
            </div>

            <div class="form-group">
                <label for="expense-date">Fecha</label>

                <input
                    id="expense-date"
                    name="date"
                    type="date"
                    required
                    value="${new Date().toLocaleDateString("en-CA")}">
            </div>

            <div class="modal-actions">

                <button
                    type="button"
                    class="button button-secondary"
                    data-action="cerrar-modal">
                    Cancelar
                </button>

                <button
                    type="submit"
                    class="button button-primary">
                    Guardar gasto
                </button>

            </div>

        </form>
    `);
}


export function openEditExpense(expenseId) {
    const expense = data.expenses.find(
        item => item.id === expenseId
    );

    if (!expense) return;

    openModal(`
        <div class="modal-header">

            <div>
                <h2>Editar gasto</h2>
                <p>Modifica los datos del movimiento.</p>
            </div>

            <button
                class="modal-close"
                type="button"
                data-action="cerrar-modal"
                aria-label="Cerrar">
                ×
            </button>

        </div>

        <form
            id="new-expense-form"
            data-expense-id="${escapeHTML(expense.id)}">

            <div class="form-group">
                <label for="expense-concept">Concepto</label>

                <input
                    id="expense-concept"
                    name="concept"
                    type="text"
                    maxlength="120"
                    required
                    value="${escapeHTML(expense.concept)}">
            </div>

            <div class="form-group">
                <label for="expense-amount">Importe (€)</label>

                <input
                    id="expense-amount"
                    name="amount"
                    type="number"
                    inputmode="decimal"
                    min="0.01"
                    max="100000"
                    step="0.01"
                    required
                    value="${(expense.amountCents / 100).toFixed(2)}">
            </div>

            <div class="form-group">
                <label for="expense-date">Fecha</label>

                <input
                    id="expense-date"
                    name="date"
                    type="date"
                    required
                    value="${escapeHTML(expense.date)}">
            </div>

            <div class="modal-actions">

                <button
                    type="button"
                    class="button button-secondary"
                    data-action="cerrar-modal">
                    Cancelar
                </button>

                <button
                    type="submit"
                    class="button button-primary">
                    Guardar cambios
                </button>

            </div>

        </form>
    `);
}

/* =====================================================
   MODALES
   ===================================================== */

export function openEditDue(dueId) {
    const due = data.dues.find(item => item.id === dueId);

    if (!due) return;

    const family = getFamily(due.familyId);

    if (!family) return;

    openModal(`
        <div class="modal-header">

            <div>
                <h2>Editar cuota</h2>
                <p>
                    ${escapeHTML(family.name)} ·
                    ${escapeHTML(periodLabel(due.period))}
                </p>
            </div>

            <button
                class="modal-close"
                type="button"
                data-action="cerrar-modal"
                aria-label="Cerrar">
                ×
            </button>

        </div>

        <form id="edit-due-form" data-due-id="${escapeHTML(due.id)}">

            <div class="form-group">

                <label for="due-amount-input">
                    Importe esperado (€)
                </label>

                <input
                    id="due-amount-input"
                    name="amount"
                    type="number"
                    inputmode="decimal"
                    min="0"
                    max="100000"
                    step="0.01"
                    required
                    value="${(due.expectedCents / 100).toFixed(2)}">

            </div>

            <div class="form-group">

                <label for="due-justification-input">
                    Justificación (opcional)
                </label>

                <textarea
                    id="due-justification-input"
                    name="justification"
                    maxlength="500"
                    placeholder="Por ejemplo, derrama o pago especial...">${escapeHTML(due.justification || "")}</textarea>

            </div>

            <p class="due-family-meta">
                ${due.status === "pagado"
                    ? "Esta cuota ya está pagada. Para cambiar el importe, primero tendrás que devolverla a pendiente."
                    : "Los cambios solo afectan a esta cuota mensual."}
            </p>

            <div class="modal-actions">

                <button
                    type="button"
                    class="button button-secondary"
                    data-action="cerrar-modal">
                    Cancelar
                </button>

                <button
                    type="submit"
                    class="button button-primary"
                    ${due.status === "pagado" ? "disabled" : ""}>
                    Guardar cambios
                </button>

            </div>

        </form>
    `);
}


export function openManageMembers(familyId) {
    const family = getFamily(familyId);

    if (!family) return;

    if (!Array.isArray(family.memberList)) {
        family.memberList = [];
    }

    const members = (family.memberList || [])
        .filter(member => member.active);

    const memberRows = members.map(member => `
        <div class="member-edit-row" data-member-id="${escapeHTML(member.id)}">

            <div class="form-group member-name-field">
                <label>Nombre</label>

                <input
                    type="text"
                    name="memberName"
                    maxlength="100"
                    required
                    value="${escapeHTML(member.name)}">
            </div>

            <div class="form-group member-type-field">
                <label>Tipo</label>

                <select name="memberType">

                    <option value="adult" ${member.type === "adult" ? "selected" : ""}>
                        Adulto
                    </option>

                    <option value="child" ${member.type === "child" ? "selected" : ""}>
                        Niño
                    </option>

                </select>
            </div>

            <div class="form-group member-fee-field">
                <label>Cuota (€)</label>

                <input
                    type="number"
                    name="memberFee"
                    min="0"
                    max="100000"
                    step="0.01"
                    inputmode="decimal"
                    required
                    value="${(member.monthlyFeeCents / 100).toFixed(2)}">
            </div>

            <button
                type="button"
                class="member-remove-button"
                data-action="eliminar-miembro"
                aria-label="Eliminar miembro">
                ×
            </button>

        </div>
    `).join("");

    openModal(`
        <div class="modal-header">

            <div>
                <h2>Editar familia</h2>
                <p>Gestiona los miembros y sus cuotas.</p>
            </div>

            <button
                class="modal-close"
                type="button"
                data-action="cerrar-modal"
                aria-label="Cerrar">
                ×
            </button>

        </div>

        <form id="manage-family-form" data-family-id="${escapeHTML(family.id)}">

            <div class="form-group">

                <label for="manage-family-name">
                    Nombre de la familia
                </label>

                <input
                    id="manage-family-name"
                    name="familyName"
                    type="text"
                    maxlength="100"
                    required
                    value="${escapeHTML(family.name)}">

            </div>

            ${document.documentElement.dataset.userRole === "admin" ? `
                <div class="family-access-section">

                    <div class="section-heading">
                        <div>
                            <h3>Código de acceso familiar</h3>
                            <p>Compártelo con los adultos de esta familia para que puedan solicitar acceso.</p>
                        </div>
                    </div>

                    <div class="family-access-code-actions">
                        <button
                            type="button"
                            id="family-access-code-button"
                            class="button button-secondary"
                            data-action="generar-codigo-familiar"
                            data-family-id="${escapeHTML(family.id)}"
                            disabled>
                            Comprobando código...
                        </button>
                    </div>

                    <div
                        id="family-access-code-result"
                        class="family-access-code-result"
                        hidden>

                        <strong id="family-access-code-value"></strong>

                        <button
                            type="button"
                            class="button button-secondary family-access-copy-button"
                            data-action="copiar-codigo-familiar">
                            Copiar código
                        </button>

                        <p class="form-help">
                            Comparte este código con los adultos de la familia.
                        </p>

                    </div>

                </div>
            ` : ""}

            <div class="section-heading">

                <div>
                    <h3>Miembros</h3>
                    <p>Edita los importes individuales.</p>
                </div>

                <button
                    type="button"
                    class="button button-secondary"
                    data-action="anadir-miembro">
                    + Añadir
                </button>

            </div>

            <div id="manage-members-list">
                ${memberRows}
            </div>

            <div class="family-edit-total">
                <span>Cuota mensual calculada</span>
                <strong id="family-edit-total">0,00 €</strong>
            </div>

            <div class="form-group" id="fee-change-reason-group" hidden>

                <label for="fee-change-reason">
                    Motivo del cambio de cuota
                </label>

                <textarea
                    id="fee-change-reason"
                    name="feeChangeReason"
                    rows="3"
                    maxlength="500"
                    placeholder="Explica por qué cambia la cuota..."></textarea>

                <p class="form-help">
                    Este motivo quedará registrado en el historial de la familia.
                </p>

            </div>

            <p class="form-help">
                Los cambios en los miembros no modificarán las mensualidades
                anteriores. Si la cuota actual está pendiente, podrás actualizar
                su importe al guardar.
            </p>

            <div class="modal-actions family-edit-actions">

                <button
                    type="button"
                    class="button button-danger"
                    data-action="desactivar-familia"
                    data-family-id="${escapeHTML(family.id)}">
                    Desactivar familia
                </button>

                <div class="modal-actions-main">

                    <button
                        type="button"
                        class="button button-secondary"
                        data-action="cerrar-modal">
                        Cancelar
                    </button>

                    <button
                        type="submit"
                        class="button button-primary">
                        Guardar cambios
                    </button>

                </div>

            </div>

        </form>
    `);

    updateFamilyEditTotal();

    // Recuperar el último código de acceso de la familia.
    if (document.documentElement.dataset.userRole === "admin") {

        (async () => {
            const result = await getFamilyAccessCodeManager(family.id);

            const button = document.getElementById(
                "family-access-code-button"
            );

            const resultContainer = document.getElementById(
                "family-access-code-result"
            );

            const codeElement = document.getElementById(
                "family-access-code-value"
            );

            if (!button || !resultContainer || !codeElement) return;

            button.disabled = false;

            if (!result.ok) {
                button.textContent = "Reintentar consulta";
                showToast(result.message);
                return;
            }

            if (result.code) {
                codeElement.textContent = result.code;
                resultContainer.hidden = false;
                button.textContent = "Regenerar código";
            } else {
                button.textContent = "Generar código";
            }

        })();

    }
}