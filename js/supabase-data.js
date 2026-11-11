import { supabase } from "../supabase-client.js";

/**
 * Convierte los estados de Supabase al modelo de CESPlus.
 */
function mapDueStatus(status) {
    switch (status) {
        case "paid":
            return "pagado";
        case "partial":
            return "deuda";
        default:
            return "pendiente";
    }
}

/**
 * Carga los datos de CESPlus desde Supabase
 * y los adapta al modelo utilizado por la interfaz.
 */
export async function loadSupabaseData(profile) {
    const [
        familiesResult,
        membersResult,
        duesResult,
        expensesResult,
        auditResult,
        settingsResult
    ] = await Promise.all([
        supabase.from("families").select("*").order("name"),
        supabase.from("members").select("*").order("name"),
        supabase.from("monthly_dues").select("*").order("period", { ascending: false }),
        supabase.from("expenses").select("*").order("expense_date", { ascending: false }),
        profile.role === "admin" || profile.role === "treasurer"
            ? supabase.from("audit_log").select("*").order("changed_at", { ascending: false })
            : Promise.resolve({ data: [], error: null }),
        supabase.from("app_settings").select("*").eq("id", true).maybeSingle()
    ]);

    const results = [
        familiesResult,
        membersResult,
        duesResult,
        expensesResult,
        auditResult,
        settingsResult
    ];

    const failed = results.find(result => result.error);

    if (failed) {
        throw new Error(failed.error.message);
    }

    const members = membersResult.data || [];

    const families = (familiesResult.data || []).map(family => {
        const familyMembers = members
            .filter(member => member.family_id === family.id)
            .map(member => ({
                id: member.id,
                name: member.name,
                type: member.member_type,
                monthlyFeeCents: member.monthly_fee_cents,
                active: member.active
            }));

        return {
            id: family.id,
            name: family.name,
            active: family.active,
            members: familyMembers.length,
            memberList: familyMembers
        };
    });

    const dues = (duesResult.data || []).map(due => ({
        id: due.id,
        familyId: due.family_id,
        period: due.period.slice(0, 7),
        expectedCents: due.expected_amount_cents,
        receivedCents: due.received_amount_cents || 0,
        status: mapDueStatus(due.status),
        paidAt: due.paid_at,
        justification: due.justification
    }));

    const expenses = (expensesResult.data || []).map(expense => ({
        id: expense.id,
        concept: expense.concept,
        category: expense.category,
        amountCents: expense.amount_cents,
        date: expense.expense_date,
        status: expense.status,
        justification: expense.justification
    }));

    const auditLog = (auditResult.data || []).map(entry => {
        const family = families.find(
            item => item.id === entry.family_id
        );

        return {
            id: entry.id,
            date: entry.changed_at,
            category: entry.entity_table,
            action: entry.action,
            tags: [entry.action],
            familyId: entry.family_id,
            familyName: family?.name || null,
            description: entry.action,
            changes: {
                previousValue: entry.old_data,
                newValue: entry.new_data
            },
            reason: entry.reason || ""
        };
    });

    const settings = settingsResult.data || {
        adult_fee_cents: 3000,
        child_fee_cents: 1000,
        opening_balance_cents: 0
    };

    return {
        families,
        dues,
        expenses,
        auditLog,
        settings: {
            adultFeeCents: settings.adult_fee_cents,
            childFeeCents: settings.child_fee_cents
        },
        openingBalanceCents: settings.opening_balance_cents
    };
}

/**
 * Registrar un pago completo o parcial en Supabase.
 *
 * amountCents representa el importe TOTAL recibido
 * hasta ese momento, no solamente el nuevo ingreso.
 *
 * La actualización comprueba que la cuota no haya cambiado
 * desde que se leyó, evitando sobrescribir otro ingreso.
 */
