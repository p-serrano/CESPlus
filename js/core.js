/* =====================================================
   CESPLUS — CORE
   Estado, almacenamiento, utilidades y cálculos
   ===================================================== */

"use strict";

/* -------------------------------------------------
   ESTADO COMPARTIDO
   ------------------------------------------------- */

export const STORAGE_KEY = "cesplus_demo_v2";

export const INITIAL_DATA = {
    openingBalanceCents: 0,

    settings: {
        adultFeeCents: 3000,
        childFeeCents: 1000
    },

    auditLog: [],

    expenses: []
};

export let data = null;
export function setData(newData) {
    data = newData;
}

export let currentView = "inicio";
export let currentFilter = "pendiente";
export let currentPeriod = getCurrentPeriod();

export let toastTimer = null;

export let activeAuditFilters = {
    categories: [],
    tags: [],
    families: [],
    dateFrom: "",
    dateTo: ""
};

/* -------------------------------------------------
   ETIQUETAS DE AUDITORÍA
   ------------------------------------------------- */

export const auditTagLabels = {
    family_created: "Familia creada",
    family_name_changed: "Nombre de familia",
    member_added: "Alta de miembro",
    member_name_changed: "Cambio de nombre",
    member_type_changed: "Cambio de tipo",
    member_fee_changed: "Cambio de cuota",
    member_removed: "Baja de miembro",

    due_amount_updated: "Actualización de cuota",
    payment: "Ingreso registrado",
    payment_reversed: "Ingreso anulado",

    expense_created: "Gasto creado",
    expense_updated: "Gasto modificado",
    expense_deleted: "Gasto eliminado",

    adult_fee_updated: "Actualización de cuota de adulto",
    child_fee_updated: "Actualización de cuota infantil",
    opening_balance_updated: "Actualización del saldo inicial",

    familias: "Familias",
    miembros: "Miembros",
    nombres: "Nombres",
    altas: "Altas",
    tipo: "Tipo",
    cuotas: "Cuotas"
};

/* -------------------------------------------------
   UTILIDADES
   ------------------------------------------------- */

export function getCurrentPeriod() {
    const now = new Date();

    return [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0")
    ].join("-");
}

export function periodLabel(period) {
    const [year, month] = period.split("-").map(Number);

    const date = new Date(year, month - 1, 1);

    return new Intl.DateTimeFormat("es-ES", {
        month: "long",
        year: "numeric"
    }).format(date);
}

export function money(cents) {
    return new Intl.NumberFormat("es-ES", {
        style: "currency",
        currency: "EUR"
    }).format((cents || 0) / 100);
}

export function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

