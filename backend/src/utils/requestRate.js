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
    try {
        await pool.query(`DELETE FROM request_hits WHERE created_at < NOW() - INTERVAL '2 hours'`);
        const count = await pool.query(
            `SELECT COUNT(*)::int AS n
             FROM request_hits
             WHERE ip = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
            [ip]
        );
        if ((count.rows[0]?.n || 0) >= LIMIT) return { limited: true };
        await pool.query('INSERT INTO request_hits (ip) VALUES ($1)', [ip]);
        return { limited: false };
    } catch (err) {
        console.error('[rate] request limit skipped:', err.message);
        return { limited: false };
    }
}

module.exports = { consumeRequestSlot };
