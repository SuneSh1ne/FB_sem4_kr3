// ========== Подключение к серверу WebSocket ==========
const socket = io('http://localhost:3001');

// ========== App Shell: навигация ==========
const contentDiv = document.getElementById('app-content');
const homeBtn = document.getElementById('home-btn');
const aboutBtn = document.getElementById('about-btn');

function setActiveButton(activeId) {
    [homeBtn, aboutBtn].forEach(btn => btn.classList.remove('active'));
    document.getElementById(activeId).classList.add('active');
}

async function loadContent(page) {
    try {
        const response = await fetch(`/content/${page}.html`);
        if (!response.ok) throw new Error('Страница не найдена');
        const html = await response.text();
        contentDiv.innerHTML = html;

        if (page === 'home') {
            initNotes();
        }
    } catch (err) {
        contentDiv.innerHTML = '<p class="is-center text-error">❌ Ошибка загрузки страницы</p>';
        console.error(err);
    }
}

// ========== Логика работы с заметками ==========
function initNotes() {
    const form = document.getElementById('todo-form');
    const input = document.getElementById('todo-input');
    const list = document.getElementById('todo-list');

    if (!form || !input || !list) return;

    function loadTodos() {
        const todos = JSON.parse(localStorage.getItem('todos') || '[]');
        list.innerHTML = todos.map((todo, index) => `
            <li>
                ${escapeHtml(todo)}
                <button class="delete-todo" data-index="${index}" style="float:right; background:#ff4444; color:white; border:none; border-radius:4px; cursor:pointer;">✖</button>
            </li>
        `).join('');

        document.querySelectorAll('.delete-todo').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(btn.dataset.index);
                deleteTodo(index);
            });
        });
    }

    function addTodo(text) {
        const todos = JSON.parse(localStorage.getItem('todos') || '[]');
        todos.push(text);
        localStorage.setItem('todos', JSON.stringify(todos));
        loadTodos();

        socket.emit('newTask', { text: text, timestamp: new Date().toISOString() });
    }

    function deleteTodo(index) {
        const todos = JSON.parse(localStorage.getItem('todos') || '[]');
        todos.splice(index, 1);
        localStorage.setItem('todos', JSON.stringify(todos));
        loadTodos();
    }

    function escapeHtml(str) {
        return str.replace(/[&<>]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (text) {
            addTodo(text);
            input.value = '';
        }
    });

    loadTodos();
}

// ========== Обработка WebSocket события от других клиентов ==========
socket.on('taskAdded', (task) => {
    console.log('📨 Задача от другого клиента:', task);
    
    const notification = document.createElement('div');
    notification.textContent = `✨ Новая задача: ${task.text}`;
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #3b82f6;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        z-index: 1000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        animation: slideIn 0.3s ease;
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
});

// ========== Push-уведомления ==========
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

const VAPID_PUBLIC_KEY = 'BMZ58mQIB0l4UBraPAagiVP8tSmAtP8Z9JeUy56-9ZMu5DzeJPAtjpoL_SPbCUdlW3VtqCLojKNeFxocJr2zJNY';

async function subscribeToPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        alert('Ваш браузер не поддерживает push-уведомления');
        return false;
    }
    
    try {
        const registration = await navigator.serviceWorker.ready;
        
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
        
        const response = await fetch('http://localhost:3001/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(subscription)
        });
        
        if (response.ok) {
            console.log('✅ Подписка на push успешно создана');
            return true;
        } else {
            console.error('❌ Ошибка при отправке подписки на сервер');
            return false;
        }
    } catch (err) {
        console.error('❌ Ошибка подписки на push:', err);
        return false;
    }
}

async function isPushSubscribed() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        return false;
    }
    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        return subscription !== null;
    } catch (err) {
        console.error('❌ Ошибка проверки подписки:', err);
        return false;
    }
}

async function unsubscribeFromPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        return;
    }
    
    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        
        if (subscription) {
            await fetch('http://localhost:3001/unsubscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ endpoint: subscription.endpoint })
            });
            
            await subscription.unsubscribe();
            console.log('✅ Отписка от push выполнена');
        }
    } catch (err) {
        console.error('❌ Ошибка отписки:', err);
    }
}

// ========== Обработка навигации ==========
homeBtn.addEventListener('click', () => {
    setActiveButton('home-btn');
    loadContent('home');
});

aboutBtn.addEventListener('click', () => {
    setActiveButton('about-btn');
    loadContent('about');
});

// ========== Регистрация Service Worker ==========
if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            console.log('✅ ServiceWorker зарегистрирован');

            const enableBtn = document.getElementById('enable-push');
            const disableBtn = document.getElementById('disable-push');

            if (enableBtn && disableBtn) {
                const subscribed = await isPushSubscribed();
                
                if (subscribed) {
                    enableBtn.style.display = 'none';
                    disableBtn.style.display = 'inline-block';
                } else {
                    enableBtn.style.display = 'inline-block';
                    disableBtn.style.display = 'none';
                }

                enableBtn.addEventListener('click', async () => {
                    if (Notification.permission === 'denied') {
                        alert('Уведомления запрещены. Разрешите их в настройках браузера.');
                        return;
                    }
                    if (Notification.permission === 'default') {
                        const permission = await Notification.requestPermission();
                        if (permission !== 'granted') {
                            alert('Необходимо разрешить уведомления.');
                            return;
                        }
                    }
                    const success = await subscribeToPush();
                    if (success) {
                        enableBtn.style.display = 'none';
                        disableBtn.style.display = 'inline-block';
                    }
                });

                // Кнопка ВЫКЛЮЧИТЬ
                disableBtn.addEventListener('click', async () => {
                    await unsubscribeFromPush();
                    disableBtn.style.display = 'none';
                    enableBtn.style.display = 'inline-block';
                });
            }
        } catch (err) {
            console.error('❌ Ошибка регистрации ServiceWorker:', err);
        }
    });
}

// ========== Загружаем главную страницу ==========
loadContent('home');