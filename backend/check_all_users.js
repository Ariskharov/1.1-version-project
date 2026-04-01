require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkAllUsers() {
    try {
        const res = await pool.query(`SELECT id, login, password FROM "users"`);
        console.log('Все пользователи в БД:');
        console.log(res.rows);
    } catch (err) {
        console.error('Ошибка:', err.message);
    } finally {
        await pool.end();
    }
}

checkAllUsers();
