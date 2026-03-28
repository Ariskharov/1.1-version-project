const express = require('express');
const { uploadImage, deleteImage } = require('../controllers/uploadController');

const router = express.Router();

router.post('/', uploadImage);
router.delete('/', deleteImage);

module.exports = router;
