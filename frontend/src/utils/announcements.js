const API_BASE = 'http://localhost:8080';

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
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Не удалось обновить объявление');
    }
    return res.json();
};

export const deleteAnnouncement = async (id) => {
    const res = await fetch(`${API_BASE}/announcements/${id}`, { method: 'DELETE' });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Не удалось удалить объявление');
    }
    return res.json();
};