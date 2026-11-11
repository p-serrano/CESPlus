"use strict";

import { supabase } from "./supabase-client.js";

/* =====================================================
   ELEMENTOS DEL DOM
   ===================================================== */

const authScreen = document.getElementById("auth-screen");

const views = {
    login: document.getElementById("login-view"),
    register: document.getElementById("register-view"),
    confirmation: document.getElementById("confirmation-view"),
    familyLink: document.getElementById("link-family-view")
};

// Login
const loginForm = document.getElementById("login-form");
const loginEmail = document.getElementById("login-email");
const loginPassword = document.getElementById("login-password");
const loginButton = document.getElementById("login-button");
const loginError = document.getElementById("login-error");
const loginInfo = document.getElementById("login-info");

// Registro
const registerForm = document.getElementById("register-form");
const registerName = document.getElementById("register-name");
const registerEmail = document.getElementById("register-email");
const registerPassword = document.getElementById("register-password");
const registerPasswordConfirm = document.getElementById("register-password-confirm");
const registerButton = document.getElementById("register-button");
const registerError = document.getElementById("register-error");
const registerInfo = document.getElementById("register-info");

// Vinculación familiar
const familyLinkForm = document.getElementById("family-link-form");
const familyCode = document.getElementById("family-code");
const familyLinkButton = document.getElementById("family-link-button");
const familyLinkError = document.getElementById("family-link-error");
const familyLinkInfo = document.getElementById("family-link-info");
const familyLinkPending = document.getElementById("family-link-pending");
const checkLinkStatusButton = document.getElementById("check-link-status-button");

// Selección del miembro
const familyMemberForm = document.getElementById("family-member-form");
const familyMemberSelect = document.getElementById("family-member-select");
const familyMemberError = document.getElementById("family-member-error");
const familyMemberButton = document.getElementById("family-member-button");
const familyMemberBackButton = document.getElementById("family-member-back-button");

// Botones de navegación
const showRegisterButton = document.getElementById("show-register-button");
const showLoginButton = document.getElementById("show-login-button");
const confirmationLoginButton = document.getElementById("confirmation-login-button");
const authLogoutButton = document.getElementById("auth-logout-button");

// Cierre de sesión de la aplicación
const logoutButton = document.getElementById("logout-button");


/* =====================================================
   ESTADO DE AUTENTICACIÓN
   ===================================================== */

let currentUser = null;
let currentProfile = null;

let sessionCheckId = 0;
let lastAuthenticatedUserId = null;
let profileLoadInProgress = false;


/* =====================================================
   NAVEGACIÓN ENTRE PANTALLAS
   ===================================================== */

function showView(viewName) {

    Object.values(views).forEach(view => {
        if (view) {
            view.hidden = true;
        }
    });

    if (views[viewName]) {
        views[viewName].hidden = false;
    }

    authScreen.hidden = false;
    document.body.classList.add("auth-required");
}


function showLoginView() {
    showView("login");
    clearMessages();
}


function showRegisterView() {
    showView("register");
    clearMessages();
}


function showConfirmationView(email) {

    showView("confirmation");

    const paragraph = views.confirmation.querySelector(".auth-heading p");

    if (paragraph && email) {
        paragraph.textContent =
            `Te hemos enviado un mensaje a ${email}. ` +
            "Abre el correo y pulsa el enlace para confirmar tu dirección.";
    }
}


/* =====================================================
   MENSAJES
   ===================================================== */

function setMessage(element, message, visible = true) {

    if (!element) return;

    element.textContent = message;
    element.hidden = !visible;
}


function clearMessages() {

    [
        loginError,
        loginInfo,
        registerError,
        registerInfo,
        familyLinkError,
        familyLinkInfo,
        familyMemberError
    ].forEach(element => setMessage(element, ""));
}


function showError(message) {
    setMessage(loginError, message);
    setMessage(loginInfo, "");
}


function showInfo(message) {
    setMessage(loginInfo, message);
    setMessage(loginError, "");
}


/* =====================================================
   BLOQUEAR / DESBLOQUEAR FORMULARIOS
   ===================================================== */

function setLoginLoading(isLoading) {

    loginButton.disabled = isLoading;
    loginEmail.disabled = isLoading;
    loginPassword.disabled = isLoading;

    loginButton.textContent = isLoading
        ? "Comprobando acceso..."
        : "Iniciar sesión";
}


function setRegisterLoading(isLoading) {

    registerButton.disabled = isLoading;

    registerButton.textContent = isLoading
        ? "Creando cuenta..."
        : "Crear cuenta";
}


