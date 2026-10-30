const webpush = require('web-push');
const pool = require('../database/pg');

const DEFAULT_VAPID_PUBLIC_KEY = 'BMCa1KFzwCinml2K6JTMNoYDUu8LVYwxsKRZQNaXH5N6MGSs5c6ZKxWEbsfczBpHqpWrc9wDI5sfNz056Ec-GWc';
const DEFAULT_VAPID_PRIVATE_KEY = 'Gu6ZzM1aJm3z9WJKCcXezQqCongjTYY1BlNvGcwGTAI';
const DEFAULT_VAPID_SUBJECT = 'mailto:admin@timetrack.local';

let configured = false;

function ensureConfigured() {
    if (configured) return true;
    const publicKey = process.env.VAPID_PUBLIC_KEY || DEFAULT_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY || DEFAULT_VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || DEFAULT_VAPID_SUBJECT;

    if (!publicKey || !privateKey) {
        console.warn('[push] VAPID keys missing — push disabled');
        return false;
    }
    try {
        webpush.setVapidDetails(subject, publicKey, privateKey);
        configured = true;
        return true;
    } catch (err) {
        console.warn('[push] Failed to set VAPID details:', err.message);
        return false;
    }
}

function getPublicKey() {
    return process.env.VAPID_PUBLIC_KEY || DEFAULT_VAPID_PUBLIC_KEY;
}

async function ensureTable() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS push_subscriptions (
            id SERIAL PRIMARY KEY,
            endpoint TEXT NOT NULL UNIQUE,
            p256dh TEXT NOT NULL,
            auth TEXT NOT NULL,
            "userId" INTEGER NULL,
            "userAgent" TEXT NULL,
            "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);
}

async function saveSubscription({ endpoint, keys, userId, userAgent }) {
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
        throw new Error('Invalid subscription');
    }
    await ensureTable();
    const result = await pool.query(
        `INSERT INTO push_subscriptions (endpoint, p256dh, auth, "userId", "userAgent", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (endpoint) DO UPDATE SET
           p256dh = EXCLUDED.p256dh,
           auth = EXCLUDED.auth,
           "userId" = COALESCE(EXCLUDED."userId", push_subscriptions."userId"),
           "userAgent" = EXCLUDED."userAgent",
           "updatedAt" = NOW()
         RETURNING id, endpoint, "userId"`,
        [endpoint, keys.p256dh, keys.auth, userId ?? null, userAgent || null]
    );
    return result.rows[0];
}

async function removeSubscription(endpoint) {
    if (!endpoint) return;
    await ensureTable();
    await pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [endpoint]);
}

async function listSubscriptions() {
    await ensureTable();
    const result = await pool.query(
        'SELECT id, endpoint, p256dh, auth, "userId" FROM push_subscriptions ORDER BY id ASC'
    );
    return result.rows;
}

function buildAnnouncementPayload(announcement) {
    const typeLabel = announcement.type === 'persistent' ? 'Актуально' : 'Срочно';
    const title = announcement.title
        ? `${typeLabel}: ${announcement.title}`
        : `${typeLabel} — объявление`;
    const body = String(announcement.message || '').slice(0, 180);
    return {
        title,
        body,
        url: '/cabinet',
        tag: `announcement-${announcement.id || Date.now()}`,
        type: announcement.type || 'urgent',
        announcementId: announcement.id || null,
    };
}

async function listAdminSubscriptions() {
    await ensureTable();
    const result = await pool.query(
        `SELECT s.id, s.endpoint, s.p256dh, s.auth, s."userId"
         FROM push_subscriptions s
         INNER JOIN "users" u ON u.id = s."userId"
         WHERE lower(u.role) = 'admin'`
    );
    return result.rows;
}

function positionWord(count) {
    const n = Math.abs(Number(count) || 0) % 100;
    const n1 = n % 10;
    if (n > 10 && n < 20) return 'позиций';
    if (n1 > 1 && n1 < 5) return 'позиции';
    if (n1 === 1) return 'позиция';
    return 'позиций';
}

function buildOrderRequestPayload(order) {
    const positions = Array.isArray(order.product_order) ? order.product_order : [];
    const needsPrice = positions.some((line) => {
        const price = Number(line?.price);
        return !Number.isFinite(price) || price === 0;
    });
    const name = String(order.name_client || 'Клиент').trim().slice(0, 80) || 'Клиент';
    const count = positions.length;
    const pieces = [`${name}`, count ? `${count} ${positionWord(count)}` : 'без позиций'];
    if (needsPrice) pieces.push('Нужна цена');
    return {
        title: 'Новая заявка',
        body: pieces.join(' · ').slice(0, 180),
        url: `/order/${order.id}`,
        tag: `order-request-${order.id}`,
        type: 'request',
    };
}

async function deliver(subs, payload) {
    if (!subs.length) return { sent: 0, failed: 0, total: 0 };
    const data = JSON.stringify(payload);
    let sent = 0;
    let failed = 0;

    await Promise.all(
        subs.map(async (sub) => {
            const pushSubscription = {
                endpoint: sub.endpoint,
                keys: { p256dh: sub.p256dh, auth: sub.auth },
            };
            try {
                await webpush.sendNotification(pushSubscription, data, {
                    TTL: 60 * 60 * 12,
                    urgency: payload.type === 'urgent' ? 'high' : 'normal',
                });
                sent += 1;
            } catch (err) {
                failed += 1;
                const status = err.statusCode || err.status;
                console.error('[push] send failed', status, err.message);
                if (status === 404 || status === 410) {
                    try {
                        await removeSubscription(sub.endpoint);
                    } catch (_) {
                        /* ignore */
                    }
                }
            }
        })
    );

    console.log(`[push] sent=${sent} failed=${failed} total=${subs.length}`);
    return { sent, failed, total: subs.length };
}

async function sendPushToAll(payload) {
    if (!ensureConfigured()) {
        return { sent: 0, failed: 0, skipped: true };
    }
    return deliver(await listSubscriptions(), payload);
}

async function notifyOrderRequest(order) {
    if (!order?.id) return { sent: 0 };
    if (!ensureConfigured()) return { sent: 0, failed: 0, skipped: true };
    try {
        const subs = await listAdminSubscriptions();
        return deliver(subs, buildOrderRequestPayload(order));
    } catch (err) {
        console.error('[push] admin subscriptions failed:', err.message);
        return { sent: 0, failed: 0, error: 'push failed' };
    }
}

async function notifyAnnouncement(announcement) {
    if (!announcement) return { sent: 0 };
    const active = announcement.isActive !== false && announcement.isactive !== false;
    if (!active) return { sent: 0, skipped: 'inactive' };

    const expires = announcement.expiresAt || announcement.expiresat;
    if (expires) {
        const end = new Date(expires);
        if (!Number.isNaN(end.getTime()) && end <= new Date()) {
            return { sent: 0, skipped: 'expired' };
        }
    }

    return sendPushToAll(buildAnnouncementPayload(announcement));
}

module.exports = {
    getPublicKey,
    ensureConfigured,
    ensureTable,
    saveSubscription,
    removeSubscription,
    notifyAnnouncement,
    notifyOrderRequest,
    sendPushToAll,
};
