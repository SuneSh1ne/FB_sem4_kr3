const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const webpush = require('web-push');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

// VAPID-ключи (замените на свои)
const vapidKeys = {
    publicKey: 'BMZ58mQIB0l4UBraPAagiVP8tSmAtP8Z9JeUy56-9ZMu5DzeJPAtjpoL_SPbCUdlW3VtqCLojKNeFxocJr2zJNY',
    privateKey: 'm8vrJDzoyDiGp-uMamH1PWE2nL-XdG1ncJejJg8fNus'
};

webpush.setVapidDetails(
    'mailto:your-email@example.com',
    vapidKeys.publicKey,
    vapidKeys.privateKey
);

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, './')));

// Хранилище push-подписок
let subscriptions = [];

// Хранилище активных напоминаний (таймеров)
const reminders = new Map();

const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// ========== WebSocket обработка ==========
io.on('connection', (socket) => {
    console.log('✅ Клиент подключён:', socket.id);

    // Обычная задача (WebSocket)
    socket.on('newTask', (task) => {
        console.log('📝 Новая задача:', task);
        io.emit('taskAdded', task);
    });

    // Новое напоминание (создаём таймер)
    socket.on('newReminder', (reminder) => {
        const { id, text, reminderTime } = reminder;
        const delay = reminderTime - Date.now();
        
        console.log(`⏰ Новое напоминание: "${text}" через ${Math.round(delay / 1000)} сек`);
        
        if (delay <= 0) {
            console.log('⚠️ Время напоминания уже прошло');
            return;
        }

        // Создаём таймер
        const timeoutId = setTimeout(() => {
            console.log(`🔔 Отправка напоминания: "${text}"`);
            
            const payload = JSON.stringify({
                title: '⏰ Напоминание',
                body: text,
                reminderId: id
            });

            // Отправляем всем подписанным клиентам
            subscriptions.forEach(sub => {
                webpush.sendNotification(sub, payload).catch(err => {
                    if (err.statusCode === 410) {
                        subscriptions = subscriptions.filter(s => s.endpoint !== sub.endpoint);
                    } else {
                        console.error('❌ Ошибка push:', err);
                    }
                });
            });

            reminders.delete(id);
        }, delay);

        reminders.set(id, {
            timeoutId,
            text,
            reminderTime
        });
    });

    // Отмена напоминания (при удалении заметки)
    socket.on('cancelReminder', ({ id }) => {
        if (reminders.has(id)) {
            clearTimeout(reminders.get(id).timeoutId);
            reminders.delete(id);
            console.log(`🗑️ Напоминание ${id} отменено`);
        }
    });

    socket.on('disconnect', () => {
        console.log('❌ Клиент отключён:', socket.id);
    });
});

// ========== Эндпоинт для откладывания напоминания ==========
app.post('/snooze', (req, res) => {
    const reminderId = req.query.reminderId;
    
    if (!reminderId || !reminders.has(reminderId)) {
        return res.status(400).json({ error: 'Reminder not found' });
    }

    const reminder = reminders.get(reminderId);
    
    // Отменяем старый таймер
    clearTimeout(reminder.timeoutId);
    
    // Новая задержка: 5 минут
    const snoozeDelay = 5 * 60 * 1000;
    const newTimeoutId = setTimeout(() => {
        console.log(`🔔 Отложенное напоминание: "${reminder.text}"`);
        
        const payload = JSON.stringify({
            title: '⏰ Напоминание (отложено)',
            body: reminder.text,
            reminderId: reminderId
        });

        subscriptions.forEach(sub => {
            webpush.sendNotification(sub, payload).catch(err => {
                if (err.statusCode === 410) {
                    subscriptions = subscriptions.filter(s => s.endpoint !== sub.endpoint);
                }
            });
        });

        reminders.delete(reminderId);
    }, snoozeDelay);

    reminders.set(reminderId, {
        timeoutId: newTimeoutId,
        text: reminder.text,
        reminderTime: Date.now() + snoozeDelay
    });

    console.log(`⏰ Напоминание "${reminder.text}" отложено на 5 минут`);
    res.status(200).json({ message: 'Reminder snoozed for 5 minutes' });
});

// ========== Push-подписки ==========
app.post('/subscribe', (req, res) => {
    const subscription = req.body;
    subscriptions.push(subscription);
    console.log('📌 Подписка сохранена, всего:', subscriptions.length);
    res.status(201).json({ message: 'Подписка сохранена' });
});

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