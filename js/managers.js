/* =====================================================
   CESPLUS — MANAGERS
   Operaciones y lógica de negocio
   ===================================================== */

"use strict";

import {
    data,
    currentPeriod,
    save,
    resetData,
    getFamily,
    getDue,
    createId,
    money
} from "./core.js";

import {
    savePayment,
    reversePayment,
    saveExpense,
    removeExpense,
    createFamilyWithMembers,
    updateFamilyWithMembers,
    deactivateFamily as deactivateFamilyInSupabase,
    reactivateFamily as reactivateFamilyInSupabase,
    getPendingFamilyLinkRequests,
    approveFamilyLink as approveFamilyLinkInSupabase,
    rejectFamilyLink as rejectFamilyLinkInSupabase,
    generateFamilyAccessCode as generateFamilyAccessCodeInSupabase,
    getFamilyAccessCode as getFamilyAccessCodeInSupabase
} from "./supabase-data.js";


/* -------------------------------------------------
   AUDITORÍA
   ------------------------------------------------- */

export function registerAuditLog({
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


/* -------------------------------------------------
   CONFIGURACIÓN GENERAL
   ------------------------------------------------- */

export function saveAdminSettings(form) {
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
        return {
            ok: false,
            message: "Revisa los importes introducidos."
        };
    }

    const previousAdultFee = data.settings.adultFeeCents || 0;
    const previousChildFee = data.settings.childFeeCents || 0;
    const previousOpeningBalance = data.openingBalanceCents || 0;

    const newAdultFee = Math.round(adultFee * 100);
    const newChildFee = Math.round(childFee * 100);
    const newOpeningBalance = Math.round(openingBalance * 100);

    data.settings.adultFeeCents = newAdultFee;
    data.settings.childFeeCents = newChildFee;
    data.openingBalanceCents = newOpeningBalance;

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

    return {
        ok: true,
        message: "Configuración guardada correctamente."
    };
}


/* -------------------------------------------------
   CUOTAS E INGRESOS
   ------------------------------------------------- */

export function toggleDueStatus(dueId) {
    const due = data.dues.find(item => item.id === dueId);

    if (!due) {
        return {
            ok: false,
            message: "No se ha encontrado la cuota."
        };
    }

    const family = getFamily(due.familyId);

    if (!family) {
        return {
            ok: false,
            message: "No se ha encontrado la familia."
        };
    }

    if (due.status === "pendiente") {
        return {
            ok: true,
            requiresConfirmation: false,
            action: "payment",
            dueId
        };
    }

    return {
        ok: true,
        requiresConfirmation: true,
        action: "reversal",
        dueId,
        title: "Anular ingreso",
        description: `La cuota de ${family.name} volverá a estar pendiente. Se descontarán ${money(due.receivedCents)} del saldo.`,
        confirmLabel: "Anular ingreso"
    };
}


export async function confirmPayment(dueId) {
    const due = data.dues.find(item => item.id === dueId);

    if (!due || due.status !== "pendiente") {
        return {
            ok: false,
            message: "No se puede registrar este ingreso."
        };
    }

    const family = getFamily(due.familyId);

    if (!family) {
        return {
            ok: false,
            message: "No se ha encontrado la familia."
        };
    }

    if (
        !Number.isSafeInteger(due.expectedCents) ||
        due.expectedCents < 0
    ) {
        return {
            ok: false,
            message: "El importe de esta cuota no es válido."
        };
    }

    try {
        const result = await savePayment(
            due.id,
            due.expectedCents
        );

        due.status = "pagado";
        due.receivedCents = result.received_amount_cents;
        due.paidAt = result.paid_at;

        return {
            ok: true,
            message: "Ingreso registrado correctamente."
        };

    } catch (error) {
        console.error("Error registrando el pago:", error);

        return {
            ok: false,
            message: error.message || "No se ha podido registrar el ingreso."
        };
    }
}


export async function revertPayment(dueId) {
    const due = data.dues.find(item => item.id === dueId);

    if (!due || due.status !== "pagado") {
        return {
            ok: false,
            message: "No se puede anular este ingreso."
        };
    }

    try {
        await reversePayment(due.id);

        due.status = "pendiente";
        due.receivedCents = 0;
        due.paidAt = null;

        return {
            ok: true,
            message: "Ingreso anulado. La cuota vuelve a estar pendiente."
        };

    } catch (error) {
        console.error("Error anulando el pago:", error);

        return {
            ok: false,
            message: error.message || "No se ha podido anular el ingreso."
        };
    }
}


export function saveDueForm(form) {
    const dueId = form.dataset.dueId;
    const due = data.dues.find(item => item.id === dueId);

    if (!due || due.status === "pagado") {
        return {
            ok: false,
            message: "No se puede modificar esta cuota."
        };
    }

    const formData = new FormData(form);

    const amount = Number(formData.get("amount"));

    const justification = String(
        formData.get("justification") || ""
    ).trim();

    if (
        !Number.isFinite(amount) ||
        amount < 0 ||
        amount > 100000
    ) {
        return {
            ok: false,
            message: "Introduce un importe válido."
        };
    }

    due.expectedCents = Math.round(amount * 100);
    due.justification = justification;

    save();

    return {
        ok: true,
        message: "Cuota actualizada."
    };
}


/* -------------------------------------------------
   GASTOS
   ------------------------------------------------- */

export async function saveExpenseForm(form) {
    const formData = new FormData(form);

    const expenseId = form.dataset.expenseId;

    const concept = String(
        formData.get("concept") || ""
    ).trim();

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
        return {
            ok: false,
            message: "Revisa los datos del gasto."
        };
    }

    const amountCents = Math.round(amount * 100);

    const expense = {
        concept,
        amountCents,
        date
    };

    try {
        const result = await saveExpense(
            expenseId,
            expense
        );

        const savedExpense = {
            id: result.id,
            concept: result.concept,
            amountCents: result.amount_cents,
            date: result.expense_date,
            category: result.category,
            status: result.status,
            justification: result.justification
        };

        if (expenseId) {
            const index = data.expenses.findIndex(
                item => item.id === expenseId
            );

            if (index === -1) {
                data.expenses.push(savedExpense);
            } else {
                data.expenses[index] = savedExpense;
            }
        } else {
            data.expenses.push(savedExpense);
        }

        return {
            ok: true,
            message: expenseId
                ? "Gasto actualizado correctamente."
                : "Gasto registrado correctamente."
        };

    } catch (error) {
        console.error("Error guardando el gasto:", error);

        return {
            ok: false,
            message: error.message || "No se ha podido guardar el gasto."
        };
    }
    
}

