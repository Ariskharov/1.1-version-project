const pool = require('../database/pg');

const LIMIT = 5;

function clientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    const raw = Array.isArray(forwarded) ? forwarded[0] : String(forwarded || req.ip || '');
    const ip = raw.split(',')[0].trim().slice(0, 80);
    return ip || 'unknown';
}

/**
 * Пять заявок в час с одного адреса. Если таблицы ещё нет, заявку не блокируем.
 * Счётчик растёт и на срабатывании ловушки для ботов.
 */
async function consumeRequestSlot(req) {
    const ip = clientIp(req);
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1)::bigint)', [`request:${ip}`]);
        await client.query(`DELETE FROM request_hits WHERE created_at < NOW() - INTERVAL '2 hours'`);
        const count = await client.query(
            `SELECT COUNT(*)::int AS n
             FROM request_hits
             WHERE ip = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
            [ip]
        );
        if ((count.rows[0]?.n || 0) >= LIMIT) {
            await client.query('COMMIT');
            return { limited: true };
        }
        await client.query('INSERT INTO request_hits (ip) VALUES ($1)', [ip]);
        await client.query('COMMIT');
        return { limited: false };
    } catch (err) {
        try { await client.query('ROLLBACK'); } catch { /* транзакция уже закрыта */ }
        console.error('[rate] request limit skipped:', err.message);
        return { limited: false };
    } finally {
        client.release();
    }
}

module.exports = { consumeRequestSlot };
