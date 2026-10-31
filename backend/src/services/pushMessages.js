const norm = (value) => (value == null ? '' : String(value));

const isActiveFlag = (value, fallback) => {
    if (value === undefined || value === null) return fallback;
    return value !== false && value !== 'false' && value !== 0 && value !== '0';
};

// Пуш уходит, когда объявление включено и его либо только что включили, либо изменили текст.
function shouldNotifyAnnouncement(before, patch) {
    const row = before || {};
    const next = patch || {};
    const wasActive = isActiveFlag(row.isActive ?? row.isactive, false);
    const hasActiveFlag = Object.prototype.hasOwnProperty.call(next, 'isActive')
        || Object.prototype.hasOwnProperty.call(next, 'isactive');
    const nextActive = hasActiveFlag
        ? isActiveFlag(next.isActive ?? next.isactive, true)
        : wasActive;
    if (!nextActive) return false;
    if (!wasActive) return true;
    return ['title', 'message', 'type', 'image'].some((key) => {
        if (!Object.prototype.hasOwnProperty.call(next, key)) return false;
        const previous = row[key] ?? row[key.toLowerCase()];
        return norm(next[key]) !== norm(previous);
    });
}

function positionWord(count) {
    const n = Math.abs(Number(count) || 0) % 100;
    const n1 = n % 10;
    if (n > 10 && n < 20) return 'позиций';
    if (n1 > 1 && n1 < 5) return 'позиции';
    if (n1 === 1) return 'позиция';
    return 'позиций';
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

function buildOrderRequestPayload(order) {
    const positions = Array.isArray(order.product_order) ? order.product_order : [];
    const needsPrice = positions.some((line) => {
        const price = Number(line?.price);
        return !Number.isFinite(price) || price === 0;
    });
    const name = String(order.name_client || 'Клиент').trim().slice(0, 80) || 'Клиент';
    const count = positions.length;
    const pieces = [name, count ? `${count} ${positionWord(count)}` : 'без позиций'];
    if (needsPrice) pieces.push('Нужна цена');
    return {
        title: 'Новая заявка',
        body: pieces.join(' · ').slice(0, 180),
        url: `/order/${order.id}`,
        tag: `order-request-${order.id}`,
        type: 'request',
    };
}

module.exports = {
    shouldNotifyAnnouncement,
    buildAnnouncementPayload,
    buildOrderRequestPayload,
};
