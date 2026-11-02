const express = require('express');
const { uploadImage, deleteImage } = require('../controllers/uploadController');
const { authenticate } = require('../middleware/auth');
const { can } = require('../utils/roles');

const router = express.Router();

// Заявку с фото отправляет гость, поэтому загрузка остаётся открытой.
// Стереть файл могут только те, кто правит мебель или объявления.
const guardUploadDelete = (req, res, next) => {
    if (can(req.userRole, 'editFurniture') || can(req.userRole, 'announcements')) return next();
    return res.status(403).json({ error: 'Недостаточно прав' });
};

router.post('/', uploadImage);
router.delete('/', authenticate, guardUploadDelete, deleteImage);

module.exports = router;
