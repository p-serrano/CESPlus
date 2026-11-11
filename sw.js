// =====================================================
// CESPLUS — SERVICE WORKER
// =====================================================

const CACHE_NAME = "cesplus-v1";

const APP_FILES = [
    "./",
    "./index.html",
    "./manifest.json",
    "./styles/styles.css",

    "./supabase-auth.js",
    "./supabase-client.js",

    "./js/app.js",
    "./js/core.js",
    "./js/managers.js",
    "./js/supabase.js",
    "./js/supabase-data.js",

    "./js/ui/administration.js",
    "./js/ui/dashboard.js",
    "./js/ui/economy.js",
    "./js/ui/events.js",
    "./js/ui/families.js",
    "./js/ui/forms.js",
    "./js/ui/modals.js",
    "./js/ui/navigation.js",
    "./js/ui/ui.js"
];

// INSTALL
self.addEventListener("install", event => {

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(APP_FILES))
    );

    self.skipWaiting();
});

// ACTIVATE
self.addEventListener("activate", event => {

    event.waitUntil(

        caches.keys()
            .then(cacheNames => {

                return Promise.all(

                    cacheNames
                        .filter(cacheName =>
                            cacheName.startsWith("cesplus-") &&
                            cacheName !== CACHE_NAME
                        )
                        .map(cacheName =>
                            caches.delete(cacheName)
                        )

                );

            })
            .then(() => self.clients.claim())

    );

});

// FETCH
self.addEventListener("fetch", event => {

    const request = event.request;
    const url = new URL(request.url);

    // Solo peticiones GET del propio proyecto.
    // Las peticiones a Supabase quedan fuera.
    if (
        request.method !== "GET" ||
        url.origin !== self.location.origin ||
        !url.pathname.startsWith(
            new URL(self.registration.scope).pathname
        )
    ) {
        return;
    }

    event.respondWith(

        fetch(request)
            .then(response => {

                if (response.ok) {

                    const responseClone = response.clone();

                    caches.open(CACHE_NAME)
                        .then(cache => {
                            cache.put(request, responseClone);
                        });

                }

                return response;

            })
            .catch(async () => {

                const cachedResponse = await caches.match(request);

                if (cachedResponse) {
                    return cachedResponse;
                }

                throw new Error(
                    "CESPlus: recurso no disponible."
                );

            })

    );

});