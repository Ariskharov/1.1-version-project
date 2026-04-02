require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pg = require('pg');
const supabase = require('./src/utils/supabaseClient');

const BUCKET_NAME = 'furniture';
const frontendDir = path.join(__dirname, '../frontend/public/utilse');

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL
});

async function migrateImages() {
    console.log('Начинаем миграцию изображений в Supabase...');

    try {
        const { rows: products } = await pool.query('SELECT id, title, img FROM product WHERE img IS NOT NULL AND img != \'\'');
        
        for (const product of products) {
            // Если ссылка уже HTTPS, пропускаем
            if (product.img.startsWith('http')) {
                console.log(`[Пропуск] ID: ${product.id} уже имеет внешний URL: ${product.img}`);
                continue;
            }

            // Ищем файл на диске
            let fileName = product.img.replace('utilse/', '').replace('/utilse/', '');
            let filePath = path.join(frontendDir, fileName);
            
            // Если файла нет в frontend/public/utilse, возможно он в backend/uploads
            if (!fs.existsSync(filePath)) {
                filePath = path.join(__dirname, 'uploads', fileName);
            }

            if (!fs.existsSync(filePath)) {
                console.warn(`[Внимание] Файл не найден для ID: ${product.id} по пути: ${filePath}`);
                continue;
            }

            const fileBuffer = fs.readFileSync(filePath);
            const ext = path.extname(fileName);
            // Генерируем чистое латинское имя, чтобы избежать проблем с кириллицей
            const safeName = `product_${product.id}_${Date.now()}${ext}`;

            console.log(`Загрузка ID: ${product.id} -> ${safeName}`);

            const { data, error } = await supabase.storage.from(BUCKET_NAME).upload(safeName, fileBuffer, {
                contentType: 'image/' + ext.replace('.', ''),
                upsert: true
            });

            if (error) {
                console.error(`[Ошибка Supabase] ID ${product.id}:`, error);
                continue;
            }

            const { data: publicUrlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(safeName);
            const publicUrl = publicUrlData.publicUrl;

            await pool.query('UPDATE product SET img = $1 WHERE id = $2', [publicUrl, product.id]);
            console.log(`[Успех] ID ${product.id} обновлен в БД: ${publicUrl}`);
        }
    } catch (err) {
        console.error('Ошибка скрипта:', err);
    } finally {
        await pool.end();
        console.log('Миграция завершена.');
    }
}

migrateImages();