export async function deleteExpense(expenseId) {
    const expenseIndex = data.expenses.findIndex(
        item => item.id === expenseId
    );

    if (expenseIndex === -1) {
        return {
            ok: false,
            message: "No se ha encontrado el gasto."
        };
    }

    try {
        await removeExpense(expenseId);

        data.expenses.splice(expenseIndex, 1);

        return {
            ok: true,
            message: "Gasto eliminado correctamente."
        };

    } catch (error) {
        console.error("Error eliminando el gasto:", error);

        return {
            ok: false,
            message: error.message || "No se ha podido eliminar el gasto."
        };
    }
}


/* -------------------------------------------------
   FAMILIAS Y MIEMBROS
   ------------------------------------------------- */

export async function saveFamilyForm(form) {
    const formData = new FormData(form);

    const name = String(
        formData.get("name") || ""
    ).trim();

    if (!name) {
        return {
            ok: false,
            message: "Introduce el nombre de la familia."
        };
    }

    const duplicate = data.families.some(family =>
        family.active &&
        family.name.toLocaleLowerCase("es") ===
        name.toLocaleLowerCase("es")
    );

    if (duplicate) {
        return {
            ok: false,
            message: "Ya existe una familia con ese nombre."
        };
    }

    const rows = form.querySelectorAll(".member-edit-row");

    if (rows.length === 0 || rows.length > 100) {
        return {
            ok: false,
            message: "La familia debe tener entre 1 y 100 miembros."
        };
    }

    const memberList = [];
    let expectedCents = 0;

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
            return {
                ok: false,
                message: "Revisa los nombres, tipos y cuotas de los miembros."
            };
        }

        const feeCents = Math.round(amount * 100);

        memberList.push({
            name: memberName,
            type,
            monthlyFeeCents: feeCents,
            active: true
        });

        expectedCents += feeCents;
    }

    try {
        const result = await createFamilyWithMembers(
            name,
            memberList,
            currentPeriod,
            expectedCents
        );

        data.families.push(result.family);
        data.dues.push(result.due);

        return {
            ok: true,
            message: "Familia creada correctamente.",
            familyId: result.family.id
        };

    } catch (error) {
        console.error("Error creando la familia:", error);

        return {
            ok: false,
            message: error.message ||
                "No se ha podido crear la familia en Supabase."
        };
    }
}


