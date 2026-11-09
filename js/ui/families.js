/* =====================================================
   CESPLUS — FAMILIES
   Renderizado de familias y miembros
   ===================================================== */

"use strict";

import {
    data,
    currentPeriod,
    money,
    escapeHTML,
    getDue
} from "../core.js";


/* =====================================================
   LISTADO DE FAMILIAS
   ===================================================== */

export function renderFamilies() {
    const container = document.getElementById("families-content");

    const families = data.families.filter(family => family.active);
    const inactiveFamilies = data.families.filter(family => !family.active);

    container.innerHTML = `
        <div class="family-management-list">

            ${families.map(family => {
                const due = getDue(family.id, currentPeriod);

                const members = (family.memberList || [])
                    .filter(member => member.active);

                const calculatedTotal = members.reduce(
                    (total, member) => total + member.monthlyFeeCents,
                    0
                );

                return `
                    <article class="family-management-card">

                        <button
                            type="button"
                            class="family-management-header"
                            data-action="toggle-family"
                            aria-expanded="false"
                            aria-controls="family-members-${escapeHTML(family.id)}">

                            <div class="family-management-info">
                                <h3>${escapeHTML(family.name)}</h3>

                                <p>
                                    ${members.length}
                                    ${members.length === 1 ? "miembro activo" : "miembros activos"}
                                </p>
                            </div>

                            <div class="family-management-header-right">

                                <strong class="family-management-amount">
                                    ${money(due ? due.expectedCents : calculatedTotal)}
                                </strong>

                                <span class="family-dropdown-arrow"></span>

                            </div>

                        </button>

                        <div
                            id="family-members-${escapeHTML(family.id)}"
                            class="family-management-details"
                            hidden>

                            <div class="family-management-members">

                                ${members.map(member => `
                                    <div class="family-member-summary">

                                        <span>
                                            ${escapeHTML(member.name)}

                                            <small>
                                                ${member.type === "child" ? "Menor" : "Adulto"}
                                            </small>
                                        </span>

                                        <strong>
                                            ${money(member.monthlyFeeCents)}
                                        </strong>

                                    </div>
                                `).join("")}

                            </div>

                            <div class="family-management-footer">

                                <span class="status-badge ${due?.status === "pagado" ? "paid" : "pending"}">
                                    ${due?.status === "pagado" ? "Cuota abonada" : "Cuota pendiente"}
                                </span>

                                <button
                                    class="button button-primary"
                                    data-action="gestionar-miembros"
                                    data-family-id="${escapeHTML(family.id)}">
                                    Editar familia
                                </button>

                            </div>

                        </div>

                    </article>
                `;
            }).join("")}

        </div>

        ${inactiveFamilies.length ? `
            <details class="inactive-families-section">

                <summary class="inactive-families-header">

                    <div class="inactive-families-heading">
                        <span class="inactive-families-icon">↳</span>

                        <div>
                            <strong>Familias inactivas</strong>
                            <small>Familias archivadas temporalmente</small>
                        </div>
                    </div>

                    <div class="inactive-families-header-right">
                        <span class="inactive-families-count">
                            ${inactiveFamilies.length}
                        </span>
                        <span class="inactive-families-arrow"></span>
                    </div>

                </summary>

                <div class="inactive-families-list">

                    ${inactiveFamilies.map(family => {
                        const members = family.memberList || [];

                        return `
                            <article class="inactive-family-card">

                                <div class="inactive-family-info">
                                    <strong>${escapeHTML(family.name)}</strong>

                                    <span>
                                        ${members.length}
                                        ${members.length === 1 ? "miembro" : "miembros"}
                                    </span>
                                </div>

                                <button
                                    type="button"
                                    class="button button-secondary"
                                    data-action="reactivar-familia"
                                    data-family-id="${escapeHTML(family.id)}">
                                    Reactivar
                                </button>

                            </article>
                        `;
                    }).join("")}

                </div>

            </details>
        ` : ""}
    `;
}