export async function savePayment(dueId, amountCents) {
    const { data: authData, error: authError } =
        await supabase.auth.getUser();

    if (authError || !authData.user) {
        throw new Error("No se ha podido identificar al usuario.");
    }

    if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
        throw new Error("El importe recibido debe ser superior a cero.");
    }

    const { data: due, error: dueError } = await supabase
        .from("monthly_dues")
        .select("*")
        .eq("id", dueId)
        .maybeSingle();

    if (dueError) throw dueError;

    if (!due) {
        throw new Error("No se ha encontrado la cuota.");
    }

    if (!["pending", "partial"].includes(due.status)) {
        throw new Error("Esta cuota ya está abonada o no se puede modificar.");
    }

    const previousReceived = due.received_amount_cents || 0;

    if (
        amountCents <= previousReceived ||
        amountCents > due.expected_amount_cents
    ) {
        throw new Error(
            "El importe total recibido debe ser superior al anterior " +
            "y no puede superar la cuota esperada."
        );
    }

    const newStatus = amountCents === due.expected_amount_cents
        ? "paid"
        : "partial";

    let query = supabase
        .from("monthly_dues")
        .update({
            status: newStatus,
            received_amount_cents: amountCents,
            paid_at: due.paid_at || new Date().toISOString(),
            paid_by: due.paid_by || authData.user.id,
            updated_at: new Date().toISOString()
        })
        .eq("id", dueId)
        .eq("status", due.status)
        .eq("expected_amount_cents", due.expected_amount_cents);

    // Comparar también el importe recibido anterior.
    if (due.received_amount_cents === null) {
        query = query.is("received_amount_cents", null);
    } else {
        query = query.eq(
            "received_amount_cents",
            due.received_amount_cents
        );
    }

    const { data, error } = await query
        .select()
        .maybeSingle();

    if (error) throw error;

    if (!data) {
        throw new Error(
            "La cuota ha cambiado mientras registrabas el ingreso. " +
            "Recarga los datos e inténtalo de nuevo."
        );
    }

    return data;
}


/**
 * Modificar el importe esperado y la justificación de una cuota.
 *
 * Conserva el dinero recibido y recalcula el estado.
 */
export async function updateDueExpected(
    dueId,
    expectedAmountCents,
    justification
) {
    if (
        !Number.isSafeInteger(expectedAmountCents) ||
        expectedAmountCents < 0
    ) {
        throw new Error("El importe esperado no es válido.");
    }

    const { data: authData, error: authError } =
        await supabase.auth.getUser();

    if (authError || !authData.user) {
        throw new Error("No se ha podido identificar al usuario.");
    }

    const { data: due, error: dueError } = await supabase
        .from("monthly_dues")
        .select("*")
        .eq("id", dueId)
        .maybeSingle();

    if (dueError) throw dueError;

    if (!due) {
        throw new Error("No se ha encontrado la cuota.");
    }

    if (due.status === "paid") {
        throw new Error("No se puede modificar una cuota abonada.");
    }

    const receivedCents = due.received_amount_cents || 0;

    if (expectedAmountCents < receivedCents) {
        throw new Error(
            "El importe esperado no puede ser inferior " +
            "al dinero que ya se ha recibido."
        );
    }

    // Determinar el estado final.
    let newStatus;
    let newReceived;
    let newPaidAt;
    let newPaidBy;

    if (receivedCents === 0) {
        newStatus = "pending";
        newReceived = null;
        newPaidAt = null;
        newPaidBy = null;

    } else if (receivedCents === expectedAmountCents) {
        newStatus = "paid";
        newReceived = receivedCents;
        newPaidAt = due.paid_at || new Date().toISOString();
        newPaidBy = due.paid_by || authData.user.id;

    } else {
        newStatus = "partial";
        newReceived = receivedCents;
        newPaidAt = due.paid_at || new Date().toISOString();
        newPaidBy = due.paid_by || authData.user.id;
    }

    let query = supabase
        .from("monthly_dues")
        .update({
            expected_amount_cents: expectedAmountCents,
            received_amount_cents: newReceived,
            status: newStatus,
            paid_at: newPaidAt,
            paid_by: newPaidBy,
            justification: String(justification || "").trim(),
            updated_at: new Date().toISOString()
        })
        .eq("id", dueId)
        .eq("status", due.status)
        .eq("expected_amount_cents", due.expected_amount_cents);

    if (due.received_amount_cents === null) {
        query = query.is("received_amount_cents", null);
    } else {
        query = query.eq(
            "received_amount_cents",
            due.received_amount_cents
        );
    }

    const { data, error } = await query
        .select()
        .maybeSingle();

    if (error) throw error;

    if (!data) {
        throw new Error(
            "La cuota ha cambiado mientras la modificabas. " +
            "Recarga los datos e inténtalo de nuevo."
        );
    }

    return data;
}


