require('dotenv').config();
const pool = require('./src/database/pg');

async function checkProducts() {
    try {
        const res = await pool.query('SELECT id, title, img FROM product ORDER BY id ASC LIMIT 14');
        console.log(res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        pool.end();
    }
}
checkProducts();
