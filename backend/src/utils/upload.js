const multer = require('multer');

const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 8 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) {
            cb(null, true);
            return;
        }
        cb(new Error('Допустимы только изображения JPEG, PNG, WEBP или GIF'));
    },
});

module.exports = { upload };