function setFamilyLinkLoading(isLoading) {

    familyLinkButton.disabled = isLoading;
    familyCode.disabled = isLoading;

    familyLinkButton.textContent = isLoading
        ? "Comprobando código..."
        : "Comprobar código";
}


function setFamilyMemberLoading(isLoading) {

    familyMemberButton.disabled = isLoading;
    familyMemberSelect.disabled = isLoading;
    familyMemberBackButton.disabled = isLoading;

    familyMemberButton.textContent = isLoading
        ? "Enviando solicitud..."
        : "Enviar solicitud";
}


/* =====================================================
   PERMISOS DE VISUALIZACIÓN SEGÚN EL ROL
   ===================================================== */

function applyRoleVisibility(profile) {

    document.querySelectorAll("[data-role]").forEach(element => {

        const allowedRoles = element.dataset.role
            .split(",")
            .map(role => role.trim());

        element.hidden = !allowedRoles.includes(profile.role);
    });
}


/* =====================================================
   MOSTRAR APLICACIÓN
   ===================================================== */

function showApplication(profile) {

    applyRoleVisibility(profile);

    document.body.classList.remove("auth-required");
    authScreen.hidden = true;

    const displayName = profile.display_name || "Usuario";

    const userNameElement =
        document.getElementById("user-menu-name");

    const userEmailElement =
        document.getElementById("user-menu-email");

    const userRoleElement =
        document.getElementById("user-menu-role");

    const avatarElement =
        document.querySelector(".avatar");

    const roles = {
        admin: "Administrador",
        treasurer: "Tesorero",
        member: "Miembro"
    };

    const initials = displayName
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(part => part.charAt(0))
        .join("")
        .toUpperCase();

    if (userNameElement) {
        userNameElement.textContent = displayName;
    }

    if (userEmailElement) {
        userEmailElement.textContent = currentUser?.email || "";
    }

    if (userRoleElement) {
        userRoleElement.textContent =
            roles[profile.role] || "Usuario";
    }

    if (avatarElement) {
        avatarElement.textContent = initials || "C+";
    }
}


/* =====================================================
   RESTABLECER FORMULARIO DE VINCULACIÓN
   ===================================================== */

function resetFamilyLinkForm() {

    familyLinkForm.hidden = false;
    familyMemberForm.hidden = true;

    familyLinkPending.hidden = true;
    checkLinkStatusButton.hidden = true;

    familyMemberSelect.innerHTML =
        '<option value="">Selecciona un miembro...</option>';

    familyMemberForm.reset();

    familyLinkButton.disabled = false;
    familyCode.disabled = false;
    familyLinkButton.textContent = "Comprobar código";

    familyMemberButton.disabled = false;
    familyMemberSelect.disabled = false;
    familyMemberBackButton.disabled = false;
    familyMemberButton.textContent = "Enviar solicitud";
}


/* =====================================================
   MOSTRAR VINCULACIÓN FAMILIAR
   ===================================================== */

function showLinkingScreen() {

    showView("familyLink");

    resetFamilyLinkForm();

    clearMessages();

    updateFamilyRequestDisplay();
}


/* =====================================================
   CONSULTAR ESTADO DE SOLICITUD
   ===================================================== */

async function updateFamilyRequestDisplay() {

    if (!currentUser) return;

    const userId = currentUser.id;

    try {

        const { data, error } = await supabase
            .from("family_link_requests")
            .select("status")
            .eq("user_id", userId)
            .order("requested_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) {
            console.error("Error al consultar la solicitud:", error);
            return;
        }

        // Evitamos actualizar la pantalla de otro usuario.
        if (currentUser?.id !== userId) return;

        if (data?.status === "pending") {

            familyLinkForm.hidden = true;
            familyMemberForm.hidden = true;

            familyLinkPending.hidden = false;
            checkLinkStatusButton.hidden = false;

        } else {

            familyLinkPending.hidden = true;
            checkLinkStatusButton.hidden = true;

            familyLinkForm.hidden = false;
            familyMemberForm.hidden = true;

            if (data?.status === "rejected") {

                setMessage(
                    familyLinkInfo,
                    "Tu solicitud anterior ha sido rechazada. " +
                    "Puedes volver a enviar una solicitud con tu código familiar."
                );
            }
        }

    } catch (error) {

        console.error("Error al consultar el estado familiar:", error);
    }
}


/* =====================================================
   CERRAR SESIÓN Y VOLVER AL LOGIN
   ===================================================== */

