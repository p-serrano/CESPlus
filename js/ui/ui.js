/* =====================================================
   CESPLUS — UI
   Coordinación general de la interfaz
   ===================================================== */

"use strict";

import {
    currentView,
    currentPeriod,
    showToast,
    load,
    ensurePeriodDues,
    setCurrentPeriod
} from "../core.js";

import {
    toggleDueStatus,
    confirmPayment
} from "../managers.js";

import {
    renderPeriodSelect,
    renderSummary,
    renderDues,
    renderMemberDashboard,
    updateDashboardVisibility,
    setSelectedDashboardPeriod
} from "./dashboard.js";

import { navigate } from "./navigation.js";
import { renderFamilies } from "./families.js";
import { renderEconomy } from "./economy.js";
import { renderAdministration } from "./administration.js";

import {
    closeModal,
    openModal,
    confirmAction
} from "./modals.js";

import { initEvents } from "./events.js";


// =====================================================
// GESTIÓN DE PAGOS
// =====================================================

async function handlePaymentStatus(dueId) {
    const result = toggleDueStatus(dueId);

    if (!result.ok) {
        showToast(result.message);
        return;
    }

    // -----------------------------------------------
    // CUOTA PENDIENTE: elegir tipo de ingreso
    // -----------------------------------------------

    if (result.action === "payment") {
        openModal(`
            <div class="modal-header">
                <div>
                    <h2>Registrar ingreso</h2>
                    <p>¿El ingreso de esta cuota es completo?</p>
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
                    data-action="iniciar-pago-parcial"
                    data-due-id="${dueId}">
                    No, es parcial
                </button>

                <button
                    type="button"
                    class="button button-primary"
                    data-action="iniciar-pago-completo"
                    data-due-id="${dueId}">
                    Sí, es completo
                </button>
            </div>
        `);

        return;
    }

    // -----------------------------------------------
    // CUOTA CON DEUDA: completar importe restante
    // -----------------------------------------------

    if (result.action === "complete-payment") {
        confirmAction(
            result.title,
            result.description,
            result.confirmLabel,
            `confirmar-completar-pago:${dueId}`
        );

        return;
    }

    // -----------------------------------------------
    // CUOTA PAGADA: anular ingreso
    // -----------------------------------------------

    if (result.action === "reversal") {
        confirmAction(
            result.title,
            result.description,
            result.confirmLabel,
            `confirmar-pendiente:${dueId}`
        );
    }
}


// =====================================================
// RESULTADOS DE OPERACIONES
// =====================================================

function handleManagerResult(result, options = {}) {
    if (!result) return;

    if (!result.ok) {
        showToast(
            result.message ||
            "No se ha podido completar la operación."
        );

        return;
    }

    if (options.closeModal !== false) {
        closeModal();
    }

    if (options.render !== false) {
        renderAll();
    }

    if (result.message) {
        showToast(result.message);
    }

    if (options.navigate) {
        navigate(options.navigate, {
            renderFamilies,
            renderEconomy,
            renderAdministration
        });
    }
}


// =====================================================
// RENDERIZADO GENERAL
// =====================================================

export function renderAll() {

    // Selector de periodos.
    renderPeriodSelect();

    // Mostrar los bloques correspondientes al rol.
    updateDashboardVisibility();

    // Indicadores económicos.
    renderSummary();

    // Dashboard específico según el perfil.
    const userRole = document.documentElement.dataset.userRole;

    if (userRole === "member") {

        renderMemberDashboard();

    } else {

        renderDues();

    }

    // Otras secciones.
    if (currentView === "familias") {
        renderFamilies();
    }

    if (currentView === "economia") {
        renderEconomy();
    }

    if (currentView === "administracion") {
        renderAdministration();
    }
}


// =====================================================
// INICIALIZACIÓN
// =====================================================

let uiInitialized = false;

export function init({ supabase = false } = {}) {

    if (uiInitialized) {
        renderAll();
        return;
    }

    // Carga de datos local para el modo de prueba.
    if (!supabase) {
        load();
        ensurePeriodDues(currentPeriod);
    }

    initEvents({

        handlePaymentStatus,

        handleManagerResult,

        // Cambio de periodo desde el selector.
        onPeriodChange: period => {
            setSelectedDashboardPeriod(period);
            renderAll();
        }

    });

    uiInitialized = true;

    renderAll();
}