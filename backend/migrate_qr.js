require('dotenv').config();
const pool = require('./src/database/pg');

async function run() {
    try {
        console.log('Running migration to add source column...');
        await pool.query('ALTER TABLE "workSessions" ADD COLUMN IF NOT EXISTS source TEXT DEFAULT \'manual\';');
        console.log('Migration completed successfully!');
    } catch (e) {
        console.error('Migration failed:', e);
    } finally {
        await pool.end();
    }
}
run();
