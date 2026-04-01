require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function encryptEmir() {
    try {
        // У emir пароль 1234, шифруем его
        const hashedPassword = bcrypt.hashSync('1234', 10);
        await pool.query(`UPDATE "users" SET password = $1 WHERE login = 'emir'`, [hashedPassword]);
        console.log('✅ Пароль emir успешно зашифрован в базе данных!');
    } catch (err) {
        console.error('Ошибка:', err.message);
    } finally {
        await pool.end();
    }
}

encryptEmir();