/* -------------------------------------------------
   EDICIÓN DE FAMILIAS Y MIEMBROS
   ------------------------------------------------- */

export async function saveManageFamilyForm(form) {
    const family = getFamily(form.dataset.familyId);

    if (!family) {
        return {
            ok: false,
            message: "No se ha encontrado la familia."
        };
    }

    const familyName = String(
        form.querySelector('[name="familyName"]').value || ""
    ).trim();

    if (!familyName) {
        return {
            ok: false,
            message: "Introduce el nombre de la familia."
        };
    }

    const duplicate = data.families.some(item =>
        item.active &&
        item.id !== family.id &&
        item.name.toLocaleLowerCase("es") ===
        familyName.toLocaleLowerCase("es")
    );

    if (duplicate) {
        return {
            ok: false,
            message: "Ya existe una familia con ese nombre."
        };
    }

    const originalMembers = family.memberList || [];
    const rows = form.querySelectorAll(".member-edit-row");

    const updatedMembers = [];
    const changesToRegister = [];

    // VALIDAR Y COMPARAR LOS MIEMBROS

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
            return {
                ok: false,
                message: "Revisa los nombres y las cuotas de los miembros."
            };
        }

        const rawMemberId = row.dataset.memberId || "";

        const memberId = rawMemberId.startsWith("member-")
            ? null
            : rawMemberId;
        const newFeeCents = Math.round(amount * 100);

        const original = memberId
            ? originalMembers.find(member => member.id === memberId)
            : null;

        updatedMembers.push({
            id: memberId,
            name,
            type,
            monthlyFeeCents: newFeeCents,
            active: true
        });

        // Nuevo miembro.

        if (!original) {
            changesToRegister.push({
                action: "member_added"
            });

            continue;
        }

        // Cambio de nombre.

        if (original.name !== name) {
            changesToRegister.push({
                action: "member_name_changed"
            });
        }

        // Cambio de tipo.

        if (original.type !== type) {
            changesToRegister.push({
                action: "member_type_changed"
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
                requiresReason: !automaticTypeChange
            });
        }
    }

    if (updatedMembers.length === 0) {
        return {
            ok: false,
            message: "La familia debe tener al menos un miembro activo."
        };
    }

    // DETECTAR MIEMBROS ELIMINADOS.

    const updatedIds = new Set(
        updatedMembers
            .map(member => member.id)
            .filter(Boolean)
    );

    originalMembers.forEach(original => {
        if (original.active && !updatedIds.has(original.id)) {
            changesToRegister.push({
                action: "member_removed"
            });
        }
    });

    // DETECTAR CAMBIO DE NOMBRE DE FAMILIA.

    if (family.name !== familyName) {
        changesToRegister.push({
            action: "family_name_changed"
        });
    }

    // VALIDAR JUSTIFICACIÓN.

    const requiresReason = changesToRegister.some(
        change => change.requiresReason
    );

    let reason = "";

    if (requiresReason) {
        reason = String(
            form.querySelector('[name="feeChangeReason"]')?.value || ""
        ).trim();

        if (!reason) {
            return {
                ok: false,
                message: "Explica el motivo del cambio de cuota."
            };
        }
    }

    // CALCULAR CUOTA ACTUALIZADA.

    const updatedDueAmount = updatedMembers.reduce(
        (total, member) => total + member.monthlyFeeCents,
        0
    );

    // GUARDAR EN SUPABASE.

    try {
        const result = await updateFamilyWithMembers(
            family.id,
            familyName,
            updatedMembers,
            currentPeriod,
            reason
        );

        // Actualizar los datos locales con los datos reales de Supabase.

        Object.assign(family, result.family);

        if (result.due) {
            const existingDue = getDue(family.id, currentPeriod);

            if (existingDue) {
                Object.assign(existingDue, result.due);
            } else {
                data.dues.push(result.due);
            }
        }

        return {
            ok: true,
            message: changesToRegister.length > 0
                ? `${changesToRegister.length} cambio(s) registrado(s).`
                : "Familia actualizada."
        };

    } catch (error) {
        console.error("Error actualizando la familia:", error);

        return {
            ok: false,
            message: error.message ||
                "No se ha podido actualizar la familia en Supabase."
        };
    }
}


