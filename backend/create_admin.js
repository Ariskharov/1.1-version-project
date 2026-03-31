require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function createAdmin() {
    const login = 'arif';
    const password = '0000';
    const role = 'admin';
    const fullName = 'Arif Admin';

    const hashedPassword = bcrypt.hashSync(password, 10);

    try {
        const res = await pool.query(
            `INSERT INTO "users" (login, email, password, role, "fullName")
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, login, email, role, "fullName"`,
            [login, login + '@admin.local', hashedPassword, role, fullName]
        );
        console.log('✅ Админ создан успешно:');
        console.log(res.rows[0]);
    } catch (err) {
        console.error('❌ Ошибка:', err.message);
    } finally {
        await pool.end();
    }
}

createAdmin();