export function createId(prefix = "item") {
    return `${prefix}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;
}

/* -------------------------------------------------
   NOTIFICACIONES
   ------------------------------------------------- */

export function showToast(message) {
    const toast = document.getElementById("toast");

    if (!toast) return;

    toast.textContent = message;
    toast.classList.add("visible");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
        toast.classList.remove("visible");
    }, 2600);
}

/* -------------------------------------------------
   ALMACENAMIENTO LOCAL
   ------------------------------------------------- */

export function save() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
        console.error(
            "No se han podido guardar los datos locales.",
            error
        );

        showToast("No se han podido guardar los cambios.");
    }
}

export function load() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);

        if (!saved) {
            data = structuredClone(INITIAL_DATA);
            save();
            return;
        }

        const parsed = JSON.parse(saved);

        if (
            !parsed ||
            !Array.isArray(parsed.families) ||
            !Array.isArray(parsed.dues) ||
            !Array.isArray(parsed.expenses)
        ) {
            throw new Error("Estructura de datos no válida.");
        }

        data = {
            ...structuredClone(INITIAL_DATA),
            ...parsed,

            settings: {
                ...INITIAL_DATA.settings,
                ...(parsed.settings || {})
            },

            auditLog: Array.isArray(parsed.auditLog)
                ? parsed.auditLog
                : []
        };

        if (!Number.isFinite(data.openingBalanceCents)) {
            data.openingBalanceCents = 0;
        }

    } catch (error) {
        console.error(
            "No se han podido leer los datos locales.",
            error
        );

        data = structuredClone(INITIAL_DATA);

        showToast("Se han cargado de nuevo los datos de prueba.");
    }
}

/* -------------------------------------------------
   CÁLCULOS DE CUOTAS
   ------------------------------------------------- */

export function getDueReceived(due) {
    const received = Number(due?.receivedCents ?? 0);

    return Number.isSafeInteger(received) && received >= 0
        ? received
        : 0;
}

export function getDueDebt(due) {
    const expected = Number(due?.expectedCents);
    const received = getDueReceived(due);

    if (!Number.isSafeInteger(expected) || expected < 0) {
        return 0;
    }

    return Math.max(0, expected - received);
}

/* -------------------------------------------------
   ACCESO A FAMILIAS Y CUOTAS
   ------------------------------------------------- */

export function getFamily(familyId) {
    return data.families.find(
        family => family.id === familyId
    );
}

export function getDuesForPeriod(period) {
    return data.dues.filter(
        due => due.period === period
    );
}

export function getDue(familyId, period) {
    return data.dues.find(due =>
        due.familyId === familyId &&
        due.period === period
    );
}

/* -------------------------------------------------
   GENERACIÓN DE CUOTAS
   ------------------------------------------------- */

export function ensurePeriodDues(period) {
    const actualPeriod = getCurrentPeriod();

    // Solo generamos cuotas del mes actual.
    if (period !== actualPeriod) return;

    data.families
        .filter(family => family.active)
        .forEach(family => {

            if (getDue(family.id, period)) return;

            const expectedCents = family.memberList
                .filter(member => member.active)
                .reduce(
                    (total, member) =>
                        total + member.monthlyFeeCents,
                    0
                );

            data.dues.push({
                id: createId("due"),
                familyId: family.id,
                period,
                expectedCents,
                receivedCents: null,
                status: "pendiente",
                paidAt: null,
                justification: ""
            });
        });

    save();
}

/* -------------------------------------------------
   CÁLCULOS ECONÓMICOS
   ------------------------------------------------- */

export function getMonthMetrics(period) {
    const dues = getDuesForPeriod(period);

    // Ingresos reales, incluidos los pagos parciales.
    const income = dues.reduce(
        (total, due) => total + getDueReceived(due),
        0
    );

    // Deuda pendiente: importe esperado menos lo recibido.
    const pending = dues.reduce((total, due) => {
        if (
            due.status !== "pendiente" &&
            due.status !== "deuda"
        ) {
            return total;
        }

        return total + getDueDebt(due);
    }, 0);

    const expenses = data.expenses
        .filter(expense =>
            typeof expense.date === "string" &&
            expense.date.startsWith(period)
        )
        .reduce((total, expense) => {
            const amount = Number(expense.amountCents);

            return total + (
                Number.isSafeInteger(amount) && amount >= 0
                    ? amount
                    : 0
            );
        }, 0);

    return {
        income,
        pending,
        expenses,

        pendingCount: dues.filter(due =>
            due.status === "pendiente" ||
            due.status === "deuda"
        ).length
    };
}

export function getCurrentBalance() {
    const openingBalance = Number(data.openingBalanceCents);

    const validOpeningBalance =
        Number.isSafeInteger(openingBalance) &&
        openingBalance >= 0
            ? openingBalance
            : 0;

    // Todos los ingresos realmente recibidos.
    const income = data.dues.reduce(
        (total, due) => total + getDueReceived(due),
        0
    );

    const expenses = data.expenses.reduce((total, expense) => {
        const amount = Number(expense.amountCents);

        return total + (
            Number.isSafeInteger(amount) && amount >= 0
                ? amount
                : 0
        );
    }, 0);

    return validOpeningBalance + income - expenses;
}

/* -------------------------------------------------
   CAMBIOS DE ESTADO
   ------------------------------------------------- */

export function setCurrentView(view) {
    currentView = view;
}

export function setCurrentFilter(filter) {
    currentFilter = filter;
}

export function setCurrentPeriod(period) {
    currentPeriod = period;
}

export function setActiveAuditFilters(filters) {
    activeAuditFilters = filters;
}

export function resetData() {
    data = structuredClone(INITIAL_DATA);
}