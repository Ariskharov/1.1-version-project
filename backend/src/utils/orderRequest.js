const clip = (value, max) => String(value ?? '').trim().slice(0, max);

const money = (value) => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const num = parseFloat(String(value ?? '').replace(/[^\d.,]/g, '').replace(',', '.'));
    return Number.isFinite(num) ? num : 0;
};

const asList = (value) => (Array.isArray(value) ? value : []);

const sanitizeInputs = (raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const out = {};
    for (const [key, value] of Object.entries(raw).slice(0, 40)) {
        if (key.length < 1 || key.length > 40) continue;
        if (key === '__proto__' || key === 'prototype' || key === 'constructor') continue;
        if (/[^\p{L}\p{N}_]/u.test(key)) continue;
        if (typeof value === 'boolean') out[key] = value;
        else if (typeof value === 'number' && Number.isFinite(value)) out[key] = value;
        else if (typeof value === 'string') out[key] = value.slice(0, 80);
    }
    return out;
};

const sanitizeDetails = (list) => {
    if (!Array.isArray(list)) return [];
    return list.slice(0, 80).map((detail) => ({
        key: clip(detail?.key, 40),
        label: clip(detail?.label, 120),
        size: clip(detail?.size, 80),
        count: Math.max(0, Math.min(9999, Math.round(Number(detail?.count) || 0))),
    })).filter((detail) => detail.label);
};

const safeImage = (value) => {
    const text = clip(value, 500);
    if (!text || text.includes('..') || /\s/.test(text)) return null;
    if (text.startsWith('/utilse/')) return text;
    try {
        const url = new URL(text);
        if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
        return text;
    } catch {
        return null;
    }
};

/**
 * Собирает заявку только из разрешённых полей.
 * Цену каталожной позиции берёт из базы, а не из письма клиента.
 */
function buildOrderRequest(body, products) {
    const source = body || {};
    const name = clip(source.name_client, 200);
    const phone = clip(source.phone, 40);
    const phoneDigits = phone.replace(/\D/g, '');
    const note = clip(source.order_note, 2000);
    const email = clip(source.email, 120);

    if (name.length < 2) return { error: 'Укажите имя' };
    if (phoneDigits.length < 6) return { error: 'Укажите телефон' };
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { error: 'Проверьте адрес почты' };
    }

    const byId = new Map((Array.isArray(products) ? products : []).map((product) => [Number(product.id), product]));
    const rawItems = Array.isArray(source.positions) ? source.positions : [];
    if (rawItems.length > 30) return { error: 'В одной заявке не больше 30 изделий' };
    const positions = [];

    rawItems.forEach((item, index) => {
        if (!item || typeof item !== 'object') return;
        const quantity = Math.min(999, Math.max(1, Math.round(Number(item.quantity) || 1)));
        const description = clip(item.description, 1000);
        const product = byId.get(Number(item.productId));

        if (product) {
            const safePrice = money(product.price);
            positions.push({
                id: `${Date.now()}-${index}`,
                isCustom: false,
                productId: product.id,
                title: clip(product.title, 200) || 'Изделие',
                img: product.img || null,
                description,
                price: safePrice,
                quantity,
                totalPrice: safePrice * quantity,
                userInputs: sanitizeInputs(item.userInputs),
                calculatedDetails: sanitizeDetails(item.calculatedDetails),
                variables: asList(product.variables),
                conditions: asList(product.conditions),
                details: asList(product.details),
                bodyColor: clip(item.bodyColor, 80),
                facadeColor: clip(item.facadeColor, 80),
            });
            return;
        }

        const title = clip(item.title, 200);
        if (!title) return;
        positions.push({
            id: `${Date.now()}-c-${index}`,
            isCustom: true,
            title,
            description,
            price: 0,
            quantity,
            totalPrice: 0,
            img: safeImage(item.img),
        });
    });

    if (!positions.length && note.length < 5) {
        return { error: 'Добавьте изделие или опишите, что нужно сделать' };
    }

    const subtotal = positions.reduce((sum, item) => sum + (Number(item.price) || 0) * item.quantity, 0);
    return {
        record: {
            name_client: name,
            name_compony: clip(source.name_compony, 200),
            address: clip(source.address, 300),
            phone,
            email,
            order_note: note,
            product_order: positions,
            status: 'Заявка',
            subtotal,
            discountAmount: 0,
            discountPercent: 0,
            taxAmount: 0,
            total: subtotal,
            createdAt: new Date().toISOString(),
        },
    };
}

module.exports = { buildOrderRequest };
