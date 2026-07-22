/**
 * Запуск SQL-миграций из backend/migrations (по имени файла).
 * Использование: node backend/scripts/run-migration.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const pool = require('../src/database/pg');

async function main() {
    const dir = path.join(__dirname, '../migrations');
    const files = fs
        .readdirSync(dir)
        .filter((f) => f.endsWith('.sql'))
        .sort();

    if (!files.length) {
        console.log('Нет SQL-файлов в migrations/');
        await pool.end();
        return;
    }

    for (const file of files) {
        const sqlPath = path.join(dir, file);
        const sql = fs.readFileSync(sqlPath, 'utf8');
        await pool.query(sql);
        console.log(`Миграция ${file} — OK`);
    }

    await pool.end();
}

main().catch((err) => {
    console.error('Ошибка миграции:', err.message);
    process.exit(1);
});
