/* =====================================================
   CESPLUS — EVENTS
   Gestión de eventos e interacciones de la interfaz
   ===================================================== */

"use strict";

import {
    data,
    money,
    createId,
    showToast,
    getFamily,
    setCurrentFilter,
    setActiveAuditFilters
} from "../core.js";

import {
    saveAdminSettings,
    toggleDueStatus,
    confirmPayment,
    revertPayment,
    saveDueForm,
    saveExpenseForm,
    deleteExpense,
    saveFamilyForm,
    saveManageFamilyForm,
    deactivateFamilyManager,
    reactivateFamilyManager,
    confirmReset,
    approveFamilyLinkManager,
    rejectFamilyLinkManager,
    generateFamilyAccessCodeManager
} from "../managers.js";

import { renderDues } from "./dashboard.js";

import { navigate } from "./navigation.js";

import { renderFamilies } from "./families.js";

import {
    updateNewFamilyTotal,
    updateFamilyEditTotal,
    updateMemberFeeByType,
    checkFamilyFeeChanges,
    openNewFamily,
    openNewExpense,
    openEditExpense,
    openEditDue,
    openManageMembers
} from "./forms.js";

import {
    closeModal,
    confirmAction
} from "./modals.js";

import { renderEconomy } from "./economy.js";

import {
    applyAuditFilters,
    renderAuditLog,
    renderAdministration,
    renderUserProfiles
} from "./administration.js";

import {
    updateUserRole
} from "../supabase-data.js";


/* =====================================================
   UTILIDADES DE PERMISOS
   ===================================================== */

function isMember() {
    return document.documentElement.dataset.userRole === "member";
}


function denyAccess() {
    showToast("No tienes permisos para realizar esta acción.");
}


/* =====================================================
   INICIALIZACIÓN DE EVENTOS
   ===================================================== */

export function initEvents({
    handlePaymentStatus,
    handleManagerResult,
    onPeriodChange
}) {

    document.addEventListener("click", event =>
        handleClick(event, {
            handlePaymentStatus,
            handleManagerResult
        })
    );

    document.addEventListener("submit", event =>
        handleSubmit(event, handleManagerResult)
    );

    document.addEventListener("change", event =>
        handleChange(event, onPeriodChange)
    );

    document.addEventListener("keydown", handleKeydown);
    document.addEventListener("input", handleInput);

    document.getElementById("show-all-dues")
        ?.addEventListener("click", () => {

            if (isMember()) {
                denyAccess();
                return;
            }

            setCurrentFilter("todas");

            document.querySelectorAll("[data-filter]").forEach(button => {
                button.classList.toggle(
                    "active",
                    button.dataset.filter === "todas"
                );
            });

            renderDues();
        });
}


/* =====================================================
   EVENTOS: CLICK
   ===================================================== */