/**
 * Anular un pago en Supabase.
 */
export async function reversePayment(dueId) {
    const { data, error } = await supabase
        .from("monthly_dues")
        .update({
            status: "pending",
            received_amount_cents: null,
            paid_at: null,
            paid_by: null,
            updated_at: new Date().toISOString()
        })
        .eq("id", dueId)
        .eq("status", "paid")
        .select()
        .maybeSingle();

    if (error) throw error;

    if (!data) {
        throw new Error("No se ha podido anular el ingreso.");
    }

    return data;
}


export async function saveExpense(expenseId, expenseData) {
    let query;

    if (expenseId) {
        query = supabase
            .from("expenses")
            .update({
                concept: expenseData.concept,
                amount_cents: expenseData.amountCents,
                expense_date: expenseData.date
            })
            .eq("id", expenseId);
    } else {
        const { data: authData, error: authError } =
            await supabase.auth.getUser();

        if (authError || !authData.user) {
            throw new Error("No se ha podido identificar al usuario.");
        }

        query = supabase
            .from("expenses")
            .insert({
                concept: expenseData.concept,
                category: "general",
                amount_cents: expenseData.amountCents,
                expense_date: expenseData.date,
                status: "pending",
                justification: "",
                created_by: authData.user.id
            });
    }

    const { data, error } = await query
        .select()
        .single();

    if (error) throw error;

    return data;
}


export async function removeExpense(expenseId) {
    const { data, error } = await supabase
        .from("expenses")
        .delete()
        .eq("id", expenseId)
        .select("id")
        .maybeSingle();

    if (error) throw error;

    if (!data) {
        throw new Error("No se ha podido eliminar el gasto.");
    }

    return data;
}

export async function createFamilyWithMembers(
    name,
    members,
    period,
    expectedAmountCents
) {
    // Normalizar el periodo al formato YYYY-MM-DD
    const periodDate = /^\d{4}-\d{2}$/.test(period)
        ? `${period}-01`
        : period;

    // Crear familia, miembros y cuota mediante la función SQL
    const { data: familyId, error: createError } = await supabase.rpc(
        "create_family_with_members",
        {
            p_name: name,
            p_members: members.map(member => ({
                name: member.name,
                type: member.type,
                monthlyFeeCents: member.monthlyFeeCents
            })),
            p_period: periodDate,
            p_expected_amount_cents: expectedAmountCents
        }
    );

    if (createError) throw createError;

    // Recuperar la familia creada
    const { data: familyRow, error: familyError } = await supabase
        .from("families")
        .select("*")
        .eq("id", familyId)
        .single();

    if (familyError) throw familyError;

    // Recuperar sus miembros
    const { data: memberRows, error: membersError } = await supabase
        .from("members")
        .select("*")
        .eq("family_id", familyId);

    if (membersError) throw membersError;

    // Recuperar la cuota del periodo
    const { data: dueRow, error: dueError } = await supabase
        .from("monthly_dues")
        .select("*")
        .eq("family_id", familyId)
        .eq("period", periodDate)
        .single();

    if (dueError) throw dueError;

    // Devolver los datos con el formato que utiliza CESPlus
    return {
        family: {
            id: familyRow.id,
            name: familyRow.name,
            active: familyRow.active,
            members: memberRows.length,
            memberList: memberRows.map(member => ({
                id: member.id,
                name: member.name,
                type: member.member_type,
                monthlyFeeCents: member.monthly_fee_cents,
                active: member.active
            }))
        },
        due: {
            id: dueRow.id,
            familyId: dueRow.family_id,
            period: dueRow.period.slice(0, 7),
            expectedCents: dueRow.expected_amount_cents,
            receivedCents: dueRow.received_amount_cents,
            status: mapDueStatus(dueRow.status),
            paidAt: dueRow.paid_at,
            justification: dueRow.justification
        }
    };
}

