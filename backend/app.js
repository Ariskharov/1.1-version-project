require('dotenv').config();
const express = require('express');
const cors = require('cors');
// static upload removed

// Import routes
const authRoutes = require('./src/routes/authRoutes');
const collectionRoutes = require('./src/routes/collectionRoutes');
const uploadRoutes = require('./src/routes/uploadRoutes');

const app = express();
const port = process.env.PORT || 8080;

// CORS — разрешаем все источники (Vercel генерирует разные URL для каждого деплоя)
app.use(cors());

app.use(express.json());

// Static file serving for images (no longer needed, using Supabase)

// Upload route MUST come before collection routes (otherwise /:collection intercepts /upload)
app.use('/upload', uploadRoutes);

// Auth and collection routes
app.use('/', authRoutes);
app.use('/', collectionRoutes);

if (process.env.NODE_ENV !== 'production') {
    app.listen(port, () => {
        console.log(`Backend server started on http://localhost:${port}`);
    });
}

module.exports = app;
