const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const { listLogs } = require('../services/serverLog');

const router = express.Router();

router.get('/server-logs', authenticate, requireRole('admin', 'it'), async (req, res) => {
    try {
        const rows = await listLogs({
            level: String(req.query.level || ''),
            limit: req.query.limit,
        });
        res.set('Cache-Control', 'no-store');
        res.json(rows);
    } catch (err) {
        console.error('[server-log] list', err.message);
        res.status(500).json({ error: 'Не удалось прочитать журнал' });
    }
});

module.exports = router;
