const express = require('express');
const jwt = require('jsonwebtoken');
const pool = require('../database/pg');

const router = express.Router();

const PUBLIC_TABLES = ['product', 'announcements'];
const PRIVATE_TABLES = ['order', 'users', 'workSessions'];

// true — вход есть, false — гость, null — токен прислали, но он протух.
const accessOf = (req) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) return false;
    try {
        jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        return true;
    } catch {
        return null;
    }
};

async function revisionStamps(names) {
    const result = await pool.query(
        `SELECT name, rev::text AS rev
         FROM data_revision
         WHERE name = ANY($1::text[])`,
        [names]
    );
    if (!result.rows.length) {
        const err = new Error('data_revision empty');
        err.code = 'EMPTY';
        throw err;
    }
    const out = {};
    result.rows.forEach((row) => {
        out[row.name] = row.rev;
    });
    return out;
}

async function statStamps(names) {
    const result = await pool.query(
        `SELECT relname,
                (COALESCE(n_tup_ins, 0) + COALESCE(n_tup_upd, 0) + COALESCE(n_tup_del, 0))::text AS changes,
                COALESCE(n_live_tup, 0)::text AS live
         FROM pg_stat_user_tables
         WHERE relname = ANY($1::text[])`,
        [names]
    );
    const out = {};
    result.rows.forEach((row) => {
        out[row.relname] = `${row.live}:${row.changes}`;
    });
    names.forEach((name) => {
        if (!out[name]) out[name] = '0:0';
    });
    return out;
}

router.get('/sync', async (req, res) => {
    const access = accessOf(req);
    if (access === null) return res.status(401).json({ error: 'Invalid token' });

    const names = access ? PUBLIC_TABLES.concat(PRIVATE_TABLES) : PUBLIC_TABLES.slice();
    try {
        let stamps;
        try {
            stamps = await revisionStamps(names);
        } catch (err) {
            if (err.code !== '42P01' && err.code !== 'EMPTY') throw err;
            stamps = await statStamps(names);
        }
        res.set('Cache-Control', 'no-store');
        return res.json(stamps);
    } catch (err) {
        console.error('[sync]', err.message);
        return res.status(500).json({ error: 'sync failed' });
    }
});

module.exports = router;
