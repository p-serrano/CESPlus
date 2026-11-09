/* =====================================================
   CESPLUS — NAVIGATION
   Navegación y control de acceso a secciones
   ===================================================== */

"use strict";

import {
    setCurrentView,
    showToast
} from "../core.js";


// =====================================================
// CONFIGURACIÓN DE SECCIONES
// =====================================================

const VIEW_CONFIG = {
    inicio: {
        title: "Control de cuotas",
        roles: ["admin", "treasurer", "member"]
    },

    familias: {
        title: "Familias y miembros",
        roles: ["admin", "treasurer"]
    },

    economia: {
        title: "Economía",
        roles: ["admin", "treasurer"]
    },

    administracion: {
        title: "Administración",
        roles: ["admin"]
    }
};


// =====================================================
// NAVEGACIÓN
// =====================================================

export function navigate(
    view,
    {
        renderFamilies,
        renderEconomy,
        renderAdministration
    } = {}
) {

    const config = VIEW_CONFIG[view];

    // Comprobar que la sección existe.
    if (!config) return;

    // Comprobar permisos del usuario.
    const userRole = document.documentElement.dataset.userRole;

    if (!config.roles.includes(userRole)) {
        showToast(
            "No tienes permisos para acceder a esta sección."
        );

        return;
    }

    // Actualizar la vista actual.
    setCurrentView(view);

    // Mostrar la sección correspondiente.
    document.querySelectorAll(".view").forEach(section => {

        section.classList.toggle(
            "active",
            section.id === `view-${view}`
        );

    });

    // Actualizar botones de navegación.
    document.querySelectorAll("[data-view]").forEach(button => {

        const active = button.dataset.view === view;

        button.classList.toggle("active", active);

        if (button.matches("button")) {
            button.setAttribute(
                "aria-current",
                active ? "page" : "false"
            );
        }

    });

    // Actualizar título.
    const pageTitle = document.getElementById("page-title");

    if (pageTitle) {
        pageTitle.textContent = config.title;
    }

    // Renderizar contenido de la sección.
    if (view === "familias" && renderFamilies) {
        renderFamilies();
    }

    if (view === "economia" && renderEconomy) {
        renderEconomy();
    }

    if (view === "administracion" && renderAdministration) {
        renderAdministration();
    }

    // Volver al inicio de la página.
    window.scrollTo({
        top: 0,
        behavior: "auto"
    });
}