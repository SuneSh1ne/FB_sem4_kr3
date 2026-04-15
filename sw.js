const STATIC_CACHE = 'app-shell-v4';
const DYNAMIC_CACHE = 'dynamic-content-v1';

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

self.addEventListener('install', event => {
    console.log('[SW] Установка');
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(cache => cache.addAll(ASSETS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    console.log('[SW] Активация');
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
                    .map(key => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});

// Стратегии загрузки
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    if (url.origin !== self.location.origin) return;

    if (url.pathname.startsWith('/content/')) {
        event.respondWith(
            fetch(event.request)
                .then(networkRes => {
                    const resClone = networkRes.clone();
                    caches.open(DYNAMIC_CACHE).then(cache => {
                        cache.put(event.request, resClone);
                    });
                    return networkRes;
                })
                .catch(() => {
                    return caches.match(event.request)
                        .then(cached => cached || caches.match('/content/home.html'));
                })
        );
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(cached => cached || fetch(event.request))
    );
});

// ========== Обработчик push-уведомлений ==========
self.addEventListener('push', (event) => {
    console.log('[SW] Получено push-сообщение');
    
    let data = { title: '🔔 Уведомление', body: '', reminderId: null };
    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            data.body = event.data.text();
        }
    }

    const options = {
        body: data.body,
        icon: '/icons/icon-128x128.png',
        badge: '/icons/icon-48x48.png',
        vibrate: [200, 100, 200],
        data: {
            reminderId: data.reminderId,
            url: '/'
        }
    };

    // Добавляем кнопку "Отложить" только если есть reminderId
    if (data.reminderId) {
        options.actions = [
            {
                action: 'snooze',
                title: '⏰ Отложить на 5 минут'
            }
        ];
        options.requireInteraction = true; // Уведомление не исчезает автоматически
    }

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// ========== Обработчик клика по уведомлению ==========
self.addEventListener('notificationclick', (event) => {
    const notification = event.notification;
    const action = event.action;
    const reminderId = notification.data?.reminderId;

    notification.close();

    if (action === 'snooze' && reminderId) {
        // Отправляем запрос на сервер для откладывания
        console.log('[SW] Откладывание напоминания:', reminderId);
        
        event.waitUntil(
            fetch(`/snooze?reminderId=${reminderId}`, {
                method: 'POST'
            })
            .then(response => {
                if (response.ok) {
                    console.log('[SW] Напоминание успешно отложено');
                } else {
                    console.error('[SW] Ошибка при откладывании');
                }
            })
            .catch(err => console.error('[SW] Ошибка fetch:', err))
        );
    } else {
        // Обычный клик — открываем приложение
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});