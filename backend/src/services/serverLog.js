const pool = require('../database/pg');

let ready = null;

const ensureServerLog = () => {
    if (!ready) {
        ready = pool.query(`
            CREATE TABLE IF NOT EXISTS server_logs (
                id bigserial PRIMARY KEY,
                created_at timestamptz NOT NULL DEFAULT now(),
                level text NOT NULL,
                event text NOT NULL,
                message text NOT NULL,
                method text,
                path text,
                status integer,
                actor text
            )
        `).then(() => pool.query(`
            CREATE INDEX IF NOT EXISTS server_logs_created_at_idx
            ON server_logs (created_at DESC)
        `)).catch((err) => {
            ready = null;
            throw err;
        });
    }
    return ready;
};

let writes = 0;

const prune = async () => {
    await pool.query(`
        DELETE FROM server_logs
        WHERE id < (
            SELECT id FROM server_logs ORDER BY id DESC OFFSET 1200 LIMIT 1
        )
    `);
};

const record = async (entry) => {
    try {
        await ensureServerLog();
        await pool.query(
            `INSERT INTO server_logs (level, event, message, method, path, status, actor)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
                String(entry.level || 'event').slice(0, 20),
                String(entry.event || 'event').slice(0, 40),
                String(entry.message || '').slice(0, 500),
                entry.method ? String(entry.method).slice(0, 12) : null,
                entry.path ? String(entry.path).slice(0, 240) : null,
                Number.isInteger(entry.status) ? entry.status : null,
                entry.actor ? String(entry.actor).slice(0, 80) : null,
            ]
        );
        writes += 1;
        if (writes % 25 === 0) await prune();
    } catch (err) {
        console.error('[server-log]', err.message);
    }
};

const listLogs = async ({ level, limit }) => {
    await ensureServerLog();
    const size = Math.min(300, Math.max(1, Number(limit) || 150));
    const params = [size];
    let where = '';
    if (level === 'problem') {
        where = `WHERE level IN ('error', 'warn')`;
    } else if (level === 'event' || level === 'error' || level === 'warn') {
        params.push(level);
        where = `WHERE level = $2`;
    }
    const result = await pool.query(
        `SELECT id, created_at, level, event, message, method, path, status, actor
         FROM server_logs
         ${where}
         ORDER BY id DESC
         LIMIT $1`,
        params
    );
    return result.rows;
};

module.exports = { ensureServerLog, record, listLogs };
