const API_BASE = 'http://localhost:8080';

const SEEN_KEY = 'tt_seen_announcement_ids';
const PROMPT_DISMISS_KEY = 'tt_push_prompt_dismissed';

export const isPushSupported = () =>
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;

export const getNotificationPermission = () => {
    if (typeof Notification === 'undefined') return 'unsupported';
    return Notification.permission;
};

export const wasPromptDismissed = () => {
    try {
        return localStorage.getItem(PROMPT_DISMISS_KEY) === '1';
    } catch {
        return false;
    }
};

export const dismissPrompt = () => {
    try {
        localStorage.setItem(PROMPT_DISMISS_KEY, '1');
    } catch {
        /* ignore */
    }
};

export const resetPromptDismiss = () => {
    try {
        localStorage.removeItem(PROMPT_DISMISS_KEY);
    } catch {
        /* ignore */
    }
};

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i += 1) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

export async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return null;
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;
    return reg;
}

export async function fetchVapidPublicKey() {
    const res = await fetch(`${API_BASE}/push/vapid-public-key`);
    if (!res.ok) throw new Error('Push на сервере не настроен');
    const data = await res.json();
    return data.publicKey;
}

/**
 * Запрашивает разрешение, регистрирует SW и сохраняет push-подписку на бэкенде.
 */
export async function enablePushNotifications(userId = null) {
    if (!isPushSupported()) {
        throw new Error('Уведомления не поддерживаются этим браузером');
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
        throw new Error(
            permission === 'denied'
                ? 'Разрешение отклонено. Включите уведомления в настройках браузера/сайта.'
                : 'Разрешение не получено'
        );
    }

    const registration = await registerServiceWorker();
    if (!registration) throw new Error('Service Worker не зарегистрирован');

    const publicKey = await fetchVapidPublicKey();
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
        subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
    }

    const res = await fetch(`${API_BASE}/push/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            subscription: subscription.toJSON(),
            userId,
        }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Не удалось сохранить подписку');
    }

    resetPromptDismiss();
    return { permission, subscription };
}

export async function disablePushNotifications() {
    if (!('serviceWorker' in navigator)) return;
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager?.getSubscription();
    if (subscription) {
        const endpoint = subscription.endpoint;
        try {
            await fetch(`${API_BASE}/push/unsubscribe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ endpoint }),
            });
        } catch {
            /* ignore network */
        }
        await subscription.unsubscribe();
    }
}

export async function getPushStatus() {
    if (!isPushSupported()) {
        return { supported: false, permission: 'unsupported', subscribed: false };
    }
    const permission = Notification.permission;
    let subscribed = false;
    try {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = await reg?.pushManager?.getSubscription();
        subscribed = Boolean(sub);
    } catch {
        subscribed = false;
    }
    return { supported: true, permission, subscribed };
}

/** Локальное уведомление (когда вкладка открыта / fallback) */
export function showLocalNotification(title, options = {}) {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
        return false;
    }
    try {
        const n = new Notification(title, {
            icon: '/icons/icon-192.png',
            badge: '/icons/icon-192.png',
            ...options,
        });
        n.onclick = () => {
            window.focus();
            if (options.data?.url) {
                window.location.href = options.data.url;
            }
            n.close();
        };
        return true;
    } catch {
        return false;
    }
}

export function loadSeenAnnouncementIds() {
    try {
        const raw = localStorage.getItem(SEEN_KEY);
        const arr = raw ? JSON.parse(raw) : [];
        return new Set(Array.isArray(arr) ? arr.map(String) : []);
    } catch {
        return new Set();
    }
}

export function saveSeenAnnouncementIds(ids) {
    try {
        const arr = [...ids].slice(-200);
        localStorage.setItem(SEEN_KEY, JSON.stringify(arr));
    } catch {
        /* ignore */
    }
}

/**
 * Сравнивает список объявлений с уже виденными и показывает local Notification
 * для новых активных (fallback, если push не дошёл).
 */
export function notifyNewAnnouncementsLocally(list, { onlyUrgent = false } = {}) {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
        return 0;
    }
    const seen = loadSeenAnnouncementIds();
    let count = 0;
    const next = new Set(seen);

    (list || []).forEach((a) => {
        if (!a || a.id == null) return;
        const id = String(a.id);
        next.add(id);
        if (seen.has(id)) return;
        if (onlyUrgent && a.type !== 'urgent') return;

        const typeLabel = a.type === 'persistent' ? 'Актуально' : 'Срочно';
        const title = a.title ? `${typeLabel}: ${a.title}` : `${typeLabel} — объявление`;
        showLocalNotification(title, {
            body: String(a.message || '').slice(0, 180),
            tag: `announcement-${id}`,
            data: { url: '/cabinet' },
        });
        count += 1;
    });

    saveSeenAnnouncementIds(next);
    return count;
}

/** Пометить текущий список как уже просмотренный (без уведомлений) */
export function markAnnouncementsSeen(list) {
    const seen = loadSeenAnnouncementIds();
    (list || []).forEach((a) => {
        if (a?.id != null) seen.add(String(a.id));
    });
    saveSeenAnnouncementIds(seen);
}