function showLogin() {

    // Comprobamos si realmente había una sesión
    // que debamos limpiar.
    const hadSession = Boolean(
        currentUser ||
        currentProfile ||
        lastAuthenticatedUserId
    );

    currentUser = null;
    currentProfile = null;
    lastAuthenticatedUserId = null;

    showLoginView();

    // Solo notificamos a la aplicación cuando
    // se produce un cambio real de sesión.
    if (hadSession) {

        document.dispatchEvent(
            new CustomEvent("cesplus:signed-out")
        );
    }
}


/* =====================================================
   CARGAR PERFIL AUTORIZADO
   ===================================================== */

async function loadAuthorizedProfile(session, forceRefresh = false) {

    const checkId = ++sessionCheckId;

    if (!session?.user) {

        lastAuthenticatedUserId = null;
        currentUser = null;
        currentProfile = null;

        showLogin();
        setLoginLoading(false);

        return;
    }

    const userId = session.user.id;

    // Evitamos consultas repetidas para usuarios ya autorizados.
    if (
        !forceRefresh &&
        lastAuthenticatedUserId === userId &&
        currentProfile?.active &&
        currentUser?.id === userId
    ) {

        showApplication(currentProfile);
        setLoginLoading(false);

        return;
    }

    currentUser = session.user;
    profileLoadInProgress = true;

    try {

        const { data: profile, error } = await supabase
            .from("profiles")
            .select("user_id, display_name, role, family_id, member_id, active")
            .eq("user_id", userId)
            .maybeSingle();

        // Ignoramos respuestas de consultas anteriores.
        if (checkId !== sessionCheckId) return;

        if (error) {

            console.error("Error al consultar el perfil:", error);

            await supabase.auth.signOut();

            showLogin();

            showError(
                "No se ha podido comprobar tu perfil. " +
                "Revisa las políticas de seguridad de Supabase."
            );

            return;
        }

        if (!profile) {

            await supabase.auth.signOut();

            showLogin();

            showError(
                "No se ha encontrado tu perfil en CESPlus. " +
                "Contacta con la administración."
            );

            return;
        }

        const validRoles = ["admin", "treasurer", "member"];

        if (!validRoles.includes(profile.role)) {

            await supabase.auth.signOut();

            showLogin();

            showError(
                "Tu cuenta tiene un rol no válido. " +
                "Contacta con la administración."
            );

            return;
        }

        currentUser = session.user;
        currentProfile = profile;

        // CUENTA PROVISIONAL:
        // Puede acceder a la vinculación, pero no a la aplicación.
        if (
            profile.role === "member" &&
            profile.active === false &&
            profile.family_id === null &&
            profile.member_id === null
        ) {

            lastAuthenticatedUserId = null;

            showLinkingScreen();

            return;
        }

        // Cualquier otro perfil inactivo queda bloqueado.
        if (!profile.active) {

            await supabase.auth.signOut();

            showLogin();

            showError(
                "Tu cuenta no tiene un perfil activo en CESPlus. " +
                "Contacta con la administración."
            );

            return;
        }

        // PERFIL ACTIVO Y AUTORIZADO
        lastAuthenticatedUserId = userId;

        showApplication(profile);

        clearMessages();

        loginForm.reset();

        document.dispatchEvent(
            new CustomEvent("cesplus:authenticated", {
                detail: {
                    user: currentUser,
                    profile: currentProfile
                }
            })
        );

    } catch (error) {

        console.error("Error al cargar el perfil:", error);

        if (checkId === sessionCheckId) {

            showError(
                "No se ha podido comprobar tu perfil. " +
                "Inténtalo de nuevo."
            );
        }

    } finally {

        if (checkId === sessionCheckId) {

            profileLoadInProgress = false;

            setLoginLoading(false);
        }
    }
}


/* =====================================================
   NAVEGACIÓN ENTRE LOGIN Y REGISTRO
   ===================================================== */

showRegisterButton.addEventListener("click", showRegisterView);

showLoginButton.addEventListener("click", showLoginView);

confirmationLoginButton.addEventListener("click", showLoginView);


/* =====================================================
   CREAR CUENTA
   ===================================================== */

