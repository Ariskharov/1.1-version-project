const express = require('express');
const pool = require('../database/pg');
const { buildOrderRequest } = require('../utils/orderRequest');

const router = express.Router();

const tableColumns = async (tableName) => {
    const res = await pool.query(`SELECT * FROM "${tableName}" WHERE 1=0`);
    return res.fields.map((field) => field.name);
};

router.post('/order-request', async (req, res) => {
    try {
        const body = req.body || {};
        if (String(body.company_url_confirm || '').trim()) {
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

        const columns = await tableColumns('order');
        const data = built.record;
        const keys = Object.keys(data).filter((key) => columns.includes(key));
        const values = keys.map((key) => {
            const value = data[key];
            return value !== null && typeof value === 'object' ? JSON.stringify(value) : value;
        });

        const cols = keys.map((key) => `"${key}"`).join(', ');
        const placeholders = keys.map((_, index) => `$${index + 1}`).join(', ');
        const insert = await pool.query(
            `INSERT INTO "order" (${cols}) VALUES (${placeholders}) RETURNING id, status`,
            values
        );

        const row = insert.rows[0];
        res.status(201).json({ id: row.id, status: row.status || 'Заявка' });
    } catch (err) {
        console.error('order-request error:', err.message);
        res.status(500).json({ error: 'Не удалось сохранить заявку' });
    }
});

module.exports = router;
