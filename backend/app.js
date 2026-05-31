require('dotenv').config();
const express = require('express');
const cors = require('cors');
// static upload removed

// Import routes
const authRoutes = require('./src/routes/authRoutes');
const qrCheckinRoutes = require('./src/routes/qrCheckin');
const collectionRoutes = require('./src/routes/collectionRoutes');
const uploadRoutes = require('./src/routes/uploadRoutes');

const app = express();
const port = process.env.PORT || 8080;

// CORS — разрешаем все источники (Vercel генерирует разные URL для каждого деплоя)
app.use(cors());

app.use(express.json());

// Middleware для замера производительности (нефункциональное требование: время ответа API < 500 мс)
app.use((req, res, next) => {
    const start = process.hrtime();
    
    // Перехватываем окончание отправки ответа
    res.on('finish', () => {
        const diff = process.hrtime(start);
        const timeInMs = (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(2);
        const statusColor = res.statusCode >= 400 ? '\x1b[31m' : '\x1b[32m'; // Красный при ошибках, зелёный при успехе
        const timeColor = timeInMs > 500 ? '\x1b[33m' : '\x1b[36m'; // Жёлтый если >500мс, голубой если всё ок
        const resetColor = '\x1b[0m';
        
        console.log(
            `[PERFORMANCE] ${req.method} ${req.originalUrl} - Status: ${statusColor}${res.statusCode}${resetColor} - Time: ${timeColor}${timeInMs} ms${resetColor}`
        );
    });
    
    next();
});


// Static file serving for images (no longer needed, using Supabase)

// Upload route MUST come before collection routes (otherwise /:collection intercepts /upload)
app.use('/upload', uploadRoutes);

// Auth and collection routes
app.use('/', authRoutes);
app.use('/', qrCheckinRoutes);
app.use('/', collectionRoutes);

if (process.env.NODE_ENV !== 'production') {
    app.listen(port, () => {
        console.log(`Backend server started on http://localhost:${port}`);
    });
}

module.exports = app;