/* -------------------------------------------------
   RESTABLECER DATOS DE PRUEBA
   ------------------------------------------------- */

export function confirmReset() {
    resetData();
    save();

    return {
        ok: true,
        message: "Datos de prueba restablecidos."
    };
}

export async function deactivateFamilyManager(familyId) {
    const family = getFamily(familyId);

    if (!family) {
        return {
            ok: false,
            message: "No se ha encontrado la familia."
        };
    }

    try {
        await deactivateFamilyInSupabase(familyId);

        // Actualizar los datos locales.
        family.active = false;

        return {
            ok: true,
            message: `La familia ${family.name} ha sido desactivada.`
        };

    } catch (error) {
        console.error("Error desactivando la familia:", error);

        return {
            ok: false,
            message: error.message ||
                "No se ha podido desactivar la familia."
        };
    }
}

export async function reactivateFamilyManager(familyId) {
    const family = getFamily(familyId);

    if (!family) {
        return {
            ok: false,
            message: "No se ha encontrado la familia."
        };
    }

    try {
        await reactivateFamilyInSupabase(familyId);

        family.active = true;

        return {
            ok: true,
            message: `La familia ${family.name} ha sido reactivada.`
        };

    } catch (error) {
        console.error("Error reactivando la familia:", error);

        return {
            ok: false,
            message: error.message ||
                "No se ha podido reactivar la familia."
        };
    }
}

/**
 * Obtener solicitudes pendientes de vinculación familiar.
 */
export async function loadFamilyLinkRequests() {
    try {
        const requests = await getPendingFamilyLinkRequests();

        return {
            ok: true,
            requests: requests.map(request => ({
                ...request,
                familyName: getFamily(request.familyId)?.name || "Familia no encontrada"
            }))
        };

    } catch (error) {
        console.error("Error cargando solicitudes:", error);

        return {
            ok: false,
            message: error.message || "No se han podido cargar las solicitudes."
        };
    }
}


/**
 * Aprobar una solicitud de vinculación.
 */
export async function approveFamilyLinkManager(requestId) {
    try {
        await approveFamilyLinkInSupabase(requestId);

        return {
            ok: true,
            message: "Solicitud aprobada correctamente."
        };

    } catch (error) {
        console.error("Error aprobando solicitud:", error);

        return {
            ok: false,
            message: error.message || "No se ha podido aprobar la solicitud."
        };
    }
}


/**
 * Rechazar una solicitud de vinculación.
 */
export async function rejectFamilyLinkManager(requestId) {
    try {
        await rejectFamilyLinkInSupabase(requestId);

        return {
            ok: true,
            message: "Solicitud rechazada correctamente."
        };

    } catch (error) {
        console.error("Error rechazando solicitud:", error);

        return {
            ok: false,
            message: error.message || "No se ha podido rechazar la solicitud."
        };
    }
}

/**
 * Generar o regenerar el código de acceso de una familia.
 */
export async function generateFamilyAccessCodeManager(familyId) {
    try {
        const code = await generateFamilyAccessCodeInSupabase(familyId);

        return {
            ok: true,
            code,
            message: "Código de acceso generado correctamente."
        };

    } catch (error) {
        console.error("Error generando el código familiar:", error);

        return {
            ok: false,
            message: error.message || "No se ha podido generar el código."
        };
    }
}
/**
 * Recuperar el último código de acceso de una familia.
 */
export async function getFamilyAccessCodeManager(familyId) {
    try {
        const code = await getFamilyAccessCodeInSupabase(familyId);

        return {
            ok: true,
            code
        };

    } catch (error) {
        console.error("Error recuperando el código familiar:", error);

        return {
            ok: false,
            message: error.message || "No se ha podido recuperar el código."
        };
    }
}