async function handleClick(event, {
    handlePaymentStatus,
    handleManagerResult
}) {

    const button = event.target.closest("button");

    // Los miembros únicamente pueden navegar por las
    // secciones que tienen autorizadas.
    if (isMember()) {

        if (button?.dataset.view) {
            navigate(button.dataset.view, {
                renderFamilies,
                renderEconomy,
                renderAdministration
            });

            return;
        }

        // No permitir filtros ni acciones de gestión.
        if (
            button?.dataset.action ||
            button?.dataset.filter ||
            event.target.closest(
                "#audit-filter-toggle, " +
                "#audit-filter-modal, " +
                "#show-all-dues"
            )
        ) {
            denyAccess();
            return;
        }

        // No continuar con eventos administrativos.
        if (event.target.matches(".modal-overlay")) {
            return;
        }

        return;
    }


    // =================================================
    // FILTROS DE AUDITORÍA
    // =================================================

    // Filtros: abrir
    if (event.target.closest("#audit-filter-toggle")) {
        const modal = document.getElementById("audit-filter-modal");
        const button = document.getElementById("audit-filter-toggle");

        if (modal && button) {
            modal.hidden = false;
            button.setAttribute("aria-expanded", "true");
        }

        return;
    }

    // Filtros: cerrar
    if (event.target.closest('[data-action="close-audit-filters"]')) {
        const modal = document.getElementById("audit-filter-modal");
        const toggle = document.getElementById("audit-filter-toggle");

        if (modal && toggle) {
            modal.hidden = true;
            toggle.setAttribute("aria-expanded", "false");
        }

        return;
    }

    // Aplicar filtros
    if (event.target.closest("#audit-apply-filters")) {
        applyAuditFilters();

        const modal = document.getElementById("audit-filter-modal");
        const toggle = document.getElementById("audit-filter-toggle");

        if (modal && toggle) {
            modal.hidden = true;
            toggle.setAttribute("aria-expanded", "false");
        }

        return;
    }

    // Limpiar filtros
    if (event.target.closest("#audit-clear-filters")) {
        document.querySelectorAll(
            'input[name="audit-category"], input[name="audit-tag"], input[name="audit-family"]'
        ).forEach(input => {
            input.checked = false;
        });

        document.getElementById("audit-date-from").value = "";
        document.getElementById("audit-date-to").value = "";

        setActiveAuditFilters({
            categories: [],
            tags: [],
            families: [],
            dateFrom: "",
            dateTo: ""
        });

        renderAuditLog();

        return;
    }


    // =================================================
    // ACCESOS RÁPIDOS DE FECHAS
    // =================================================

    const periodButton = event.target.closest("[data-audit-period]");

    if (periodButton) {
        const fromInput = document.getElementById("audit-date-from");
        const toInput = document.getElementById("audit-date-to");

        const today = new Date();
        const from = new Date(today);

        const formatDate = date => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, "0");
            const day = String(date.getDate()).padStart(2, "0");

            return `${year}-${month}-${day}`;
        };

        toInput.value = formatDate(today);

        switch (periodButton.dataset.auditPeriod) {
            case "24h":
                from.setDate(from.getDate() - 1);
                break;

            case "7d":
                from.setDate(from.getDate() - 6);
                break;

            case "30d":
                from.setDate(from.getDate() - 29);
                break;

            case "month":
                from.setDate(1);
                break;

            case "previous-month":
                from.setMonth(from.getMonth() - 1);
                from.setDate(1);

                toInput.value = formatDate(
                    new Date(today.getFullYear(), today.getMonth(), 0)
                );
                break;
        }

        fromInput.value = formatDate(from);

        return;
    }


    if (!button) {

        // Cerrar modal al pulsar fuera del panel.
        if (event.target.matches(".modal-overlay")) {
            closeModal();
        }

        return;
    }


    // =================================================
    // NAVEGACIÓN
    // =================================================

    if (button.dataset.view) {
        navigate(button.dataset.view, {
            renderFamilies,
            renderEconomy,
            renderAdministration
        });

        return;
    }


    // =================================================
    // FILTROS DE CUOTAS
    // =================================================

    if (button.dataset.filter) {
        setCurrentFilter(button.dataset.filter);

        document.querySelectorAll("[data-filter]").forEach(item => {
            item.classList.toggle("active", item === button);
        });

        renderDues();

        return;
    }


    const action = button.dataset.action;

    if (!action) return;


    // =================================================
    // VINCULACIONES FAMILIARES
    // =================================================

    // Aprobar solicitud
    if (action === "aprobar-vinculacion") {
        const result = await approveFamilyLinkManager(
            button.dataset.requestId
        );

        handleManagerResult(result, {
            closeModal: false
        });

        return;
    }

    // Rechazar solicitud
    if (action === "rechazar-vinculacion") {
        const result = await rejectFamilyLinkManager(
            button.dataset.requestId
        );

        handleManagerResult(result, {
            closeModal: false
        });

        return;
    }


    // =================================================
    // CÓDIGOS DE ACCESO FAMILIAR
    // =================================================

    // Generar código
    if (action === "generar-codigo-familiar") {
        const familyId = button.dataset.familyId;

        button.disabled = true;
        button.textContent = "Generando...";

        const result = await generateFamilyAccessCodeManager(familyId);

        button.disabled = false;
        button.textContent = "Regenerar código";

        if (!result.ok) {
            showToast(result.message);
            return;
        }

        const resultContainer = document.getElementById(
            "family-access-code-result"
        );

        const codeElement = document.getElementById(
            "family-access-code-value"
        );

        if (resultContainer && codeElement) {
            codeElement.textContent = result.code;
            resultContainer.hidden = false;
        }

        showToast(result.message);

        return;
    }

    // Copiar código
    if (action === "copiar-codigo-familiar") {
        const codeElement = document.getElementById(
            "family-access-code-value"
        );

        const code = codeElement?.textContent.trim();

        if (!code) {
            showToast("No hay ningún código para copiar.");
            return;
        }

        try {
            await navigator.clipboard.writeText(code);

            showToast("Código copiado al portapapeles.");

        } catch (error) {
            console.error("Error copiando el código:", error);
            showToast("No se ha podido copiar el código.");
        }

        return;
    }


    // =================================================
    // MODALES
    // =================================================

    if (action === "cerrar-modal") {
        closeModal();
        return;
    }


    // =================================================
    // CUOTAS
    // =================================================

    if (action === "editar-cuota") {
        openEditDue(button.dataset.dueId);
        return;
    }

    if (action === "cambiar-estado") {
        handlePaymentStatus(button.dataset.dueId);
        return;
    }


    // =================================================
    // FAMILIAS
    // =================================================

    if (action === "familia") {
        openNewFamily();
        return;
    }

    if (action === "gestionar-miembros") {
        openManageMembers(button.dataset.familyId);
        return;
    }

    // Desactivar familia
    if (action === "desactivar-familia") {
        const familyId = button.dataset.familyId;
        const family = getFamily(familyId);

        if (!family) return;

        confirmAction(
            "Desactivar familia",
            `¿Quieres desactivar la familia «${family.name}»? Dejará de aparecer en el listado de familias activas, pero se conservarán sus miembros, cuotas e historial.`,
            "Desactivar familia",
            `confirmar-desactivar-familia:${familyId}`
        );

        return;
    }

    // Reactivar familia
    if (action === "reactivar-familia") {
        const familyId = button.dataset.familyId;
        const family = getFamily(familyId);

        if (!family) return;

        confirmAction(
            "Reactivar familia",
            `¿Quieres reactivar la familia «${family.name}»? Volverá a aparecer en el listado de familias activas.`,
            "Reactivar familia",
            `confirmar-reactivar-familia:${familyId}`
        );

        return;
    }

    // Desplegar familia
    if (action === "toggle-family") {
        const detailsId = button.getAttribute("aria-controls");
        const details = document.getElementById(detailsId);

        if (!details) return;

        const isExpanded =
            button.getAttribute("aria-expanded") === "true";

        button.setAttribute("aria-expanded", String(!isExpanded));
        details.hidden = isExpanded;

        return;
    }


    // =================================================
    // GASTOS
    // =================================================

    if (action === "gasto") {
        openNewExpense();
        return;
    }

    if (action === "editar-gasto") {
        openEditExpense(button.dataset.expenseId);
        return;
    }

    if (action === "eliminar-gasto") {
        const expense = data.expenses.find(
            item => item.id === button.dataset.expenseId
        );

        if (!expense) return;

        confirmAction(
            "Eliminar gasto",
            `¿Quieres eliminar el gasto «${expense.concept}» de ${money(expense.amountCents)}? Esta operación modificará el saldo, pero quedará registrada en el historial.`,
            "Eliminar gasto",
            `confirmar-eliminar-gasto:${expense.id}`
        );

        return;
    }


    // =================================================
    // MIEMBROS DE UNA FAMILIA
    // =================================================

    // Añadir miembro
    if (action === "anadir-miembro") {
        const form = button.closest("form");

        if (!form) return;

        const list = form.querySelector(
            "#manage-members-list, #new-family-members-list"
        );

        if (!list) return;

        const row = document.createElement("div");

        row.className = "member-edit-row";
        row.dataset.memberId = createId("member");

        row.innerHTML = `
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
        `;

        list.appendChild(row);

        row.querySelector('[name="memberName"]').focus();

        if (form.id === "new-family-form") {
            updateNewFamilyTotal();
        } else {
            updateFamilyEditTotal();
        }

        return;
    }

    // Eliminar miembro
    if (action === "eliminar-miembro") {
        const row = button.closest(".member-edit-row");
        const form = button.closest("form");

        if (!row || !form) return;

        const list = row.parentElement;

        if (list.querySelectorAll(".member-edit-row").length <= 1) {
            showToast("La familia debe tener al menos un miembro.");
            return;
        }

        row.remove();

        if (form.id === "new-family-form") {
            updateNewFamilyTotal();
        } else {
            updateFamilyEditTotal();
            checkFamilyFeeChanges(form);
        }

        return;
    }


    // =================================================
    // RESTABLECER DATOS
    // =================================================

    if (action === "reset-demo") {
        confirmAction(
            "Restablecer datos",
            "Se eliminarán los cambios realizados y se recuperarán los datos de demostración. Esta operación no se puede deshacer.",
            "Restablecer datos",
            "confirmar-restablecer"
        );

        return;
    }

    if (action === "confirmar-restablecer") {
        const result = confirmReset();

        handleManagerResult(result, {
            render: true
        });

        return;
    }


    // =================================================
    // CONFIRMACIONES
    // =================================================

    // Confirmar pago
    if (action.startsWith("confirmar-pago:")) {
        const result = await confirmPayment(action.split(":")[1]);

        handleManagerResult(result);

        return;
    }

    // Anular ingreso
    if (action.startsWith("confirmar-pendiente:")) {
        const result = await revertPayment(action.split(":")[1]);

        handleManagerResult(result);

        return;
    }

    // Eliminar gasto
    if (action.startsWith("confirmar-eliminar-gasto:")) {
        const result = await deleteExpense(action.split(":")[1]);

        handleManagerResult(result);

        return;
    }

    // Desactivar familia
    if (action.startsWith("confirmar-desactivar-familia:")) {
        const result = await deactivateFamilyManager(
            action.split(":")[1]
        );

        handleManagerResult(result, {
            render: true
        });

        return;
    }

    // Reactivar familia
    if (action.startsWith("confirmar-reactivar-familia:")) {
        const result = await reactivateFamilyManager(
            action.split(":")[1]
        );

        handleManagerResult(result, {
            render: true
        });

        return;
    }
}


