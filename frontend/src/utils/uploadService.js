const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8080';

/**
 * Загружает фотографию на бэкенд (POST /upload).
 * @param {File} file - Файл из input[type="file"]
 * @returns {Promise<string>} Возвращает путь к сохраненному файлу (например, '/utilse/12345.jpg' или URL)
 */
export const uploadPhoto = async (file) => {
    if (!file) throw new Error('Файл не выбран');

    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        body: formData,
    });

    if (!res.ok) {
        let errMessage = `Ошибка HTTP: ${res.status}`;
        try {
            const errJson = await res.json();
            if (errJson.error) errMessage = errJson.error;
        } catch (_) {}
        throw new Error(errMessage);
    }

    const data = await res.json();
    if (!data || !data.path) {
        throw new Error('Некорректный ответ сервера при загрузке фото');
    }

    return data.path;
};

/**
 * Удаляет ранее загруженную фотографию с бэкенда (DELETE /upload).
 * @param {string} filePath - Путь или имя файла
 */
export const deletePhoto = async (filePath) => {
    if (!filePath) return;

    const fileName = filePath.replace(/^\/utilse\//, '');

    const res = await fetch(`${API_BASE}/upload`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName }),
    });

    if (!res.ok) {
        console.warn('[uploadService] Ошибка удаления файла:', res.status);
    }
};
