/* =====================================================
   CESPLUS — DASHBOARD
   Panel de administración, tesorería y miembros
   ===================================================== */

"use strict";

import {
    data,
    currentFilter,
    currentPeriod,
    periodLabel,
    money,
    escapeHTML,
    getFamily,
    getDuesForPeriod,
    getCurrentPeriod,
    getMonthMetrics,
    getCurrentBalance,
    setCurrentPeriod,
    showToast,
    getDueReceived,
    getDueDebt
} from "../core.js";

import {
    loadGlobalDashboardMetrics
} from "../supabase-data.js";


// =====================================================
// CONFIGURACIÓN Y ESTADO
// =====================================================

let selectedDashboardPeriod = "all";

const globalMetricsCache = new Map();

let metricsRequestId = 0;


// =====================================================
// UTILIDADES
// =====================================================

function getUserRole() {
    return document.documentElement.dataset.userRole || "";
}


function isMember() {
    return getUserRole() === "member";
}


function formatDate(date) {
    if (!date) return "—";

    const parsedDate = new Date(`${date}T00:00:00`);

    if (Number.isNaN(parsedDate.getTime())) {
        return "—";
    }

    return new Intl.DateTimeFormat("es-ES", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    }).format(parsedDate);
}


function formatCompactPeriod(period) {
    const [year, month] = period.split("-").map(Number);

    const monthName = new Intl.DateTimeFormat("es-ES", {
        month: "short"
    }).format(new Date(year, month - 1, 1));

    const capitalizedMonth =
        monthName.charAt(0).toLocaleUpperCase("es") +
        monthName.slice(1).replace(".", "");

    return `${capitalizedMonth} ${String(year).slice(-2)}`;
}


function getMonthFromDate(date) {
    if (!date) return null;

    const match = String(date).match(/^(\d{4}-\d{2})/);

    return match ? match[1] : null;
}


function getAllAvailablePeriods() {
    const periods = [
        ...data.dues.map(due => due.period),
        ...data.expenses.map(expense => getMonthFromDate(expense.date))
    ].filter(period => /^\d{4}-\d{2}$/.test(period));

    const current = getCurrentPeriod();

    periods.push(current);

    const uniquePeriods = [...new Set(periods)];

    uniquePeriods.sort();

    if (!uniquePeriods.length) {
        return [current];
    }

    const firstPeriod = uniquePeriods[0];

    const [startYear, startMonth] = firstPeriod
        .split("-")
        .map(Number);

    const [endYear, endMonth] = current
        .split("-")
        .map(Number);

    const start = new Date(startYear, startMonth - 1, 1);
    const end = new Date(endYear, endMonth - 1, 1);

    const result = [];

    for (
        let date = new Date(start);
        date <= end;
        date.setMonth(date.getMonth() + 1)
    ) {
        result.push([
            date.getFullYear(),
            String(date.getMonth() + 1).padStart(2, "0")
        ].join("-"));
    }

    return result;
}


function getSelectedFamily() {
    if (!data?.families?.length) {
        return null;
    }

    return data.families.find(family => family.active) || null;
}


function setElementContent(id, html) {
    const element = document.getElementById(id);

    if (element) {
        element.innerHTML = html;
    }
}


// =====================================================
// SELECTOR DE PERIODO
// =====================================================

export function getSelectedDashboardPeriod() {
    return selectedDashboardPeriod;
}


export function setSelectedDashboardPeriod(period) {
    selectedDashboardPeriod = period;
}


export function renderPeriodSelect() {
    const select = document.getElementById("period-select");

    if (!select) return;

    const periods = getAllAvailablePeriods();

    if (
        selectedDashboardPeriod !== "all" &&
        !periods.includes(selectedDashboardPeriod)
    ) {
        selectedDashboardPeriod = "all";
    }

    const options = [
        `
            <option value="all"
                ${selectedDashboardPeriod === "all" ? "selected" : ""}>
                Todos los meses
            </option>
        `,
        ...periods.map(period => `
            <option value="${period}"
                ${period === selectedDashboardPeriod ? "selected" : ""}>
                ${escapeHTML(formatCompactPeriod(period))}
            </option>
        `)
    ];

    select.innerHTML = options.join("");
}


// =====================================================
// INDICADORES GENERALES
// =====================================================

