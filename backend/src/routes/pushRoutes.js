const express = require('express');
const jwt = require('jsonwebtoken');
const { authenticate } = require('../middleware/auth');
const {
    getPublicKey,
    saveSubscription,
    removeSubscription,
    ensureConfigured,
} = require('../services/pushService');

const router = express.Router();

router.get('/push/vapid-public-key', (req, res) => {
    const key = getPublicKey();
    if (!key) {
        return res.status(503).json({ error: 'Push not configured' });
    }
    res.json({ publicKey: key, enabled: ensureConfigured() });
});

const actorId = (req) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return null;
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        const id = Number(decoded.id);
        return Number.isInteger(id) && id > 0 ? id : null;
    } catch {
        return null;
    }
};

router.post('/push/subscribe', async (req, res) => {
    try {
        const { subscription } = req.body || {};
        if (!subscription?.endpoint || !subscription?.keys) {
            return res.status(400).json({ error: 'subscription required' });
        }
        const saved = await saveSubscription({
            endpoint: subscription.endpoint,
            keys: subscription.keys,
            userId: actorId(req),
            userAgent: req.headers['user-agent'] || null,
        });
        res.json({ success: true, id: saved.id });
    } catch (err) {
        console.error('[push] subscribe error:', err.message);
        res.status(500).json({ error: err.message || 'Subscribe failed' });
    }
});

router.post('/push/unsubscribe', async (req, res) => {
    try {
        const endpoint = req.body?.endpoint || req.body?.subscription?.endpoint;
        if (!endpoint) {
            return res.status(400).json({ error: 'endpoint required' });
        }
        await removeSubscription(endpoint);
        res.json({ success: true });
    } catch (err) {
        console.error('[push] unsubscribe error:', err.message);
        res.status(500).json({ error: 'Unsubscribe failed' });
    }
});

/** Тестовая отправка только для администратора */
router.post('/push/test', authenticate, async (req, res) => {
    try {
        if (String(req.userRole || '').toLowerCase() !== 'admin') {
            return res.status(403).json({ error: 'Access denied' });
        }
        const { notifyAnnouncement } = require('../services/pushService');
        const result = await notifyAnnouncement({
            id: 'test',
            title: req.body?.title || 'Тест уведомления',
            message: req.body?.message || 'Если вы видите это — push работает',
            type: 'urgent',
            isActive: true,
        });
        res.json(result);
    } catch (err) {
        console.error('[push] test error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
