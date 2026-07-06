require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('./src/database/pg');

async function migrate() {
    try {
        console.log('Подключение к PostgreSQL...');
        await pool.query('SELECT 1');
        console.log('Успешное подключение!');

        // 1. Создание реляционных таблиц (с отдельными столбцами)
        const schema = [
            `DROP TABLE IF EXISTS "users";`,
            `CREATE TABLE "users" (
                "id" SERIAL PRIMARY KEY,
                "email" TEXT,
                "password" TEXT,
                "login" TEXT,
                "fullName" TEXT,
                "avatar" TEXT,
                "role" TEXT,
                "badgeId" TEXT
            );`,
            `DROP TABLE IF EXISTS "workSessions";`,
            `CREATE TABLE "workSessions" (
                "id" SERIAL PRIMARY KEY,
                "userId" INTEGER,
                "date" TEXT,
                "startTime" TEXT,
                "endTime" TEXT,
                "durationMinutes" INTEGER,
                "status" TEXT,
                "editedBy" INTEGER
            );`,
            `DROP TABLE IF EXISTS "product";`,
            `CREATE TABLE "product" (
                "id" SERIAL PRIMARY KEY,
                "img" TEXT,
                "title" TEXT,
                "variables" JSONB,
                "conditions" JSONB,
                "details" JSONB,
                "details_statik" JSONB,
                "price" TEXT
            );`,
            `DROP TABLE IF EXISTS "order";`,
            `CREATE TABLE "order" (
                "id" SERIAL PRIMARY KEY,
                "name_client" TEXT,
                "name_compony" TEXT,
                "address" TEXT,
                "order_note" TEXT,
                "description_for_order" TEXT,
                "order_color" TEXT,
                "product_order" JSONB,
                "subtotal" NUMERIC,
                "discountAmount" NUMERIC,
                "taxAmount" NUMERIC,
                "total" NUMERIC,
                "status" TEXT,
                "createdAt" TEXT
            );`
        ];

        for (const query of schema) {
            await pool.query(query);
        }
        console.log('Красивые реляционные таблицы созданы.');

        // 2. Чтение оригинального db.json
        const dbPath = path.join(__dirname, 'db.json');
        if (!fs.existsSync(dbPath)) {
            console.log('Файл db.json не найден.');
            process.exit(0);
        }

        const rawData = fs.readFileSync(dbPath, 'utf8');
        const db = JSON.parse(rawData);

        // 3. Динамическая вставка по столбцам
        const tables = ['users', 'workSessions', 'product', 'order'];

        for (const tableName of tables) {
            const items = db[tableName] || [];
            if (items.length > 0) {
                
                // Проверяем и назначаем id, если их нет
                let maxId = 0;
                for (const item of items) {
                    if (item.id && Number(item.id) > maxId) maxId = Number(item.id);
                }
                let nextId = maxId + 1;

                for (let item of items) {
                    if (!item.id) item.id = nextId++;

                    // Собираем колонки из ключей объекта, кроме внутренних свойств (если есть)
                    const keys = Object.keys(item);
                    
                    // Превращаем поля JSON (массивы, объекты) в строки JSON перед вставкой
                    const values = keys.map(k => {
                        const val = item[k];
                        if (val !== null && typeof val === 'object') {
                            return JSON.stringify(val);
                        }
                        return val;
                    });

                    // Динамическая строка SQL `INSERT INTO table ("col1", "col2") VALUES ($1, $2)`
                    const colsString = keys.map(k => `"${k}"`).join(', ');
                    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
                    
                    // Формируем блок ON CONFLICT DO UPDATE для решения проблем с дубликатами
                    const updateString = keys.filter(k => k !== 'id').map(k => `"${k}" = EXCLUDED."${k}"`).join(', ');

                    const sql = `
                        INSERT INTO "${tableName}" (${colsString}) 
                        VALUES (${placeholders})
                        ${updateString ? 'ON CONFLICT ("id") DO UPDATE SET ' + updateString : ''}
                    `;
                    
                    await pool.query(sql, values);
                }

                // Обновляем автоинкремент (чтобы база продолжала давать правильные ID)
                await pool.query(
                    `SELECT setval(pg_get_serial_sequence('"${tableName}"', 'id'), coalesce(max(id), 0) + 1, false) FROM "${tableName}";`
                );
                
                console.log(`Таблица ${tableName}: мигрировано ${items.length} записей.`);
            }
        }

        console.log('Красивая миграция успешно завершена!');
    } catch (err) {
        console.error('Ошибка в скрипте миграции:', err);
    } finally {
        await pool.end();
        process.exit();
    }
}

migrate();
