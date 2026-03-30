require('dotenv').config();
const pool = require('./src/database/pg');

(async () => {
    try {
        // 1. Get first product (simulating 'selected' on frontend)
        const first = await pool.query('SELECT * FROM "product" LIMIT 1');
        const product = first.rows[0];
        console.log('Got product:', product.id, product.title);

        // 2. Simulate what frontend sends in PUT body (with img path added)
        const body = { ...product, img: '/utilse/test_photo.jpg' };
        console.log('Body keys:', Object.keys(body));
        
        // 3. Get table columns (same as controller)
        const colsRes = await pool.query('SELECT * FROM "product" WHERE 1=0');
        const availableColumns = colsRes.fields.map(f => f.name);
        console.log('Available columns:', availableColumns);

        // 4. Filter keys (same as controller logic)
        const keys = Object.keys(body).filter(k => k !== 'id' && availableColumns.includes(k));
        console.log('Keys to update:', keys);

        // 5. Build values (same as controller)
        const values = keys.map(k => {
            const val = body[k];
            return (val !== null && typeof val === 'object') ? JSON.stringify(val) : val;
        });

        const setString = keys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
        values.push(product.id);
        const sql = `UPDATE "product" SET ${setString} WHERE id = $${values.length} RETURNING id, img`;
        
        console.log('SQL:', sql.substring(0, 120));
        
        const result = await pool.query(sql, values);
        console.log('Result after update:', result.rows[0]);
    } catch(e) {
        console.error('ERROR:', e.message);
    } finally {
        await pool.end();
    }
})();
