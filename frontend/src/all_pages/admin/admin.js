import React, { useContext, useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useDialogA11y } from '../../hooks/useDialogA11y';
import { useForm } from "react-hook-form";
import './admin.scss';
import { CustomContext } from '../../Context';
import LoadingSpinner, { LoadingPage } from '../../components/ui/LoadingSpinner';
import { useCatalogTheme } from '../../context/CatalogThemeContext';
import { parseISO, differenceInMinutes, addDays, format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import {
    ANNOUNCEMENT_TYPES,
    fetchAnnouncements,
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
    formatExpiryLabel,
    isAnnouncementActive,
} from '../../utils/announcements';
import PhotoUploadSlot from '../../components/ui/PhotoUploadSlot';
import { uploadPhoto } from '../../utils/uploadService';

const resolveImageUrl = (img) => {
    if (!img || typeof img !== 'string') return null;
    if (img.startsWith('http')) return img;
    const file = img.split('/').pop();
    return `/utilse/${file}`;
};

const EMPTY_ANN_FORM = {
    title: '',
    message: '',
    type: 'urgent',
    expiresAt: '',
    isActive: true,
    image: '',
};

const toDatetimeLocal = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const toIsoOrNull = (localValue) => {
    if (!localValue) return null;
    const d = new Date(localValue);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

// ==================== PURE UTILITIES ====================

const calculateShiftDuration = (startDate, startTime, endDate, endTime) => {
  if (!startDate || !startTime || !endDate || !endTime) return null;
  try {
    const start = parseISO(`${startDate}T${startTime}`);
    let end = parseISO(`${endDate}T${endTime}`);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
    if (end < start) end = addDays(end, 1);
    return Math.max(0, differenceInMinutes(end, start));
  } catch {
    return null;
  }
};

const formatTime = (time) => (time ? time.slice(0, 5) : '-');
const formatDate = (date) => date.split('-').reverse().join('.');

const formatShiftPeriod = (session) => {
  if (!session.endDate || session.endDate === session.date) {
    return formatDate(session.date);
  }
  return `${formatDate(session.date)} → ${formatDate(session.endDate)}`;
};

const formatDuration = (session) => {
  if (session.durationMinutes == null) return session.endTime ? '-' : 'Активна';
  const total = session.durationMinutes;
  const days = Math.floor(total / (24 * 60));
  const hours = Math.floor((total % (24 * 60)) / 60);
  const minutes = total % 60;
  return days > 0 ? `${days} д ${hours} ч ${minutes} мин` : `${hours} ч ${minutes} мин`;
};

const normalizeTime = (input) => {
  if (!input) return null;
  const trimmed = input.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  if (hours > 23 || minutes > 59) return null;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

const sortSessions = (sessions) =>
  [...sessions].sort((a, b) => {
    const dateA = a.endDate || a.date;
    const dateB = b.endDate || b.date;
    return dateB.localeCompare(dateA) || a.startTime.localeCompare(b.startTime);
  });

const getInitials = (name = '') => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

const getPeriodLabel = (preset, dateRange) => {
  const labels = {
    today: 'Сегодня',
    week: 'Эта неделя',
    month: 'Этот месяц',
    last_month: 'Прошлый месяц',
    all: 'За всё время',
    custom: 'Произвольный период',
  };
  if (preset === 'custom' && dateRange.from && dateRange.to) {
    return `${formatDate(dateRange.from)} — ${formatDate(dateRange.to)}`;
  }
  return labels[preset] || 'Период';
};

// ==================== ПРЕСЕТЫ ПЕРИОДОВ (упрощённые и удобные) ====================
const PERIOD_PRESETS = [
  { key: 'today', label: 'Сегодня' },
  { key: 'week', label: 'Эта неделя' },
  { key: 'month', label: 'Этот месяц' },
  { key: 'last_month', label: 'Прошлый месяц' },
  { key: 'all', label: 'За всё время' },
  { key: 'custom', label: 'Произвольный' },
];

const ROLE_LABELS = {
    user: 'Сотрудник',
    manager: 'Менеджер',
    admin: 'Администратор',
};

const Admin = () => {
    const { resolvedTheme } = useCatalogTheme();
    const {
        currentUser,
        users,
        workSessions,
        manualStartShift,
        manualEndShift,
        editSession,
        deleteSession,
        addUser,
        updateUser,
        deleteUser,
        showToast,
        confirm,
        dataLoaded,
    } = useContext(CustomContext);

    // ==================== СОСТОЯНИЯ ====================
    const [selectedUser, setSelectedUser] = useState(null);
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [isEditSessionModalOpen, setIsEditSessionModalOpen] = useState(false);
    const [editingSession, setEditingSession] = useState(null);

    // ==================== НОВАЯ МОЩНАЯ ФИЛЬТРАЦИЯ (переделана с нуля по образцу кабинета) ====================
    const [activePreset, setActivePreset] = useState('today');
    const [customDateFrom, setCustomDateFrom] = useState('');
    const [customDateTo, setCustomDateTo] = useState('');
    const [employeeFilter, setEmployeeFilter] = useState(''); // '' = все, или numeric user.id (coerced from select)
    const [statusFilter, setStatusFilter] = useState('all'); // all | active | closed
    const [sortBy, setSortBy] = useState('date_desc');
    const [employeeSearch, setEmployeeSearch] = useState('');

    // Состояния загрузки для защиты от множественных кликов и визуальной обратной связи
    const [pendingShiftActions, setPendingShiftActions] = useState(new Set()); // sessionId
    const [pendingStartShiftUsers, setPendingStartShiftUsers] = useState(new Set()); // userId
    const [isSavingShift, setIsSavingShift] = useState(false); // для модалки редактирования смены
    const [isSavingUser, setIsSavingUser] = useState(false);   // для модалки пользователя

    // ==================== ОБЪЯВЛЕНИЯ ====================
    const [announcements, setAnnouncements] = useState([]);
    const [annForm, setAnnForm] = useState(EMPTY_ANN_FORM);
    const [editingAnnId, setEditingAnnId] = useState(null);
    const [annLoading, setAnnLoading] = useState(false);
    const [annSaving, setAnnSaving] = useState(false);
    const [annBusyId, setAnnBusyId] = useState(null); // id объявления при toggle/delete
    const [annPanelOpen, setAnnPanelOpen] = useState(true);

    const { register, handleSubmit, reset, setValue, watch } = useForm();

    const userModalRef = useRef(null);
    const viewModalRef = useRef(null);
    const editSessionModalRef = useRef(null);

    const closeUserModal = useCallback(() => setIsUserModalOpen(false), []);
    const closeViewModal = useCallback(() => setIsViewModalOpen(false), []);
    const closeEditSessionModal = useCallback(() => {
        setIsEditSessionModalOpen(false);
        setEditingSession(null);
    }, []);

    useDialogA11y(isUserModalOpen, closeUserModal, userModalRef);
    useDialogA11y(isViewModalOpen, closeViewModal, viewModalRef);
    useDialogA11y(isEditSessionModalOpen, closeEditSessionModal, editSessionModalRef);

    // ==================== ОБЪЯВЛЕНИЯ: загрузка и CRUD ====================
    const loadAnnouncements = useCallback(() => {
        setAnnLoading(true);
        fetchAnnouncements()
            .then((list) => setAnnouncements(Array.isArray(list) ? list : []))
            .catch(() => {
                setAnnouncements([]);
                showToast('error', 'Не удалось загрузить объявления');
            })
            .finally(() => setAnnLoading(false));
    }, [showToast]);

    useEffect(() => {
        if (currentUser?.role === 'admin') {
            loadAnnouncements();
        }
    }, [currentUser?.role, loadAnnouncements]);

    const resetAnnForm = () => {
        setAnnForm(EMPTY_ANN_FORM);
        setEditingAnnId(null);
    };

    const handleAnnFormChange = (field, value) => {
        setAnnForm((prev) => ({ ...prev, [field]: value }));
    };

    const handleAnnPlus24h = () => {
        const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
        setAnnForm((prev) => ({ ...prev, expiresAt: toDatetimeLocal(d.toISOString()) }));
    };

    const handleEditAnnouncement = (item) => {
        setEditingAnnId(item.id);
        setAnnForm({
            title: item.title || '',
            message: item.message || '',
            type: item.type === 'persistent' ? 'persistent' : 'urgent',
            expiresAt: toDatetimeLocal(item.expiresAt || item.expiresat),
            isActive: item.isActive !== false && item.isactive !== false,
        });
        setAnnPanelOpen(true);
    };

    const handleSaveAnnouncement = async (e) => {
        e.preventDefault();
        const message = (annForm.message || '').trim();
        if (!message) {
            showToast('error', 'Введите текст объявления');
            return;
        }
        if (annSaving) return;

        const payload = {
            title: (annForm.title || '').trim().slice(0, 200),
            message,
            type: annForm.type === 'persistent' ? 'persistent' : 'urgent',
            expiresAt: toIsoOrNull(annForm.expiresAt),
            isActive: !!annForm.isActive,
        };

        setAnnSaving(true);
        try {
            if (editingAnnId != null) {
                await updateAnnouncement(editingAnnId, payload);
                showToast('success', 'Объявление обновлено');
            } else {
                await createAnnouncement({
                    ...payload,
                    createdBy: currentUser?.id ?? null,
                });
                showToast(
                    'success',
                    payload.isActive
                        ? 'Объявление создано. Push отправлен подписчикам.'
                        : 'Объявление создано (выключено — push не отправлялся).'
                );
            }
            resetAnnForm();
            loadAnnouncements();
        } catch (err) {
            showToast('error', err.message || 'Ошибка сохранения объявления');
        } finally {
            setAnnSaving(false);
        }
    };

    const handleToggleAnnouncement = async (item) => {
        if (annBusyId != null || annSaving) return;
        const nextActive = !(item.isActive !== false && item.isactive !== false);
        setAnnBusyId(item.id);
        try {
            await updateAnnouncement(item.id, { isActive: nextActive });
            showToast('success', nextActive ? 'Объявление включено' : 'Объявление выключено');
            loadAnnouncements();
        } catch (err) {
            showToast('error', err.message || 'Не удалось изменить статус');
        } finally {
            setAnnBusyId(null);
        }
    };

    const handleDeleteAnnouncement = async (item) => {
        if (annBusyId != null || annSaving) return;
        const preview = String(item.title || item.message || 'Без текста').slice(0, 160);
        const ok = await confirm({
            message: `Удалить объявление?\n\n${preview}`,
            confirmLabel: 'Удалить',
            cancelLabel: 'Отмена',
            danger: true,
        });
        if (!ok) return;
        setAnnBusyId(item.id);
        try {
            await deleteAnnouncement(item.id);
            if (Number(editingAnnId) === Number(item.id)) resetAnnForm();
            showToast('success', 'Объявление удалено');
            loadAnnouncements();
        } catch (err) {
            showToast('error', err.message || 'Не удалось удалить');
        } finally {
            setAnnBusyId(null);
        }
    };

    // ==================== LOADING HELPERS ====================
    const withLoading = (setLoading, id, fn) => {
        setLoading(prev => new Set(prev).add(id));
        Promise.resolve(fn()).finally(() => {
            setLoading(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        });
    };

    const isShiftActionPending = (id) => pendingShiftActions.has(id);
    const isUserStartPending = (userId) => pendingStartShiftUsers.has(userId);

    const handleStartShift = (userId) => {
        if (isUserStartPending(userId)) return;
        withLoading(setPendingStartShiftUsers, userId, () => manualStartShift(userId));
    };

    const handleEndShift = (sessionId) => {
        if (isShiftActionPending(sessionId)) return;
        withLoading(setPendingShiftActions, sessionId, () => manualEndShift(sessionId));
    };

    const handleDeleteShift = (sessionId) => {
        if (isShiftActionPending(sessionId)) return;
        withLoading(setPendingShiftActions, sessionId, () => deleteSession(sessionId));
    };

    // ==================== ДИАПАЗОН ДАТ (мощные пресеты + произвольный период) ====================
    const dateRange = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (activePreset === 'custom' && customDateFrom && customDateTo) {
            return { from: customDateFrom, to: customDateTo };
        }

        let from, to;

        switch (activePreset) {
            case 'today':
                from = to = format(today, 'yyyy-MM-dd');
                break;
            case 'week':
                from = format(subDays(today, 6), 'yyyy-MM-dd');
                to = format(today, 'yyyy-MM-dd');
                break;
            case 'month':
                from = format(startOfMonth(today), 'yyyy-MM-dd');
                to = format(today, 'yyyy-MM-dd');
                break;
            case 'last_month': {
                const lastMonth = subMonths(today, 1);
                from = format(startOfMonth(lastMonth), 'yyyy-MM-dd');
                to = format(endOfMonth(lastMonth), 'yyyy-MM-dd');
                break;
            }
            case 'custom':
                // Пользователь выбрал "Произвольный", но ещё не указал обе даты — показываем всё до заполнения
                from = '1970-01-01';
                to = format(today, 'yyyy-MM-dd');
                break;
            case 'all':
            default:
                from = '1970-01-01';
                to = format(today, 'yyyy-MM-dd');
                break;
        }

        return { from, to };
    }, [activePreset, customDateFrom, customDateTo]);

    // ==================== ФИЛЬТРАЦИЯ СМЕН (упрощённая) ====================
    const filteredSessions = useMemo(() => {
        let result = [...workSessions];

        // 1. Фильтр по периоду (исправлено: активные и переходящие смены теперь корректно попадают в "Сегодня"/текущие периоды)
        result = result.filter(s => {
            const shiftStart = s.date;
            const shiftEnd = s.endDate || s.date;
            const isActive = !s.endTime;
            const rangeFrom = dateRange.from;
            const rangeTo = dateRange.to;

            if (isActive) {
                // Активные смены (в т.ч. ночные и >24ч) должны быть видны в актуальных представлениях
                // Показываем их, если выбранный диапазон "дотягивается" до сегодня,
                // или если начало смены попадает в диапазон.
                const todayStr = format(new Date(), 'yyyy-MM-dd');
                const rangeIsCurrent = rangeTo >= todayStr;

                if (rangeIsCurrent) {
                    // Для текущих/недавних фильтров показываем все активные, начавшиеся не позже конца диапазона
                    return shiftStart <= rangeTo;
                } else {
                    // Для исторических custom-периодов показываем активную смену только если она реально шла в тот период
                    return shiftStart >= rangeFrom && shiftStart <= rangeTo;
                }
            }

            // Завершённые смены — стандартная проверка пересечения интервалов [start, end]
            return shiftEnd >= rangeFrom && shiftStart <= rangeTo;
        });

        // 2. Фильтр по конкретному сотруднику (приводим к числу, т.к. value из <select> — строка)
        if (employeeFilter != null && employeeFilter !== '') {
            const targetId = Number(employeeFilter);
            result = result.filter(s => Number(s.userId) === targetId);
        }

        // 3. Фильтр по статусу
        if (statusFilter === 'active') {
            result = result.filter(s => !s.endTime);
        } else if (statusFilter === 'closed') {
            result = result.filter(s => !!s.endTime);
        }

        // 4. Сортировка
        if (sortBy === 'date_asc') {
            result.sort((a, b) => {
                const da = a.endDate || a.date;
                const db = b.endDate || b.date;
                return da.localeCompare(db) || a.startTime.localeCompare(b.startTime);
            });
        } else if (sortBy === 'duration_desc') {
            // Активные смены (без duration) считаем "самыми длинными" — показываем первыми
            result.sort((a, b) => {
                const da = a.durationMinutes != null ? a.durationMinutes : (a.endTime ? 0 : Infinity);
                const db = b.durationMinutes != null ? b.durationMinutes : (b.endTime ? 0 : Infinity);
                return db - da;
            });
        } else {
            // date_desc по умолчанию
            result.sort((a, b) => {
                const da = a.endDate || a.date;
                const db = b.endDate || b.date;
                return db.localeCompare(da) || b.startTime.localeCompare(a.startTime);
            });
        }

        return result;
    }, [workSessions, dateRange, employeeFilter, statusFilter, sortBy]);

    // Вспомогательная функция для получения сессий конкретного пользователя из отфильтрованного списка
    const getFilteredUserSessions = (userId) => {
        if (userId == null || userId === '') return [];
        const targetId = Number(userId);
        return filteredSessions.filter(s => Number(s.userId) === targetId);
    };

    // ==================== СТАТИСТИКА ПО ФИЛЬТРАМ (полезно для админа) ====================
    const filterStats = useMemo(() => {
        const totalShifts = filteredSessions.length;
        const activeNow = filteredSessions.filter(s => !s.endTime).length;

        const totalMinutes = filteredSessions.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
        const totalHours = Math.floor(totalMinutes / 60);

        return { totalShifts, activeNow, totalHours };
    }, [filteredSessions]);

    // Показываем только выбранного сотрудника, если фильтр активен (гораздо удобнее)
    const displayUsers = (employeeFilter != null && employeeFilter !== '')
        ? users.filter(u => Number(u.id) === Number(employeeFilter))
        : users;

    const sidebarUsers = useMemo(() => {
        const q = employeeSearch.trim().toLowerCase();
        if (!q) return users;
        return users.filter(u =>
            u.fullName?.toLowerCase().includes(q) ||
            u.position?.toLowerCase().includes(q) ||
            u.phone?.includes(q)
        );
    }, [users, employeeSearch]);

    const getUserShiftStats = (userId) => {
        const sessions = getFilteredUserSessions(userId);
        const totalMinutes = sessions.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
        return {
            count: sessions.length,
            hours: Math.floor(totalMinutes / 60),
            minutes: totalMinutes % 60,
            activeCount: sessions.filter(s => !s.endTime).length,
        };
    };

    const focusEmployee = (userId) => {
        setEmployeeFilter(userId);
        setActivePreset('all');
        setCustomDateFrom('');
        setCustomDateTo('');
    };

    const adminClassName = (extra = '') =>
        ['admin', `admin--theme-${resolvedTheme}`, extra].filter(Boolean).join(' ');

    if (!currentUser || currentUser.role !== 'admin') {
        return (
            <div className={adminClassName('admin--denied')}>
                <div className="admin-access-denied">
                    <span className="admin-access-denied__icon" aria-hidden="true">⛔</span>
                    <h2>Доступ запрещён</h2>
                    <p>Эта страница доступна только администраторам</p>
                </div>
            </div>
        );
    }

    // getAllUserSessions — используется в модалке просмотра профиля (показывает ВСЕ смены сотрудника)
    const getAllUserSessions = (userId) => {
        if (userId == null || userId === '') return [];
        const targetId = Number(userId);
        return sortSessions(workSessions.filter(s => Number(s.userId) === targetId));
    };

    // ==================== ОБРАБОТЧИКИ ====================
    const openUserForm = (user = null) => {
        if (user) {
            setSelectedUser(user);
            reset({
                fullName: user.fullName || '',
                login: user.login || '',
                password: '',
                phone: user.phone || '',
                position: user.position || '',
                description: user.description || '',
                badgeId: user.badgeId || '',
                role: user.role || 'user',
            });
        } else {
            setSelectedUser(null);
            reset({
                fullName: '', login: '', password: '', phone: '', position: '',
                description: '', badgeId: '', role: 'user'
            });
        }
        setIsUserModalOpen(true);
    };

    const openViewModal = (user) => {
        setSelectedUser(user);
        setIsViewModalOpen(true);
    };

    // Главная функция сохранения
    const onSubmitUser = async (data) => {
        if (isSavingUser) return;
        setIsSavingUser(true);

        try {
            if (selectedUser) {
                // Редактирование
                await updateUser(selectedUser.id, data);
                showToast('success', 'Данные сотрудника обновлены!');
            } else {
                // Создание нового
                const newUserData = {
                    ...data,
                    email: null,           // если нужно
                    avatar: null
                };
                await addUser(newUserData);
                showToast('success', 'Новый сотрудник успешно создан!');
            }

            setIsUserModalOpen(false);
            reset();
        } catch (err) {
            console.error("Ошибка при сохранении:", err);
            showToast('error', 'Ошибка при сохранении. Проверьте консоль.');
        } finally {
            setIsSavingUser(false);
        }
    };

    const handleDeleteUser = async (user) => {
        const confirmed = await confirm({
            message: `Вы уверены, что хотите удалить сотрудника "${user.fullName}"?`,
            confirmLabel: 'Удалить',
            danger: true,
        });
        if (confirmed) await deleteUser(user.id);
    };

    const openEditSessionModal = (session) => {
        setEditingSession(session);
        setValue('startTime', session.startTime?.slice(0, 5) || '');
        setValue('endTime', session.endTime?.slice(0, 5) || '');
        setValue('startDate', session.date);

        if (session.endDate && session.endDate !== session.date) {
            setValue('endDateType', 'custom');
            setValue('customEndDate', session.endDate);
        } else {
            setValue('endDateType', 'same');
        }

        setIsEditSessionModalOpen(true);
    };

    const onSubmitEditSession = async (data) => {
        if (!editingSession || isSavingShift) return;

        setIsSavingShift(true);

        const normalizedStart = normalizeTime(data.startTime);
        if (!normalizedStart) {
            showToast('error', 'Неверный формат времени прихода');
            return;
        }

        let normalizedEnd = null;
        if (data.endTime?.trim()) {
            normalizedEnd = normalizeTime(data.endTime);
            if (!normalizedEnd) {
                showToast('error', 'Неверный формат времени ухода');
                return;
            }
        }

        // === Определяем финальные даты ===
        const startDate = data.startDate || editingSession.date;   // пользователь мог поменять дату начала

        let endDate = startDate; // по умолчанию та же дата

        if (data.endDateType === 'next') {
            endDate = format(addDays(parseISO(startDate), 1), 'yyyy-MM-dd');
        } else if (data.endDateType === 'custom' && data.customEndDate) {
            endDate = data.customEndDate;
        } else if (editingSession.endDate) {
            endDate = editingSession.endDate; // сохраняем старую, если не меняли
        }

        const updates = {
            date: startDate,
            startTime: normalizedStart + ':00',
            status: 'manually_edited',
            editedBy: currentUser.id,
        };

        // === Расчёт продолжительности ===
        if (data.manualDurationHours && !isNaN(parseFloat(data.manualDurationHours))) {
            updates.durationMinutes = Math.round(parseFloat(data.manualDurationHours) * 60);
            if (normalizedEnd) {
                updates.endTime = normalizedEnd + ':00';
                if (endDate && endDate !== startDate) {
                    updates.endDate = endDate;
                }
            }
        } 
        else if (normalizedEnd) {
            updates.endTime = normalizedEnd + ':00';

            if (endDate && endDate !== startDate) {
                updates.endDate = endDate;
            }

            updates.durationMinutes = calculateShiftDuration(
                startDate,
                updates.startTime,
                endDate,
                updates.endTime
            );
        } else {
            updates.endTime = null;
            updates.durationMinutes = null;
            // Не отправляем endDate если смена активная
        }

        try {
            await editSession(editingSession.id, updates);
            showToast('success', 'Смена успешно обновлена!');
            setIsEditSessionModalOpen(false);
            setEditingSession(null);
        } catch (err) {
            console.error('Ошибка при сохранении смены:', err);
            showToast('error', 'Не удалось сохранить изменения смены. Смотри консоль браузера (F12).');
            // Не закрываем модалку при ошибке — пользователь может исправить данные
        } finally {
            setIsSavingShift(false);
        }
    };

    if (!dataLoaded) {
        return <LoadingPage message="Загрузка панели администратора..." />;
    }

    return (
        <div className={adminClassName()}>
            <div className="admin-ambient" aria-hidden="true">
                <div className="admin-ambient__orb admin-ambient__orb--1" />
                <div className="admin-ambient__orb admin-ambient__orb--2" />
                <div className="admin-ambient__grain" />
            </div>

            <header className="admin-hero">
                <div className="admin-hero__intro">
                    <span className="admin-hero__badge">Управление командой</span>
                    <h1 className="admin-hero__title">Панель администратора</h1>
                </div>
                <div className="admin-hero__stats">
                    <div className="admin-stat">
                        <span className="admin-stat__value">{users.length}</span>
                        <span className="admin-stat__label">сотрудников</span>
                    </div>
                    <div className="admin-stat">
                        <span className="admin-stat__value">{filterStats.activeNow}</span>
                        <span className="admin-stat__label">на смене</span>
                    </div>
                    <div className="admin-stat">
                        <span className="admin-stat__value">{filterStats.totalHours}</span>
                        <span className="admin-stat__label">часов за период</span>
                    </div>
                </div>
            </header>

            <section className="admin-announcements" aria-labelledby="admin-announcements-title">
                <div className="admin-announcements__head">
                    <div className="admin-announcements__head-text">
                        <h2 id="admin-announcements-title" className="admin-announcements__title">
                            Объявления для сотрудников
                        </h2>
                        <div className="admin-announcements__stats">
                            <span className="admin-announcements__stat">
                                Всего <strong>{announcements.length}</strong>
                            </span>
                            <span className="admin-announcements__stat admin-announcements__stat--on">
                                Активных{' '}
                                <strong>
                                    {announcements.filter((a) => isAnnouncementActive(a)).length}
                                </strong>
                            </span>
                        </div>
                    </div>
                    <button
                        type="button"
                        className="admin-announcements__toggle"
                        onClick={() => setAnnPanelOpen((v) => !v)}
                        aria-expanded={annPanelOpen}
                        aria-controls="admin-announcements-body"
                    >
                        {annPanelOpen ? 'Свернуть' : 'Развернуть'}
                    </button>
                </div>

                {annPanelOpen && (
                    <div id="admin-announcements-body" className="admin-announcements__body">
                        <form
                            className={`admin-announcements__form${
                                editingAnnId != null ? ' admin-announcements__form--editing' : ''
                            }`}
                            onSubmit={handleSaveAnnouncement}
                        >
                            <div className="admin-announcements__panel-head">
                                <h3 className="admin-announcements__panel-title">
                                    {editingAnnId != null ? 'Редактирование' : 'Новое объявление'}
                                </h3>
                                <p className="admin-announcements__hint">
                                    {ANNOUNCEMENT_TYPES[annForm.type]?.hint}
                                </p>
                            </div>

                            <div className="admin-announcements__form-grid">
                                <label className="admin-announcements__field admin-announcements__field--title">
                                    <span>Заголовок</span>
                                    <input
                                        type="text"
                                        maxLength={200}
                                        value={annForm.title}
                                        onChange={(e) => handleAnnFormChange('title', e.target.value)}
                                        placeholder="Необязательно"
                                    />
                                </label>
                                <label className="admin-announcements__field admin-announcements__field--type">
                                    <span>Тип</span>
                                    <select
                                        value={annForm.type}
                                        onChange={(e) => handleAnnFormChange('type', e.target.value)}
                                    >
                                        {Object.values(ANNOUNCEMENT_TYPES).map((t) => (
                                            <option key={t.key} value={t.key}>
                                                {t.label}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label className="admin-announcements__field admin-announcements__field--message">
                                    <span>Текст *</span>
                                    <textarea
                                        rows={3}
                                        required
                                        value={annForm.message}
                                        onChange={(e) => handleAnnFormChange('message', e.target.value)}
                                        placeholder="Текст объявления для сотрудников"
                                    />
                                </label>

                                {/* UI под фото к новости — логику upload подключит отдельный разработчик */}
                                <div className="admin-announcements__field admin-announcements__field--photo">
                                    <PhotoUploadSlot
                                        inputId="admin-announcement-photo"
                                        label="Фото к объявлению"
                                        hint="Картинка к новости/объявлению"
                                        variant="banner"
                                        className="admin-announcements__photo-slot"
                                        previewUrl={annForm.image ? resolveImageUrl(annForm.image) : ''}
                                        onFileChange={async (e) => {
                                            const file = e.target.files[0];
                                            if (!file) return;
                                            try {
                                                const path = await uploadPhoto(file);
                                                handleAnnFormChange('image', path);
                                                showToast('success', 'Фото объявления загружено');
                                            } catch (err) {
                                                showToast('error', 'Ошибка загрузки фото: ' + err.message);
                                            }
                                        }}
                                        onRemove={() => handleAnnFormChange('image', '')}
                                    />
                                </div>

                                <label className="admin-announcements__field admin-announcements__field--expires">
                                    <span>Дата окончания</span>
                                    <input
                                        type="datetime-local"
                                        value={annForm.expiresAt}
                                        onChange={(e) => handleAnnFormChange('expiresAt', e.target.value)}
                                    />
                                </label>

                                <div className="admin-announcements__toolbar">
                                    <div className="admin-announcements__toolbar-left">
                                        <button
                                            type="button"
                                            className="admin-ann-btn admin-ann-btn--ghost"
                                            onClick={handleAnnPlus24h}
                                        >
                                            +24 часа
                                        </button>
                                        {annForm.expiresAt ? (
                                            <button
                                                type="button"
                                                className="admin-ann-btn admin-ann-btn--ghost"
                                                onClick={() => handleAnnFormChange('expiresAt', '')}
                                            >
                                                Без срока
                                            </button>
                                        ) : null}
                                        <label className="admin-announcements__check">
                                            <input
                                                type="checkbox"
                                                checked={!!annForm.isActive}
                                                onChange={(e) =>
                                                    handleAnnFormChange('isActive', e.target.checked)
                                                }
                                            />
                                            <span>Активно</span>
                                        </label>
                                    </div>
                                    <div className="admin-announcements__toolbar-right">
                                        {editingAnnId != null && (
                                            <button
                                                type="button"
                                                className="admin-ann-btn admin-ann-btn--ghost"
                                                onClick={resetAnnForm}
                                                disabled={annSaving}
                                            >
                                                Отмена
                                            </button>
                                        )}
                                        <button
                                            type="submit"
                                            className="admin-ann-btn admin-ann-btn--primary"
                                            disabled={annSaving}
                                        >
                                            {annSaving
                                                ? 'Сохранение…'
                                                : editingAnnId != null
                                                  ? 'Сохранить'
                                                  : 'Создать'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </form>

                        <div className="admin-announcements__list-wrap">
                            <div className="admin-announcements__panel-head">
                                <h3 className="admin-announcements__panel-title">Все объявления</h3>
                                <span className="admin-announcements__list-meta">
                                    {annLoading
                                        ? 'Загрузка…'
                                        : announcements.length === 0
                                          ? 'пусто'
                                          : `${announcements.length} шт.`}
                                </span>
                            </div>

                            <div className="admin-announcements__list" role="list">
                                {annLoading && (
                                    <p className="admin-announcements__empty">Загрузка объявлений…</p>
                                )}
                                {!annLoading && announcements.length === 0 && (
                                    <p className="admin-announcements__empty">
                                        Пока нет объявлений — создайте первое слева
                                    </p>
                                )}
                                {!annLoading &&
                                    [...announcements]
                                        .sort((a, b) => {
                                            const da = new Date(
                                                a.createdAt || a.createdat || 0
                                            ).getTime();
                                            const db = new Date(
                                                b.createdAt || b.createdat || 0
                                            ).getTime();
                                            return db - da;
                                        })
                                        .map((item) => {
                                            const active = isAnnouncementActive(item);
                                            const typeLabel =
                                                ANNOUNCEMENT_TYPES[item.type]?.label ||
                                                item.type ||
                                                '—';
                                            const expires = item.expiresAt || item.expiresat;
                                            const itemBusy =
                                                Number(annBusyId) === Number(item.id);
                                            const isEditing =
                                                Number(editingAnnId) === Number(item.id);
                                            return (
                                                <article
                                                    key={item.id}
                                                    className={[
                                                        'admin-announcements__item',
                                                        item.type === 'persistent'
                                                            ? 'admin-announcements__item--persistent'
                                                            : 'admin-announcements__item--urgent',
                                                        active
                                                            ? ''
                                                            : 'admin-announcements__item--inactive',
                                                        isEditing
                                                            ? 'admin-announcements__item--editing'
                                                            : '',
                                                    ]
                                                        .filter(Boolean)
                                                        .join(' ')}
                                                    role="listitem"
                                                >
                                                    <div className="admin-announcements__item-main">
                                                        <div className="admin-announcements__item-meta">
                                                            <span
                                                                className={`admin-ann-badge admin-ann-badge--${
                                                                    item.type === 'persistent'
                                                                        ? 'persistent'
                                                                        : 'urgent'
                                                                }`}
                                                            >
                                                                {typeLabel}
                                                            </span>
                                                            <span
                                                                className={`admin-ann-badge ${
                                                                    active
                                                                        ? 'admin-ann-badge--on'
                                                                        : 'admin-ann-badge--off'
                                                                }`}
                                                            >
                                                                {active
                                                                    ? 'Активно'
                                                                    : 'Не показывается'}
                                                            </span>
                                                            <span className="admin-announcements__expiry">
                                                                {formatExpiryLabel(expires)}
                                                            </span>
                                                        </div>
                                                        {item.title ? (
                                                            <strong className="admin-announcements__item-title">
                                                                {item.title}
                                                            </strong>
                                                        ) : null}
                                                        <p className="admin-announcements__item-text">
                                                            {item.message}
                                                        </p>
                                                    </div>
                                                    <div className="admin-announcements__item-actions">
                                                        <button
                                                            type="button"
                                                            className="admin-ann-btn admin-ann-btn--ghost"
                                                            onClick={() =>
                                                                handleEditAnnouncement(item)
                                                            }
                                                            disabled={
                                                                annSaving || annBusyId != null
                                                            }
                                                        >
                                                            Изменить
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="admin-ann-btn admin-ann-btn--ghost"
                                                            onClick={() =>
                                                                handleToggleAnnouncement(item)
                                                            }
                                                            disabled={
                                                                annSaving || annBusyId != null
                                                            }
                                                        >
                                                            {itemBusy
                                                                ? '…'
                                                                : item.isActive !== false &&
                                                                    item.isactive !== false
                                                                  ? 'Выкл'
                                                                  : 'Вкл'}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="admin-ann-btn admin-ann-btn--danger"
                                                            onClick={() =>
                                                                handleDeleteAnnouncement(item)
                                                            }
                                                            disabled={
                                                                annSaving || annBusyId != null
                                                            }
                                                        >
                                                            {itemBusy ? '…' : 'Удалить'}
                                                        </button>
                                                    </div>
                                                </article>
                                            );
                                        })}
                            </div>
                        </div>
                    </div>
                )}
            </section>

            <div className="admin__top">
                <div className="admin__top__left">
                    <div className="admin__filters">
                        <div className="admin__filters__head">
                            <h2 className="admin__filters__title">Журнал смен</h2>
                            <span className="admin__filters__period">{getPeriodLabel(activePreset, dateRange)}</span>
                        </div>
                        {/* Быстрые пресеты периодов */}
                        <div className="admin__filters__presets" role="group" aria-label="Период">
                            {PERIOD_PRESETS.map(preset => (
                                <button
                                    key={preset.key}
                                    type="button"
                                    className={`preset-btn ${activePreset === preset.key ? 'active' : ''}`}
                                    onClick={() => setActivePreset(preset.key)}
                                    aria-pressed={activePreset === preset.key}
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>

                        {/* Произвольный период */}
                        {activePreset === 'custom' && (
                            <div className="admin__filters__custom">
                                <input
                                    type="date"
                                    value={customDateFrom}
                                    onChange={(e) => setCustomDateFrom(e.target.value)}
                                    placeholder="Дата с"
                                />
                                <span>—</span>
                                <input
                                    type="date"
                                    value={customDateTo}
                                    onChange={(e) => setCustomDateTo(e.target.value)}
                                    placeholder="Дата по"
                                />
                            </div>
                        )}

                        {/* Компактная панель фильтров */}
                        <div className="admin__filters__toolbar">
                            <select
                                aria-label="Фильтр по сотруднику"
                                value={employeeFilter}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    const newEmp = val ? Number(val) : '';
                                    setEmployeeFilter(newEmp);
                                    // При выборе конкретного сотрудника сразу переключаемся на "За всё время",
                                    // чтобы его смены (включая старые) сразу отобразились. Пользователь потом может
                                    // сузить период пресетами, если нужно.
                                    if (newEmp) {
                                        setActivePreset('all');
                                        setCustomDateFrom('');
                                        setCustomDateTo('');
                                    }
                                }}
                                title="Фильтр по сотруднику"
                            >
                                <option value="">Все сотрудники</option>
                                {users.map(u => (
                                    <option key={u.id} value={u.id}>{u.fullName}</option>
                                ))}
                            </select>

                            <select
                                aria-label="Фильтр по статусу смены"
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                title="Фильтр по статусу смены"
                            >
                                <option value="all">Все статусы</option>
                                <option value="active">Только активные</option>
                                <option value="closed">Только завершённые</option>
                            </select>

                            <select
                                aria-label="Сортировка смен"
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                title="Сортировка"
                            >
                                <option value="date_desc">Сначала новые</option>
                                <option value="date_asc">Сначала старые</option>
                                <option value="duration_desc">По длительности ↓</option>
                            </select>

                            <button
                                className="reset-btn"
                                onClick={() => {
                                    setActivePreset('today');
                                    setCustomDateFrom('');
                                    setCustomDateTo('');
                                    setEmployeeFilter('');
                                    setStatusFilter('all');
                                    setSortBy('date_desc');
                                }}
                            >
                                Сбросить
                            </button>

                            {employeeFilter !== '' && employeeFilter != null && (
                                <button
                                    type="button"
                                    className="btn-clear-focus"
                                    onClick={() => setEmployeeFilter('')}
                                >
                                    Сбросить фокус
                                </button>
                            )}
                        </div>

                        <div className="admin__filters__stats">
                            <div className="admin-mini-stat">
                                <span className="admin-mini-stat__value">{filterStats.totalShifts}</span>
                                <span className="admin-mini-stat__label">смен в выборке</span>
                            </div>
                            <div className="admin-mini-stat">
                                <span className="admin-mini-stat__value">{filterStats.activeNow}</span>
                                <span className="admin-mini-stat__label">активных</span>
                            </div>
                            <div className="admin-mini-stat">
                                <span className="admin-mini-stat__value">{filterStats.totalHours} ч</span>
                                <span className="admin-mini-stat__label">отработано</span>
                            </div>
                        </div>
                    </div>

                    <div className="admin__table" role="region" aria-label="Журнал смен по сотрудникам">
                        <div className="admin__table__header" aria-hidden="true">
                            <span></span>
                            <span>Период</span>
                            <span>Приход</span>
                            <span>Уход</span>
                            <span>Отработано</span>
                            <span>Статус</span>
                            <span>Действия</span>
                        </div>

                        {displayUsers.map(user => {
                            const sessions = getFilteredUserSessions(user.id);
                            return (
                                <div key={user.id} className="admin__table__user-group">
                                    <div className="admin__table__user-header">
                                        <div className="admin__table__user-title">
                                            <strong>{user.fullName}</strong>
                                            {user.position && <span className="user-position"> — {user.position}</span>}
                                        </div>
                                        {Number(employeeFilter) !== Number(user.id) && (
                                            <button
                                                type="button"
                                                className="btn-focus"
                                                onClick={() => focusEmployee(user.id)}
                                                title="Показать все смены этого сотрудника"
                                                aria-label={`Показать все смены: ${user.fullName}`}
                                            >
                                                Фокус
                                            </button>
                                        )}
                                    </div>

                                    {sessions.length === 0 ? (
                                        <div className="admin__table__row admin__table__row--empty">
                                            <span>Смены отсутствуют в выбранном фильтре</span>
                                            <span className="admin__table__actions">
                                                <button
                                                    onClick={() => handleStartShift(user.id)}
                                                    className="btn-start"
                                                    disabled={isUserStartPending(user.id)}
                                                >
                                                    {isUserStartPending(user.id) ? '⏳ Загрузка...' : '▶ Старт'}
                                                </button>
                                            </span>
                                        </div>
                                    ) : (
                                        sessions.map(session => (
                                            <div key={session.id} className="admin__table__row">
                                                <span></span>
                                                <span>{formatShiftPeriod(session)}</span>
                                                <span>{formatTime(session.startTime)}</span>
                                                <span>{formatTime(session.endTime)}</span>
                                                <span>{formatDuration(session)}</span>
                                                <span className={`status status--${session.endTime ? 'completed' : 'active'}`}>
                                                    {session.endTime ? 'Завершена' : 'На работе'}
                                                </span>
                                                <span className="admin__table__actions">
                                                    {!session.endTime && (
                                                        <button
                                                            onClick={() => handleEndShift(session.id)}
                                                            className="btn-end"
                                                            disabled={isShiftActionPending(session.id)}
                                                        >
                                                            {isShiftActionPending(session.id) ? '⏳' : '⏹ Завершить'}
                                                        </button>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => openEditSessionModal(session)}
                                                        className="btn-edit"
                                                        title="Редактировать смену"
                                                        aria-label={`Редактировать смену ${formatShiftPeriod(session)}`}
                                                        disabled={isShiftActionPending(session.id)}
                                                    >
                                                        <span aria-hidden="true">✎</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteShift(session.id)}
                                                        className="btn-delete"
                                                        title="Удалить смену"
                                                        aria-label={`Удалить смену ${formatShiftPeriod(session)}`}
                                                        disabled={isShiftActionPending(session.id)}
                                                    >
                                                        <span aria-hidden="true">{isShiftActionPending(session.id) ? '⏳' : '🗑'}</span>
                                                    </button>
                                                </span>
                                            </div>
                                        ))
                                    )}

                                    {sessions.length > 0 && (
                                        <div className="admin__table__row admin__table__row--footer">
                                            <span></span>
                                            <span></span>
                                            <span></span>
                                            <span></span>
                                            <span></span>
                                            <span></span>
                                            <span className="admin__table__actions">
                                                <button
                                                    onClick={() => handleStartShift(user.id)}
                                                    className="btn-start"
                                                    disabled={isUserStartPending(user.id)}
                                                >
                                                    {isUserStartPending(user.id) ? '⏳ Загрузка...' : '▶ Новая'}
                                                </button>
                                            </span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="admin__top__right">
                    <h2>Сотрудники</h2>

                    <div className="admin-search">
                        <svg className="admin-search__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
                            <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                        </svg>
                        <input
                            type="search"
                            className="admin-search__input"
                            placeholder="Поиск сотрудника..."
                            value={employeeSearch}
                            onChange={(e) => setEmployeeSearch(e.target.value)}
                            aria-label="Поиск сотрудника"
                        />
                        {employeeSearch && (
                            <button
                                type="button"
                                className="admin-search__clear"
                                onClick={() => setEmployeeSearch('')}
                                aria-label="Очистить поиск"
                            >
                                ×
                            </button>
                        )}
                    </div>

                    <button onClick={() => openUserForm()} className="btn-add">＋ Добавить сотрудника</button>

                    <div className="users-list">
                        {sidebarUsers.length === 0 ? (
                            <div className="users-list__empty">Никого не найдено</div>
                        ) : sidebarUsers.map(user => {
                            const stats = getUserShiftStats(user.id);
                            return (
                            <div
                                key={user.id}
                                className={`user-item${Number(employeeFilter) === Number(user.id) ? ' user-item--focused' : ''}`}
                            >
                                <div className="user-item__head">
                                    <span className="user-item__avatar" aria-hidden="true">
                                        {user.avatar ? (
                                            <img src={resolveImageUrl(user.avatar)} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                                        ) : (
                                            getInitials(user.fullName)
                                        )}
                                    </span>
                                    <div className="user-item__info">
                                        <strong>{user.fullName}</strong>
                                        <small>{user.position || '—'} • {user.phone || '—'}</small>
                                        <span className="user-item__meta">
                                            {stats.count} смен · {stats.hours} ч
                                            {stats.activeCount > 0 && (
                                                <span className="user-item__live"> · на смене</span>
                                            )}
                                        </span>
                                    </div>
                                </div>
                                <div className="user-actions">
                                    <button
                                        onClick={() => handleStartShift(user.id)}
                                        className="btn-start"
                                        disabled={isUserStartPending(user.id)}
                                    >
                                        {isUserStartPending(user.id) ? '⏳ Загрузка...' : '▶ Начать смену'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => focusEmployee(user.id)}
                                        className="btn-focus"
                                        title="Показать все смены этого сотрудника"
                                    >
                                        Фокус
                                    </button>
                                    <button type="button" onClick={() => openViewModal(user)} className="btn-view" aria-label={`Просмотреть профиль: ${user.fullName}`}>
                                        <span aria-hidden="true">👁</span> Просмотреть
                                    </button>
                                    <button type="button" onClick={() => openUserForm(user)} className="btn-edit" aria-label={`Редактировать: ${user.fullName}`}>
                                        <span aria-hidden="true">✎</span> Редактировать
                                    </button>
                                    <button type="button" onClick={() => handleDeleteUser(user)} className="btn-delete" aria-label={`Удалить сотрудника: ${user.fullName}`}>
                                        <span aria-hidden="true">🗑</span> Удалить
                                    </button>
                                </div>
                            </div>
                        );
                        })}
                    </div>
                </div>
            </div>

            {/* Модалка создания / редактирования */}
            {isUserModalOpen && (
                <div className="modal" onClick={() => !isSavingUser && setIsUserModalOpen(false)} role="presentation">
                    <div
                        ref={userModalRef}
                        className="modal__content"
                        onClick={(e) => e.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="admin-user-modal-title"
                        tabIndex={-1}
                    >
                        <button type="button" className="modal__close" onClick={() => setIsUserModalOpen(false)} aria-label="Закрыть">✕</button>
                        <h2 id="admin-user-modal-title">{selectedUser ? 'Редактирование сотрудника' : 'Новый сотрудник'}</h2>
                        <form onSubmit={handleSubmit(onSubmitUser)}>
                            {/* UI аватара — логику upload подключит отдельный разработчик */}
                            <PhotoUploadSlot
                                inputId="admin-user-avatar"
                                label="Аватар"
                                hint="Фото профиля"
                                variant="avatar"
                                className="modal__avatar-slot"
                                previewUrl={watch('avatar') ? resolveImageUrl(watch('avatar')) : ''}
                                onFileChange={async (e) => {
                                    const file = e.target.files[0];
                                    if (!file) return;
                                    try {
                                        const path = await uploadPhoto(file);
                                        setValue('avatar', path);
                                        showToast('success', 'Аватар сотрудника загружен');
                                    } catch (err) {
                                        showToast('error', 'Ошибка загрузки аватара: ' + err.message);
                                    }
                                }}
                                onRemove={() => setValue('avatar', null)}
                            />
                            <input {...register('fullName', { required: true })} placeholder="ФИО *" aria-label="ФИО" />
                            <input {...register('login', { required: true })} placeholder="Логин *" aria-label="Логин" />
                            <input {...register('password')} type="password" placeholder="Пароль" aria-label="Пароль" />
                            <input {...register('phone')} placeholder="Телефон" aria-label="Телефон" />
                            <input {...register('position')} placeholder="Должность" aria-label="Должность" />
                            <input {...register('badgeId')} placeholder="ID Бейджика" aria-label="ID бейджа" />
                            <select {...register('role')} aria-label="Роль">
                                <option value="user">Сотрудник</option>
                                <option value="manager">Менеджер</option>
                                <option value="admin">Администратор</option>
                            </select>
                            <textarea {...register('description')} placeholder="Описание" rows={3} aria-label="Описание" />

                            <div className="modal__actions">
                                <button type="submit" disabled={isSavingUser}>
                                    {isSavingUser ? <><LoadingSpinner size="sm" /> Сохранение...</> : (selectedUser ? 'Сохранить изменения' : 'Создать сотрудника')}
                                </button>
                                <button 
                                    type="button" 
                                    onClick={() => setIsUserModalOpen(false)}
                                    disabled={isSavingUser}
                                >
                                    Отмена
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Остальные модалки (просмотр и редактирование смены) */}
            {isViewModalOpen && selectedUser && (
                <div className="modal" onClick={() => setIsViewModalOpen(false)} role="presentation">
                    <div
                        ref={viewModalRef}
                        className="modal__content modal__content--large"
                        onClick={(e) => e.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="admin-view-modal-title"
                        tabIndex={-1}
                    >
                        <h2 id="admin-view-modal-title">Профиль — {selectedUser.fullName}</h2>
                        <button type="button" className="modal__close" onClick={() => setIsViewModalOpen(false)} aria-label="Закрыть">✕</button>

                        <div className="user-info">
                            <div className="user-info__avatar" aria-hidden="true">
                                {selectedUser.avatar ? (
                                    <img src={resolveImageUrl(selectedUser.avatar)} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                                ) : (
                                    getInitials(selectedUser.fullName)
                                )}
                            </div>
                            <div className="user-info__grid">
                                <p><strong>Логин</strong><span>{selectedUser.login}</span></p>
                                <p><strong>Телефон</strong><span>{selectedUser.phone || '—'}</span></p>
                                <p><strong>Должность</strong><span>{selectedUser.position || '—'}</span></p>
                                <p><strong>Роль</strong><span>{ROLE_LABELS[selectedUser.role] || selectedUser.role}</span></p>
                                <p><strong>ID бейджа</strong><span>{selectedUser.badgeId || '—'}</span></p>
                            </div>
                            {selectedUser.description && (
                                <p className="user-info__desc"><strong>Описание</strong><span>{selectedUser.description}</span></p>
                            )}
                        </div>

                        <h3 className="modal__section-title">История смен</h3>
                        <div className="history-list">
                            {getAllUserSessions(selectedUser.id).length === 0 ? (
                                <p>Смен нет</p>
                            ) : (
                                getAllUserSessions(selectedUser.id).map(session => (
                                    <div key={session.id} className="history-item">
                                        <div className="history-date">{formatShiftPeriod(session)}</div>
                                        <div className="history-time">{formatTime(session.startTime)} — {formatTime(session.endTime)}</div>
                                        <div className="history-duration">{formatDuration(session)}</div>
                                        <div className="history-item__actions">
                                            <button
                                                type="button"
                                                onClick={() => openEditSessionModal(session)}
                                                className="btn-edit-small"
                                                aria-label={`Редактировать смену ${formatShiftPeriod(session)}`}
                                                disabled={isShiftActionPending(session.id)}
                                            >
                                                <span aria-hidden="true">✎</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteShift(session.id)}
                                                className="btn-delete btn-delete--compact"
                                                title="Удалить смену"
                                                aria-label={`Удалить смену ${formatShiftPeriod(session)}`}
                                                disabled={isShiftActionPending(session.id)}
                                            >
                                                <span aria-hidden="true">{isShiftActionPending(session.id) ? '⏳' : '🗑'}</span>
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {isEditSessionModalOpen && editingSession && (
                <div className="modal" onClick={() => !isSavingShift && setIsEditSessionModalOpen(false)} role="presentation">
                    <div
                        ref={editSessionModalRef}
                        className="modal__content"
                        onClick={(e) => e.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="admin-edit-session-title"
                        tabIndex={-1}
                    >
                        <button
                            type="button"
                            className="modal__close"
                            onClick={() => { setIsEditSessionModalOpen(false); setEditingSession(null); }}
                            aria-label="Закрыть"
                        >
                            ✕
                        </button>
                        <h2 id="admin-edit-session-title">Редактирование смены</h2>
                        <p className="modal__subtitle">
                            <strong>{users.find(u => Number(u.id) === Number(editingSession.userId))?.fullName || 'Сотрудник'}</strong>
                            {' — '}{formatShiftPeriod(editingSession)}
                        </p>

                        <form onSubmit={handleSubmit(onSubmitEditSession)}>
                            <div className="modal__field">
                                <label>Дата начала смены</label>
                                <input type="date" {...register('startDate')} />
                            </div>

                            <div className="modal__field">
                                <label>Время прихода</label>
                                <input {...register('startTime', { required: true })} placeholder="ЧЧ:ММ" />
                            </div>

                            <div className="modal__field">
                                <label>Дата окончания смены</label>
                                <select {...register('endDateType')} defaultValue="same">
                                    <option value="same">В тот же день</option>
                                    <option value="next">На следующий день</option>
                                    <option value="custom">Другая дата</option>
                                </select>

                                {watch('endDateType') === 'custom' && (
                                    <input type="date" {...register('customEndDate')} className="modal__field-nested" />
                                )}
                            </div>

                            <div className="modal__field">
                                <label>Время ухода</label>
                                <input {...register('endTime')} placeholder="Оставьте пустым, если смена активна" />
                            </div>

                            <div className="modal__field">
                                <label>Продолжительность вручную (часы)</label>
                                <input
                                    {...register('manualDurationHours')}
                                    type="number"
                                    step="0.25"
                                    placeholder="Например 25.5"
                                />
                            </div>

                            <div className="modal__actions">
                                <button type="submit" disabled={isSavingShift}>
                                    {isSavingShift ? <><LoadingSpinner size="sm" /> Сохранение...</> : 'Сохранить'}
                                </button>
                                <button 
                                    type="button" 
                                    onClick={() => {setIsEditSessionModalOpen(false); setEditingSession(null);}}
                                    disabled={isSavingShift}
                                >
                                    Отмена
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Admin;