require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { uploadDir } = require('./src/utils/upload');

// Import routes
const authRoutes = require('./src/routes/authRoutes');
const collectionRoutes = require('./src/routes/collectionRoutes');
const uploadRoutes = require('./src/routes/uploadRoutes');

const app = express();
const port = process.env.PORT || 8080;

const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    // Задеплоенный фронтенд (добавь свои домены через запятую)
    process.env.FRONTEND_URL,
].filter(Boolean); // убираем undefined если переменная не задана

app.use(cors({
    origin: (origin, callback) => {
        // Разрешаем запросы без origin (postman, curl) и из разрешённых доменов
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.warn(`[CORS] Blocked origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
}));

// Handle preflight OPTIONS requests (Express 5 syntax)
app.options('/{*path}', cors());

app.use(express.json());

// Static file serving for images (Do this BEFORE catch-all collection routes)
app.use('/utilse', express.static(uploadDir));

// Upload route MUST come before collection routes (otherwise /:collection intercepts /upload)
app.use('/upload', uploadRoutes);

// Auth and collection routes
app.use('/', authRoutes);
app.use('/', collectionRoutes);

if (process.env.NODE_ENV !== 'production') {
    app.listen(port, () => {
        console.log(`Backend server started on http://localhost:${port}`);
        console.log(`Serving static files from: ${uploadDir}`);
    });
}

module.exports = app;
