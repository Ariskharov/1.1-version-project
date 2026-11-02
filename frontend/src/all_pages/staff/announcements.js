import React, { useContext, useEffect, useRef, useState } from 'react';
import { CustomContext } from '../../Context';
import { useCatalogTheme } from '../../context/CatalogThemeContext';
import { LoadingPage } from '../../components/ui/LoadingSpinner';
import PhotoUploadSlot from '../../components/ui/PhotoUploadSlot';
import { resolveImageUrl } from '../../config/api';
import { deletePhoto, uploadPhoto } from '../../utils/uploadService';
import {
    ANNOUNCEMENT_TYPES,
    createAnnouncement,
    deleteAnnouncement,
    formatExpiryLabel,
    isAnnouncementActive,
    updateAnnouncement,
} from '../../utils/announcements';
import './staff.scss';

const EMPTY = {
    title: '',
    message: '',
    type: 'urgent',
    expiresAt: '',
    isActive: true,
    image: '',
};

const toDatetimeLocal = (iso) => {
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const toIsoOrNull = (value) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const savedText = (isActive, push, created) => {
    const base = created ? 'Объявление создано' : 'Объявление обновлено';
    if (!isActive) return `${base}. Оно выключено и в кабинет не попадает.`;
    if (!push) return `${base}.`;
    if (push.skipped === 'expired') return `${base}, но срок уже истёк — уведомление не отправлено.`;
    if (push.error || push.skipped) return `${base}. Уведомление не настроено или не отправилось.`;
    if (push.sent > 0) return `${base}. Уведомление отправлено: ${push.sent}.`;
    return `${base}. Сотрудники увидят его в кабинете.`;
};

const HrAnnouncements = () => {
    const { resolvedTheme } = useCatalogTheme();
    const {
        currentUser,
        announcements,
        dataLoaded,
        refreshData,
        showToast,
        confirm,
    } = useContext(CustomContext);
    const [form, setForm] = useState(EMPTY);
    const [editingId, setEditingId] = useState(null);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [busyId, setBusyId] = useState(null);
    const [items, setItems] = useState([]);
    const formRef = useRef(null);
    const uploadingRef = useRef(false);
    const originalImage = useRef('');
    const sessionUploads = useRef(new Set());

    useEffect(() => {
        if (!dataLoaded) return;
        setItems(Array.isArray(announcements) ? announcements : []);
    }, [announcements, dataLoaded]);

    const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

    const dropUnusedUploads = () => {
        const keep = originalImage.current;
        sessionUploads.current.forEach((path) => {
            if (path && path !== keep) deletePhoto(path);
        });
        sessionUploads.current.clear();
    };

    const reset = () => {
        dropUnusedUploads();
        originalImage.current = '';
        setForm(EMPTY);
        setEditingId(null);
    };

    const plusDay = () => {
        setField('expiresAt', toDatetimeLocal(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()));
    };

    const startEdit = (item) => {
        dropUnusedUploads();
        originalImage.current = item.image || item.img || '';
        setEditingId(item.id);
        setForm({
            title: item.title || '',
            message: item.message || '',
            type: item.type === 'persistent' ? 'persistent' : 'urgent',
            expiresAt: toDatetimeLocal(item.expiresAt || item.expiresat),
            isActive: item.isActive !== false && item.isactive !== false,
            image: item.image || item.img || '',
        });
        formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const save = async (event) => {
        event.preventDefault();
        const message = form.message.trim();
        if (!message) {
            showToast('error', 'Введите текст объявления');
            return;
        }
        if (saving || uploadingRef.current) {
            if (uploadingRef.current) showToast('info', 'Дождитесь загрузки фото');
            return;
        }
        const payload = {
            title: form.title.trim().slice(0, 200),
            message,
            type: form.type === 'persistent' ? 'persistent' : 'urgent',
            expiresAt: toIsoOrNull(form.expiresAt),
            isActive: !!form.isActive,
            image: form.image || null,
        };
        const creating = editingId == null;
        setSaving(true);
        try {
            const saved = creating
                ? await createAnnouncement({ ...payload, createdBy: currentUser?.id ?? null })
                : await updateAnnouncement(editingId, payload);
            const previousImage = originalImage.current;
            if (previousImage && previousImage !== payload.image) deletePhoto(previousImage);
            sessionUploads.current.clear();
            originalImage.current = '';
            setForm(EMPTY);
            setEditingId(null);
            showToast('success', savedText(payload.isActive, saved?.push, creating));
            try { await refreshData(); } catch { /* список подтянет живая синхронизация */ }
        } catch (err) {
            showToast('error', err.message || 'Не удалось сохранить объявление');
        } finally {
            setSaving(false);
        }
    };

    const toggleActive = async (item) => {
        if (busyId != null || saving || uploadingRef.current) return;
        const nextActive = !(item.isActive !== false && item.isactive !== false);
        setBusyId(item.id);
        try {
            await updateAnnouncement(item.id, { isActive: nextActive });
            if (Number(editingId) === Number(item.id)) setField('isActive', nextActive);
            const visible = isAnnouncementActive({ ...item, isActive: nextActive, isactive: nextActive });
            let note = 'Объявление выключено';
            if (nextActive && visible) note = 'Объявление снова показывается в кабинете';
            if (nextActive && !visible) note = 'Объявление включено, но срок уже истёк. В кабинете его не будет, пока не сдвинете дату.';
            showToast('success', note);
            try { await refreshData(); } catch { /* список подтянет живая синхронизация */ }
        } catch (err) {
            showToast('error', err.message || 'Не удалось изменить объявление');
        } finally {
            setBusyId(null);
        }
    };

    const remove = async (item) => {
        if (busyId != null || saving || uploadingRef.current) return;
        const preview = String(item.title || item.message || 'Без текста').slice(0, 160);
        const ok = await confirm({
            message: `Удалить объявление?\n\n${preview}`,
            confirmLabel: 'Удалить',
            cancelLabel: 'Отмена',
            danger: true,
        });
        if (!ok) return;
        setBusyId(item.id);
        try {
            await deleteAnnouncement(item.id);
            if (Number(editingId) === Number(item.id)) reset();
            showToast('success', 'Объявление удалено');
            try { await refreshData(); } catch { /* список подтянет живая синхронизация */ }
        } catch (err) {
            showToast('error', err.message || 'Не удалось удалить объявление');
        } finally {
            setBusyId(null);
        }
    };

    if (!currentUser || !dataLoaded) {
        return <LoadingPage message="Загрузка объявлений..." />;
    }

    const list = [...items].sort((left, right) => {
        const leftTime = new Date(left.createdAt || left.createdat || 0).getTime();
        const rightTime = new Date(right.createdAt || right.createdat || 0).getTime();
        return rightTime - leftTime;
    });

    return (
        <section className={`staff staff--theme-${resolvedTheme}`}>
            <header className="staff__hero">
                <p className="staff__badge">Объявления</p>
                <h1>{editingId != null ? 'Редактирование' : 'Новое объявление'}</h1>
                <p className="staff__note">
                    Новое объявление создаётся в форме. Уже опубликованное можно исправить, выключить или удалить, если оно устарело или с ошибкой.
                    Активное объявление сотрудники видят в личном кабинете.
                </p>
            </header>

            <form ref={formRef} className={`staff__form${editingId != null ? ' is-editing' : ''}`} onSubmit={save}>
                <p className="staff__hint">{ANNOUNCEMENT_TYPES[form.type]?.hint}</p>
                <div className="staff__form-grid">
                    <label className="staff__field">
                        <span>Заголовок</span>
                        <input
                            value={form.title}
                            maxLength={200}
                            onChange={(e) => setField('title', e.target.value)}
                            placeholder="Необязательно"
                        />
                    </label>
                    <label className="staff__field">
                        <span>Тип</span>
                        <select value={form.type} onChange={(e) => setField('type', e.target.value)}>
                            {Object.values(ANNOUNCEMENT_TYPES).map((type) => (
                                <option key={type.key} value={type.key}>{type.label}</option>
                            ))}
                        </select>
                    </label>
                    <label className="staff__field staff__field--wide">
                        <span>Текст</span>
                        <textarea
                            required
                            value={form.message}
                            onChange={(e) => setField('message', e.target.value)}
                            placeholder="Текст объявления для сотрудников"
                        />
                    </label>
                    <div className="staff__field staff__field--wide">
                        <PhotoUploadSlot
                            inputId="hr-announcement-photo"
                            label="Фото к объявлению"
                            hint="Это фото увидят в личном кабинете"
                            variant="banner"
                            previewUrl={form.image ? resolveImageUrl(form.image) : ''}
                            onFileChange={async (e) => {
                                const file = e.target.files?.[0];
                                e.target.value = '';
                                if (!file || uploadingRef.current) return;
                                uploadingRef.current = true;
                                setUploading(true);
                                try {
                                    const path = await uploadPhoto(file);
                                    setForm((prev) => {
                                        if (prev.image && prev.image !== path && sessionUploads.current.has(prev.image)) {
                                            sessionUploads.current.delete(prev.image);
                                            deletePhoto(prev.image);
                                        }
                                        sessionUploads.current.add(path);
                                        return { ...prev, image: path };
                                    });
                                    showToast('success', 'Фото загружено');
                                } catch (err) {
                                    showToast('error', err.message || 'Не удалось загрузить фото');
                                } finally {
                                    uploadingRef.current = false;
                                    setUploading(false);
                                }
                            }}
                            onRemove={() => setForm((prev) => {
                                if (prev.image && sessionUploads.current.has(prev.image)) {
                                    sessionUploads.current.delete(prev.image);
                                    deletePhoto(prev.image);
                                }
                                return { ...prev, image: '' };
                            })}
                        />
                    </div>
                    <label className="staff__field">
                        <span>Показывать до</span>
                        <input
                            type="datetime-local"
                            value={form.expiresAt}
                            onChange={(e) => setField('expiresAt', e.target.value)}
                        />
                    </label>
                    <div className="staff__row">
                        <button type="button" className="staff__btn" onClick={plusDay}>+24 часа</button>
                        {form.expiresAt ? (
                            <button type="button" className="staff__btn" onClick={() => setField('expiresAt', '')}>
                                Без срока
                            </button>
                        ) : null}
                        <label className="staff__row">
                            <input
                                type="checkbox"
                                checked={form.isActive}
                                onChange={(e) => setField('isActive', e.target.checked)}
                            />
                            <span>Активно</span>
                        </label>
                    </div>
                </div>
                <div className="staff__row">
                    <button type="submit" className="staff__btn staff__btn--primary" disabled={saving || uploading || busyId != null}>
                        {uploading ? 'Загрузка фото…' : saving ? 'Сохранение…' : editingId != null ? 'Сохранить' : 'Создать'}
                    </button>
                    {editingId != null && (
                        <button type="button" className="staff__btn" onClick={reset} disabled={saving || uploading}>
                            Отмена
                        </button>
                    )}
                </div>
            </form>

            <div className="staff__list">
                <h2 className="staff__section-title">Уже опубликованные</h2>
                {list.length === 0 && <p className="staff__empty">Объявлений пока нет.</p>}
                {list.map((item) => {
                    const active = isAnnouncementActive(item);
                    const image = item.image || item.img;
                    const editing = Number(editingId) === Number(item.id);
                    const busy = Number(busyId) === Number(item.id);
                    const turnedOn = item.isActive !== false && item.isactive !== false;
                    return (
                        <article
                            key={item.id}
                            className={`staff__item${active ? '' : ' is-off'}${editing ? ' is-editing' : ''}`}
                        >
                            <div className="staff__meta">
                                <span className="staff__chip">{ANNOUNCEMENT_TYPES[item.type]?.label || item.type}</span>
                                <span className="staff__chip">{active ? 'Активно' : 'Не показывается'}</span>
                                <span>{formatExpiryLabel(item.expiresAt || item.expiresat)}</span>
                            </div>
                            {item.title ? <strong>{item.title}</strong> : null}
                            <p>{item.message}</p>
                            {image ? (
                                <img className="staff__photo" src={resolveImageUrl(image)} alt={item.title ? `Фото: ${item.title}` : 'Фото объявления'} />
                            ) : null}
                            <div className="staff__row">
                                <button type="button" className="staff__btn" onClick={() => startEdit(item)} disabled={saving || uploading || busyId != null}>
                                    Изменить
                                </button>
                                <button type="button" className="staff__btn" onClick={() => toggleActive(item)} disabled={saving || uploading || busyId != null}>
                                    {busy ? '…' : turnedOn ? 'Выключить' : 'Включить'}
                                </button>
                                <button type="button" className="staff__btn staff__btn--danger" onClick={() => remove(item)} disabled={saving || uploading || busyId != null}>
                                    {busy ? '…' : 'Удалить'}
                                </button>
                            </div>
                        </article>
                    );
                })}
            </div>
        </section>
    );
};

export default HrAnnouncements;