export async function updateFamilyWithMembers(
    familyId,
    name,
    members,
    period,
    reason
) {
    const periodDate = /^\d{4}-\d{2}$/.test(period)
        ? `${period}-01`
        : period;

    const { error: updateError } = await supabase.rpc(
        "update_family_with_members",
        {
            p_family_id: familyId,
            p_name: name,
            p_members: members.map(member => ({
                id: member.id || null,
                name: member.name,
                type: member.type,
                monthlyFeeCents: member.monthlyFeeCents
            })),
            p_period: periodDate,
            p_reason: reason || null
        }
    );

    if (updateError) throw updateError;

    // Recuperar la familia actualizada.
    const { data: familyRow, error: familyError } = await supabase
        .from("families")
        .select("*")
        .eq("id", familyId)
        .single();

    if (familyError) throw familyError;

    // Recuperar todos sus miembros.
    const { data: memberRows, error: membersError } = await supabase
        .from("members")
        .select("*")
        .eq("family_id", familyId);

    if (membersError) throw membersError;

    // Recuperar la cuota del periodo.
    const { data: dueRow, error: dueError } = await supabase
        .from("monthly_dues")
        .select("*")
        .eq("family_id", familyId)
        .eq("period", periodDate)
        .maybeSingle();

    if (dueError) throw dueError;

    return {
        family: {
            id: familyRow.id,
            name: familyRow.name,
            active: familyRow.active,
            members: memberRows.filter(member => member.active).length,
            memberList: memberRows.map(member => ({
                id: member.id,
                name: member.name,
                type: member.member_type,
                monthlyFeeCents: member.monthly_fee_cents,
                active: member.active
            }))
        },
        due: dueRow ? {
            id: dueRow.id,
            familyId: dueRow.family_id,
            period: dueRow.period.slice(0, 7),
            expectedCents: dueRow.expected_amount_cents,
            receivedCents: dueRow.received_amount_cents,
            status: mapDueStatus(dueRow.status),
            paidAt: dueRow.paid_at,
            justification: dueRow.justification
        } : null
    };
}

export async function deactivateFamily(familyId) {
    const { data: family, error } = await supabase
        .from("families")
        .update({ active: false })
        .eq("id", familyId)
        .select("id, name, active")
        .single();

    if (error) throw error;

    return family;
}

export async function reactivateFamily(familyId) {
    const { data: family, error } = await supabase
        .from("families")
        .update({ active: true })
        .eq("id", familyId)
        .select("id, name, active")
        .single();

    if (error) throw error;

    return family;
}

 /**
 * Obtener solicitudes de vinculación pendientes.
 */
export async function getPendingFamilyLinkRequests() {
    const { data: requests, error } = await supabase
        .from("family_link_requests")
        .select("id, user_id, family_id, member_id, requested_at")
        .eq("status", "pending")
        .order("requested_at", { ascending: true });

    if (error) throw error;

    if (!requests || requests.length === 0) {
        return [];
    }

    // Recuperar los usuarios solicitantes.
    const userIds = [...new Set(requests.map(request => request.user_id))];

    const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, display_name, email")
        .in("user_id", userIds);

    if (profilesError) throw profilesError;

    // Recuperar los miembros seleccionados en las solicitudes.
    const memberIds = [
        ...new Set(
            requests
                .map(request => request.member_id)
                .filter(Boolean)
        )
    ];

    let members = [];

    if (memberIds.length > 0) {
        const { data: memberRows, error: membersError } = await supabase
            .from("members")
            .select("id, name")
            .in("id", memberIds);

        if (membersError) throw membersError;

        members = memberRows || [];
    }

    return requests.map(request => ({
        id: request.id,
        userId: request.user_id,
        familyId: request.family_id,
        memberId: request.member_id,
        memberName: members.find(
            member => member.id === request.member_id
        )?.name || "Miembro no encontrado",

        requestedAt: request.requested_at,

        userName: profiles?.find(
            profile => profile.user_id === request.user_id
        )?.display_name || "Usuario sin nombre",

        userEmail: profiles?.find(
            profile => profile.user_id === request.user_id
        )?.email || "Correo no disponible"
    }));
}


