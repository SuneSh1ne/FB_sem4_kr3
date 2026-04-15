const STATIC_CACHE = 'app-shell-v2';
const DYNAMIC_CACHE = 'dynamic-content-v1';

// Статические ресурсы (App Shell)
const ASSETS = [
    '/',
    '/index.html',
    '/app.js',
    '/style.css',
    '/manifest.json',
    '/icons/favicon-48x48.png',
    '/icons/favicon-128x128.png',
    '/icons/favicon-512x512.png',
    'https://unpkg.com/chota@latest'
];

// Установка – кэшируем App Shell
self.addEventListener('install', event => {
    console.log('[SW] Установка');
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(cache => cache.addAll(ASSETS))
            .then(() => self.skipWaiting())
    );
});

// Активация – чистим старые кэши
self.addEventListener('activate', event => {
    console.log('[SW] Активация');
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
                    .map(key => {
                        console.log('[SW] Удаление старого кэша:', key);
                        return caches.delete(key);
                    })
            );
        }).then(() => self.clients.claim())
    );
});

// Стратегии загрузки:
// - Статика (App Shell) -> Cache First
// - Динамический контент (/content/*) -> Network First
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    
    // Пропускаем запросы к другим источникам (CDN)
    if (url.origin !== self.location.origin) return;

    // Динамические страницы – Network First
    if (url.pathname.startsWith('/content/')) {
        event.respondWith(
            fetch(event.request)
                .then(networkRes => {
                    // Кэшируем свежий ответ
                    const resClone = networkRes.clone();
                    caches.open(DYNAMIC_CACHE).then(cache => {
                        cache.put(event.request, resClone);
                    });
                    return networkRes;
                })
                .catch(() => {
                    // При ошибке сети – берём из кэша
                    return caches.match(event.request)
                        .then(cached => {
                            if (cached) return cached;
                            // Фолбек: показываем home
                            return caches.match('/content/home.html');
                        });
                })
        );
        return;
    }

    // Статические ресурсы – Cache First
    event.respondWith(
        caches.match(event.request)
            .then(cached => cached || fetch(event.request))
    );
});