/* =====================================================
   EVENTOS: SUBMIT
   ===================================================== */

async function handleSubmit(event, handleManagerResult) {

    const form = event.target;

    if (!(form instanceof HTMLFormElement)) return;

    // ================================================
    // GESTIÓN DE USUARIOS Y PERMISOS
    // ================================================

    if (form.matches("[data-user-role-form]")) {
        event.preventDefault();

        // Solo el administrador puede modificar permisos.
        if (document.documentElement.dataset.userRole !== "admin") {
            denyAccess();
            return;
        }

        const userId = form.dataset.userId;
        const role = form.elements.role?.value;
        const button = form.querySelector('button[type="submit"]');

        if (!userId || !role) {
            showToast("No se han podido identificar los datos del usuario.");
            return;
        }

        if (!["member", "treasurer", "admin"].includes(role)) {
            showToast("El permiso seleccionado no es válido.");
            return;
        }

        if (button) {
            button.disabled = true;
            button.textContent = "Guardando...";
        }

        try {
            await updateUserRole(userId, role);

            showToast("Permisos actualizados correctamente.");

            await renderUserProfiles();

        } catch (error) {
            console.error("Error actualizando permisos:", error);

            showToast(
                error.message || "No se han podido actualizar los permisos."
            );

            if (button) {
                button.disabled = false;
                button.textContent = "Guardar";
            }
        }

        return;
    }

    // Un miembro no puede enviar formularios de gestión.
    if (isMember()) {
        event.preventDefault();
        denyAccess();
        return;
    }

    if (form.id === "admin-settings-form") {
        event.preventDefault();

        const result = saveAdminSettings(form);

        handleManagerResult(result, {
            closeModal: false
        });

        return;
    }

    if (form.id === "edit-due-form") {
        event.preventDefault();

        const result = saveDueForm(form);

        handleManagerResult(result);

        return;
    }

    if (form.id === "manage-family-form") {
        event.preventDefault();

        const result = await saveManageFamilyForm(form);

        handleManagerResult(result);

        return;
    }

    if (form.id === "new-expense-form") {
        event.preventDefault();

        const result = await saveExpenseForm(form);

        handleManagerResult(result);

        return;
    }

    if (form.id === "new-family-form") {
        event.preventDefault();

        const result = await saveFamilyForm(form);

        handleManagerResult(result, {
            navigate: "familias"
        });
    }
}