/**
 * Aprobar una solicitud de vinculación familiar.
 */
export async function approveFamilyLink(requestId) {
    const { error } = await supabase.rpc(
        "approve_family_link",
        {
            p_request_id: requestId
        }
    );

    if (error) throw error;
}


/**
 * Rechazar una solicitud de vinculación familiar.
 */
export async function rejectFamilyLink(requestId) {
    const { error } = await supabase.rpc(
        "reject_family_link",
        {
            p_request_id: requestId
        }
    );

    if (error) throw error;
}

export async function generateFamilyAccessCode(familyId) {
    const { data, error } = await supabase.rpc(
        "generate_family_access_code",
        {
            p_family_id: familyId
        }
    );

    if (error) throw error;

    return data;
}

export async function hasFamilyAccessCode(familyId) {
    const { data, error } = await supabase.rpc(
        "has_family_access_code",
        {
            p_family_id: familyId
        }
    );

    if (error) throw error;

    return data;
}

export async function getFamilyAccessCode(familyId) {
    const { data, error } = await supabase.rpc(
        "get_family_access_code",
        {
            p_family_id: familyId
        }
    );

    if (error) throw error;

    return data;
}

export async function loadGlobalDashboardMetrics(period) {
    const { data, error } = await supabase.rpc(
        "get_global_dashboard_metrics",
        {
            p_period: period
        }
    );

    if (error) {
        throw new Error(
            "No se han podido cargar los indicadores globales: " +
            error.message
        );
    }

    return {
        balanceCents: Number(data.balanceCents) || 0,
        incomeCents: Number(data.incomeCents) || 0,
        expensesCents: Number(data.expensesCents) || 0,
        pendingCents: Number(data.pendingCents) || 0
    };
}

/**
 * Obtener todos los perfiles y sus familias.
 * Esta operación está reservada a administradores.
 */
export async function loadUserProfiles() {
    const { data: authData, error: authError } =
        await supabase.auth.getUser();

    if (authError || !authData.user) {
        throw new Error("No se ha podido identificar al usuario.");
    }

    const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select(`
            user_id,
            display_name,
            email,
            role,
            family_id,
            active
        `)
        .order("display_name");

    if (profilesError) throw profilesError;

    const { data: families, error: familiesError } = await supabase
        .from("families")
        .select("id, name");

    if (familiesError) throw familiesError;

    return (profiles || []).map(profile => ({
        userId: profile.user_id,
        displayName: profile.display_name,
        email: profile.email || "",
        role: profile.role,
        familyId: profile.family_id,
        familyName: families?.find(
            family => family.id === profile.family_id
        )?.name || "Sin familia vinculada",
        active: profile.active
    }));
}


/**
 * Actualizar el rol de un usuario.
 */
export async function updateUserRole(userId, newRole) {
    const allowedRoles = ["member", "treasurer", "admin"];

    if (!allowedRoles.includes(newRole)) {
        throw new Error("El permiso seleccionado no es válido.");
    }

    const { data: authData, error: authError } =
        await supabase.auth.getUser();

    if (authError || !authData.user) {
        throw new Error("No se ha podido identificar al usuario.");
    }

    // Evitar que el administrador cambie accidentalmente
    // sus propios permisos.
    if (authData.user.id === userId) {
        throw new Error("No puedes modificar tus propios permisos.");
    }

    const { data, error } = await supabase
        .from("profiles")
        .update({
            role: newRole,
            updated_at: new Date().toISOString()
        })
        .eq("user_id", userId)
        .select("user_id, display_name, email, role, family_id, active")
        .maybeSingle();

    if (error) throw error;

    if (!data) {
        throw new Error(
            "No se ha podido actualizar el usuario. Comprueba los permisos."
        );
    }

    return data;
}