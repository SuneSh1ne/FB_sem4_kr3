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

// ========== Генерация уникального ID ==========
function generateId() {
    return Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

// ========== Логика работы с заметками и напоминаниями ==========
function initNotes() {
    console.log('🔧 initNotes вызвана');
    
    // Элементы для простой заметки
    const form = document.getElementById('note-form');
    const input = document.getElementById('note-input');
    
    // Элементы для напоминания
    const reminderForm = document.getElementById('reminder-form');
    const reminderText = document.getElementById('reminder-text');
    const reminderTime = document.getElementById('reminder-time');
    
    const list = document.getElementById('notes-list');

    if (!list) {
        console.error('❌ notes-list не найден');
        return;
    }

    console.log('✅ Элементы найдены:', {
        form: !!form,
        reminderForm: !!reminderForm,
        list: !!list
    });

    function loadNotes() {
        const notes = JSON.parse(localStorage.getItem('notes') || '[]');
        console.log('📋 Загрузка заметок:', notes.length);
        
        list.innerHTML = notes.map(note => {
            let reminderInfo = '';
            if (note.reminder) {
                const date = new Date(note.reminder);
                reminderInfo = `<br><small style="color: #3b82f6;">⏰ Напоминание: ${date.toLocaleString()}</small>`;
            }
            return `
                <li style="margin-bottom: 0.75rem; padding: 0.75rem; border-left: 4px solid ${note.reminder ? '#3b82f6' : '#ccc'}; background: #f9f9f9; border-radius: 8px;">
                    ${escapeHtml(note.text)}
                    ${reminderInfo}
                    <button class="delete-note" data-id="${note.id}" style="float:right; background:#ff4444; color:white; border:none; border-radius:4px; cursor:pointer; padding: 4px 8px;">✖</button>
                </li>
            `;
        }).join('');

        document.querySelectorAll('.delete-note').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = btn.dataset.id;
                deleteNote(id);
            });
        });
    }

    function addSimpleNote(text) {
        const notes = JSON.parse(localStorage.getItem('notes') || '[]');
        const newNote = {
            id: generateId(),
            text: text,
            reminder: null
        };
        notes.push(newNote);
        localStorage.setItem('notes', JSON.stringify(notes));
        loadNotes();
        console.log('✅ Простая заметка добавлена:', text);

        socket.emit('newTask', { text: text, timestamp: new Date().toISOString() });
    }

    function addReminderNote(text, reminderTimestamp) {
        const notes = JSON.parse(localStorage.getItem('notes') || '[]');
        const newNote = {
            id: generateId(),
            text: text,
            reminder: reminderTimestamp
        };
        notes.push(newNote);
        localStorage.setItem('notes', JSON.stringify(notes));
        loadNotes();
        console.log('⏰ Напоминание добавлено:', text, new Date(reminderTimestamp).toLocaleString());

        socket.emit('newReminder', {
            id: newNote.id,
            text: text,
            reminderTime: reminderTimestamp
        });

        socket.emit('newTask', { text: `[НАПОМИНАНИЕ] ${text}`, timestamp: new Date().toISOString() });
    }

    function deleteNote(id) {
        let notes = JSON.parse(localStorage.getItem('notes') || '[]');
        const deletedNote = notes.find(n => n.id === id);
        notes = notes.filter(n => n.id !== id);
        localStorage.setItem('notes', JSON.stringify(notes));
        loadNotes();
        console.log('🗑️ Заметка удалена:', id);

        if (deletedNote && deletedNote.reminder) {
            socket.emit('cancelReminder', { id: id });
        }
    }

    function escapeHtml(str) {
        return str.replace(/[&<>]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
    }

    // Обработка простой формы
    if (form && input) {
        console.log('✅ Форма заметки найдена, добавляем обработчик');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const text = input.value.trim();
            console.log('📝 Отправка простой заметки:', text);
            if (text) {
                addSimpleNote(text);
                input.value = '';
            } else {
                console.warn('⚠️ Пустой текст');
            }
        });
    } else {
        console.error('❌ Форма заметки не найдена!');
    }

    // Обработка формы напоминания
    if (reminderForm && reminderText && reminderTime) {
        console.log('✅ Форма напоминания найдена, добавляем обработчик');
        reminderForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const text = reminderText.value.trim();
            const timeValue = reminderTime.value;
            
            console.log('⏰ Отправка напоминания:', { text, timeValue });
            
            if (!text) {
                alert('Введите текст напоминания');
                return;
            }
            if (!timeValue) {
                alert('Выберите дату и время');
                return;
            }
            
            const reminderTimestamp = new Date(timeValue).getTime();
            const now = Date.now();
            
            if (reminderTimestamp <= now) {
                alert('Дата и время должны быть в будущем');
                return;
            }
            
            addReminderNote(text, reminderTimestamp);
            reminderText.value = '';
            reminderTime.value = '';
        });
    } else {
        console.error('❌ Форма напоминания не найдена!');
    }

    loadNotes();
}

// ========== Обработка WebSocket события от других клиентов ==========
socket.on('taskAdded', (task) => {
    console.log('📨 Задача от другого клиента:', task);
    
    const notification = document.createElement('div');
    notification.textContent = `✨ ${task.text}`;
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

const VAPID_PUBLIC_KEY = 'BMZ58mQIB0l4UBraPAagiVP8tSmAtP8Z9JeUy56-9ZMu5DzeJPAtjpoL_SPbCUdlW3VtqCLojKNeFxocJr2zJNY'; // Замените на свой

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
        }
        return false;
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