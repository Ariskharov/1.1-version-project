require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkUser() {
    try {
        const res = await pool.query(`SELECT id, login, password FROM "users" WHERE login = 'emir'`);
        console.log('Пользователь emir в БД:');
        console.log(res.rows[0]);
    } catch (err) {
        console.error('Ошибка:', err.message);
    } finally {
        await pool.end();
    }
}

checkUser();
