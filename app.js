// DOM элементы
const form = document.getElementById('todo-form');
const input = document.getElementById('todo-input');
const list = document.getElementById('todo-list');
const statusDiv = document.getElementById('status');

// Загрузка задач из localStorage
function loadTodos() {
    const todos = JSON.parse(localStorage.getItem('todos') || '[]');
    list.innerHTML = todos.map(todo => `<li>${escapeHtml(todo)}</li>`).join('');
}

// Сохранение новой задачи
function addTodo(text) {
    const todos = JSON.parse(localStorage.getItem('todos') || '[]');
    todos.push(text);
    localStorage.setItem('todos', JSON.stringify(todos));
    loadTodos();
}

// Простая защита от XSS
function escapeHtml(str) {
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// Обработка отправки формы
form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (text) {
        addTodo(text);
        input.value = '';
        updateStatus('✅ Задача добавлена (офлайн-режим)');
        setTimeout(() => updateStatus('🟢 Приложение готово к работе'), 2000);
    }
});

// Обновление статуса
function updateStatus(msg) {
    statusDiv.innerHTML = msg;
}

// Первоначальная загрузка
loadTodos();

// Регистрация Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            console.log('ServiceWorker зарегистрирован с scope:', registration.scope);
            updateStatus('✅ Service Worker активен. Приложение работает офлайн!');
        } catch (err) {
            console.error('Ошибка регистрации ServiceWorker:', err);
            updateStatus('⚠️ Service Worker не зарегистрирован. Офлайн-режим недоступен.');
        }
    });
} else {
    updateStatus('❌ Ваш браузер не поддерживает Service Worker');
}