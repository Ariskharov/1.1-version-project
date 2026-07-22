const express = require('express');
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

router.post('/push/subscribe', async (req, res) => {
    try {
        const { subscription, userId } = req.body || {};
        if (!subscription?.endpoint || !subscription?.keys) {
            return res.status(400).json({ error: 'subscription required' });
        }
        const saved = await saveSubscription({
            endpoint: subscription.endpoint,
            keys: subscription.keys,
            userId: userId != null ? Number(userId) : null,
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

/** Тестовая отправка (для проверки с админки) */
router.post('/push/test', async (req, res) => {
    try {
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
