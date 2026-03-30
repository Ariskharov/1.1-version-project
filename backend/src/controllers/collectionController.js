const pool = require('../database/pg');

// Более надежный способ получить колонки - просто попытаться зачитать 0 строк из таблицы
const getTableColumns = async (tableName) => {
    try {
        const res = await pool.query(`SELECT * FROM "${tableName}" WHERE 1=0`);
        const columns = res.fields.map(field => field.name);
        console.log(`[DEBUG] Detected columns for ${tableName}:`, columns);
        return columns;
    } catch (e) {
        console.error(`[DEBUG] Error getting columns for ${tableName}:`, e.message);
        return [];
    }
};

const getCollection = async (req, res) => {
    try {
        const collection = req.params.collection;
        const result = await pool.query(`SELECT * FROM "${collection}" ORDER BY id ASC`);
        res.json(result.rows);
    } catch (err) {
        console.error('getCollection error:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

const getCollectionItem = async (req, res) => {
    try {
        const collection = req.params.collection;
        const id = Number(req.params.id);
        const result = await pool.query(`SELECT * FROM "${collection}" WHERE id = $1`, [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({});
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('getCollectionItem error:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

const createCollectionItem = async (req, res) => {
    try {
        const collection = req.params.collection;
        const availableColumns = await getTableColumns(collection);
        
        const filteredData = {};
        Object.keys(req.body).forEach(key => {
            // Исключаем 'id' — PostgreSQL сам генерирует ID через SERIAL
            // Также пропускаем поля, которых нет в таблице
            if (key !== 'id' && availableColumns.includes(key)) {
                filteredData[key] = req.body[key];
            }
        });
        console.log(`[DEBUG] Keys being inserted (id excluded):`, Object.keys(filteredData));

        const keys = Object.keys(filteredData);
        const values = keys.map(k => {
            const val = filteredData[k];
            return (val !== null && typeof val === 'object') ? JSON.stringify(val) : val;
        });

        let sql;
        if (keys.length === 0) {
            sql = `INSERT INTO "${collection}" DEFAULT VALUES RETURNING *`;
        } else {
            const colsString = keys.map(k => `"${k}"`).join(', ');
            const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
            sql = `INSERT INTO "${collection}" (${colsString}) VALUES (${placeholders}) RETURNING *`;
        }
        
        console.log(`[DEBUG] Executing INSERT on ${collection}. Keys:`, keys);
        
        try {
            const insertRes = await pool.query(sql, values);
            res.json(insertRes.rows[0]);
        } catch (dbErr) {
            console.error(`[DB INSERT ERROR] Table: ${collection}, SQL: ${sql}, Values:`, values, dbErr.message);
            res.status(400).json({ error: dbErr.message });
        }
    } catch (err) {
        console.error('createCollectionItem error:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

const updateCollectionItem = async (req, res) => {
    try {
        const collection = req.params.collection;
        const id = Number(req.params.id);
        const availableColumns = await getTableColumns(collection);

        const keys = Object.keys(req.body).filter(k => k !== 'id' && availableColumns.includes(k));
        
        if (keys.length === 0) {
            console.log(`[DEBUG] No valid keys for update in ${collection}. Available:`, availableColumns);
            const result = await pool.query(`SELECT * FROM "${collection}" WHERE id = $1`, [id]);
            return res.json(result.rows[0] || {});
        }

        const values = keys.map(k => {
            const val = req.body[k];
            return (val !== null && typeof val === 'object') ? JSON.stringify(val) : val;
        });

        const setString = keys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
        values.push(id);

        const sql = `UPDATE "${collection}" SET ${setString} WHERE id = $${values.length} RETURNING *`;
        
        console.log(`[DEBUG] Executing UPDATE on ${collection} ID ${id}. Keys:`, keys);

        try {
            const result = await pool.query(sql, values);
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Не найдено' });
            }
            res.json(result.rows[0]);
        } catch (dbErr) {
            console.error(`[DB UPDATE ERROR] Table: ${collection}, ID: ${id}, SQL: ${sql}`, dbErr.message);
            res.status(400).json({ error: dbErr.message });
        }
    } catch (err) {
        console.error('updateCollectionItem error:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

const deleteCollectionItem = async (req, res) => {
    try {
        const collection = req.params.collection;
        const id = Number(req.params.id);
        await pool.query(`DELETE FROM "${collection}" WHERE id = $1`, [id]);
        res.json({ success: true });
    } catch (err) {
        console.error('deleteCollectionItem error:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

module.exports = {
    getCollection,
    getCollectionItem,
    createCollectionItem,
    updateCollectionItem,
    deleteCollectionItem
};
