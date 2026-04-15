const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const webpush = require('web-push');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const vapidKeys = {
    publicKey: 'BMZ58mQIB0l4UBraPAagiVP8tSmAtP8Z9JeUy56-9ZMu5DzeJPAtjpoL_SPbCUdlW3VtqCLojKNeFxocJr2zJNY',
    privateKey: 'm8vrJDzoyDiGp-uMamH1PWE2nL-XdG1ncJejJg8fNus'
};

webpush.setVapidDetails(
    'mailto:sunshinehqd@yandex.ru',  // замените на свой email
    vapidKeys.publicKey,
    vapidKeys.privateKey
);

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Раздача статических файлов из корня проекта
app.use(express.static(path.join(__dirname, './')));

// Хранилище push-подписок (в реальном проекте используйте БД)
let subscriptions = [];

const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// WebSocket соединение
io.on('connection', (socket) => {
    console.log('✅ Клиент подключён:', socket.id);

    // Обработка события 'newTask' от клиента
    socket.on('newTask', (task) => {
        console.log('📝 Новая задача:', task);

        // Рассылаем всем подключённым клиентам
        io.emit('taskAdded', task);

        // Отправляем push-уведомления всем подписанным клиентам
        const payload = JSON.stringify({
            title: '✅ Новая задача',
            body: task.text
        });

        subscriptions.forEach(sub => {
            webpush.sendNotification(sub, payload).catch(err => {
                console.error('❌ Ошибка push:', err);
                // Если подписка недействительна — удаляем её
                if (err.statusCode === 410) {
                    subscriptions = subscriptions.filter(s => s.endpoint !== sub.endpoint);
                }
            });
        });
    });

    socket.on('disconnect', () => {
        console.log('❌ Клиент отключён:', socket.id);
    });
});

// Эндпоинт для сохранения push-подписки
app.post('/subscribe', (req, res) => {
    const subscription = req.body;
    subscriptions.push(subscription);
    console.log('📌 Подписка сохранена, всего подписок:', subscriptions.length);
    res.status(201).json({ message: 'Подписка сохранена' });
});

// Эндпоинт для удаления push-подписки
app.post('/unsubscribe', (req, res) => {
    const { endpoint } = req.body;
    subscriptions = subscriptions.filter(sub => sub.endpoint !== endpoint);
    console.log('🗑️ Подписка удалена, осталось:', subscriptions.length);
    res.status(200).json({ message: 'Подписка удалена' });
});

const PORT = 3001;
server.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
});