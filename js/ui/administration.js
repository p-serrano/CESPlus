"use strict";

import {
    data,
    escapeHTML,
    activeAuditFilters,
    auditTagLabels,
    setActiveAuditFilters
} from "../core.js";

import {
    loadFamilyLinkRequests
} from "../managers.js";

import {
    loadUserProfiles
} from "../supabase-data.js";


/* =====================================================
   HISTORIAL DE ACTIVIDAD
   ===================================================== */

export function applyAuditFilters() {
    const filters = {
        categories: [...document.querySelectorAll(
            'input[name="audit-category"]:checked'
        )].map(input => input.value),

        tags: [...document.querySelectorAll(
            'input[name="audit-tag"]:checked'
        )].map(input => input.value),

        families: [...document.querySelectorAll(
            'input[name="audit-family"]:checked'
        )].map(input => input.value),

        dateFrom: document.getElementById("audit-date-from")?.value || "",
        dateTo: document.getElementById("audit-date-to")?.value || ""
    };

    setActiveAuditFilters(filters);
    renderAuditLog();
}


export function renderAuditLog() {
    const container = document.getElementById("audit-log-list");
    const summary = document.getElementById("audit-results-summary");

    if (!container) return;

    const selectedCategories = activeAuditFilters.categories;
    const selectedTags = activeAuditFilters.tags;
    const selectedFamilies = activeAuditFilters.families;

    const searchInput = document.getElementById("audit-search-input");

    const searchTerm = (searchInput?.value || "")
        .trim()
        .toLocaleLowerCase("es");

    const dateFrom = activeAuditFilters.dateFrom;
    const dateTo = activeAuditFilters.dateTo;

    const hasFilters =
        selectedCategories.length > 0 ||
        selectedTags.length > 0 ||
        selectedFamilies.length > 0 ||
        searchTerm !== "" ||
        dateFrom !== "" ||
        dateTo !== "";

    if (!hasFilters) {
        container.innerHTML = "";

        if (summary) {
            summary.hidden = true;
            summary.textContent = "";
        }

        return;
    }

    const entries = (data.auditLog || []).filter(entry => {
        const categoryMatches =
            selectedCategories.length === 0 ||
            selectedCategories.includes(entry.category);

        const tagMatches =
            selectedTags.length === 0 ||
            (entry.tags || []).some(tag => selectedTags.includes(tag));

        const familyMatches =
            selectedFamilies.length === 0 ||
            selectedFamilies.includes(String(entry.familyId));

        const description = String(entry.description || "")
            .toLocaleLowerCase("es");

        const familyName = String(entry.familyName || "")
            .toLocaleLowerCase("es");

        const reason = String(entry.reason || "")
            .toLocaleLowerCase("es");

        const searchMatches =
            !searchTerm ||
            description.includes(searchTerm) ||
            familyName.includes(searchTerm) ||
            reason.includes(searchTerm);

        const entryDate = new Date(entry.date);

        const entryDay = new Date(
            entryDate.getFullYear(),
            entryDate.getMonth(),
            entryDate.getDate()
        );

        let dateMatches = true;

        if (dateFrom) {
            const fromDate = new Date(`${dateFrom}T00:00:00`);
            dateMatches = dateMatches && entryDay >= fromDate;
        }

        if (dateTo) {
            const toDate = new Date(`${dateTo}T23:59:59.999`);
            dateMatches = dateMatches && entryDate <= toDate;
        }

        return (
            categoryMatches &&
            tagMatches &&
            familyMatches &&
            searchMatches &&
            dateMatches
        );
    });

    if (summary) {
        summary.hidden = !hasFilters;

        summary.textContent =
            `${entries.length} movimiento${entries.length !== 1 ? "s" : ""} encontrado${entries.length !== 1 ? "s" : ""}`;
    }

    if (entries.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">◷</div>
                <h3>No hay movimientos</h3>
                <p>
                    No se han encontrado movimientos con los filtros seleccionados.
                </p>
            </div>
        `;

        return;
    }

    container.innerHTML = entries.map(entry => {
        const date = new Date(entry.date);

        const formattedDate = date.toLocaleString("es-ES", {
            dateStyle: "medium",
            timeStyle: "short"
        });

        const tags = (entry.tags || []).map(tag => `
            <span class="audit-tag">
                ${escapeHTML(auditTagLabels[tag] || tag)}
            </span>
        `).join(" ");

        let changesHTML = "";

        if (entry.changes) {
            const changes = entry.changes;

            if (
                changes.previousValue !== undefined &&
                changes.newValue !== undefined
            ) {
                const isFeeChange = [
                    "member_fee_changed",
                    "due_amount_updated"
                ].includes(entry.action);

                const previous = isFeeChange
                    ? (changes.previousValue / 100).toLocaleString("es-ES", {
                        style: "currency",
                        currency: "EUR"
                    })
                    : changes.previousValue;

                const next = isFeeChange
                    ? (changes.newValue / 100).toLocaleString("es-ES", {
                        style: "currency",
                        currency: "EUR"
                    })
                    : changes.newValue;

                changesHTML = `
                    <div class="audit-change">
                        <span>${escapeHTML(String(previous))}</span>
                        <span>→</span>
                        <strong>${escapeHTML(String(next))}</strong>
                    </div>
                `;
            }
        }

        return `
            <article class="audit-entry">

                <div class="audit-entry-header">
                    <span class="audit-date">
                        ${escapeHTML(formattedDate)}
                    </span>

                    <div class="audit-tags">
                        ${tags}
                    </div>
                </div>

                <h4>
                    ${escapeHTML(entry.description || "Movimiento registrado")}
                </h4>

                <p class="audit-family">
                    ${escapeHTML(entry.familyName || "Administración")}
                </p>

                ${changesHTML}

                ${entry.reason ? `
                    <p class="audit-reason">
                        <strong>Motivo:</strong>
                        ${escapeHTML(entry.reason)}
                    </p>
                ` : ""}

            </article>
        `;
    }).join("");
}


/* =====================================================
   SOLICITUDES DE VINCULACIÓN
   ===================================================== */

export async function renderFamilyLinkRequests() {
    const container = document.getElementById(
        "family-link-requests-list"
    );

    if (!container) return;

    container.innerHTML = "<p>Cargando solicitudes...</p>";

    const result = await loadFamilyLinkRequests();

    if (!result.ok) {
        container.innerHTML = `
            <p class="empty-state">
                No se han podido cargar las solicitudes.
            </p>
        `;
        console.error(result.message);
        return;
    }

    const counter = document.getElementById(
        "family-link-requests-count"
    );

    if (counter) {
        counter.textContent = result.requests.length;
        counter.hidden = result.requests.length === 0;
    }

    if (result.requests.length === 0) {
        container.innerHTML = `
            <p class="empty-state">
                No hay solicitudes pendientes de aprobación.
            </p>
        `;
        return;
    }

    container.innerHTML = result.requests.map(request => `
    <div class="family-link-request">

        <div class="family-link-request-info">

            <div class="family-link-request-name">
                <strong>${escapeHTML(request.userName)}</strong>
                <span class="request-status-badge">Pendiente</span>
            </div>

            <span>
                Familia: ${escapeHTML(request.familyName)}
            </span>

            <span>
                Miembro solicitado: ${escapeHTML(request.memberName)}
            </span>

            <span>
                Correo: ${escapeHTML(request.userEmail)}
            </span>

            <small>
                ${new Date(request.requestedAt).toLocaleString("es-ES")}
            </small>

        </div>

        <div class="family-link-request-actions">

            <button
                type="button"
                class="button button-primary"
                data-action="aprobar-vinculacion"
                data-request-id="${escapeHTML(request.id)}">
                Aprobar
            </button>

            <button
                type="button"
                class="button button-danger"
                data-action="rechazar-vinculacion"
                data-request-id="${escapeHTML(request.id)}">
                Rechazar
            </button>

        </div>

    </div>
`).join("");
}


/* =====================================================
   USUARIOS Y PERMISOS
   ===================================================== */

export async function renderUserProfiles() {
    const container = document.getElementById("user-profiles-list");

    if (!container) return;

    // Protección adicional: esta sección es exclusiva del administrador.
    if (document.documentElement.dataset.userRole !== "admin") {
        container.innerHTML = `
            <p class="empty-state">
                No tienes permisos para gestionar usuarios.
            </p>
        `;
        return;
    }

    container.innerHTML = "<p>Cargando usuarios...</p>";

    try {
        const profiles = await loadUserProfiles();

        const currentUserResponse = await import("../../supabase-client.js");
        const { data: authData } = await currentUserResponse.supabase.auth.getUser();
        const currentUserId = authData?.user?.id;

        if (profiles.length === 0) {
            container.innerHTML = `
                <p class="empty-state">
                    No hay usuarios registrados.
                </p>
            `;
            return;
        }

        const roleLabels = {
            admin: "Administrador",
            treasurer: "Tesorero",
            member: "Miembro"
        };

        container.innerHTML = profiles.map(profile => {
            const isCurrentUser = profile.userId === currentUserId;

            return `
                <article class="user-profile-card">

                    <div class="user-profile-info">
                        <strong>
                            ${escapeHTML(profile.displayName || "Usuario")}
                        </strong>

                        <span>
                            ${escapeHTML(profile.email || "Sin correo")}
                        </span>

                        <small>
                            Familia: ${escapeHTML(profile.familyName)}
                        </small>

                        <small>
                            Estado: 
                            <span class="${profile.active ? "status-active" : "status-inactive"}">
                                ${profile.active ? "Activo" : "Pendiente de activación"}
                            </span>
                        </small>
                    </div>

                    <form
                        class="user-role-form"
                        data-user-role-form
                        data-user-id="${escapeHTML(profile.userId)}">

                        <label>
                            <span>Permisos</span>

                            <select
                                name="role"
                                ${isCurrentUser ? "disabled" : ""}
                                aria-label="Permisos de ${escapeHTML(profile.displayName)}">

                                <option
                                    value="member"
                                    ${profile.role === "member" ? "selected" : ""}>
                                    ${roleLabels.member}
                                </option>

                                <option
                                    value="treasurer"
                                    ${profile.role === "treasurer" ? "selected" : ""}>
                                    ${roleLabels.treasurer}
                                </option>

                                <option
                                    value="admin"
                                    ${profile.role === "admin" ? "selected" : ""}>
                                    ${roleLabels.admin}
                                </option>

                            </select>
                        </label>

                        ${
                            isCurrentUser
                                ? `<small class="user-role-note">Tu propia cuenta no se puede modificar desde aquí.</small>`
                                : `
                                    <button
                                        type="submit"
                                        class="button button-primary">
                                        Guardar
                                    </button>
                                `
                        }

                    </form>

                </article>
            `;
        }).join("");

    } catch (error) {
        console.error("Error al cargar usuarios:", error);

        container.innerHTML = `
            <p class="empty-state">
                No se han podido cargar los usuarios.
            </p>
        `;
    }
}


/* =====================================================
   ADMINISTRACIÓN
   ===================================================== */

export function renderAdministration() {
    const container = document.getElementById("administration-content");

    if (!container) return;

    container.innerHTML = `

        <section class="admin-section" id="family-link-requests-section">

            <div class="admin-section-heading">
                <div>
                    <div class="admin-title-with-badge">
                        <h3>Solicitudes de vinculación</h3>
                        <span id="family-link-requests-count" class="pending-count">0</span>
                    </div>
                    <p>Gestiona las solicitudes de acceso de nuevas familias.</p>
                </div>
            </div>

            <div id="family-link-requests-list">
                <p>Cargando solicitudes...</p>
            </div>

        </section>

        <section class="admin-section" id="user-profiles-section" data-role="admin">

            <div class="admin-section-heading">
                <div>
                    <h3>Usuarios y permisos</h3>
                    <p>Consulta las cuentas registradas y gestiona sus niveles de acceso.</p>
                </div>
            </div>

            <div id="user-profiles-list">
                <p>Cargando usuarios...</p>
            </div>

        </section>

        <section class="admin-section">

            <div class="admin-section-heading">
                <div>
                    <h3>Historial de actividad</h3>
                    <p>Consulta y busca los cambios realizados en CESPlus.</p>
                </div>
            </div>

            <div class="audit-search">
                <label for="audit-search-input">Buscar movimientos</label>

                <input
                    type="search"
                    id="audit-search-input"
                    placeholder="Buscar por descripción, familia o motivo..."
                    autocomplete="off">
            </div>

            <div class="audit-filter-panel">

                <button
                    type="button"
                    class="audit-filter-toggle"
                    id="audit-filter-toggle"
                    aria-expanded="false"
                    aria-controls="audit-filter-modal">

                    <span>
                        <strong>Filtrar movimientos</strong>
                        <small>Personaliza los resultados del historial</small>
                    </span>

                    <span class="audit-filter-arrow">⌄</span>

                </button>

                <div class="audit-filter-modal" id="audit-filter-modal" hidden>

                    <div
                        class="audit-filter-backdrop"
                        data-action="close-audit-filters">
                    </div>

                    <div
                        class="audit-filter-dialog"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="audit-modal-title">

                        <div class="audit-modal-header">

                            <div>
                                <h3 id="audit-modal-title">
                                    Filtrar movimientos
                                </h3>

                                <p>
                                    Personaliza los resultados del historial.
                                </p>
                            </div>

                            <button
                                type="button"
                                class="audit-modal-close"
                                data-action="close-audit-filters"
                                aria-label="Cerrar filtros">
                                ×
                            </button>

                        </div>

                        <div class="audit-filter-content" id="audit-filter-content">

                            <div class="audit-filter-group">
                                <h4>Categorías</h4>

                                <div class="audit-checkbox-grid">

                                    <label><input type="checkbox" name="audit-category" value="family"> Familias</label>
                                    <label><input type="checkbox" name="audit-category" value="member"> Miembros</label>
                                    <label><input type="checkbox" name="audit-category" value="due"> Cuotas</label>
                                    <label><input type="checkbox" name="audit-category" value="payment"> Ingresos</label>
                                    <label><input type="checkbox" name="audit-category" value="expense"> Gastos</label>
                                    <label><input type="checkbox" name="audit-category" value="economy"> Economía</label>
                                    <label><input type="checkbox" name="audit-category" value="settings"> Configuración</label>

                                </div>
                            </div>

                            <div class="audit-filter-group">
                                <h4>Familias</h4>

                                <div class="audit-family-options">

                                    ${(data.families || [])
                                        .filter(family => family.active !== false)
                                        .slice()
                                        .sort((a, b) => a.name.localeCompare(b.name, "es"))
                                        .map(family => `
                                            <label>
                                                <input
                                                    type="checkbox"
                                                    name="audit-family"
                                                    value="${escapeHTML(family.id)}">

                                                ${escapeHTML(family.name)}
                                            </label>
                                        `).join("")}

                                </div>
                            </div>

                            <div class="audit-filter-group">
                                <h4>Tipo de movimiento</h4>

                                <div class="audit-checkbox-grid">

                                    <label><input type="checkbox" name="audit-tag" value="member_added"> Altas</label>
                                    <label><input type="checkbox" name="audit-tag" value="member_removed"> Bajas</label>
                                    <label><input type="checkbox" name="audit-tag" value="member_name_changed"> Cambios de nombre</label>
                                    <label><input type="checkbox" name="audit-tag" value="member_type_changed"> Cambios de tipo</label>
                                    <label><input type="checkbox" name="audit-tag" value="member_fee_changed"> Cambios de cuota</label>
                                    <label><input type="checkbox" name="audit-tag" value="family_name_changed"> Cambios de familia</label>
                                    <label><input type="checkbox" name="audit-tag" value="payment"> Ingresos registrados</label>
                                    <label><input type="checkbox" name="audit-tag" value="payment_reversed"> Ingresos anulados</label>
                                    <label><input type="checkbox" name="audit-tag" value="expense_created"> Gastos creados</label>
                                    <label><input type="checkbox" name="audit-tag" value="expense_updated"> Gastos modificados</label>
                                    <label><input type="checkbox" name="audit-tag" value="expense_deleted"> Gastos eliminados</label>

                                </div>
                            </div>

                            <div class="audit-filter-group">

                                <h4>Periodo</h4>

                                <div class="audit-date-fields">

                                    <label>
                                        Desde
                                        <input type="date" id="audit-date-from">
                                    </label>

                                    <label>
                                        Hasta
                                        <input type="date" id="audit-date-to">
                                    </label>

                                </div>

                                <div class="audit-date-shortcuts">

                                    <button type="button" data-audit-period="24h">Últimas 24 horas</button>
                                    <button type="button" data-audit-period="7d">Últimos 7 días</button>
                                    <button type="button" data-audit-period="30d">Últimos 30 días</button>
                                    <button type="button" data-audit-period="month">Este mes</button>
                                    <button type="button" data-audit-period="previous-month">Mes anterior</button>

                                </div>

                            </div>

                        </div>

                        <div class="audit-filter-actions">

                            <button
                                type="button"
                                class="button button-secondary"
                                id="audit-clear-filters">
                                Limpiar filtros
                            </button>

                            <button
                                type="button"
                                class="button button-primary"
                                id="audit-apply-filters">
                                Aplicar filtros
                            </button>

                        </div>

                    </div>
                </div>
            </div>

            <div
                class="audit-results-summary"
                id="audit-results-summary"
                hidden>
            </div>

            <div id="audit-log-list"></div>

        </section>

        <section class="admin-section">

            <div class="admin-section-heading">
                <div>
                    <h3>Configuración general</h3>
                    <p>Gestiona las cuotas y el saldo inicial de la peña.</p>
                </div>
            </div>

            <form id="admin-settings-form" class="settings-form">

                <div class="form-grid">

                    <label class="form-field">
                        <span>Cuota mensual por adulto (€)</span>

                        <input
                            type="number"
                            name="adultFee"
                            min="0"
                            step="0.01"
                            value="${(data.settings.adultFeeCents / 100).toFixed(2)}"
                            required>
                    </label>

                    <label class="form-field">
                        <span>Cuota mensual por niño (€)</span>

                        <input
                            type="number"
                            name="childFee"
                            min="0"
                            step="0.01"
                            value="${(data.settings.childFeeCents / 100).toFixed(2)}"
                            required>
                    </label>

                    <label class="form-field">
                        <span>Saldo inicial (€)</span>

                        <input
                            type="number"
                            name="openingBalance"
                            step="0.01"
                            value="${(data.openingBalanceCents / 100).toFixed(2)}"
                            required>
                    </label>

                </div>

                <div class="form-actions">
                    <button type="submit" class="button button-primary">
                        Guardar configuración
                    </button>
                </div>

            </form>

        </section>

    `;

    renderAuditLog();
    renderFamilyLinkRequests();
    renderUserProfiles();
}