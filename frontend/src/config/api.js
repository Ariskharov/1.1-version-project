/**
 * Единая конфигурация API и утилиты работы с медиа-ресурсами.
 */

export const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8080';

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

const apiConfig = {
    API_BASE,
    resolveImageUrl,
};

export default apiConfig;
