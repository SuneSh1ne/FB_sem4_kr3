const CACHE_NAME = 'todo-cache-v1';
const ASSETS = [
    '/',
    '/index.html',
    '/app.js',
    '/style.css',
    'https://unpkg.com/chota@latest'
];

// Установка – кэшируем файлы
self.addEventListener('install', event => {
    console.log('[SW] Установка');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[SW] Кэширование ресурсов');
                return cache.addAll(ASSETS);
            })
            .then(() => self.skipWaiting())
    );
});

// Активация – чистим старые кэши
self.addEventListener('activate', event => {
    console.log('[SW] Активация');
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => {
                        console.log('[SW] Удаление старого кэша:', key);
                        return caches.delete(key);
                    })
            );
        }).then(() => self.clients.claim())
    );
});

// Перехват fetch-запросов – сначала кэш, потом сеть
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Нашли в кэше – возвращаем
                if (response) {
                    return response;
                }
                // Нет в кэше – идём в сеть
                return fetch(event.request).then(fetchResponse => {
                    // Не кэшируем неправильные ответы
                    if (!fetchResponse || fetchResponse.status !== 200) {
                        return fetchResponse;
                    }
                    // Клонируем и сохраняем в кэш
                    const responseToCache = fetchResponse.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                    return fetchResponse;
                });
            })
    );
});