registerForm.addEventListener("submit", async event => {

    event.preventDefault();

    clearMessages();

    const displayName = registerName.value.trim();
    const email = registerEmail.value.trim();
    const password = registerPassword.value;
    const passwordConfirm = registerPasswordConfirm.value;

    if (!displayName || !email || !password || !passwordConfirm) {

        setMessage(
            registerError,
            "Completa todos los campos."
        );

        return;
    }

    if (password.length < 8) {

        setMessage(
            registerError,
            "La contraseña debe tener al menos 8 caracteres."
        );

        return;
    }

    if (password !== passwordConfirm) {

        setMessage(
            registerError,
            "Las contraseñas no coinciden."
        );

        return;
    }

    setRegisterLoading(true);

    try {

        const { data, error } = await supabase.auth.signUp({

            email,
            password,

            options: {
                data: {
                    display_name: displayName
                },

                emailRedirectTo:
                    window.location.origin + window.location.pathname
            }
        });

        if (error) {

            console.error("Error al crear la cuenta:", error);

            setMessage(
                registerError,
                "No se ha podido crear la cuenta. " +
                error.message
            );

            return;
        }

        registerForm.reset();

        if (data.session) {

            await loadAuthorizedProfile(data.session);

        } else {

            showConfirmationView(email);
        }

    } catch (error) {

        console.error("Error durante el registro:", error);

        setMessage(
            registerError,
            "No se ha podido conectar con Supabase. " +
            "Inténtalo de nuevo."
        );

    } finally {

        setRegisterLoading(false);
    }
});


/* =====================================================
   INICIAR SESIÓN
   ===================================================== */

loginForm.addEventListener("submit", async event => {

    event.preventDefault();

    clearMessages();

    const email = loginEmail.value.trim();
    const password = loginPassword.value;

    if (!email || !password) {

        showError(
            "Introduce tu correo electrónico y contraseña."
        );

        return;
    }

    setLoginLoading(true);

    try {

        const { data, error } = await supabase.auth
            .signInWithPassword({
                email,
                password
            });

        if (error) {

            showError(
                "No se ha podido iniciar sesión. " +
                "Comprueba tus credenciales y que hayas confirmado tu correo."
            );

            setLoginLoading(false);

            return;
        }

        await loadAuthorizedProfile(data.session);

    } catch (error) {

        console.error("Error durante el inicio de sesión:", error);

        showError(
            "No se ha podido conectar con Supabase. " +
            "Comprueba tu conexión e inténtalo de nuevo."
        );

        setLoginLoading(false);
    }
});


/* =====================================================
   FASE 1: COMPROBAR CÓDIGO FAMILIAR
   ===================================================== */

familyLinkForm.addEventListener("submit", async event => {

    event.preventDefault();

    setMessage(familyLinkError, "");
    setMessage(familyLinkInfo, "");
    setMessage(familyMemberError, "");

    const code = familyCode.value.trim();

    if (!code) {

        setMessage(
            familyLinkError,
            "Introduce el código de tu familia."
        );

        return;
    }

    setFamilyLinkLoading(true);

    try {

        const { data, error } = await supabase.rpc(
            "get_family_adults_by_code",
            {
                p_code: code
            }
        );

        if (error) {

            console.error("Error al comprobar el código:", error);

            setMessage(
                familyLinkError,
                "No se ha podido comprobar el código. " +
                "Inténtalo de nuevo."
            );

            return;
        }

        if (!data || typeof data !== "object") {

            setMessage(
                familyLinkError,
                "La respuesta del servidor no es válida."
            );

            return;
        }

        switch (data.status) {

            case "ok": {

                const adults = Array.isArray(data.adults)
                    ? data.adults
                    : [];

                if (adults.length === 0) {

                    setMessage(
                        familyLinkError,
                        "No hay adultos disponibles para vincular en esta familia."
                    );

                    return;
                }

                // Guardamos el código para la segunda fase.
                familyCode.dataset.validatedCode = code;

                // Limpiamos las opciones anteriores.
                familyMemberSelect.innerHTML =
                    '<option value="">Selecciona un miembro...</option>';

                // Añadimos los adultos disponibles.
                adults.forEach(adult => {

                    const option = document.createElement("option");

                    option.value = adult.id;
                    option.textContent = adult.name;

                    familyMemberSelect.appendChild(option);
                });

                // Cambiamos a la segunda fase.
                familyLinkForm.hidden = true;
                familyMemberForm.hidden = false;

                familyMemberSelect.value = "";

                setMessage(
                    familyLinkInfo,
                    "Código correcto. Ahora selecciona tu nombre."
                );

                familyMemberSelect.focus();

                break;
            }

            case "invalid_code":

                setMessage(
                    familyLinkError,
                    "El código no es válido. Comprueba que lo has escrito correctamente."
                );

                break;

            case "blocked":

                setMessage(
                    familyLinkError,
                    "Has superado el número de intentos. " +
                    "Espera 15 minutos antes de volver a intentarlo."
                );

                break;

            case "no_adults":

                setMessage(
                    familyLinkError,
                    "No hay adultos disponibles para vincular en esta familia. " +
                    "Contacta con la administración."
                );

                break;

            case "pending":

                await updateFamilyRequestDisplay();

                break;

            case "account_not_eligible":

                setMessage(
                    familyLinkError,
                    "Esta cuenta no puede solicitar una vinculación. " +
                    "Contacta con la administración."
                );

                break;

            case "not_authenticated":

                setMessage(
                    familyLinkError,
                    "Tu sesión ha caducado. Inicia sesión de nuevo."
                );

                break;

            default:

                setMessage(
                    familyLinkError,
                    "No se ha podido validar el código. " +
                    "Contacta con la administración."
                );
        }

    } catch (error) {

        console.error("Error al comprobar el código familiar:", error);

        setMessage(
            familyLinkError,
            "Se ha producido un error. Inténtalo de nuevo."
        );

    } finally {

        setFamilyLinkLoading(false);
    }
});


