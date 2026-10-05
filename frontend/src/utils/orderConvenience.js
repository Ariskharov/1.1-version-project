import { evaluate } from 'mathjs';

export const ORDER_DRAFT_KEY = 'order_draft';

export const BUYER_FIELDS = [
    'name_client',
    'name_compony',
    'address',
    'phone',
    'email',
    'order_note',
    'buyer_rep_title',
    'buyer_rep_name',
    'buyer_basis',
    'buyer_inn',
    'buyer_bank',
    'buyer_bik',
    'buyer_account',
    'buyer_sign',
    'procurement_basis',
    'delivery_days',
    'contract_city',
];

export const ORDER_STATUSES = [
    'Черновик',
    'Оформлен',
    'Пилится',
    'Собирается',
    'Ожидание доставки',
    'Установка',
    'Завершено',
];

const emptyDraftOrder = () => ({
    name_client: '',
    name_compony: '',
    address: '',
    phone: '',
    email: '',
    order_note: '',
    positions: [],
});

export function readOrderDraft() {
    try {
        const raw = localStorage.getItem(ORDER_DRAFT_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;
        if (Array.isArray(parsed.positions)) {
            return {
                order: parsed,
                discountPercent: Number(parsed.discountPercent) || 0,
            };
        }
    } catch {
        return null;
    }
    return null;
}

export function writeOrderDraft(order, discountPercent = 0) {
    const payload = {
        ...emptyDraftOrder(),
        ...order,
        positions: order?.positions || [],
        discountPercent: Number(discountPercent) || 0,
    };
    localStorage.setItem(ORDER_DRAFT_KEY, JSON.stringify(payload));
}

export function draftHasWork(draft) {
    const order = draft?.order;
    if (!order) return false;
    return (order.positions?.length > 0) || !!(order.name_client || order.name_compony);
}

export function organizationKey(name) {
    return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function buildOrganizationCards(orders) {
    const map = new Map();
    (Array.isArray(orders) ? orders : []).forEach((order) => {
        const key = organizationKey(order?.name_compony);
        if (!key) return;
        const prev = map.get(key);
        if (prev && Number(order.id) < Number(prev.sourceId)) return;
        const card = { sourceId: order.id, label: order.name_compony };
        BUYER_FIELDS.forEach((field) => {
            if (order[field]) card[field] = order[field];
        });
        map.set(key, card);
    });
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, 'ru'));
}

export function filterOrganizations(cards, query) {
    const q = organizationKey(query);
    if (q.length < 2) return [];
    return cards.filter((card) => organizationKey(card.label).includes(q)).slice(0, 6);
}

export function applyOrganization(current, card) {
    const next = { ...current };
    BUYER_FIELDS.forEach((field) => {
        if (card[field]) next[field] = card[field];
    });
    return next;
}

export function discountFromPercent(subtotal, percent) {
    const pct = Math.max(0, Math.min(100, Number(percent) || 0));
    const base = Math.max(0, Number(subtotal) || 0);
    const discountAmount = pct > 0 ? Math.round(base * pct / 100) : 0;
    return {
        discountPercent: pct,
        discountAmount,
        subtotal: base,
        total: base - discountAmount,
    };
}

export function calculatePositionDetails(product, userInputs = {}) {
    if (!product?.details?.length) return [];
    const nums = { ...userInputs };
    (product.variables || []).forEach((variable) => {
        nums[variable.name] = Number(nums[variable.name]) || variable.default || 0;
    });
    (product.conditions || []).forEach((condition) => {
        if (condition.type === 'flag') nums[condition.name] = !!nums[condition.name];
    });

    return product.details.map((detail) => {
        if (detail.if_condition && !nums[detail.if_condition]) return null;
        try {
            const width = evaluate(detail.formula_width || '0', nums);
            const height = detail.formula_height ? evaluate(detail.formula_height, nums) : null;
            const count = evaluate(detail.count_formula || '1', nums);
            const size = height
                ? `${Math.round(width)} × ${Math.round(height)} мм`
                : `${Math.round(width)} мм`;
            return {
                key: detail.key,
                label: detail.label,
                size,
                count: Math.max(0, Math.round(count)),
            };
        } catch {
            return { key: detail.key, label: detail.label, size: 'Ошибка', count: 0 };
        }
    }).filter(Boolean);
}

export function buildCatalogPosition(product, inputs, calculatedDetails) {
    const quantity = Math.max(1, Number(inputs?.coll) || 1);
    const price = Number(product?.price || 0);
    return {
        id: Date.now(),
        isCustom: false,
        productId: product.id,
        title: product.title,
        img: product.img,
        description: '',
        price,
        quantity,
        totalPrice: price * quantity,
        userInputs: { ...inputs },
        calculatedDetails,
        variables: product.variables,
        conditions: product.conditions,
        details: product.details,
        bodyColor: '',
        facadeColor: '',
    };
}

export function appendPositionToDraft(position) {
    const draft = readOrderDraft() || { order: emptyDraftOrder(), discountPercent: 0 };
    const positions = [...(draft.order.positions || []), position];
    writeOrderDraft({ ...draft.order, positions }, draft.discountPercent);
    return positions.length;
}

export function isTodayOrder(order) {
    const raw = order?.createdAt || order?.updatedAt || '';
    if (!raw) return false;
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) {
        return String(raw).slice(0, 10) === new Date().toISOString().slice(0, 10);
    }
    const now = new Date();
    return date.getFullYear() === now.getFullYear()
        && date.getMonth() === now.getMonth()
        && date.getDate() === now.getDate();
}

export function lineSum(items) {
    return (items || []).reduce((sum, item) => {
        const price = Number(item.price || 0);
        const qty = Number(item.quantity || item.userInputs?.coll || 1) || 1;
        return sum + price * qty;
    }, 0);
}

export function repeatOrderPayload(order) {
    const productOrder = (order.product_order || []).map((item, index) => ({
        ...item,
        id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
    }));
    const subtotal = lineSum(productOrder);
    const discountAmount = Number(order.discountAmount) || 0;
    const taxAmount = Number(order.taxAmount) || 0;
    const payload = {
        product_order: productOrder,
        status: 'Черновик',
        discountAmount,
        taxAmount,
        subtotal,
        total: subtotal - discountAmount + taxAmount,
        createdAt: new Date().toISOString(),
        contract_date: new Date().toISOString().slice(0, 10),
        contract_no: '',
    };
    BUYER_FIELDS.forEach((field) => {
        if (order[field]) payload[field] = order[field];
    });
    return payload;
}
