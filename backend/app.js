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

app.use(cors());
app.use(express.json());

// Static file serving for images (Do this BEFORE catch-all collection routes)
app.use('/utilse', express.static(uploadDir));

// Link all routes identically to the old server.js flat structure
app.use('/', authRoutes);
app.use('/', collectionRoutes);
app.use('/upload', uploadRoutes);

app.listen(port, () => {
    console.log(`Backend server started on http://localhost:${port}`);
    console.log(`Serving static files from: ${uploadDir}`);
});
