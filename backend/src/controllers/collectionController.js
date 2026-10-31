const pool = require('../database/pg');
const { notifyAnnouncement } = require('../services/pushService');
const { shouldNotifyAnnouncement } = require('../services/pushMessages');
const { isPublicToken, newPublicToken } = require('../utils/publicToken');

const parseId = (value) => {
    const id = Number(value);
    if (!Number.isInteger(id) || id < 0) return null;
    return id;
};

const publicRow = (collection, row) => {
    if (!row || collection !== 'users') return row;
    const { password, ...safe } = row;
    return safe;
};

const withAnnouncementPush = async (row, shouldNotify) => {
    if (!shouldNotify || !row) return row;
    try {
        const push = await notifyAnnouncement(row);
        return { ...row, push };
    } catch (err) {
        console.error('[push] announcement notify failed:', err.message);
        return { ...row, push: { sent: 0, failed: 0, error: 'push failed' } };
    }
};

const columnCache = new Map();

// Колонки таблицы не меняются, пока процесс жив. Повторные сохранения не ходят в базу за списком.
const getTableColumns = async (tableName) => {
    if (columnCache.has(tableName)) return columnCache.get(tableName);
    try {
        const res = await pool.query(`SELECT * FROM "${tableName}" WHERE 1=0`);
        const names = res.fields.map(field => field.name);
        columnCache.set(tableName, names);
        return names;
    } catch (e) {
        console.error(`[DEBUG] Error getting columns for ${tableName}:`, e.message);
        return [];
    }
};

const getCollection = async (req, res) => {
    try {
        const collection = req.params.collection;
        const result = await pool.query(`SELECT * FROM "${collection}" ORDER BY id ASC`);
        res.set('Cache-Control', 'no-store');
        res.json(result.rows.map((row) => publicRow(collection, row)));
    } catch (err) {
        console.error('getCollection error:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

const getCollectionItem = async (req, res) => {
    try {
        const collection = req.params.collection;
        const id = parseId(req.params.id);
        if (id == null) return res.status(400).json({ error: 'Некорректный id' });
        const result = await pool.query(`SELECT * FROM "${collection}" WHERE id = $1`, [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({});
        }
        res.set('Cache-Control', 'no-store');
        res.json(publicRow(collection, result.rows[0]));
    } catch (err) {
        console.error('getCollectionItem error:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

const createCollectionItem = async (req, res) => {
    const collection = req.params.collection;
    let client;
    try {
        if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
            req.body = {};
        }
        client = await pool.connect();
        const availableColumns = await getTableColumns(collection);
        await client.query('BEGIN');

        // Два одновременных создания товара не должны получить один и тот же id.
        if (collection === 'product' && !req.body.id) {
            await client.query('LOCK TABLE "product" IN SHARE ROW EXCLUSIVE MODE');
            const maxRes = await client.query(`SELECT COALESCE(MAX(id), 0) + 1 as next_id FROM "product"`);
            req.body.id = maxRes.rows[0].next_id;
        }
        
        const filteredData = {};
        Object.keys(req.body).forEach(key => {
            if (availableColumns.includes(key)) {
                filteredData[key] = req.body[key];
            }
        });
        if (collection === 'order' && availableColumns.includes('public_token')) {
            filteredData.public_token = newPublicToken();
        }

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
        
        const insertRes = await client.query(sql, values);
        try {
            await client.query(`SELECT setval(pg_get_serial_sequence('"${collection}"', 'id'), (SELECT MAX(id) FROM "${collection}"))`);
        } catch (seqErr) {
            console.log(`[DEBUG] Sequence sync skipped for ${collection}: ${seqErr.message}`);
        }
        await client.query('COMMIT');

        let row = publicRow(collection, insertRes.rows[0]);
        if (collection === 'announcements') {
            row = await withAnnouncementPush(row, shouldNotifyAnnouncement(null, row));
        }
        res.json(row);
    } catch (err) {
        if (client) {
            try { await client.query('ROLLBACK'); } catch { /* транзакция уже закрыта */ }
        }
        console.error('createCollectionItem error:', err);
        const isDbError = Boolean(err.code && err.severity);
        res.status(isDbError ? 400 : 500).json({ error: isDbError ? err.message : 'Server error' });
    } finally {
        client?.release();
    }
};

const updateCollectionItem = async (req, res) => {
    try {
        const collection = req.params.collection;
        const id = parseId(req.params.id);
        if (id == null) return res.status(400).json({ error: 'Некорректный id' });
        if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
            req.body = {};
        }
        const availableColumns = await getTableColumns(collection);

        let notifyAfter = false;
        if (collection === 'announcements') {
            try {
                const prev = await pool.query('SELECT * FROM "announcements" WHERE id = $1', [id]);
                notifyAfter = shouldNotifyAnnouncement(prev.rows[0], req.body);
            } catch (prevErr) {
                console.error('[push] previous announcement read failed:', prevErr.message);
            }
        }

        const keys = Object.keys(req.body).filter((k) => {
            if (k === 'id' || !availableColumns.includes(k)) return false;
            if (k === 'public_token' && !isPublicToken(req.body[k])) return false;
            return true;
        });
        
        if (keys.length === 0) {
            console.log(`[DEBUG] No valid keys for update in ${collection}. Available:`, availableColumns);
            const result = await pool.query(`SELECT * FROM "${collection}" WHERE id = $1`, [id]);
            return res.json(publicRow(collection, result.rows[0]) || {});
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
            let row = publicRow(collection, result.rows[0]);
            row = await withAnnouncementPush(row, notifyAfter);
            res.json(row);
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
    const collection = req.params.collection;
    const id = parseId(req.params.id);
    if (id == null) return res.status(400).json({ error: 'Некорректный id' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        if (collection === 'users') {
            await client.query('DELETE FROM "workSessions" WHERE "userId" = $1', [id]);
            await client.query('SAVEPOINT push_cleanup');
            try {
                await client.query('DELETE FROM push_subscriptions WHERE "userId" = $1', [id]);
            } catch (subErr) {
                await client.query('ROLLBACK TO SAVEPOINT push_cleanup');
                if (subErr.code !== '42P01') throw subErr;
            }
        }

        const deleted = await client.query(`DELETE FROM "${collection}" WHERE id = $1 RETURNING id`, [id]);
        if (deleted.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Не найдено' });
        }
        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        try { await client.query('ROLLBACK'); } catch { /* транзакция уже закрыта */ }
        console.error('deleteCollectionItem error:', err);
        res.status(500).json({ error: 'Server error' });
    } finally {
        client.release();
    }
};

module.exports = {
    getCollection,
    getCollectionItem,
    createCollectionItem,
    updateCollectionItem,
    deleteCollectionItem
};
