/* =====================================================
   CESPLUS — APLICACIÓN PRINCIPAL
   Primera versión: datos de prueba
   ===================================================== */

"use strict";

let activeAuditFilters = {
    categories: [],
    tags: [],
    families: [],
    dateFrom: "",
    dateTo: ""
};

const CESPlus = (() => {
    const STORAGE_KEY = "cesplus_demo_v2";

    const INITIAL_DATA = {
        openingBalanceCents: 0,

        settings: {
            adultFeeCents: 3000,
            childFeeCents: 1000
        },

        auditLog: [],

        families: [
            {
                id: "garcia",
                name: "García Castellet",
                members: 4,
                active: true,
                memberList: [
                    { id: "g1", name: "Adulto 1", type: "adult", monthlyFeeCents: 3000, active: true },
                    { id: "g2", name: "Adulto 2", type: "adult", monthlyFeeCents: 3000, active: true },
                    { id: "g3", name: "Niño 1", type: "child", monthlyFeeCents: 1000, active: true },
                    { id: "g4", name: "Niño 2", type: "child", monthlyFeeCents: 1000, active: true }
                ]
            },
            {
                id: "hector",
                name: "Héctor",
                members: 1,
                active: true,
                memberList: [
                    { id: "h1", name: "Adulto 1", type: "adult", monthlyFeeCents: 3000, active: true }
                ]
            },
            {
                id: "serrano",
                name: "Serrano",
                members: 2,
                active: true,
                memberList: [
                    { id: "s1", name: "Adulto 1", type: "adult", monthlyFeeCents: 3000, active: true },
                    { id: "s2", name: "Adulto 2", type: "adult", monthlyFeeCents: 3000, active: true }
                ]
            },
            {
                id: "viciano",
                name: "Viciano",
                members: 1,
                active: true,
                memberList: [
                    { id: "v1", name: "Adulto 1", type: "adult", monthlyFeeCents: 3000, active: true }
                ]
            }
        ],

        dues: [
            {
                id: "due-garcia",
                familyId: "garcia",
                period: "",
                expectedCents: 8000,
                receivedCents: 0,
                status: "pendiente",
                paidAt: null,
                justification: ""
            },
            {
                id: "due-hector",
                familyId: "hector",
                period: "",
                expectedCents: 3000,
                receivedCents: 3000,
                status: "pagado",
                paidAt: new Date().toISOString(),
                justification: ""
            },
            {
                id: "due-serrano",
                familyId: "serrano",
                period: "",
                expectedCents: 6000,
                receivedCents: 0,
                status: "pendiente",
                paidAt: null,
                justification: ""
            },
            {
                id: "due-viciano",
                familyId: "viciano",
                period: "",
                expectedCents: 3000,
                receivedCents: 0,
                status: "pendiente",
                paidAt: null,
                justification: ""
            }
        ],

        expenses: []
    };

    let data;
    let currentView = "inicio";
    let currentFilter = "todas";
    let currentPeriod = getCurrentPeriod();
    let toastTimer = null;

    /* -------------------------------------------------
       UTILIDADES
       ------------------------------------------------- */

    const auditTagLabels = {
        // Familias y miembros
        family_created: "Familia creada",
        family_name_changed: "Nombre de familia",
        member_added: "Alta de miembro",
        member_name_changed: "Cambio de nombre",
        member_type_changed: "Cambio de tipo",
        member_fee_changed: "Cambio de cuota",
        member_removed: "Baja de miembro",

        // Cuotas e ingresos
        due_amount_updated: "Actualización de cuota",
        payment: "Ingreso registrado",
        payment_reversed: "Ingreso anulado",

        // Gastos
        expense_created: "Gasto creado",
        expense_updated: "Gasto modificado",
        expense_deleted: "Gasto eliminado",

        // Administración
        adult_fee_updated: "Actualización de cuota de adulto",
        child_fee_updated: "Actualización de cuota infantil",
        opening_balance_updated: "Actualización del saldo inicial",

        // Etiquetas de registros antiguos
        familias: "Familias",
        miembros: "Miembros",
        nombres: "Nombres",
        altas: "Altas",
        tipo: "Tipo",
        cuotas: "Cuotas"
    };

    function getCurrentPeriod() {
        const now = new Date();

        return [
            now.getFullYear(),
            String(now.getMonth() + 1).padStart(2, "0")
        ].join("-");
    }

    function periodLabel(period) {
        const [year, month] = period.split("-").map(Number);

        const date = new Date(year, month - 1, 1);

        return new Intl.DateTimeFormat("es-ES", {
            month: "long",
            year: "numeric"
        }).format(date);
    }

    function money(cents) {
        return new Intl.NumberFormat("es-ES", {
            style: "currency",
            currency: "EUR"
        }).format((cents || 0) / 100);
    }

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        })[char]);
    }

    function createId(prefix = "item") {
        return `${prefix}-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 8)}`;
    }

    function save() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (error) {
            console.error("No se han podido guardar los datos locales.", error);
            showToast("No se han podido guardar los cambios.");
        }
    }

    function load() {
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
                    : [],
            };

            if (!Number.isFinite(data.openingBalanceCents)) {
                data.openingBalanceCents = 0;
            }
        } catch (error) {
            console.error("No se han podido leer los datos locales.", error);

            data = structuredClone(INITIAL_DATA);

            showToast("Se han cargado de nuevo los datos de prueba.");
        }
    }

    function showToast(message) {
        const toast = document.getElementById("toast");

        if (!toast) return;

        toast.textContent = message;
        toast.classList.add("visible");

        clearTimeout(toastTimer);

        toastTimer = setTimeout(() => {
            toast.classList.remove("visible");
        }, 2600);
    }

    function getFamily(familyId) {
        return data.families.find(family => family.id === familyId);
    }

    function getDuesForPeriod(period) {
        return data.dues.filter(due => due.period === period);
    }

    function getDue(familyId, period) {
        return data.dues.find(due =>
            due.familyId === familyId &&
            due.period === period
        );
    }

    function ensurePeriodDues(period) {
        const actualPeriod = getCurrentPeriod();

        // Solo generamos cuotas del mes actual.
        // Nunca creamos cuotas futuras ni reconstruimos meses históricos.
        if (period !== actualPeriod) return;

        data.families
            .filter(family => family.active)
            .forEach(family => {
                // Si ya existe, no modificamos la cuota.
                if (getDue(family.id, period)) return;

                // Calcular la cuota ordinaria según los miembros activos.
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
                    receivedCents: 0,
                    status: "pendiente",
                    paidAt: null,
                    justification: ""
                });
            });

        save();
    }

    /* -------------------------------------------------
       CÁLCULOS
       ------------------------------------------------- */

    function getMonthMetrics(period) {
        const dues = getDuesForPeriod(period);

        const income = dues.reduce((total, due) => {
            if (due.status !== "pagado") return total;

            const amount = Number(due.receivedCents);

            return total + (
                Number.isSafeInteger(amount) && amount >= 0
                    ? amount
                    : 0
            );
        }, 0);

        const pending = dues.reduce((total, due) => {
            if (due.status !== "pendiente") return total;

            const amount = Number(due.expectedCents);

            return total + (
                Number.isSafeInteger(amount) && amount >= 0
                    ? amount
                    : 0
            );
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
            pendingCount: dues.filter(
                due => due.status === "pendiente"
            ).length
        };
    }

    function getCurrentBalance() {
        const openingBalance = Number(data.openingBalanceCents);

        const validOpeningBalance =
            Number.isSafeInteger(openingBalance) &&
            openingBalance >= 0
                ? openingBalance
                : 0;

        const income = data.dues.reduce((total, due) => {
            if (due.status !== "pagado") return total;

            const amount = Number(due.receivedCents);

            return total + (
                Number.isSafeInteger(amount) && amount >= 0
                    ? amount
                    : 0
            );
        }, 0);

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
       SELECTOR DE MES
       ------------------------------------------------- */

    function renderPeriodSelect() {
        const select = document.getElementById("period-select");

        if (!select) return;

        const current = getCurrentPeriod();

        // Buscar el primer periodo con información
        const existingPeriods = data.dues
            .map(due => due.period)
            .filter(period => /^\d{4}-\d{2}$/.test(period));

        const firstPeriod = existingPeriods.length
            ? existingPeriods.sort()[0]
            : current;

        const periods = [];

        // Generar todos los meses desde el primero registrado hasta el actual
        const [startYear, startMonth] = firstPeriod.split("-").map(Number);
        const [endYear, endMonth] = current.split("-").map(Number);

        const start = new Date(startYear, startMonth - 1, 1);
        const end = new Date(endYear, endMonth - 1, 1);

        for (
            let date = new Date(start);
            date <= end;
            date.setMonth(date.getMonth() + 1)
        ) {
            const period = [
                date.getFullYear(),
                String(date.getMonth() + 1).padStart(2, "0")
            ].join("-");

            periods.push(period);
        }

        // Si el periodo seleccionado no es válido, volver al actual
        if (!periods.includes(currentPeriod)) {
            currentPeriod = current;
        }

        select.innerHTML = periods.map(period => `
            <option value="${period}"
                ${period === currentPeriod ? "selected" : ""}>
                ${escapeHTML(periodLabel(period))}
            </option>
        `).join("");
    }

    /* -------------------------------------------------
       RESUMEN
       ------------------------------------------------- */

    function renderSummary() {
        const metrics = getMonthMetrics(currentPeriod);

        document.getElementById("balance-value").textContent =
            money(getCurrentBalance());

        document.getElementById("income-value").textContent =
            money(metrics.income);

        document.getElementById("expenses-value").textContent =
            money(metrics.expenses);

        document.getElementById("pending-value").textContent =
            money(metrics.pending);

        document.getElementById("pending-count").textContent =
            `${metrics.pendingCount} ${
                metrics.pendingCount === 1
                    ? "familia con cuota pendiente"
                    : "familias con cuotas pendientes"
            }`

        document.getElementById("dues-description").textContent =
            `Cuotas de ${periodLabel(currentPeriod)}.`;

        document.querySelector(".sidebar-footer span:last-child")
            ?.replaceChildren(document.createTextNode("Modo de prueba"));
    }

    /* -------------------------------------------------
       TARJETAS DE CUOTAS
       ------------------------------------------------- */

    function renderDues() {
        const list = document.getElementById("dues-list");
        const empty = document.getElementById("dues-empty");

        let dues = getDuesForPeriod(currentPeriod)
            .map(due => ({
                ...due,
                family: getFamily(due.familyId)
            }))
            .filter(due => due.family?.active);

        if (currentFilter !== "todas") {
            dues = dues.filter(due => due.status === currentFilter);
        }

        dues.sort((a, b) => {
            if (a.status !== b.status) {
                return a.status === "pendiente" ? -1 : 1;
            }

            return a.family.name.localeCompare(b.family.name, "es");
        });

        list.innerHTML = dues.map(due => {
            const paid = due.status === "pagado";

            return `
                <article class="due-card">

                    <span class="due-family-name">
                        ${escapeHTML(due.family.name)}
                    </span>

                    <strong class="due-amount">
                        ${money(due.expectedCents)}
                    </strong>

                    <button
                        class="due-status-button ${paid ? "paid" : "pending"}"
                        data-action="cambiar-estado"
                        data-due-id="${escapeHTML(due.id)}"
                        aria-label="${paid ? "Cuota abonada" : "Registrar ingreso"}">
                        ${paid ? "Abonada" : "Pendiente"}
                    </button>

                </article>
            `;
        }).join("");

        empty.classList.toggle("hidden", dues.length > 0);
        list.classList.toggle("hidden", dues.length === 0);
    }

    /* -------------------------------------------------
       NAVEGACIÓN
       ------------------------------------------------- */

    const VIEW_TITLES = {
        inicio: "Control de cuotas",
        familias: "Familias y miembros",
        economia: "Economía",
        administracion: "Administración"
    };

    function navigate(view) {
        if (!VIEW_TITLES[view]) return;

        currentView = view;

        document.querySelectorAll(".view").forEach(section => {
            section.classList.toggle(
                "active",
                section.id === `view-${view}`
            );
        });

        document.querySelectorAll("[data-view]").forEach(button => {
            const active = button.dataset.view === view;

            button.classList.toggle("active", active);

            if (button.matches("button")) {
                button.setAttribute("aria-current", active ? "page" : "false");
            }
        });

        document.getElementById("page-title").textContent =
            VIEW_TITLES[view];

        if (view === "familias") renderFamilies();
        if (view === "economia") renderEconomy();
        if (view === "administracion") renderAdministration();

        window.scrollTo({ top: 0, behavior: "auto" });
    }

    /* -------------------------------------------------
       FAMILIAS
       ------------------------------------------------- */

    function renderFamilies() {
        const container = document.getElementById("families-content");

        const families = data.families.filter(family => family.active);

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
        `;
    }

    /* -------------------------------------------------
       AUDITFILTERS
       ------------------------------------------------- */

    function applyAuditFilters() {
        activeAuditFilters = {
            categories: [
                ...document.querySelectorAll(
                    'input[name="audit-category"]:checked'
                )
            ].map(input => input.value),

            tags: [
                ...document.querySelectorAll(
                    'input[name="audit-tag"]:checked'
                )
            ].map(input => input.value),

            families: [
                ...document.querySelectorAll(
                    'input[name="audit-family"]:checked'
                )
            ].map(input => input.value),

            dateFrom: document.getElementById("audit-date-from")?.value || "",
            dateTo: document.getElementById("audit-date-to")?.value || ""
        };

        renderAuditLog();
    }

    /* -------------------------------------------------
       AUDITLOG
       ------------------------------------------------- */

    function renderAuditLog() {
        const container = document.getElementById("audit-log-list");
        const summary = document.getElementById("audit-results-summary");

        if (!container) return;

        // Obtener filtros seleccionados
        const selectedCategories = activeAuditFilters.categories;
        const selectedTags = activeAuditFilters.tags;
        const selectedFamilies = activeAuditFilters.families;

        const searchInput = document.getElementById("audit-search-input");
        const searchTerm = (searchInput?.value || "").trim().toLocaleLowerCase("es");

        const dateFrom = activeAuditFilters.dateFrom;
        const dateTo = activeAuditFilters.dateTo;

        // Determinar si hay filtros activos
        const hasFilters =
            selectedCategories.length > 0 ||
            selectedTags.length > 0 ||
            selectedFamilies.length > 0 ||
            searchTerm !== "" ||
            dateFrom !== "" ||
            dateTo !== "";

        // Sin filtros, no mostrar movimientos ni resumen
        if (!hasFilters) {
            container.innerHTML = "";

            if (summary) {
                summary.hidden = true;
                summary.textContent = "";
            }

            return;
        }

        // Filtrar movimientos
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

            const description = String(entry.description || "").toLocaleLowerCase("es");
            const familyName = String(entry.familyName || "").toLocaleLowerCase("es");
            const reason = String(entry.reason || "").toLocaleLowerCase("es");

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

        // Resumen de resultados
        if (summary) {
            summary.hidden = !hasFilters;

            if (hasFilters) {
                summary.textContent =
                    `${entries.length} movimiento${entries.length !== 1 ? "s" : ""} encontrado${entries.length !== 1 ? "s" : ""}`;
            }
        }

        // Sin movimientos
        if (entries.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">◷</div>
                    <h3>No hay movimientos</h3>
                    <p>
                        ${hasFilters
                            ? "No se han encontrado movimientos con los filtros seleccionados."
                            : "Todavía no hay movimientos registrados."}
                    </p>
                </div>
            `;

            return;
        }

        // Mostrar movimientos
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

    /* -------------------------------------------------
       ECONOMÍA
       ------------------------------------------------- */

    function renderEconomy() {
        const container = document.getElementById("economy-content");

        const expenses = [...data.expenses]
            .sort((a, b) => b.date.localeCompare(a.date));

        container.innerHTML = `
            <article class="due-card">
                <div class="due-card-top">
                    <div class="due-family-info">
                        <strong class="due-family-name">Saldo actual</strong>
                        <span class="due-family-meta">Saldo inicial + ingresos − gastos</span>
                    </div>

                    <strong class="due-amount">${money(getCurrentBalance())}</strong>
                </div>
            </article>

            <div style="height: 16px"></div>

            <div class="section-heading">
                <div>
                    <h2>Gastos registrados</h2>
                    <p>Historial de salidas de dinero.</p>
                </div>

                <button
                    type="button"
                    class="button button-primary"
                    data-action="gasto">
                    + Registrar gasto
                </button>
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

                            <div class="expense-actions">
                                <button
                                    type="button"
                                    class="button button-secondary"
                                    data-action="editar-gasto"
                                    data-expense-id="${escapeHTML(expense.id)}">
                                    Editar
                                </button>

                                <button
                                    type="button"
                                    class="button button-danger"
                                    data-action="eliminar-gasto"
                                    data-expense-id="${escapeHTML(expense.id)}">
                                    Eliminar
                                </button>
                            </div>
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

    /* -------------------------------------------------
    ADMINISTRACIÓN
    ------------------------------------------------- */

    function renderAdministration() {
        const container = document.getElementById("administration-content");

        container.innerHTML = `
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
                        autocomplete="off"
                    >
                </div>

                <div class="audit-filter-panel">

                    <!-- Botón para abrir el modal -->
                    <button
                        type="button"
                        class="audit-filter-toggle"
                        id="audit-filter-toggle"
                        aria-expanded="false"
                        aria-controls="audit-filter-modal"
                    >
                        <span>
                            <strong>Filtrar movimientos</strong>
                            <small>Personaliza los resultados del historial</small>
                        </span>
                        <span class="audit-filter-arrow">⌄</span>
                    </button>

                    <!-- Modal -->
                    <div class="audit-filter-modal" id="audit-filter-modal" hidden>

                        <div
                            class="audit-filter-backdrop"
                            data-action="close-audit-filters"
                        ></div>

                        <div
                            class="audit-filter-dialog"
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="audit-modal-title"
                        >

                            <!-- Cabecera -->
                            <div class="audit-modal-header">
                                <div>
                                    <h3 id="audit-modal-title">Filtrar movimientos</h3>
                                    <p>Personaliza los resultados del historial.</p>
                                </div>

                                <button
                                    type="button"
                                    class="audit-modal-close"
                                    data-action="close-audit-filters"
                                    aria-label="Cerrar filtros"
                                >
                                    ×
                                </button>
                            </div>

                            <!-- Contenido de los filtros -->
                            <div class="audit-filter-content" id="audit-filter-content">

                                <!-- Categorías -->
                                <div class="audit-filter-group">
                                    <h4>Categorías</h4>

                                    <div class="audit-checkbox-grid">
                                        <label>
                                            <input type="checkbox" name="audit-category" value="family">
                                            Familias
                                        </label>

                                        <label>
                                            <input type="checkbox" name="audit-category" value="member">
                                            Miembros
                                        </label>

                                        <label>
                                            <input type="checkbox" name="audit-category" value="due">
                                            Cuotas
                                        </label>

                                        <label>
                                            <input type="checkbox" name="audit-category" value="payment">
                                            Ingresos
                                        </label>

                                        <label>
                                            <input type="checkbox" name="audit-category" value="expense">
                                            Gastos
                                        </label>

                                        <label>
                                            <input type="checkbox" name="audit-category" value="economy">
                                            Economía
                                        </label>

                                        <label>
                                            <input type="checkbox" name="audit-category" value="settings">
                                            Configuración
                                        </label>
                                    </div>
                                </div>

                                <!-- Familias -->
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
                                                        value="${escapeHTML(family.id)}"
                                                    >
                                                    ${escapeHTML(family.name)}
                                                </label>
                                            `)
                                            .join("")}
                                    </div>
                                </div>

                                <!-- Tipo de movimiento -->
                                <div class="audit-filter-group">
                                    <h4>Tipo de movimiento</h4>

                                    <div class="audit-checkbox-grid">
                                        <label>
                                            <input type="checkbox" name="audit-tag" value="member_added">
                                            Altas
                                        </label>

                                        <label>
                                            <input type="checkbox" name="audit-tag" value="member_removed">
                                            Bajas
                                        </label>

                                        <label>
                                            <input type="checkbox" name="audit-tag" value="member_name_changed">
                                            Cambios de nombre
                                        </label>

                                        <label>
                                            <input type="checkbox" name="audit-tag" value="member_type_changed">
                                            Cambios de tipo
                                        </label>

                                        <label>
                                            <input type="checkbox" name="audit-tag" value="member_fee_changed">
                                            Cambios de cuota
                                        </label>

                                        <label>
                                            <input type="checkbox" name="audit-tag" value="family_name_changed">
                                            Cambios de familia
                                        </label>

                                        <label>
                                            <input type="checkbox" name="audit-tag" value="payment">
                                            Ingresos registrados
                                        </label>

                                        <label>
                                            <input type="checkbox" name="audit-tag" value="payment_reversed">
                                            Ingresos anulados
                                        </label>

                                        <label>
                                            <input type="checkbox" name="audit-tag" value="expense_created">
                                            Gastos creados
                                        </label>

                                        <label>
                                            <input type="checkbox" name="audit-tag" value="expense_updated">
                                            Gastos modificados
                                        </label>

                                        <label>
                                            <input type="checkbox" name="audit-tag" value="expense_deleted">
                                            Gastos eliminados
                                        </label>
                                    </div>
                                </div>

                                <!-- Periodo -->
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
                                        <button type="button" data-audit-period="24h">
                                            Últimas 24 horas
                                        </button>

                                        <button type="button" data-audit-period="7d">
                                            Últimos 7 días
                                        </button>

                                        <button type="button" data-audit-period="30d">
                                            Últimos 30 días
                                        </button>

                                        <button type="button" data-audit-period="month">
                                            Este mes
                                        </button>

                                        <button type="button" data-audit-period="previous-month">
                                            Mes anterior
                                        </button>
                                    </div>
                                </div>

                            </div>

                            <!-- Acciones -->
                            <div class="audit-filter-actions">
                                <button
                                    type="button"
                                    class="button button-secondary"
                                    id="audit-clear-filters"
                                >
                                    Limpiar filtros
                                </button>

                                <button
                                    type="button"
                                    class="button button-primary"
                                    id="audit-apply-filters"
                                >
                                    Aplicar filtros
                                </button>
                            </div>

                        </div>
                    </div>
                </div>

                <div class="audit-results-summary" id="audit-results-summary" hidden></div>

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
                                required
                            >
                        </label>

                        <label class="form-field">
                            <span>Cuota mensual por niño (€)</span>
                            <input
                                type="number"
                                name="childFee"
                                min="0"
                                step="0.01"
                                value="${(data.settings.childFeeCents / 100).toFixed(2)}"
                                required
                            >
                        </label>

                        <label class="form-field">
                            <span>Saldo inicial (€)</span>
                            <input
                                type="number"
                                name="openingBalance"
                                step="0.01"
                                value="${(data.openingBalanceCents / 100).toFixed(2)}"
                                required
                            >
                        </label>
                    </div>

                    <div class="form-actions">
                        <button type="submit" class="button button-primary">
                            Guardar configuración
                        </button>
                    </div>
                </form>
            </section>

            <section class="admin-section admin-danger-section">
                <div class="admin-section-heading">
                    <div>
                        <h3>Datos de demostración</h3>
                        <p>Restablece los datos de ejemplo de la aplicación.</p>
                    </div>
                </div>

                <button
                    type="button"
                    class="button button-danger"
                    data-action="reset-demo"
                >
                    Restablecer datos de demostración
                </button>
            </section>
        `;

        renderAuditLog();
    }

    /* -------------------------------------------------
       MODALES
       ------------------------------------------------- */

    function openModal(content) {
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

    function closeModal() {
        document.getElementById("modal-root").innerHTML = "";
        document.body.style.overflow = "";
    }

    function openEditDue(dueId) {
        const due = data.dues.find(item => item.id === dueId);

        if (!due) return;

        const family = getFamily(due.familyId);

        if (!family) return;

        openModal(`
            <div class="modal-header">
                <div>
                    <h2>Editar cuota</h2>
                    <p>${escapeHTML(family.name)} · ${escapeHTML(periodLabel(due.period))}</p>
                </div>

                <button class="modal-close"
                        type="button"
                        data-action="cerrar-modal"
                        aria-label="Cerrar">
                    ×
                </button>
            </div>

            <form id="edit-due-form" data-due-id="${escapeHTML(due.id)}">

                <div class="form-group">
                    <label for="due-amount-input">Importe esperado (€)</label>

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
                        placeholder="Por ejemplo, derrama o pago especial...">${escapeHTML(due.justification)}</textarea>
                </div>

                <p class="due-family-meta">
                    ${due.status === "pagado"
                        ? "Esta cuota ya está pagada. Para cambiar el importe, primero tendrás que devolverla a pendiente."
                        : "Los cambios solo afectan a esta cuota mensual."}
                </p>

                <div class="modal-actions">
                    <button type="button"
                            class="button button-secondary"
                            data-action="cerrar-modal">
                        Cancelar
                    </button>

                    <button type="submit"
                            class="button button-primary"
                            ${due.status === "pagado" ? "disabled" : ""}>
                        Guardar cambios
                    </button>
                </div>

            </form>
        `);
    }


    function openManageMembers(familyId) {
        const family = getFamily(familyId);

        if (!family) return;

        if (!Array.isArray(family.memberList)) {
            family.memberList = [];
        }

        const members = (family.memberList || []).filter(member => member.active);

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
                    <label for="manage-family-name">Nombre de la familia</label>

                    <input
                        id="manage-family-name"
                        name="familyName"
                        type="text"
                        maxlength="100"
                        required
                        value="${escapeHTML(family.name)}">
                </div>

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

        updateFamilyEditTotal();
    }


    function updateNewFamilyTotal() {
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

    function updateFamilyEditTotal() {
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

    function updateMemberFeeByType(select) {
        const row = select.closest(".member-edit-row");

        if (!row) return;

        const feeInput = row.querySelector('[name="memberFee"]');

        if (!feeInput) return;

        const type = select.value;

        const feeCents = type === "child"
            ? data.settings.childFeeCents
            : data.settings.adultFeeCents;

        feeInput.value = (feeCents / 100).toFixed(2);

        updateFamilyEditTotal();
    }

    function saveManageFamilyForm(form) {
        const family = getFamily(form.dataset.familyId);

        if (!family) return;

        const familyName = String(
            form.querySelector('[name="familyName"]').value || ""
        ).trim();

        if (!familyName) {
            showToast("Introduce el nombre de la familia.");
            return;
        }

        const duplicate = data.families.some(item =>
            item.active &&
            item.id !== family.id &&
            item.name.toLocaleLowerCase("es") === familyName.toLocaleLowerCase("es")
        );

        if (duplicate) {
            showToast("Ya existe una familia con ese nombre.");
            return;
        }

        const originalMembers = family.memberList || [];
        const rows = form.querySelectorAll(".member-edit-row");

        const updatedMembers = [];
        const changesToRegister = [];

        // -----------------------------------------
        // VALIDAR Y COMPARAR LOS MIEMBROS
        // -----------------------------------------

        for (const row of rows) {
            const name = String(
                row.querySelector('[name="memberName"]').value || ""
            ).trim();

            const type = row.querySelector('[name="memberType"]').value;

            const amount = Number(
                row.querySelector('[name="memberFee"]').value
            );

            if (
                !name ||
                !["adult", "child"].includes(type) ||
                !Number.isFinite(amount) ||
                amount < 0 ||
                amount > 100000
            ) {
                showToast("Revisa los nombres y las cuotas de los miembros.");
                return;
            }

            const memberId = row.dataset.memberId || createId("member");

            const newFeeCents = Math.round(amount * 100);

            const original = originalMembers.find(
                member => member.id === memberId
            );

            const updatedMember = {
                id: memberId,
                name,
                type,
                monthlyFeeCents: newFeeCents,
                active: true
            };

            updatedMembers.push(updatedMember);

            // Nuevo miembro.
            if (!original) {
                changesToRegister.push({
                    action: "member_added",
                    tags: ["member_added"],
                    description: `Se añadió el miembro ${name}.`,
                    changes: {
                        memberId,
                        memberName: name,
                        type,
                        monthlyFeeCents: newFeeCents
                    }
                });

                continue;
            }

            // Cambio de nombre.
            if (original.name !== name) {
                changesToRegister.push({
                    action: "member_name_changed",
                    tags: ["member_name_changed"],
                    description: `Se modificó el nombre de un miembro: ${original.name} → ${name}.`,
                    changes: {
                        memberId,
                        previousValue: original.name,
                        newValue: name
                    }
                });
            }

            // Cambio de tipo.
            if (original.type !== type) {
                changesToRegister.push({
                    action: "member_type_changed",
                    tags: ["member_type_changed"],
                    description: `Se modificó el tipo de miembro de ${name}.`,
                    changes: {
                        memberId,
                        memberName: name,
                        previousValue: original.type,
                        newValue: type
                    }
                });
            }

            // Cambio de cuota.
            if (original.monthlyFeeCents !== newFeeCents) {

                const standardFeeForNewType = type === "child"
                    ? data.settings.childFeeCents
                    : data.settings.adultFeeCents;

                const automaticTypeChange =
                    original.type !== type &&
                    newFeeCents === standardFeeForNewType;

                changesToRegister.push({
                    action: "member_fee_changed",
                    tags: ["member_fee_changed"],
                    description: `Se modificó la cuota de ${name}.`,
                    changes: {
                        memberId,
                        memberName: name,
                        previousValue: original.monthlyFeeCents,
                        newValue: newFeeCents
                    },
                    requiresReason: !automaticTypeChange
                });
            }
        }

        if (updatedMembers.length === 0) {
            showToast("La familia debe tener al menos un miembro activo.");
            return;
        }

        // -----------------------------------------
        // DETECTAR MIEMBROS ELIMINADOS
        // -----------------------------------------

        const updatedIds = new Set(
            updatedMembers.map(member => member.id)
        );

        originalMembers.forEach(original => {
            if (original.active && !updatedIds.has(original.id)) {
                changesToRegister.push({
                    action: "member_removed",
                    tags: ["member_removed"],
                    description: `Se eliminó el miembro ${original.name}.`,
                    changes: {
                        memberId: original.id,
                        memberName: original.name,
                        previousValue: {
                            type: original.type,
                            monthlyFeeCents: original.monthlyFeeCents
                        }
                    }
                });
            }
        });

        // -----------------------------------------
        // DETECTAR CAMBIO DE NOMBRE DE FAMILIA
        // -----------------------------------------

        const previousFamilyName = family.name;

        if (previousFamilyName !== familyName) {
            changesToRegister.push({
                action: "family_name_changed",
                tags: ["family_name_changed"],
                description: `Se cambió el nombre de la familia: ${previousFamilyName} → ${familyName}.`,
                changes: {
                    previousValue: previousFamilyName,
                    newValue: familyName
                }
            });
        }

        // -----------------------------------------
        // VALIDAR JUSTIFICACIÓN
        // -----------------------------------------

        const requiresReason = changesToRegister.some(
            change => change.requiresReason
        );

        let reason = "";

        if (requiresReason) {
            reason = String(
                form.querySelector('[name="feeChangeReason"]')?.value || ""
            ).trim();

            if (!reason) {
                showToast("Explica el motivo del cambio de cuota.");
                return;
            }
        }

        // -----------------------------------------
        // GUARDAR CAMBIOS
        // -----------------------------------------

        const currentDue = getDue(family.id, currentPeriod);

        const previousDueAmount = currentDue
            ? currentDue.expectedCents
            : null;

        const updatedDueAmount = updatedMembers.reduce(
            (total, member) => total + member.monthlyFeeCents,
            0
        );

        family.name = familyName;
        family.memberList = updatedMembers;
        family.members = updatedMembers.length;

        // Registrar cada operación individualmente.
        changesToRegister.forEach(change => {
            const category = change.action.startsWith("family_")
                ? "family"
                : "member";

            registerAuditLog({
                category,
                action: change.action,
                tags: change.tags,
                familyId: family.id,
                familyName: familyName,
                description: change.description,
                changes: change.changes,
                reason: change.requiresReason ? reason : ""
            });
        });

        // -----------------------------------------
        // ACTUALIZAR CUOTA DEL MES ACTUAL
        // -----------------------------------------

        if (currentDue && currentDue.status === "pendiente") {
            if (currentDue.expectedCents !== updatedDueAmount) {
                currentDue.expectedCents = updatedDueAmount;

                registerAuditLog({
                    category: "due",
                    action: "due_amount_updated",
                    tags: ["due_amount_updated"],
                    familyId: family.id,
                    familyName: familyName,
                    description: `Se actualizó la cuota pendiente de ${familyName}.`,
                    changes: {
                        previousValue: previousDueAmount,
                        newValue: updatedDueAmount
                    },
                    reason
                });
            }
        }

        save();

        closeModal();
        renderAll();

        showToast(
            changesToRegister.length > 0
                ? `${changesToRegister.length} cambio(s) registrado(s).`
                : "Familia actualizada."
        );
    }


    function openNewExpense() {
        openModal(`
            <div class="modal-header">
                <div>
                    <h2>Registrar gasto</h2>
                    <p>Anota una salida de dinero de la peña.</p>
                </div>

                <button class="modal-close"
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
                    <button type="button"
                            class="button button-secondary"
                            data-action="cerrar-modal">
                        Cancelar
                    </button>

                    <button type="submit"
                            class="button button-primary">
                        Guardar gasto
                    </button>
                </div>

            </form>
        `);
    }


    function openEditExpense(expenseId) {
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

            <form id="new-expense-form" data-expense-id="${escapeHTML(expense.id)}">

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


    function openNewFamily() {
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

    function confirmAction(title, description, confirmLabel, action) {
        openModal(`
            <div class="modal-header">
                <div>
                    <h2>${escapeHTML(title)}</h2>
                    <p>${escapeHTML(description)}</p>
                </div>

                <button class="modal-close"
                        type="button"
                        data-action="cerrar-modal"
                        aria-label="Cerrar">
                    ×
                </button>
            </div>

            <div class="modal-actions">
                <button type="button"
                        class="button button-secondary"
                        data-action="cerrar-modal">
                    Cancelar
                </button>

                <button type="button"
                        class="button button-primary"
                        data-action="${escapeHTML(action)}">
                    ${escapeHTML(confirmLabel)}
                </button>
            </div>
        `);
    }

    /* -------------------------------------------------
       OPERACIONES
       ------------------------------------------------- */

    function registerAuditLog({
        category,
        action,
        tags = [],
        familyId = null,
        familyName = null,
        description,
        changes = null,
        reason = ""
    }) {
        if (!Array.isArray(data.auditLog)) {
            data.auditLog = [];
        }

        const entry = {
            id: createId("log"),

            date: new Date().toISOString(),

            category,
            action,

            tags: [...new Set(tags)],

            familyId,
            familyName,

            description,

            changes,

            reason: String(reason || "").trim()
        };

        data.auditLog.unshift(entry);

        return entry;
    }

    function checkFamilyFeeChanges(form) {
        const family = getFamily(form.dataset.familyId);

        if (!family) return false;

        const originalMembers = family.memberList || [];
        const rows = form.querySelectorAll(".member-edit-row");

        let hasChanges = false;

        rows.forEach(row => {
            const memberId = row.dataset.memberId;

            if (!memberId) return;

            const original = originalMembers.find(
                member => member.id === memberId
            );

            if (!original) return;

            const newAmount = Math.round(
                Number(row.querySelector('[name="memberFee"]').value) * 100
            );

            if (newAmount !== original.monthlyFeeCents) {
                hasChanges = true;
            }
        });

        const reasonGroup = form.querySelector("#fee-change-reason-group");
        const reasonInput = form.querySelector('[name="feeChangeReason"]');

        if (reasonGroup && reasonInput) {
            reasonGroup.hidden = !hasChanges;
            reasonInput.required = hasChanges;
        }

        return hasChanges;
    }

    function saveAdminSettings(form) {
        const formData = new FormData(form);

        const adultFee = Number(formData.get("adultFee"));
        const childFee = Number(formData.get("childFee"));
        const openingBalance = Number(formData.get("openingBalance"));

        if (
            !Number.isFinite(adultFee) ||
            !Number.isFinite(childFee) ||
            !Number.isFinite(openingBalance) ||
            adultFee < 0 ||
            childFee < 0 ||
            openingBalance < 0 ||
            adultFee > 100000 ||
            childFee > 100000 ||
            openingBalance > 100000000
        ) {
            showToast("Revisa los importes introducidos.");
            return;
        }

        // Valores anteriores
        const previousAdultFee = data.settings.adultFeeCents || 0;
        const previousChildFee = data.settings.childFeeCents || 0;
        const previousOpeningBalance = data.openingBalanceCents || 0;

        // Nuevos valores en céntimos
        const newAdultFee = Math.round(adultFee * 100);
        const newChildFee = Math.round(childFee * 100);
        const newOpeningBalance = Math.round(openingBalance * 100);

        // Actualizamos la configuración
        data.settings.adultFeeCents = newAdultFee;
        data.settings.childFeeCents = newChildFee;
        data.openingBalanceCents = newOpeningBalance;

        // Cambio de cuota de adulto
        if (previousAdultFee !== newAdultFee) {
            registerAuditLog({
                category: "economy",
                action: "adult_fee_updated",
                tags: ["adult_fee_updated"],
                description: "Se ha modificado la cuota mensual de adulto.",
                changes: {
                    previousValue: money(previousAdultFee),
                    newValue: money(newAdultFee)
                }
            });
        }

        // Cambio de cuota infantil
        if (previousChildFee !== newChildFee) {
            registerAuditLog({
                category: "economy",
                action: "child_fee_updated",
                tags: ["child_fee_updated"],
                description: "Se ha modificado la cuota mensual infantil.",
                changes: {
                    previousValue: money(previousChildFee),
                    newValue: money(newChildFee)
                }
            });
        }

        // Cambio del saldo inicial
        if (previousOpeningBalance !== newOpeningBalance) {
            registerAuditLog({
                category: "economy",
                action: "opening_balance_updated",
                tags: ["opening_balance_updated"],
                description: "Se ha modificado el saldo inicial.",
                changes: {
                    previousValue: money(previousOpeningBalance),
                    newValue: money(newOpeningBalance)
                }
            });
        }

        save();
        renderAll();

        showToast("Configuración guardada correctamente.");
    }

    function toggleDueStatus(dueId) {
        const due = data.dues.find(item => item.id === dueId);

        if (!due) return;

        const family = getFamily(due.familyId);

        if (!family) return;

        if (due.status === "pendiente") {
            confirmPayment(dueId);
            return;
        }

        confirmAction(
            "Anular ingreso",
            `La cuota de ${family.name} volverá a estar pendiente. Se descontarán ${money(due.receivedCents)} del saldo.`,
            "Anular ingreso",
            `confirmar-pendiente:${due.id}`
        );
    }

    function confirmPayment(dueId) {
        const due = data.dues.find(item => item.id === dueId);

        if (!due || due.status !== "pendiente") return;

        const family = getFamily(due.familyId);

        if (!family) return;

        if (
            !Number.isSafeInteger(due.expectedCents) ||
            due.expectedCents < 0
        ) {
            showToast("El importe de esta cuota no es válido.");
            return;
        }

        // Registrar el ingreso.
        due.status = "pagado";
        due.receivedCents = due.expectedCents;
        due.paidAt = new Date().toISOString();

        registerAuditLog({
            category: "payment",
            action: "payment",
            tags: ["payment"],
            familyId: family.id,
            familyName: family.name,
            description: `Ingreso de ${money(due.receivedCents)} registrado para ${family.name}.`,
            changes: {
                amountCents: due.receivedCents,
                period: due.period
            }
        });

        save();
        closeModal();
        renderAll();

        showToast("Ingreso registrado correctamente.");
    }

    function revertPayment(dueId) {
        const due = data.dues.find(item => item.id === dueId);

        if (!due || due.status !== "pagado") return;

        const family = getFamily(due.familyId);

        if (!family) return;

        if (
            !Number.isSafeInteger(due.receivedCents) ||
            due.receivedCents < 0
        ) {
            showToast("El importe del ingreso no es válido.");
            return;
        }

        // Guardar el importe antes de anular el ingreso.
        const previousAmount = due.receivedCents;

        // Anular el ingreso.
        due.status = "pendiente";
        due.receivedCents = 0;
        due.paidAt = null;

        registerAuditLog({
            category: "payment",
            action: "payment_reversed",
            tags: ["payment_reversed"],
            familyId: family.id,
            familyName: family.name,
            description: `Se anuló el ingreso de ${money(previousAmount)} de ${family.name}.`,
            changes: {
                amountCents: previousAmount,
                period: due.period
            }
        });

        save();
        closeModal();
        renderAll();

        showToast("Ingreso anulado. La cuota vuelve a estar pendiente.");
    }

    function saveDueForm(form) {
        const dueId = form.dataset.dueId;
        const due = data.dues.find(item => item.id === dueId);

        if (!due || due.status === "pagado") return;

        const formData = new FormData(form);

        const amount = Number(formData.get("amount"));
        const justification = String(
            formData.get("justification") || ""
        ).trim();

        if (!Number.isFinite(amount) || amount < 0 || amount > 100000) {
            showToast("Introduce un importe válido.");
            return;
        }

        due.expectedCents = Math.round(amount * 100);
        due.justification = justification;

        save();
        closeModal();
        renderAll();

        showToast("Cuota actualizada.");
    }

    function saveExpenseForm(form) {
        const formData = new FormData(form);

        const expenseId = form.dataset.expenseId;

        const concept = String(formData.get("concept") || "").trim();
        const amount = Number(formData.get("amount"));
        const date = String(formData.get("date") || "");

        const [year, month, day] = date.split("-").map(Number);

        const parsedDate = new Date(year, month - 1, day);

        const validDate =
            /^\d{4}-\d{2}-\d{2}$/.test(date) &&
            parsedDate.getFullYear() === year &&
            parsedDate.getMonth() === month - 1 &&
            parsedDate.getDate() === day;

        if (
            !concept ||
            !Number.isFinite(amount) ||
            amount <= 0 ||
            amount > 100000 ||
            !validDate
        ) {
            showToast("Revisa los datos del gasto.");
            return;
        }

        const amountCents = Math.round(amount * 100);

        // -----------------------------------------
        // EDITAR GASTO EXISTENTE
        // -----------------------------------------

        if (expenseId) {
            const expense = data.expenses.find(
                item => item.id === expenseId
            );

            if (!expense) {
                showToast("No se ha encontrado el gasto.");
                return;
            }

            const previousConcept = expense.concept;
            const previousAmount = expense.amountCents;
            const previousDate = expense.date;

            const hasChanges =
                previousConcept !== concept ||
                previousAmount !== amountCents ||
                previousDate !== date;

            if (!hasChanges) {
                closeModal();
                return;
            }

            expense.concept = concept;
            expense.amountCents = amountCents;
            expense.date = date;

            registerAuditLog({
                category: "expense",
                action: "expense_updated",
                tags: ["expense_updated"],
                description: `Se modificó el gasto «${concept}».`,
                changes: {
                    previousValue:
                        `${previousConcept} · ${money(previousAmount)} · ${previousDate}`,
                    newValue:
                        `${concept} · ${money(amountCents)} · ${date}`
                }
            });

            save();
            closeModal();
            renderAll();

            showToast("Gasto actualizado correctamente.");
            return;
        }

        // -----------------------------------------
        // CREAR GASTO NUEVO
        // -----------------------------------------

        const expense = {
            id: createId("expense"),
            concept,
            amountCents,
            date
        };

        data.expenses.push(expense);

        registerAuditLog({
            category: "expense",
            action: "expense_created",
            tags: ["expense_created"],
            description: `Se registró el gasto «${concept}» por ${money(amountCents)}.`,
            changes: {
                amountCents,
                date
            }
        });

        save();
        closeModal();
        renderAll();

        showToast("Gasto registrado correctamente.");
    }

    function deleteExpense(expenseId) {
        const expenseIndex = data.expenses.findIndex(
            item => item.id === expenseId
        );

        if (expenseIndex === -1) return;

        const expense = data.expenses[expenseIndex];

        registerAuditLog({
            category: "expense",
            action: "expense_deleted",
            tags: ["expense_deleted"],
            description: `Se eliminó el gasto «${expense.concept}» por ${money(expense.amountCents)}.`,
            changes: {
                previousValue:
                    `${expense.concept} · ${money(expense.amountCents)} · ${expense.date}`,
                newValue: "Gasto eliminado"
            }
        });

        data.expenses.splice(expenseIndex, 1);

        save();
        closeModal();
        renderAll();

        showToast("Gasto eliminado correctamente.");
    }

    function saveFamilyForm(form) {
        const formData = new FormData(form);

        const name = String(formData.get("name") || "").trim();

        if (!name) {
            showToast("Introduce el nombre de la familia.");
            return;
        }

        const duplicate = data.families.some(family =>
            family.active &&
            family.name.toLocaleLowerCase("es") === name.toLocaleLowerCase("es")
        );

        if (duplicate) {
            showToast("Ya existe una familia con ese nombre.");
            return;
        }

        const rows = form.querySelectorAll(".member-edit-row");

        if (rows.length === 0 || rows.length > 100) {
            showToast("La familia debe tener entre 1 y 100 miembros.");
            return;
        }

        const memberList = [];
        let expectedCents = 0;

        // Validar y crear los miembros.
        for (const row of rows) {
            const memberName = String(
                row.querySelector('[name="memberName"]').value || ""
            ).trim();

            const type = row.querySelector('[name="memberType"]').value;

            const amount = Number(
                row.querySelector('[name="memberFee"]').value
            );

            if (
                !memberName ||
                !["adult", "child"].includes(type) ||
                !Number.isFinite(amount) ||
                amount < 0 ||
                amount > 100000
            ) {
                showToast("Revisa los nombres, tipos y cuotas de los miembros.");
                return;
            }

            const feeCents = Math.round(amount * 100);

            memberList.push({
                id: row.dataset.memberId || createId("member"),
                name: memberName,
                type,
                monthlyFeeCents: feeCents,
                active: true
            });

            expectedCents += feeCents;
        }

        const family = {
            id: createId("family"),
            name,
            members: memberList.length,
            memberList,
            active: true
        };

        data.families.push(family);

        // Crear la cuota del periodo actual.
        data.dues.push({
            id: createId("due"),
            familyId: family.id,
            period: currentPeriod,
            expectedCents,
            receivedCents: 0,
            status: "pendiente",
            paidAt: null,
            justification: ""
        });

        // Registrar el alta de la familia.
        registerAuditLog({
            category: "family",
            action: "family_created",
            tags: ["family_created"],
            familyId: family.id,
            familyName: family.name,
            description: `Se creó la familia ${family.name} con ${memberList.length} miembro(s).`,
            changes: {
                members: memberList.length,
                expectedCents
            }
        });

        // Registrar cada miembro creado.
        memberList.forEach(member => {
            registerAuditLog({
                category: "member",
                action: "member_added",
                tags: ["member_added"],
                familyId: family.id,
                familyName: family.name,
                description: `Se añadió el miembro ${member.name}.`,
                changes: {
                    memberId: member.id,
                    memberName: member.name,
                    type: member.type,
                    monthlyFeeCents: member.monthlyFeeCents
                }
            });
        });

        save();
        closeModal();
        renderAll();
        navigate("familias");

        showToast("Familia creada correctamente.");
    }
    function resetDemo() {
        confirmAction(
            "Restablecer datos de prueba",
            "Se borrarán los cambios de esta demostración y se recuperarán los datos iniciales.",
            "Restablecer",
            "confirmar-restablecer"
        );
    }

    function confirmReset() {
        data = structuredClone(INITIAL_DATA);

        save();
        closeModal();
        ensurePeriodDues(currentPeriod);
        renderAll();

        showToast("Datos de prueba restablecidos.");
    }

    /* -------------------------------------------------
       EVENTOS
       ------------------------------------------------- */

    function handleClick(event) {
        const button = event.target.closest("button");

        if (!button) return;

        // Abrir modal de filtros
        if (button.id === "audit-filter-toggle") {
            const modal = document.getElementById("audit-filter-modal");

            modal.hidden = false;
            button.setAttribute("aria-expanded", "true");

            return;
        }

        // Cerrar modal de filtros
        if (button.dataset.action === "close-audit-filters") {
            const modal = document.getElementById("audit-filter-modal");
            const toggle = document.getElementById("audit-filter-toggle");

            modal.hidden = true;
            toggle.setAttribute("aria-expanded", "false");

            return;
        }


        // Aplicar filtros del historial
        if (button.id === "audit-apply-filters") {
            applyAuditFilters();

            const modal = document.getElementById("audit-filter-modal");
            const toggle = document.getElementById("audit-filter-toggle");

            modal.hidden = true;
            toggle.setAttribute("aria-expanded", "false");

            return;
        }

        // Limpiar filtros del historial
        if (button.id === "audit-clear-filters") {
            document.querySelectorAll(
                'input[name="audit-category"], input[name="audit-tag"], input[name="audit-family"]'
            ).forEach(input => {
                input.checked = false;
            });

            document.getElementById("audit-date-from").value = "";
            document.getElementById("audit-date-to").value = "";

            activeAuditFilters = {
                categories: [],
                tags: [],
                families: [],
                dateFrom: "",
                dateTo: ""
            };

            renderAuditLog();

            return;
        }        

        // Accesos rápidos de fechas del historial
        if (button.dataset.auditPeriod) {
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

            switch (button.dataset.auditPeriod) {
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

        if (button.dataset.view) {
            navigate(button.dataset.view);
            return;
        }

        if (button.dataset.filter) {
            currentFilter = button.dataset.filter;

            document.querySelectorAll("[data-filter]").forEach(item => {
                item.classList.toggle("active", item === button);
            });

            renderDues();
            return;
        }

        if (button.dataset.action === "gestionar-miembros") {
            openManageMembers(button.dataset.familyId);
            return;
        }

        if (button.dataset.familyId) {
            const family = getFamily(button.dataset.familyId);

            if (family) {
                openManageMembers(family.id);
            }

            return;
        }

        const action = button.dataset.action;

        if (!action) return;

        if (action === "cerrar-modal") {
            if (event.target === button || button.matches("button")) {
                closeModal();
            }
            return;
        }

        if (action === "editar-cuota") {
            openEditDue(button.dataset.dueId);
            return;
        }

        if (action === "cambiar-estado") {
            toggleDueStatus(button.dataset.dueId);
            return;
        }

        if (action === "familia") {
            openNewFamily();
            return;
        }

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
            }

            return;
        }

        if (action === "restablecer") {
            resetDemo();
            return;
        }

        if (action === "confirmar-restablecer") {
            confirmReset();
            return;
        }

        if (action.startsWith("confirmar-pago:")) {
            confirmPayment(action.split(":")[1]);
            return;
        }

        if (action.startsWith("confirmar-pendiente:")) {
            revertPayment(action.split(":")[1]);
        }

        if (action.startsWith("confirmar-eliminar-gasto:")) {
            deleteExpense(action.split(":")[1]);
            return;
        }

        if (event.target.closest('[data-action="toggle-family"]')) {
            const button = event.target.closest('[data-action="toggle-family"]');

            const detailsId = button.getAttribute("aria-controls");
            const details = document.getElementById(detailsId);

            if (!details) return;

            const isExpanded = button.getAttribute("aria-expanded") === "true";

            button.setAttribute("aria-expanded", String(!isExpanded));
            details.hidden = isExpanded;

            return;
        }
    }

    function handleSubmit(event) {
        const form = event.target;

        if (!(form instanceof HTMLFormElement)) return;

        if (form.id === "admin-settings-form") {
            event.preventDefault();
            saveAdminSettings(form);
            return;
        }

        if (form.id === "edit-due-form") {
            event.preventDefault();
            saveDueForm(form);
            return;
        }

        if (form.id === "manage-family-form") {
            event.preventDefault();
            saveManageFamilyForm(form);
            return;
        }

        if (form.id === "new-expense-form") {
            event.preventDefault();
            saveExpenseForm(form);
            return;
        }

        if (form.id === "new-family-form") {
            event.preventDefault();
            saveFamilyForm(form);
        }
    }

    function handleChange(event) {

        if (
            event.target.matches(
                "#audit-category-filter, #audit-tag-filter, #audit-family-filter"
            )
        ) {
            renderAuditLog();
            return;
        }

        if (event.target.id === "period-select") {
            currentPeriod = event.target.value;

            ensurePeriodDues(currentPeriod);
            renderAll();
            return;
        }

        if (
            event.target.matches(
                '#manage-members-list [name="memberFee"]'
            )
        ) {
            updateFamilyEditTotal();
        }

        if (event.target.matches('[name="memberType"]')) {
            const row = event.target.closest(".member-row");

            if (row) {
                const feeInput = row.querySelector('[name="memberFee"]');
                const isChild = event.target.value === "child";

                const feeCents = isChild
                    ? data.settings.childFeeCents
                    : data.settings.adultFeeCents;

                feeInput.value = (feeCents / 100).toFixed(2);

                updateMemberTotal();
            }

            return;
        }
    }

    function handleInput(event) {

        // Buscador del historial
        if (event.target.matches("#audit-search-input")) {
            renderAuditLog();
            return;
        }

        // Actualizar total de cuotas al editar miembros
        if (
            event.target.matches(
                '#manage-members-list [name="memberFee"]'
            )
        ) {
            updateFamilyEditTotal();
        }

        // Comprobar cambios en las cuotas individuales
        if (event.target.matches('[name="memberFee"]')) {
            const form = event.target.closest("#manage-family-form");

            if (form) {
                checkFamilyFeeChanges(form);
            }
        }
    }

    function handleKeydown(event) {
        if (event.key === "Escape") {
            closeModal();
        }
    }

    /* -------------------------------------------------
       RENDERIZADO
       ------------------------------------------------- */

    function renderAll() {
        renderPeriodSelect();
        renderSummary();
        renderDues();

        if (currentView === "familias") renderFamilies();
        if (currentView === "economia") renderEconomy();
        if (currentView === "administracion") renderAdministration();
    }

    function init() {
        load();
        ensurePeriodDues(currentPeriod);

        document.addEventListener("click", handleClick);
        document.addEventListener("change", event => {
            if (
                event.target.matches(
                    '#manage-members-list [name="memberType"], #new-family-members-list [name="memberType"]'
                )
            ) {
                updateMemberFeeByType(event.target);
            }
        });
        document.addEventListener("submit", handleSubmit);
        document.addEventListener("change", handleChange);
        document.addEventListener("keydown", handleKeydown);
        document.addEventListener("input", handleInput);
        document.addEventListener("input", event => {
            if (
                event.target.matches(
                    '#new-family-members-list [name="memberFee"]'
                )
            ) {
                updateNewFamilyTotal();
            }

            if (
                event.target.matches(
                    '#manage-members-list [name="memberFee"]'
                )
            ) {
                updateFamilyEditTotal();
            }
        });

        document.getElementById("show-all-dues")
            .addEventListener("click", () => {
                currentFilter = "todas";

                document.querySelectorAll("[data-filter]").forEach(button => {
                    button.classList.toggle(
                        "active",
                        button.dataset.filter === "todas"
                    );
                });

                renderDues();
            });

        renderAll();
    }

    return { init };
})();

document.addEventListener("DOMContentLoaded", CESPlus.init);