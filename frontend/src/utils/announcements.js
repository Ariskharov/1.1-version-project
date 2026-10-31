import { API_BASE, authHeaders } from '../config/api';

export const ANNOUNCEMENT_TYPES = {
    urgent: { key: 'urgent', label: 'Срочная', hint: 'Показывается баннером сверху в кабинете' },
    persistent: { key: 'persistent', label: 'Долгосрочная', hint: 'Блок «Актуально» в кабинете' },
};

/** Активна ли новость с учётом флага и даты окончания */
export const isAnnouncementActive = (item, now = new Date()) => {
    if (!item) return false;
    const active = item.isActive !== false && item.isactive !== false;
    if (!active) return false;
    const expires = item.expiresAt || item.expiresat;
    if (!expires) return true;
    const end = new Date(expires);
    return !Number.isNaN(end.getTime()) && end > now;
};

export const announcementSignature = (item) => [
    item?.type || '',
    item?.title || '',
    item?.message || '',
    item?.image || item?.img || '',
].join('\u0001');

export const announcementNotificationText = (item) => {
    const typeLabel = item?.type === 'persistent' ? 'Актуально' : 'Срочно';
    const title = item?.title ? `${typeLabel}: ${item.title}` : `${typeLabel} — объявление`;
    const body = String(item?.message || '').slice(0, 180);
    return {
        title,
        body,
        text: body ? `${title} — ${body}` : title,
        tag: `announcement-${item?.id}`,
    };
};

// Новое объявление или правка уже виденного. Старые id без подписи не поднимаем заново.
export const announcementsToNotify = (list, seenIds, signatures = {}) => {
    const seen = seenIds instanceof Set ? seenIds : new Set((seenIds || []).map(String));
    return (list || []).filter((item) => {
        if (!item || item.id == null) return false;
        const id = String(item.id);
        if (!seen.has(id)) return true;
        const prev = signatures[id];
        if (prev == null) return false;
        return prev !== announcementSignature(item);
    });
};

export const filterActiveAnnouncements = (list, type = null) => {
    const now = new Date();
    return (list || [])
        .filter((a) => isAnnouncementActive(a, now))
        .filter((a) => !type || a.type === type)
        .sort((a, b) => {
            const da = new Date(a.createdAt || a.createdat || 0);
            const db = new Date(b.createdAt || b.createdat || 0);
            return db - da;
        });
};

export const formatExpiryLabel = (expiresAt) => {
    if (!expiresAt) return 'Без срока';
    const d = new Date(expiresAt);
    if (Number.isNaN(d.getTime())) return 'Без срока';
    return d.toLocaleString('ru-RU', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
};

export const fetchAnnouncements = async () => {
    const res = await fetch(`${API_BASE}/announcements`);
    if (!res.ok) throw new Error('Не удалось загрузить объявления');
    return res.json();
};

export const createAnnouncement = async (payload) => {
    const res = await fetch(`${API_BASE}/announcements`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Не удалось создать объявление');
    }
    return res.json();
};

export const updateAnnouncement = async (id, payload) => {
    const res = await fetch(`${API_BASE}/announcements/${id}`, {
        method: 'PATCH',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Не удалось обновить объявление');
    }
    return res.json();
};

export const deleteAnnouncement = async (id) => {
    const res = await fetch(`${API_BASE}/announcements/${id}`, { method: 'DELETE', headers: authHeaders() });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Не удалось удалить объявление');
    }
    return res.json();
};