const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../../uploads');

// Automatically create uploads dir if it does not exist
if (fs.existsSync(uploadDir)) {
    const stat = fs.statSync(uploadDir);
    if (!stat.isDirectory()) {
        fs.unlinkSync(uploadDir);
        fs.mkdirSync(uploadDir, { recursive: true });
    }
} else {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});

const upload = multer({ storage });

module.exports = { upload, uploadDir };
