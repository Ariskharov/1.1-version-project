const { LowSync } = require('lowdb');
const { JSONFileSync } = require('lowdb/node');
const path = require('path');

const file = path.join(__dirname, '../../db.json');
const adapter = new JSONFileSync(file);
const db = new LowSync(adapter, { product: [], users: [], workSessions: [], order: [] });

// Read data from JSON file
db.read();

// Ensure db.data has the required arrays
if (!db.data) {
    db.data = { product: [], users: [], workSessions: [], order: [] };
    db.write();
}

module.exports = db;
