require('dotenv').config();
const pool = require('./src/database/pg');

(async () => {
    try {
        // Fix paths like /https://... → https://...
        const result = await pool.query(`SELECT id, img FROM "product" WHERE img LIKE '/http%'`);
        console.log(`Found ${result.rows.length} products with broken absolute URLs`);
        
        for (const row of result.rows) {
            const fixedImg = row.img.replace(/^\//, ''); // Remove leading slash
            await pool.query('UPDATE "product" SET img = $1 WHERE id = $2', [fixedImg, row.id]);
            console.log(`Fixed ID ${row.id}: ${row.img} → ${fixedImg}`);
        }
        
        console.log('Done!');
    } catch(e) {
        console.error('Error:', e.message);
    } finally {
        await pool.end();
    }
})();
