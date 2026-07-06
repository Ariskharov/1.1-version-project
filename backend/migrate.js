require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('./src/database/pg');

async function migrate() {
    try {
        console.log('Подключение к PostgreSQL...');
        await pool.query('SELECT 1'); // Проверка подключения
        console.log('Успешное подключение!');

        // 1. Создание таблиц
        const tables = ['users', 'workSessions', 'product', 'order'];
        
        for (const tableName of tables) {
            // Для совместимости с текущим NoSQL-подходом мы сделаем колонку data типа JSONB
            await pool.query(`
                CREATE TABLE IF NOT EXISTS "${tableName}" (
                    id SERIAL PRIMARY KEY,
                    data JSONB NOT NULL
                );
            `);
            // Очищаем таблицу перед миграцией, если она уже существует
            await pool.query(`TRUNCATE TABLE "${tableName}" RESTART IDENTITY;`);
        }
        console.log('Таблицы созданы.');

        // 2. Чтение db.json
        const dbPath = path.join(__dirname, 'db.json');
        if (!fs.existsSync(dbPath)) {
            console.log('Файл db.json не найден, нечего мигрировать.');
            process.exit(0);
        }

        const rawData = fs.readFileSync(dbPath, 'utf8');
        const db = JSON.parse(rawData);

        // 3. Перенос данных
        for (const tableName of tables) {
            const items = db[tableName] || [];
            
            if (items.length > 0) {
                let maxId = 0;
                for (const item of items) {
                    if (item.id && item.id > maxId) maxId = item.id;
                }
                
                let nextId = maxId + 1;

                for (let i = 0; i < items.length; i++) {
                    const item = items[i];
                    if (!item.id) {
                        item.id = nextId++;
                    }

                    await pool.query(
                        `INSERT INTO "${tableName}" (id, data) VALUES ($1, $2)
                         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
                        [item.id, JSON.stringify(item)]
                    );
                }
                
                // Обновляем счетчик автоинкремента, чтобы новые записи получали правильные ID
                await pool.query(
                    `SELECT setval(pg_get_serial_sequence('"${tableName}"', 'id'), coalesce(max(id), 0) + 1, false) FROM "${tableName}";`
                );
            }
            console.log(`Таблица ${tableName}: мигрировано ${items.length} записей.`);
        }

        console.log('Миграция успешно завершена!');
    } catch (err) {
        console.error('Ошибка во время миграции:', err);
    } finally {
        await pool.end();
        process.exit();
    }
}

migrate();
