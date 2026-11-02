"use strict";

import { supabase } from "./supabase-client.js";

/* =====================================================
   ELEMENTOS DEL DOM
   ===================================================== */

const authScreen = document.getElementById("auth-screen");

const loginForm = document.getElementById("login-form");

const loginEmail = document.getElementById("login-email");

const loginPassword = document.getElementById("login-password");

const loginButton = document.getElementById("login-button");

const loginError = document.getElementById("login-error");

const loginInfo = document.getElementById("login-info");

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
   MENSAJES
   ===================================================== */

function showError(message) {
    loginError.textContent = message;
    loginError.hidden = false;

    loginInfo.textContent = "";
    loginInfo.hidden = true;
}


function showInfo(message) {
    loginInfo.textContent = message;
    loginInfo.hidden = false;

    loginError.textContent = "";
    loginError.hidden = true;
}


function clearMessages() {
    loginError.textContent = "";
    loginError.hidden = true;

    loginInfo.textContent = "";
    loginInfo.hidden = true;
}


/* =====================================================
   BLOQUEAR / DESBLOQUEAR FORMULARIO
   ===================================================== */

function setLoginLoading(isLoading) {
    loginButton.disabled = isLoading;

    loginEmail.disabled = isLoading;

    loginPassword.disabled = isLoading;

    loginButton.textContent = isLoading
        ? "Comprobando acceso..."
        : "Iniciar sesión";
}


/* =====================================================
   MOSTRAR / OCULTAR APLICACIÓN
   ===================================================== */

function showApplication(profile) {
    document.body.classList.remove("auth-required");

    authScreen.hidden = true;

    const displayName =
        profile.display_name || "Usuario";

    const userNameElement =
        document.querySelector(".user-info strong");

    const avatarElement =
        document.querySelector(".avatar");

    const userSubtitle =
        document.querySelector(".user-info span");

    if (userNameElement) {
        userNameElement.textContent = displayName;
    }

    if (avatarElement) {
        const initials = displayName
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map(part => part.charAt(0))
            .join("")
            .toUpperCase();

        avatarElement.textContent = initials || "C+";
    }

    if (userSubtitle) {
        userSubtitle.textContent = profile.role;
    }
}


function showLogin() {
    document.body.classList.add("auth-required");

    authScreen.hidden = false;

    currentUser = null;
    currentProfile = null;

    document.dispatchEvent(
        new CustomEvent("cesplus:signed-out")
    );
}


/* =====================================================
   CARGAR PERFIL AUTORIZADO
   ===================================================== */

    async function loadAuthorizedProfile(session) {
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

        // Si ya tenemos el perfil de este usuario, no lo consultamos otra vez.
        if (
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
                .select("user_id, display_name, role, family_id, active")
                .eq("user_id", userId)
                .maybeSingle();

            // Ignoramos respuestas de consultas anteriores.
            if (checkId !== sessionCheckId) {
                return;
            }

            if (error) {
                console.error("Error al consultar el perfil:", error);

                lastAuthenticatedUserId = null;

                await supabase.auth.signOut();

                showLogin();

                showError(
                    "No se ha podido comprobar tu perfil. " +
                    "Revisa las políticas de seguridad de Supabase."
                );

                return;
            }

            if (!profile || !profile.active) {
                lastAuthenticatedUserId = null;

                await supabase.auth.signOut();

                showLogin();

                showError(
                    "Tu cuenta no tiene un perfil activo en CESPlus. " +
                    "Contacta con la administración."
                );

                return;
            }

            const validRoles = ["admin", "treasurer", "member"];

            if (!validRoles.includes(profile.role)) {
                lastAuthenticatedUserId = null;

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
                "Comprueba tus credenciales."
            );

            setLoginLoading(false);

            return;
        }

        await loadAuthorizedProfile(data.session);

    } catch (error) {
        console.error(
            "Error durante el inicio de sesión:",
            error
        );

        showError(
            "No se ha podido conectar con Supabase. " +
            "Comprueba tu conexión e inténtalo de nuevo."
        );

        setLoginLoading(false);
    }
});


/* =====================================================
   CERRAR SESIÓN
   ===================================================== */

logoutButton.addEventListener("click", async () => {
    logoutButton.disabled = true;

    try {
        const { error } = await supabase.auth.signOut();

        if (error) {
            console.error(
                "Error al cerrar sesión:",
                error
            );

            alert(
                "No se ha podido cerrar la sesión. " +
                "Inténtalo de nuevo."
            );

            return;
        }

        showLogin();

        clearMessages();

        loginPassword.value = "";

        loginEmail.focus();

    } catch (error) {
        console.error(
            "Error al cerrar sesión:",
            error
        );

        alert("Se ha producido un error al cerrar la sesión.");

    } finally {
        logoutButton.disabled = false;
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

/*
 * Ocultamos la aplicación antes de comprobar la sesión.
 * El evento INITIAL_SESSION determinará qué pantalla mostrar.
 */

document.body.classList.add("auth-required");

authScreen.hidden = false;