function updateSummaryValues(metrics) {
    document.getElementById("balance-value").textContent =
        money(metrics.balanceCents);

    document.getElementById("income-value").textContent =
        money(metrics.incomeCents);

    document.getElementById("expenses-value").textContent =
        money(metrics.expensesCents);

    document.getElementById("pending-value").textContent =
        money(metrics.pendingCents);
}


function renderStaffSummary() {
    const metrics = getMonthMetrics(currentPeriod);

    updateSummaryValues({
        balanceCents: getCurrentBalance(),
        incomeCents: metrics.income,
        expensesCents: metrics.expenses,
        pendingCents: metrics.pending
    });

    const pendingCount = document.getElementById("pending-count");

    if (pendingCount) {
        pendingCount.hidden = false;

        pendingCount.textContent =
            `${metrics.pendingCount} ${
                metrics.pendingCount === 1
                    ? "familia con cuota pendiente"
                    : "familias con cuotas pendientes"
            }`;
    }

    const description = document.getElementById("dues-description");

    if (description) {
        description.textContent =
            selectedDashboardPeriod === "all"
                ? "Cuotas de todos los meses."
                : `Cuotas de ${periodLabel(selectedDashboardPeriod)}.`;
    }

    document.querySelector(".sidebar-footer span:last-child")
        ?.replaceChildren(
            document.createTextNode("Modo de gestión")
        );
}


async function renderMemberSummary() {
    const pendingCount = document.getElementById("pending-count");

    // El número de familias con cuotas pendientes
    // es información exclusiva de administración.
    if (pendingCount) {
        pendingCount.hidden = true;
    }

    const requestId = ++metricsRequestId;

    // Comprobar si ya tenemos los indicadores de este mes.
    if (globalMetricsCache.has(currentPeriod)) {
        updateSummaryValues(
            globalMetricsCache.get(currentPeriod)
        );

        return;
    }

    try {
        const metrics = await loadGlobalDashboardMetrics(currentPeriod);

        globalMetricsCache.set(currentPeriod, metrics);

        // Evitar que una petición antigua sobrescriba
        // los indicadores de un periodo seleccionado después.
        if (requestId !== metricsRequestId) {
            return;
        }

        updateSummaryValues(metrics);

    } catch (error) {
        console.error(
            "Error cargando indicadores globales:",
            error
        );

        if (requestId === metricsRequestId) {
            showToast(
                "No se han podido cargar los indicadores globales."
            );
        }
    }
}


export function renderSummary() {
    if (!data) return;

    if (isMember()) {
        void renderMemberSummary();
    } else {
        // Cada renderizado de administración invalida
        // las posibles peticiones anteriores de miembros.
        metricsRequestId++;

        renderStaffSummary();
    }
}


// =====================================================
// DASHBOARD DE ADMINISTRACIÓN Y TESORERÍA
// =====================================================

