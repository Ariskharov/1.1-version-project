const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Требуется для Supabase и многих облачных БД
});

module.exports = pool;
