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
            initNotes(); // Инициализируем заметки
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
        list.innerHTML = todos.map(todo => `<li>${escapeHtml(todo)}</li>`).join('');
    }

    function addTodo(text) {
        const todos = JSON.parse(localStorage.getItem('todos') || '[]');
        todos.push(text);
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
            console.log('ServiceWorker зарегистрирован:', registration.scope);
        } catch (err) {
            console.error('Ошибка регистрации:', err);
        }
    });
}

// ========== Загружаем главную страницу по умолчанию ==========
loadContent('home');