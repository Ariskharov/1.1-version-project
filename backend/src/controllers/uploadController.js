const multer = require('multer');
const { upload } = require('../utils/upload');
const supabase = require('../utils/supabaseClient');

const BUCKET_NAME = 'furniture';

const uploadImage = (req, res) => {
    upload.single('file')(req, res, async (err) => {
        if (err || !req.file) {
            console.error('[UPLOAD] Error or no file received:', err);
            return res.status(400).json({ error: 'Ошибка загрузки файла' });
        }

        // Generate a unique filename
        const originalName = req.file.originalname;
        const fileExt = originalName.split('.').pop();
        const fileName = `${Date.now()}-${Math.round(Math.random() * 1E9)}.${fileExt}`;

        try {
            console.log(`[UPLOAD] Attempting Supabase upload: bucket=${BUCKET_NAME}, file=${fileName}, size=${req.file.buffer.length}, type=${req.file.mimetype}`);
            
            // Upload to Supabase Storage
            const { data, error } = await supabase
                .storage
                .from(BUCKET_NAME)
                .upload(fileName, req.file.buffer, {
                    contentType: req.file.mimetype,
                    upsert: false
                });

            if (error) {
                console.error('[UPLOAD] Supabase Error:', JSON.stringify(error));
                return res.status(500).json({ error: 'Ошибка при сохранении файла в облако: ' + error.message });
            }

            // Get public URL
            const { data: publicUrlData } = supabase
                .storage
                .from(BUCKET_NAME)
                .getPublicUrl(fileName);

            const publicUrl = publicUrlData.publicUrl;
            console.log(`[UPLOAD] File saved to Supabase: ${publicUrl}`);

            // Return the full HTTPS URL
            res.json({ path: publicUrl });

        } catch (uploadError) {
            console.error('[UPLOAD] Catch block error:', uploadError);
            res.status(500).json({ error: 'Системная ошибка облака' });
        }
    });
};

const deleteImage = async (req, res) => {
    const fileNameOrUrl = req.body.fileName;
    if (!fileNameOrUrl) return res.status(400).json({ error: 'Имя файла не указано' });

    try {
        // Extract filename from URL if a full URL was passed
        let fileName = fileNameOrUrl;
        if (fileNameOrUrl.includes(BUCKET_NAME)) {
            const parts = fileNameOrUrl.split('/');
            fileName = parts[parts.length - 1];
        }

        const { error } = await supabase
            .storage
            .from(BUCKET_NAME)
            .remove([fileName]);

        if (error) {
            console.error('[DELETE] Supabase Error:', error);
            return res.status(500).json({ error: 'Ошибка при удалении файла из облака' });
        }

        res.json({ success: true });
    } catch (err) {
        console.error('[DELETE] Catch block error:', err);
        res.status(500).json({ error: 'Системная ошибка при удалении' });
    }
};

module.exports = { uploadImage, deleteImage };
