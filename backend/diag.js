require('dotenv').config();
const pool = require('./src/database/pg');

(async () => {
    try {
        const res = await pool.query('SELECT * FROM "product" WHERE 1=0');
        console.log('fields:', res.fields.map(f => f.name));
    } catch(e) {
        console.error('Error:', e.message);
    } finally {
        await pool.end();
    }
})();
