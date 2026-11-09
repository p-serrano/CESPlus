"use strict";

import {
    data,
    money,
    escapeHTML,
    getCurrentBalance
} from "../core.js";

export function renderEconomy() {
    const container = document.getElementById("economy-content");

    const canManageExpenses = ["admin", "treasurer"].includes(
        document.documentElement.dataset.userRole
    );

    const expenses = [...data.expenses]
        .sort((a, b) => b.date.localeCompare(a.date));

    container.innerHTML = `
        <article class="due-card">
            <div class="due-card-top">
                <div class="due-family-info">
                    <strong class="due-family-name">Saldo actual</strong>
                </div>
                <strong class="due-amount">
                    ${money(getCurrentBalance())}
                </strong>
            </div>
        </article>
        <div style="height: 16px"></div>
        <div class="section-heading">
            <div>
                <h2>Gastos registrados</h2>
                <p>Historial de salidas de dinero.</p>
            </div>
            ${canManageExpenses ? `
                <button type="button" class="button button-primary" data-action="gasto">
                    + Registrar gasto
                </button>
            ` : ""}
        </div>
        ${expenses.length ? `
            <div class="dues-list">
                ${expenses.map(expense => `
                    <article class="due-card">
                        <div class="due-card-top">
                            <div class="due-family-info">
                                <strong class="due-family-name">
                                    ${escapeHTML(expense.concept)}
                                </strong>
                                <span class="due-family-meta">
                                    ${escapeHTML(expense.date)}
                                </span>
                            </div>
                            <strong class="due-amount">
                                −${money(expense.amountCents)}
                            </strong>
                        </div>
                        ${canManageExpenses ? `
                            <div class="expense-actions">
                                <button type="button" class="button button-secondary"
                                    data-action="editar-gasto"
                                    data-expense-id="${escapeHTML(expense.id)}">
                                    Editar
                                </button>
                                <button type="button" class="button button-danger"
                                    data-action="eliminar-gasto"
                                    data-expense-id="${escapeHTML(expense.id)}">
                                    Eliminar
                                </button>
                            </div>
                        ` : ""}
                    </article>
                `).join("")}
            </div>
        ` : `
            <div class="empty-state">
                <span class="empty-icon">€</span>
                <h3>Todavía no hay gastos</h3>
                <p>Cuando registres un gasto, aparecerá aquí.</p>
            </div>
        `}
    `;
}