/* =====================================================
   EVENTOS: CHANGE
   ===================================================== */

function handleChange(event, onPeriodChange) {

    // Selector general de meses.
    if (event.target.id === "period-select") {

        if (typeof onPeriodChange === "function") {
            onPeriodChange(event.target.value);
        }

        return;
    }

    if (
        event.target.matches(
            '#manage-members-list [name="memberType"], #new-family-members-list [name="memberType"]'
        )
    ) {
        updateMemberFeeByType(event.target);
        return;
    }

    if (
        event.target.matches(
            '#manage-members-list [name="memberFee"]'
        )
    ) {
        updateFamilyEditTotal();

        const form = event.target.closest("#manage-family-form");

        if (form) {
            checkFamilyFeeChanges(form);
        }

        return;
    }

    if (
        event.target.matches(
            '#new-family-members-list [name="memberFee"]'
        )
    ) {
        updateNewFamilyTotal();
    }
}


/* =====================================================
   EVENTOS: INPUT
   ===================================================== */

function handleInput(event) {

    if (isMember()) return;

    if (event.target.matches("#audit-search-input")) {
        renderAuditLog();
        return;
    }

    if (
        event.target.matches(
            '#manage-members-list [name="memberFee"]'
        )
    ) {
        updateFamilyEditTotal();

        const form = event.target.closest("#manage-family-form");

        if (form) {
            checkFamilyFeeChanges(form);
        }

        return;
    }

    if (
        event.target.matches(
            '#new-family-members-list [name="memberFee"]'
        )
    ) {
        updateNewFamilyTotal();
    }
}


/* =====================================================
   EVENTOS: KEYDOWN
   ===================================================== */

function handleKeydown(event) {

    if (event.key === "Escape") {
        closeModal();

        const filterModal = document.getElementById("audit-filter-modal");
        const filterToggle = document.getElementById("audit-filter-toggle");

        if (filterModal && filterToggle) {
            filterModal.hidden = true;
            filterToggle.setAttribute("aria-expanded", "false");
        }
    }
}