const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../../uploads');

// Automatically create uploads dir if it does not exist (skip in serverless read-only environment)
try {
    if (fs.existsSync(uploadDir)) {
        const stat = fs.statSync(uploadDir);
        if (!stat.isDirectory()) {
            fs.unlinkSync(uploadDir);
            fs.mkdirSync(uploadDir, { recursive: true });
        }
    } else {
        fs.mkdirSync(uploadDir, { recursive: true });
    }
} catch (error) {
    console.warn('Could not create upload directory (normal on Vercel Serverless environment):', error.message);
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
