const express = require('express');
const pool = require('../database/pg');
const { buildOrderRequest } = require('../utils/orderRequest');
const { isPublicToken, newPublicToken } = require('../utils/publicToken');
const { consumeRequestSlot } = require('../utils/requestRate');
const { notifyOrderRequest } = require('../services/pushService');

const router = express.Router();

const tableColumns = async (tableName) => {
    const res = await pool.query(`SELECT * FROM "${tableName}" WHERE 1=0`);
    return res.fields.map((field) => field.name);
};

router.get('/order-card/:token/stamp', async (req, res) => {
    const token = String(req.params.token || '');
    if (!isPublicToken(token)) {
        return res.status(404).json({ error: 'Заявка не найдена' });
    }
    try {
        const result = await pool.query(
            'SELECT id::text || \':\' || xmin::text AS stamp FROM "order" WHERE public_token = $1',
            [token]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'Заявка не найдена' });
        res.set('Cache-Control', 'no-store');
        return res.json({ stamp: result.rows[0].stamp });
    } catch (err) {
        if (err.code === '42703') return res.status(404).json({ error: 'Заявка не найдена' });
        console.error('order-card stamp error:', err.message);
        return res.status(500).json({ error: 'Не удалось открыть заявку' });
    }
});

router.get('/order-card/:token', async (req, res) => {
    const token = String(req.params.token || '');
    if (!isPublicToken(token)) {
        return res.status(404).json({ error: 'Заявка не найдена' });
    }
    try {
        const result = await pool.query('SELECT * FROM "order" WHERE public_token = $1', [token]);
        if (!result.rows.length) return res.status(404).json({ error: 'Заявка не найдена' });
        res.set('Cache-Control', 'no-store');
        return res.json(result.rows[0]);
    } catch (err) {
        if (err.code === '42703') return res.status(404).json({ error: 'Заявка не найдена' });
        console.error('order-card error:', err.message);
        return res.status(500).json({ error: 'Не удалось открыть заявку' });
    }
});

router.post('/order-request', async (req, res) => {
    try {
        const body = req.body || {};
        if (String(body.company_url_confirm || '').trim()) {
            const trap = await consumeRequestSlot(req);
            if (trap.limited) {
                return res.status(429).json({ error: 'Слишком много заявок. Попробуйте через час.' });
            }
            return res.json({ ok: true });
        }

        const rawItems = Array.isArray(body.positions) ? body.positions : [];
        const productIds = [...new Set(
            rawItems
                .map((item) => Number(item?.productId))
                .filter((id) => Number.isInteger(id) && id > 0)
        )];

        let products = [];
        if (productIds.length) {
            try {
                const found = await pool.query(
                    `SELECT id, title, price, img, variables, conditions, details
                     FROM "product" WHERE id = ANY($1::int[])`,
                    [productIds]
                );
                products = found.rows;
            } catch (lookupErr) {
                const found = await pool.query(
                    'SELECT id, title, price, img FROM "product" WHERE id = ANY($1::int[])',
                    [productIds]
                );
                products = found.rows;
                console.error('order-request product lookup fallback:', lookupErr.message);
            }
        }

        const built = buildOrderRequest(body, products);
        if (built.error) return res.status(400).json({ error: built.error });

        const slot = await consumeRequestSlot(req);
        if (slot.limited) {
            return res.status(429).json({ error: 'Слишком много заявок. Попробуйте через час.' });
        }

        const columns = await tableColumns('order');
        const data = { ...built.record };
        if (columns.includes('public_token')) data.public_token = newPublicToken();
        const keys = Object.keys(data).filter((key) => columns.includes(key));
        const values = keys.map((key) => {
            const value = data[key];
            return value !== null && typeof value === 'object' ? JSON.stringify(value) : value;
        });

        const cols = keys.map((key) => `"${key}"`).join(', ');
        const placeholders = keys.map((_, index) => `$${index + 1}`).join(', ');
        const returning = columns.includes('public_token')
            ? 'id, status, public_token'
            : 'id, status';
        const insert = await pool.query(
            `INSERT INTO "order" (${cols}) VALUES (${placeholders}) RETURNING ${returning}`,
            values
        );

        const row = insert.rows[0];
        try {
            await notifyOrderRequest({
                id: row.id,
                name_client: data.name_client,
                product_order: data.product_order,
            });
        } catch (pushErr) {
            console.error('[push] order request notify failed:', pushErr.message);
        }

        return res.status(201).json({
            id: row.id,
            status: row.status || 'Заявка',
            publicToken: row.public_token || null,
        });
    } catch (err) {
        console.error('order-request error:', err.message);
        return res.status(500).json({ error: 'Не удалось сохранить заявку' });
    }
});

module.exports = router;
