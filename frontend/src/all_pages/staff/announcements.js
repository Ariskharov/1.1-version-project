import React, { useContext, useEffect, useState } from 'react';
import { CustomContext } from '../../Context';
import { useCatalogTheme } from '../../context/CatalogThemeContext';
import { LoadingPage } from '../../components/ui/LoadingSpinner';
import PhotoUploadSlot from '../../components/ui/PhotoUploadSlot';
import { resolveImageUrl } from '../../config/api';
import { uploadPhoto } from '../../utils/uploadService';
import {
    ANNOUNCEMENT_TYPES,
    createAnnouncement,
    deleteAnnouncement,
    fetchAnnouncements,
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
    const [busyId, setBusyId] = useState(null);
    const [items, setItems] = useState([]);

    useEffect(() => {
        if (!dataLoaded) return;
        setItems(Array.isArray(announcements) ? announcements : []);
    }, [announcements, dataLoaded]);

    const reload = async () => {
        const list = await fetchAnnouncements();
        setItems(Array.isArray(list) ? list : []);
        await refreshData();
    };

    const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

    const reset = () => {
        setForm(EMPTY);
        setEditingId(null);
    };

    const startEdit = (item) => {
        setEditingId(item.id);
        setForm({
            title: item.title || '',
            message: item.message || '',
            type: item.type === 'persistent' ? 'persistent' : 'urgent',
            expiresAt: toDatetimeLocal(item.expiresAt || item.expiresat),
            isActive: item.isActive !== false && item.isactive !== false,
            image: item.image || item.img || '',
        });
    };

    const save = async (event) => {
        event.preventDefault();
        const message = form.message.trim();
        if (!message) {
            showToast('error', 'Введите текст объявления');
            return;
        }
        if (saving) return;
        const payload = {
            title: form.title.trim().slice(0, 200),
            message,
            type: form.type === 'persistent' ? 'persistent' : 'urgent',
            expiresAt: toIsoOrNull(form.expiresAt),
            isActive: !!form.isActive,
            image: form.image || null,
        };
        setSaving(true);
        try {
            if (editingId != null) {
                await updateAnnouncement(editingId, payload);
            } else {
                await createAnnouncement({ ...payload, createdBy: currentUser?.id ?? null });
            }
            reset();
            showToast(
                'success',
                payload.isActive
                    ? 'Объявление сохранено. Сотрудники увидят его в кабинете.'
                    : 'Объявление сохранено. Оно выключено и в кабинет не попадает.'
            );
            try { await reload(); } catch { /* список подтянет живая синхронизация */ }
        } catch (err) {
            showToast('error', err.message || 'Не удалось сохранить объявление');
        } finally {
            setSaving(false);
        }
    };

    const remove = async (item) => {
        if (busyId != null || saving) return;
        const ok = await confirm({
            message: 'Удалить это объявление?',
            confirmLabel: 'Удалить',
            danger: true,
        });
        if (!ok) return;
        setBusyId(item.id);
        try {
            await deleteAnnouncement(item.id);
            if (Number(editingId) === Number(item.id)) reset();
            showToast('success', 'Объявление удалено');
            try { await reload(); } catch { /* список подтянет живая синхронизация */ }
        } catch (err) {
            showToast('error', err.message || 'Не удалось удалить объявление');
        } finally {
            setBusyId(null);
        }
    };

    if (!currentUser || !dataLoaded) {
        return <LoadingPage message="Загрузка объявлений..." />;
    }

    const list = [...items].sort((a, b) => {
        const left = new Date(a.createdAt || a.createdat || 0).getTime();
        const right = new Date(b.createdAt || b.createdat || 0).getTime();
        return right - left;
    });

    return (
        <section className={`staff staff--theme-${resolvedTheme}`}>
            <header className="staff__hero">
                <p className="staff__badge">Отдел кадров</p>
                <h1>Объявления</h1>
                <p className="staff__note">
                    Сотрудники видят активные объявления в личном кабинете. Выключенное объявление туда не попадает и уведомление не отправляет.
                </p>
            </header>

            <form className="staff__form" onSubmit={save}>
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
                    <span>Текст</span>
                    <textarea
                        required
                        value={form.message}
                        onChange={(e) => setField('message', e.target.value)}
                        placeholder="Что нужно сообщить сотрудникам"
                    />
                </label>
                <label className="staff__field">
                    <span>Тип</span>
                    <select value={form.type} onChange={(e) => setField('type', e.target.value)}>
                        {Object.values(ANNOUNCEMENT_TYPES).map((type) => (
                            <option key={type.key} value={type.key}>{type.label} — {type.hint}</option>
                        ))}
                    </select>
                </label>
                <PhotoUploadSlot
                    inputId="hr-announcement-photo"
                    label="Фото"
                    hint="Показывается вместе с текстом"
                    variant="banner"
                    previewUrl={form.image ? resolveImageUrl(form.image) : ''}
                    onFileChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                            const path = await uploadPhoto(file);
                            setField('image', path);
                            showToast('success', 'Фото загружено');
                        } catch (err) {
                            showToast('error', err.message || 'Не удалось загрузить фото');
                        }
                    }}
                    onRemove={() => setField('image', '')}
                />
                <label className="staff__field">
                    <span>Показывать до</span>
                    <input
                        type="datetime-local"
                        value={form.expiresAt}
                        onChange={(e) => setField('expiresAt', e.target.value)}
                    />
                </label>
                <label className="staff__row">
                    <input
                        type="checkbox"
                        checked={form.isActive}
                        onChange={(e) => setField('isActive', e.target.checked)}
                    />
                    <span>Активно</span>
                </label>
                <div className="staff__row">
                    <button type="submit" className="staff__btn staff__btn--primary" disabled={saving}>
                        {saving ? 'Сохранение…' : editingId != null ? 'Сохранить' : 'Создать'}
                    </button>
                    {editingId != null && (
                        <button type="button" className="staff__btn" onClick={reset} disabled={saving}>Отмена</button>
                    )}
                </div>
            </form>

            <div className="staff__list">
                {list.length === 0 && <p className="staff__empty">Объявлений пока нет.</p>}
                {list.map((item) => {
                    const active = isAnnouncementActive(item);
                    return (
                        <article key={item.id} className={`staff__item${active ? '' : ' is-off'}`}>
                            <div className="staff__meta">
                                <span className="staff__chip">{ANNOUNCEMENT_TYPES[item.type]?.label || item.type}</span>
                                <span className="staff__chip">{active ? 'Активно' : 'Не показывается'}</span>
                                <span>{formatExpiryLabel(item.expiresAt || item.expiresat)}</span>
                            </div>
                            {item.title ? <strong>{item.title}</strong> : null}
                            <p>{item.message}</p>
                            <div className="staff__row">
                                <button type="button" className="staff__btn" onClick={() => startEdit(item)} disabled={saving || busyId != null}>
                                    Изменить
                                </button>
                                <button type="button" className="staff__btn" onClick={() => remove(item)} disabled={saving || busyId != null}>
                                    Удалить
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
