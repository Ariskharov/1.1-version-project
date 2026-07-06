require('dotenv').config();
const pool = require('./src/database/pg');
const fs = require('fs');

(async () => {
    try {
        const db = JSON.parse(fs.readFileSync('./db.json', 'utf8'));
        console.log('Restoring img paths from db.json...');
        
        for (const product of db.product) {
            if (product.img) {
                // Normalize path: ensure it starts with /utilse/
                const imgPath = product.img.startsWith('/') ? product.img : `/${product.img}`;
                await pool.query(
                    'UPDATE "product" SET img = $1 WHERE id = $2',
                    [imgPath, product.id]
                );
                console.log(`Restored ID ${product.id}: ${imgPath}`);
            }
        }
        
        console.log('Done!');
    } catch(e) {
        console.error('Error:', e.message);
    } finally {
        await pool.end();
    }
})();
