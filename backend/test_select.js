require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkLoginEndpoint() {
    try {
        const arifResult = await pool.query(`SELECT * FROM "users" WHERE "email" = $1 OR "login" = $1 OR "fullName" = $1`, ['arif']);
        console.log('Arif rows:', arifResult.rows);

        const emirResult = await pool.query(`SELECT * FROM "users" WHERE "email" = $1 OR "login" = $1 OR "fullName" = $1`, ['emir']);
        console.log('Emir rows:', emirResult.rows);
    } catch (err) {
        console.error('Ошибка:', err.message);
    } finally {
        await pool.end();
    }
}

checkLoginEndpoint();