export function renderDues() {
    if (isMember()) return;

    const list = document.getElementById("dues-list");
    const empty = document.getElementById("dues-empty");

    if (!list || !empty) return;

    // Obtener cuotas del periodo seleccionado.
    let dues = selectedDashboardPeriod === "all"
        ? [...data.dues]
        : getDuesForPeriod(selectedDashboardPeriod);

    dues = dues
        .map(due => ({
            ...due,
            family: getFamily(due.familyId)
        }))
        .filter(due => due.family?.active);

    // Aplicar filtros de estado.
    if (
        currentFilter === "pendiente" ||
        currentFilter === "pendientes"
    ) {
        dues = dues.filter(due =>
            due.status === "pendiente" ||
            due.status === "deuda"
        );
    }

    if (
        currentFilter === "pagado" ||
        currentFilter === "pagados"
    ) {
        dues = dues.filter(
            due => due.status === "pagado"
        );
    }

    // Orden: pendientes, deudas y pagadas.
    const statusOrder = {
        pendiente: 0,
        deuda: 1,
        pagado: 2
    };

    dues.sort((a, b) => {
        const statusDifference =
            statusOrder[a.status] - statusOrder[b.status];

        if (statusDifference !== 0) {
            return statusDifference;
        }

        // Primero por periodo más reciente.
        const periodDifference =
            b.period.localeCompare(a.period);

        if (periodDifference !== 0) {
            return periodDifference;
        }

        return a.family.name.localeCompare(b.family.name, "es");
    });

    list.innerHTML = dues.map(due => {

        const paid = due.status === "pagado";
        const partial = due.status === "deuda";

        const received = getDueReceived(due);
        const debt = getDueDebt(due);

        const statusClass = paid
            ? "paid"
            : partial
                ? "debt"
                : "pending";

        const statusLabel = paid
            ? "Abonada"
            : partial
                ? "Deuda"
                : "Pendiente";

        const buttonLabel = paid
            ? "Cuota abonada"
            : partial
                ? "Completar pago"
                : "Registrar ingreso";

        return `
            <article class="due-card">

                <div class="due-card-main">

                    <span class="due-family-name">
                        ${escapeHTML(due.family.name)}
                    </span>

                    <span class="due-period">
                        ${escapeHTML(periodLabel(due.period))}
                    </span>

                </div>

                <div class="due-card-amounts">

                    <div>
                        <span>Esperado</span>
                        <strong>${money(due.expectedCents)}</strong>
                    </div>

                    <div>
                        <span>Recibido</span>
                        <strong>${money(received)}</strong>
                    </div>

                    ${!paid ? `
                        <div class="due-debt-amount">
                            <span>Pendiente</span>
                            <strong>${money(debt)}</strong>
                        </div>
                    ` : ""}

                </div>

                <button
                    class="due-status-button ${statusClass}"
                    data-action="cambiar-estado"
                    data-due-id="${escapeHTML(due.id)}"
                    aria-label="${buttonLabel}">

                    ${statusLabel}

                </button>

            </article>
        `;
    }).join("");

    empty.classList.toggle("hidden", dues.length > 0);
    list.classList.toggle("hidden", dues.length === 0);
}


// =====================================================
// DASHBOARD DE MIEMBROS
// =====================================================

function getMemberDues() {
    const family = getSelectedFamily();

    if (!family) return [];

    return data.dues
        .filter(due => due.familyId === family.id)
        .sort((a, b) => b.period.localeCompare(a.period));
}


function getMemberExpenses() {
    return [...data.expenses]
        .sort((a, b) => {
            return String(b.date).localeCompare(String(a.date));
        });
}


function renderMemberCurrentDue() {
    const container = document.getElementById(
        "member-current-due"
    );

    if (!container) return;

    const family = getSelectedFamily();

    if (!family) {
        container.innerHTML = `
            <p class="member-empty-state">
                No se ha encontrado tu familia.
            </p>
        `;

        return;
    }

    let dues = getMemberDues();

    if (selectedDashboardPeriod !== "all") {
        dues = dues.filter(
            due => due.period === selectedDashboardPeriod
        );
    }

    if (!dues.length) {
        container.innerHTML = `
            <p class="member-empty-state">
                No hay cuotas registradas para este periodo.
            </p>
        `;

        return;
    }

    container.innerHTML = dues.map(due => {

        const paid = due.status === "pagado";
        const partial = due.status === "deuda";

        const received = getDueReceived(due);
        const debt = getDueDebt(due);

        const statusClass = paid
            ? "paid"
            : partial
                ? "debt"
                : "pending";

        const statusLabel = paid
            ? "Abonada"
            : partial
                ? "Deuda"
                : "Pendiente";

        return `
            <article class="member-due-card">

                <div class="member-entry-main">

                    <strong>
                        ${escapeHTML(family.name)}
                    </strong>

                    <span class="member-entry-date">
                        ${escapeHTML(periodLabel(due.period))}
                    </span>

                </div>

                <div class="member-entry-side">

                    <strong class="member-entry-amount">
                        ${money(due.expectedCents)}
                    </strong>

                    <span class="member-status-badge ${statusClass}">
                        ${statusLabel}
                    </span>

                </div>

                ${partial ? `
                    <div class="member-due-details">
                        <span>Recibido: ${money(received)}</span>
                        <strong>Pendiente: ${money(debt)}</strong>
                    </div>
                ` : ""}

            </article>
        `;
    }).join("");
}