/* =====================================================
   FASE 2: SOLICITAR VINCULACIÓN CON EL ADULTO
   ===================================================== */

familyMemberForm.addEventListener("submit", async event => {

    event.preventDefault();

    setMessage(familyMemberError, "");

    const code = familyCode.dataset.validatedCode;
    const memberId = familyMemberSelect.value;

    if (!code) {

        setMessage(
            familyMemberError,
            "Debes comprobar primero el código familiar."
        );

        familyMemberForm.hidden = true;
        familyLinkForm.hidden = false;

        return;
    }

    if (!memberId) {

        setMessage(
            familyMemberError,
            "Selecciona tu nombre antes de continuar."
        );

        return;
    }

    setFamilyMemberLoading(true);

    try {

        const { data, error } = await supabase.rpc(
            "request_family_link",
            {
                p_code: code,
                p_member_id: memberId
            }
        );

        if (error) {

            console.error("Error al solicitar la vinculación:", error);

            setMessage(
                familyMemberError,
                "No se ha podido enviar la solicitud. " +
                "Inténtalo de nuevo."
            );

            return;
        }

        switch (data) {

            case "pending":

                familyLinkForm.hidden = true;
                familyMemberForm.hidden = true;

                familyLinkPending.hidden = false;
                checkLinkStatusButton.hidden = false;

                setMessage(familyLinkInfo, "");

                break;

            case "invalid_code":

                setMessage(
                    familyMemberError,
                    "El código ha dejado de ser válido. " +
                    "Vuelve a comprobarlo."
                );

                break;

            case "invalid_member":

                setMessage(
                    familyMemberError,
                    "El miembro seleccionado ya no está disponible. " +
                    "Vuelve a comprobar el código y selecciona de nuevo."
                );

                break;

            case "blocked":

                setMessage(
                    familyMemberError,
                    "Has superado el número de intentos. " +
                    "Espera 15 minutos antes de volver a intentarlo."
                );

                break;

            case "account_not_eligible":

                setMessage(
                    familyMemberError,
                    "Esta cuenta ya no puede solicitar una vinculación. " +
                    "Contacta con la administración."
                );

                break;

            case "not_authenticated":

                setMessage(
                    familyMemberError,
                    "Tu sesión ha caducado. Inicia sesión de nuevo."
                );

                break;

            default:

                setMessage(
                    familyMemberError,
                    "No se ha podido procesar la solicitud. " +
                    "Contacta con la administración."
                );
        }

    } catch (error) {

        console.error("Error al solicitar la vinculación:", error);

        setMessage(
            familyMemberError,
            "Se ha producido un error. Inténtalo de nuevo."
        );

    } finally {

        setFamilyMemberLoading(false);
    }
});


/* =====================================================
   VOLVER A LA FASE DEL CÓDIGO
   ===================================================== */

familyMemberBackButton.addEventListener("click", () => {

    familyMemberForm.hidden = true;
    familyLinkForm.hidden = false;

    setMessage(familyMemberError, "");
    setMessage(familyLinkInfo, "");

    familyCode.focus();
});


/* =====================================================
   COMPROBAR ESTADO DE VINCULACIÓN
   ===================================================== */

