require('dotenv').config();
const express = require('express');
const cors = require('cors');
const zlib = require('zlib');
// static upload removed

// Import routes
const authRoutes = require('./src/routes/authRoutes');
const qrCheckinRoutes = require('./src/routes/qrCheckin');
const collectionRoutes = require('./src/routes/collectionRoutes');
const orderRequestRoutes = require('./src/routes/orderRequest');
const syncRoutes = require('./src/routes/sync');
const uploadRoutes = require('./src/routes/uploadRoutes');
const pushRoutes = require('./src/routes/pushRoutes');
const { ensureTable: ensurePushTable, ensureConfigured: ensurePushConfigured } = require('./src/services/pushService');
const { ensureAppSchema } = require('./src/database/schema');

const app = express();
const port = process.env.PORT || 8080;

// CORS — разрешаем все источники (Vercel генерирует разные URL для каждого деплоя)
app.use(cors());

app.use(express.json({ limit: '2mb' }));

// Крупные списки (каталог, заказы) уходят сжатыми. Мелочь не трогаем.
app.use((req, res, next) => {
    const accept = String(req.headers['accept-encoding'] || '');
    if (!/\bgzip\b/.test(accept)) return next();
    const sendJson = res.json.bind(res);
    res.json = (body) => {
        let payload;
        try {
            payload = Buffer.from(JSON.stringify(body));
        } catch {
            return sendJson(body);
        }
        if (payload.length < 1400) return sendJson(body);
        zlib.gzip(payload, (err, zipped) => {
            if (err || res.headersSent) {
                if (!res.headersSent) sendJson(body);
                return;
            }
            res.set('Content-Type', 'application/json; charset=utf-8');
            res.set('Content-Encoding', 'gzip');
            res.set('Vary', 'Accept-Encoding');
            res.set('Content-Length', String(zipped.length));
            res.end(zipped);
        });
        return res;
    };
    next();
});

let schemaPromise = null;
let schemaReady = false;
let schemaFailedAt = 0;

const ensureSchemaOnce = () => {
    if (schemaReady) return Promise.resolve();
    if (schemaPromise) return schemaPromise;
    if (Date.now() - schemaFailedAt < 30000) return Promise.resolve();

    schemaPromise = ensureAppSchema()
        .then(() => {
            schemaReady = true;
        })
        .catch((err) => {
            schemaFailedAt = Date.now();
            console.error('[schema] ensure failed:', err.message);
        })
        .finally(() => {
            schemaPromise = null;
        });
    return schemaPromise;
};

// Замер включает ожидание схемы: иначе журнал показывает только хвост запроса.
app.use((req, res, next) => {
    const start = process.hrtime();
    
    // Перехватываем окончание отправки ответа
    res.on('finish', () => {
        if (req.path === '/sync') return;
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

app.use((req, res, next) => {
    if (schemaReady) return next();
    ensureSchemaOnce().then(() => next()).catch(next);
});

// Static file serving for images (for local development/compatibility)
const path = require('path');
app.use('/utilse', express.static(path.join(__dirname, '../uploads')));

// Upload route MUST come before collection routes (otherwise /:collection intercepts /upload)
app.use('/upload', uploadRoutes);

// Web Push
app.use('/', pushRoutes);

// Публичная заявка и живая синхронизация должны стоять раньше /:collection
app.use('/', syncRoutes);
app.use('/', orderRequestRoutes);

// Auth and collection routes
app.use('/', authRoutes);
app.use('/', qrCheckinRoutes);
app.use('/', collectionRoutes);

app.use((err, req, res, next) => {
    if (err.type === 'entity.too.large' || err.status === 413) {
        return res.status(413).json({ error: 'Слишком большой запрос' });
    }
    if (err instanceof SyntaxError && err.status === 400 && Object.prototype.hasOwnProperty.call(err, 'body')) {
        return res.status(400).json({ error: 'Некорректный JSON' });
    }
    return next(err);
});

if (process.env.NODE_ENV !== 'production') {
    app.listen(port, () => {
        console.log(`Backend server started on http://localhost:${port}`);
        ensureSchemaOnce();
        ensurePushConfigured();
        ensurePushTable()
            .then(() => console.log('[push] subscriptions table ready'))
            .catch((err) => console.error('[push] table init failed:', err.message));
    });
}

module.exports = app;
