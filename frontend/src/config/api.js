/**
 * Единая конфигурация API и утилиты работы с медиа-ресурсами.
 */

import axios from 'axios';

export const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8080';

export const authHeaders = (extra = {}) => {
    const headers = { ...extra };
    try {
        const token = localStorage.getItem('token');
        if (token && !headers.Authorization && !headers.authorization) {
            headers.Authorization = `Bearer ${token}`;
        }
    } catch {
        /* приватный режим */
    }
    return headers;
};

axios.interceptors.request.use((config) => {
    try {
        const token = localStorage.getItem('token');
        if (!token) return config;
        const headers = config.headers || {};
        const existing = typeof headers.get === 'function'
            ? (headers.get('Authorization') || headers.get('authorization'))
            : (headers.Authorization || headers.authorization);
        if (!existing) {
            if (typeof headers.set === 'function') headers.set('Authorization', `Bearer ${token}`);
            else headers.Authorization = `Bearer ${token}`;
            config.headers = headers;
        }
    } catch {
        /* приватный режим */
    }
    return config;
});

/**
 * Нормализует путь к изображению для корректного отображения как локально, так и в проде на Vercel/мобильных устройствах.
 * @param {string|null|undefined} img - Путь или URL изображения
 * @returns {string|null} Полный или относительный URL для тега <img src="..." />
 */
export const resolveImageUrl = (img) => {
    if (!img || typeof img !== 'string') return null;
    
    const trimmed = img.trim();
    if (!trimmed) return null;

    // Если это уже полный URL (http/https) или data URI (base64) или blob
    if (/^(https?:|\/\/|data:|blob:)/i.test(trimmed)) {
        return trimmed;
    }

    // Если начинается с /utilse/
    if (trimmed.startsWith('/utilse/')) {
        return `${API_BASE}${trimmed}`;
    }

    // Если начинается с utilse/
    if (trimmed.startsWith('utilse/')) {
        return `${API_BASE}/${trimmed}`;
    }

    // Если начинается с /uploads/
    if (trimmed.startsWith('/uploads/')) {
        const file = trimmed.split('/').pop();
        return `${API_BASE}/utilse/${file}`;
    }

    // Иначе считаем это именем файла в /utilse/
    const filename = trimmed.split('/').pop();
    return `${API_BASE}/utilse/${filename}`;
};

// Маленькая копия для списков. Полный кадр остаётся для увеличения.
// Чужой адрес (не /utilse/) возвращается как есть.
export const previewImageUrl = (img) => {
    const full = resolveImageUrl(img);
    if (!full) return null;
    const marker = '/utilse/';
    const idx = full.indexOf(marker);
    if (idx === -1) return full;
    const name = full.slice(idx + marker.length);
    if (!name || name.startsWith('thumbs/')) return full;
    const base = name.split('/').pop().replace(/\.[^.]+$/, '');
    return `${full.slice(0, idx)}${marker}thumbs/${base}.jpg`;
};

const apiConfig = {
    API_BASE,
    authHeaders,
    resolveImageUrl,
};

export default apiConfig;