checkLinkStatusButton.addEventListener("click", async () => {

    checkLinkStatusButton.disabled = true;
    checkLinkStatusButton.textContent = "Comprobando...";

    try {

        const { data, error } = await supabase.auth.getSession();

        if (error || !data.session) {

            showLogin();

            return;
        }

        // Volvemos a consultar el perfil en Supabase.
        // Si administración lo ha aprobado, entrará en la aplicación.
        await loadAuthorizedProfile(data.session, true);

        // Si sigue siendo provisional, actualizamos el estado.
        if (
            currentProfile &&
            currentProfile.active === false
        ) {

            await updateFamilyRequestDisplay();
        }

    } catch (error) {

        console.error("Error al comprobar la vinculación:", error);

        setMessage(
            familyLinkError,
            "No se ha podido comprobar el estado. Inténtalo de nuevo."
        );

    } finally {

        checkLinkStatusButton.disabled = false;
        checkLinkStatusButton.textContent = "Comprobar estado";
    }
});


/* =====================================================
   CERRAR SESIÓN
   ===================================================== */

async function signOut() {

    // Evitamos dobles clics mientras se cierra la sesión.
    logoutButton.disabled = true;
    authLogoutButton.disabled = true;

    try {

        // Cerramos únicamente la sesión de este dispositivo.
        const { error } = await supabase.auth.signOut({
            scope: "local"
        });

        if (error) {

            console.error("Error al cerrar sesión:", error);

            alert(
                "No se ha podido cerrar la sesión. Inténtalo de nuevo."
            );

            return;
        }

        loginPassword.value = "";

        loginEmail.focus();

        // El evento SIGNED_OUT de Supabase se encargará
        // de ejecutar showLogin() y limpiar la aplicación.

    } catch (error) {

        console.error("Error al cerrar la sesión:", error);

        alert("Se ha producido un error al cerrar la sesión.");

    } finally {

        logoutButton.disabled = false;
        authLogoutButton.disabled = false;
    }
}


logoutButton.addEventListener("click", signOut);

authLogoutButton.addEventListener("click", signOut);


/* =====================================================
   MENÚ DE USUARIO
   ===================================================== */

const userMenuButton = document.getElementById("user-menu-button");
const userMenu = document.getElementById("user-menu");
const userMenuContainer = userMenuButton?.closest(".user-menu-container");


function closeUserMenu() {

    if (!userMenuContainer || !userMenuButton) return;

    userMenuContainer.classList.remove("open");

    userMenuButton.setAttribute("aria-expanded", "false");
}


function toggleUserMenu() {

    if (!userMenuContainer || !userMenuButton) return;

    const isOpening = !userMenuContainer.classList.contains("open");

    userMenuContainer.classList.toggle("open", isOpening);

    userMenuButton.setAttribute(
        "aria-expanded",
        String(isOpening)
    );
}


// Estado inicial
closeUserMenu();


// Abrir / cerrar al pulsar el avatar
userMenuButton?.addEventListener("click", event => {

    event.stopPropagation();

    toggleUserMenu();

});


// Evitar que pulsar dentro del menú lo cierre
userMenu?.addEventListener("click", event => {
    event.stopPropagation();
});


// Cerrar al pulsar fuera
document.addEventListener("click", event => {

    if (
        userMenuContainer?.classList.contains("open") &&
        !userMenuContainer.contains(event.target)
    ) {
        closeUserMenu();
    }

});


// Cerrar con Escape
document.addEventListener("keydown", event => {

    if (
        event.key === "Escape" &&
        userMenuContainer?.classList.contains("open")
    ) {

        closeUserMenu();

        userMenuButton?.focus();
    }

});


/* =====================================================
   RECUPERAR / VIGILAR LA SESIÓN
   ===================================================== */

supabase.auth.onAuthStateChange((event, session) => {

    if (
        event === "INITIAL_SESSION" ||
        event === "SIGNED_IN" ||
        event === "SIGNED_OUT" ||
        event === "TOKEN_REFRESHED" ||
        event === "USER_UPDATED"
    ) {

        setTimeout(() => {

            if (event === "SIGNED_OUT" || !session?.user) {

                ++sessionCheckId;

                lastAuthenticatedUserId = null;
                currentUser = null;
                currentProfile = null;

                showLogin();

                setLoginLoading(false);

                return;
            }

            if (
                event === "TOKEN_REFRESHED" &&
                currentProfile?.active &&
                currentUser?.id === session.user.id
            ) {
                return;
            }

            loadAuthorizedProfile(session);

        }, 0);
    }
});


/* =====================================================
   ESTADO INICIAL
   ===================================================== */

document.body.classList.add("auth-required");

authScreen.hidden = false;