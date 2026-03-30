const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { upload, uploadDir } = require('../utils/upload');

const uploadImage = (req, res) => {
    upload.single('file')(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            console.error('[UPLOAD] Multer error:', err);
            return res.status(500).json({ error: 'Ошибка Multer при загрузке' });
        } else if (err) {
            console.error('[UPLOAD] Unknown error:', err);
            return res.status(500).json({ error: 'Системная ошибка при загрузке' });
        }

        if (!req.file) {
            console.error('[UPLOAD] No file received in request');
            return res.status(400).json({ error: 'Файл не получен' });
        }

        const filePath = `/utilse/${req.file.filename}`;
        console.log(`[UPLOAD] File saved successfully: ${filePath}`);
        console.log(`[UPLOAD] Full disk path: ${req.file.path}`);
        res.json({ path: filePath });
    });
};

const deleteImage = (req, res) => {
    const fileName = req.body.fileName;
    if (!fileName) return res.status(400).json({ error: 'Имя файла не указано' });

    const filePath = path.join(uploadDir, fileName.replace('/utilse/', ''));

    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Фото не найдено' });
    }
};

module.exports = { uploadImage, deleteImage };
