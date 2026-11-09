import "../supabase-auth.js";

import { init } from "./ui/ui.js";
import { loadSupabaseData } from "./supabase-data.js";
import { setData } from "./core.js";

/* =====================================================
   ESTADO DE LA APLICACIÓN
   ===================================================== */

let loadingUserId = null;
let loadedUserId = null;
let activeUserId = null;

// Identifica cada ciclo de autenticación.
// Evita que una carga antigua sobrescriba los datos
// de una sesión más reciente.
let authGeneration = 0;


/* =====================================================
   VISIBILIDAD SEGÚN EL ROL
   ===================================================== */

function updateNavigationVisibility(profile) {

    const userRole = profile.role;

    // El resto de módulos consulta este atributo.
    document.documentElement.dataset.userRole = userRole;

    document.querySelectorAll("[data-role]").forEach(element => {

        const allowedRoles = element.dataset.role
            .split(",")
            .map(role => role.trim());

        element.hidden = !allowedRoles.includes(userRole);
    });
}


/* =====================================================
   LIMPIAR DATOS DE SESIÓN
   ===================================================== */

function clearApplicationData() {

    // Elimina los datos de la cuenta anterior de memoria.
    setData(null);

    loadingUserId = null;
    loadedUserId = null;
    activeUserId = null;

    // Invalida cualquier carga que siga en curso.
    authGeneration++;

    // Elimina el rol anterior.
    delete document.documentElement.dataset.userRole;

    // Oculta los elementos protegidos hasta que
    // se autentique y autorice otra cuenta.
    document.querySelectorAll("[data-role]").forEach(element => {
        element.hidden = true;
    });
}


/* =====================================================
   USUARIO AUTENTICADO
   ===================================================== */

document.addEventListener("cesplus:authenticated", async event => {

    const { user, profile } = event.detail;
    const userId = user.id;

    // Si cambia la cuenta, invalidamos los datos anteriores.
    if (activeUserId !== userId) {

        authGeneration++;

        activeUserId = userId;
        loadingUserId = null;
        loadedUserId = null;

        setData(null);
    }

    const currentGeneration = authGeneration;

    // Establecemos el rol antes de iniciar el dashboard.
    updateNavigationVisibility(profile);

    // Evitamos cargas duplicadas.
    if (
        loadingUserId === userId ||
        loadedUserId === userId
    ) {
        return;
    }

    loadingUserId = userId;

    try {

        // Cargamos los datos autorizados por Supabase.
        const appData = await loadSupabaseData(profile);

        // Si la sesión ha cambiado mientras esperábamos,
        // descartamos la respuesta antigua.
        if (
            currentGeneration !== authGeneration ||
            activeUserId !== userId
        ) {
            return;
        }

        setData(appData);

        // Inicializa la interfaz o actualiza su contenido
        // si ya se había inicializado anteriormente.
        init({ supabase: true });

        loadedUserId = userId;

        console.log("CESPlus: datos cargados correctamente.");

    } catch (error) {

        // No mostramos errores de una sesión que ya no existe.
        if (
            currentGeneration !== authGeneration ||
            activeUserId !== userId
        ) {
            return;
        }

        console.error("Error cargando CESPlus:", error);

        alert(
            "No se han podido cargar los datos: " +
            error.message
        );

    } finally {

        // No alteramos el estado de una sesión más reciente.
        if (
            currentGeneration === authGeneration &&
            loadingUserId === userId
        ) {
            loadingUserId = null;
        }
    }
});


/* =====================================================
   CIERRE DE SESIÓN
   ===================================================== */

document.addEventListener("cesplus:signed-out", () => {

    clearApplicationData();

    console.log("CESPlus: sesión cerrada y datos limpiados.");
});