function renderMemberExpenses() {
    const container = document.getElementById(
        "member-current-expenses"
    );

    if (!container) return;

    let expenses = getMemberExpenses();

    if (selectedDashboardPeriod !== "all") {
        expenses = expenses.filter(
            expense =>
                getMonthFromDate(expense.date) === selectedDashboardPeriod
        );
    }

    if (!expenses.length) {
        container.innerHTML = `
            <p class="member-empty-state">
                No hay gastos registrados para este periodo.
            </p>
        `;

        return;
    }

    container.innerHTML = expenses.map(expense => `
        <article class="member-expense-card">

            <div class="member-entry-main">

                <strong>
                    ${escapeHTML(expense.concept)}
                </strong>

                <span class="member-entry-date">
                    ${formatDate(expense.date)}
                </span>

            </div>

            <strong class="member-entry-amount">
                ${money(expense.amountCents)}
            </strong>

        </article>
    `).join("");
}


// =====================================================
// HISTORIAL DE CUOTAS
// =====================================================

function renderMemberDuesHistory() {
    const container = document.getElementById(
        "member-dues-history-list"
    );

    if (!container) return;

    const dues = getMemberDues();
    const family = getSelectedFamily();

    if (!dues.length || !family) {
        container.innerHTML = `
            <p class="member-empty-state">
                Todavía no hay cuotas en el historial.
            </p>
        `;

        return;
    }

    container.innerHTML = dues.map(due => {

        const paid = due.status === "pagado";
        const partial = due.status === "deuda";

        const received = getDueReceived(due);
        const debt = getDueDebt(due);

        const statusClass = paid
            ? "paid"
            : partial
                ? "debt"
                : "pending";

        const statusLabel = paid
            ? "Abonada"
            : partial
                ? "Deuda"
                : "Pendiente";

        return `
            <article class="member-history-item">

                <div class="member-entry-main">

                    <strong>
                        ${escapeHTML(periodLabel(due.period))}
                    </strong>

                    <span class="member-entry-date">
                        ${escapeHTML(family.name)}
                    </span>

                </div>

                <div class="member-entry-side">

                    <strong class="member-entry-amount">
                        ${money(due.expectedCents)}
                    </strong>

                    <span class="member-status-badge ${statusClass}">
                        ${statusLabel}
                    </span>

                </div>

                ${partial ? `
                    <div class="member-due-details">
                        <span>Recibido: ${money(received)}</span>
                        <strong>Pendiente: ${money(debt)}</strong>
                    </div>
                ` : ""}

            </article>
        `;
    }).join("");
}


// =====================================================
// HISTORIAL DE GASTOS
// =====================================================

function renderMemberExpensesHistory() {
    const container = document.getElementById(
        "member-expenses-history-list"
    );

    if (!container) return;

    const expenses = getMemberExpenses();

    if (!expenses.length) {
        container.innerHTML = `
            <p class="member-empty-state">
                Todavía no hay gastos registrados.
            </p>
        `;

        return;
    }

    container.innerHTML = expenses.map(expense => `
        <article class="member-history-item">

            <div class="member-entry-main">

                <strong>
                    ${escapeHTML(expense.concept)}
                </strong>

                <span class="member-entry-date">
                    ${formatDate(expense.date)}
                </span>

            </div>

            <strong class="member-entry-amount">
                ${money(expense.amountCents)}
            </strong>

        </article>
    `).join("");
}


// =====================================================
// RENDERIZADO GENERAL DE MIEMBROS
// =====================================================

export function renderMemberDashboard() {
    if (!isMember() || !data) return;

    const staffDashboard = document.getElementById(
        "staff-dashboard"
    );

    const memberDashboard = document.getElementById(
        "member-dashboard"
    );

    if (staffDashboard) {
        staffDashboard.hidden = true;
    }

    if (memberDashboard) {
        memberDashboard.hidden = false;
    }

    renderMemberCurrentDue();
    renderMemberExpenses();

    renderMemberDuesHistory();
    renderMemberExpensesHistory();
}


// =====================================================
// VISIBILIDAD SEGÚN ROL
// =====================================================

export function updateDashboardVisibility() {
    const staffDashboard = document.getElementById(
        "staff-dashboard"
    );

    const memberDashboard = document.getElementById(
        "member-dashboard"
    );

    const member = isMember();

    if (staffDashboard) {
        staffDashboard.hidden = member;
    }

    if (memberDashboard) {
        memberDashboard.hidden = !member;
    }
}