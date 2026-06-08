import React, { useContext, useState, useMemo } from 'react';
import { useForm } from "react-hook-form";
import './admin.scss';
import { CustomContext } from '../../Context';
import { parseISO, differenceInMinutes, addDays, format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { QRCodeSVG } from 'qrcode.react';
import { useModal } from '../../ModalContext';

// ==================== PURE UTILITIES ====================
// ... (code omitted for lines 10-69)
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

// ==================== ПРЕСЕТЫ ПЕРИОДОВ (упрощённые и удобные) ====================
const PERIOD_PRESETS = [
  { key: 'today', label: 'Сегодня' },
  { key: 'week', label: 'Эта неделя' },
  { key: 'month', label: 'Этот месяц' },
  { key: 'last_month', label: 'Прошлый месяц' },
  { key: 'all', label: 'За всё время' },
  { key: 'custom', label: 'Произвольный' },
];

const Admin = () => {
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
    } = useContext(CustomContext);

    const { showAlert, showConfirm } = useModal();

    // ==================== СОСТОЯНИЯ ====================
    const [selectedUser, setSelectedUser] = useState(null);
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [isEditSessionModalOpen, setIsEditSessionModalOpen] = useState(false);
    const [editingSession, setEditingSession] = useState(null);
    const [qrUser, setQrUser] = useState(null);
    const [isQrModalOpen, setIsQrModalOpen] = useState(false);

    // Получение актуального пользователя из глобального стейта context по ID
    const activeUser = useMemo(() => {
        if (!selectedUser) return null;
        return users.find(u => Number(u.id) === Number(selectedUser.id)) || selectedUser;
    }, [selectedUser, users]);

    // ==================== НОВАЯ МОЩНАЯ ФИЛЬТРАЦИЯ (переделана с нуля по образцу кабинета) ====================
    const [activePreset, setActivePreset] = useState('month');
    const [customDateFrom, setCustomDateFrom] = useState('');
    const [customDateTo, setCustomDateTo] = useState('');
    const [employeeFilter, setEmployeeFilter] = useState(''); // '' = все, или numeric user.id (coerced from select)
    const [statusFilter, setStatusFilter] = useState('all'); // all | active | closed
    const [sortBy, setSortBy] = useState('date_desc');

    // Состояния загрузки для защиты от множественных кликов и визуальной обратной связи
    const [pendingShiftActions, setPendingShiftActions] = useState(new Set()); // sessionId
    const [pendingStartShiftUsers, setPendingStartShiftUsers] = useState(new Set()); // userId
    const [isSavingShift, setIsSavingShift] = useState(false); // для модалки редактирования смены
    const [isSavingUser, setIsSavingUser] = useState(false);   // для модалки пользователя

    const { register, handleSubmit, reset, setValue, watch } = useForm();

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

    const handleShowQR = async (user) => {
        let badgeId = user.badgeId;
        if (!badgeId) {
            badgeId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                var r = Math.random() * 16 | 0, v = c === 'x' ? r : ((r & 0x3) | 0x8);
                return v.toString(16);
            });
            // Обновляем пользователя с новым badgeId
            await updateUser(user.id, { ...user, badgeId });
            setQrUser({ ...user, badgeId });
        } else {
            setQrUser(user);
        }
        setIsQrModalOpen(true);
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

    if (!currentUser || currentUser.role !== 'admin') {
        return <div className="access_denied">Доступ запрещён</div>;
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

        const proceedSave = async () => {
            setIsSavingUser(true);
            try {
                if (selectedUser) {
                    // Редактирование
                    await updateUser(selectedUser.id, data);
                    showAlert('Данные сотрудника обновлены!', 'success');
                } else {
                    // Создание нового
                    const newUserData = {
                        ...data,
                        email: null,
                        avatar: null
                    };
                    await addUser(newUserData);
                    showAlert('Новый сотрудник успешно создан!', 'success');
                }

                setIsUserModalOpen(false);
                reset();
            } catch (err) {
                console.error("Ошибка при сохранении:", err);
                showAlert('Ошибка при сохранении. Проверьте консоль.', 'error');
            } finally {
                setIsSavingUser(false);
            }
        };

        // Предупреждение о дублировании роли scanner
        if (data.role === 'scanner') {
            const scannerUser = users.find(u => u.role === 'scanner' && u.id !== selectedUser?.id);
            if (scannerUser) {
                const confirmed = await showConfirm(`Внимание: роль оператора сканера уже назначена ${scannerUser.fullName}. Назначить новому сотруднику?`);
                if (!confirmed) return;
            }
        }

        await proceedSave();
    };

    const handleDeleteUser = async (user) => {
        const confirmed = await showConfirm(`Вы уверены, что хотите удалить сотрудника "${user.fullName}"?`);
        if (confirmed) {
            await deleteUser(user.id);
            showAlert('Сотрудник успешно удалён', 'success');
        }
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
            showAlert('Неверный формат времени прихода', 'error');
            setIsSavingShift(false);
            return;
        }

        let normalizedEnd = null;
        if (data.endTime?.trim()) {
            normalizedEnd = normalizeTime(data.endTime);
            if (!normalizedEnd) {
                showAlert('Неверный формат времени ухода', 'error');
                setIsSavingShift(false);
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
            showAlert('Смена успешно обновлена!', 'success');
            setIsEditSessionModalOpen(false);
            setEditingSession(null);
        } catch (err) {
            console.error('Ошибка при сохранении смены:', err);
            showAlert('Не удалось сохранить изменения смены. Смотри подробности в консоли браузера.', 'error');
            // Не закрываем модалку при ошибке — пользователь может исправить данные
        } finally {
            setIsSavingShift(false);
        }
    };

    return (
        <div className="admin">
            <div className="admin__top">
                <div className="admin__top__left">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', marginBottom: '20px' }}>
                        <h1 style={{ margin: 0 }}>Панель администратора</h1>
                        <button 
                            onClick={() => window.open('/scan', '_blank')} 
                            className="btn-open-scanner"
                            style={{ 
                                background: '#10b981', 
                                color: 'white', 
                                border: 'none', 
                                padding: '10px 20px', 
                                borderRadius: '8px', 
                                fontWeight: 'bold', 
                                cursor: 'pointer',
                                transition: 'background 0.2s' 
                            }}
                            onMouseOver={(e) => e.target.style.background = '#059669'}
                            onMouseOut={(e) => e.target.style.background = '#10b981'}
                        >
                            📱 Открыть сканер
                        </button>
                    </div>

                    {/* ==================== ФИЛЬТРАЦИЯ СМЕН (упрощённая и удобная) ==================== */}
                    <div className="admin__filters">
                        {/* Быстрые пресеты периодов */}
                        <div className="admin__filters__presets">
                            {PERIOD_PRESETS.map(preset => (
                                <button
                                    key={preset.key}
                                    className={`preset-btn ${activePreset === preset.key ? 'active' : ''}`}
                                    onClick={() => setActivePreset(preset.key)}
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
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                title="Фильтр по статусу смены"
                            >
                                <option value="all">Все статусы</option>
                                <option value="active">Только активные</option>
                                <option value="closed">Только завершённые</option>
                            </select>

                            <select
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
                                    setActivePreset('month');
                                    setCustomDateFrom('');
                                    setCustomDateTo('');
                                    setEmployeeFilter('');
                                    setStatusFilter('all');
                                    setSortBy('date_desc');
                                }}
                            >
                                Сбросить
                            </button>
                        </div>

                        {/* Живая статистика по текущим фильтрам */}
                        <div className="admin__filters__stats">
                            <span>Смен: <strong>{filterStats.totalShifts}</strong></span>
                            <span>Активных сейчас: <strong>{filterStats.activeNow}</strong></span>
                            <span>Отработано всего: <strong>{filterStats.totalHours} ч</strong></span>
                        </div>
                    </div>

                    <div className="admin__table">
                        <div className="admin__table__header">
                            <span>Сотрудник</span>
                            <span>Дата</span>
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
                                        <strong>{user.fullName}</strong>
                                        {user.position && <span className="user-position"> — {user.position}</span>}
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
                                                    {isUserStartPending(user.id) ? '⏳ Загрузка...' : '▶ Начать смену'}
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
                                                    {session.source === 'qr' && ' 📱'}
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
                                                        onClick={() => openEditSessionModal(session)} 
                                                        className="btn-edit"
                                                        disabled={isShiftActionPending(session.id)}
                                                    >
                                                        ✎ Редактировать
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDeleteShift(session.id)} 
                                                        className="btn-delete"
                                                        title="Удалить смену"
                                                        disabled={isShiftActionPending(session.id)}
                                                    >
                                                        {isShiftActionPending(session.id) ? '⏳' : '🗑'}
                                                    </button>
                                                </span>
                                            </div>
                                        ))
                                    )}

                                    {/* Кнопка начать новую смену — показываем всегда, если есть хотя бы одна смена */}
                                    {sessions.length > 0 && (
                                        <div className="admin__table__row admin__table__row--empty" style={{ borderTop: '1px dashed #ccc' }}>
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
                                                    {isUserStartPending(user.id) ? '⏳ Загрузка...' : '▶ Начать новую смену'}
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
                    <button onClick={() => openUserForm()} className="btn-add">＋ Добавить сотрудника</button>

                    <div className="users-list">
                        {users.map(user => (
                            <div key={user.id} className="user-item">
                                <div>
                                    <strong>{user.fullName}</strong><br />
                                    <small>{user.position || '—'} • {user.phone || '—'}</small>
                                </div>
                                <div className="user-actions">
                                    <button 
                                        onClick={() => handleStartShift(user.id)} 
                                        className="btn-start"
                                        disabled={isUserStartPending(user.id)}
                                    >
                                        {isUserStartPending(user.id) ? '⏳' : '▶ Начать смену'}
                                    </button>
                                    <button onClick={() => openViewModal(user)} className="btn-view">👁 Просмотреть</button>
                                    <button onClick={() => handleShowQR(user)} className="btn-qr">📱 Показать QR</button>
                                    <button onClick={() => openUserForm(user)} className="btn-edit">✎ Редактировать</button>
                                    <button onClick={() => handleDeleteUser(user)} className="btn-delete">🗑 Удалить</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Модалка создания / редактирования */}
            {isUserModalOpen && (
                <div className="modal">
                    <div className="modal__content">
                        <h2>{selectedUser ? 'Редактирование сотрудника' : 'Новый сотрудник'}</h2>
                        <form onSubmit={handleSubmit(onSubmitUser)}>
                            <input {...register('fullName', { required: true })} placeholder="ФИО *" />
                            <input {...register('login', { required: true })} placeholder="Логин *" />
                            <input {...register('password')} type="password" placeholder="Пароль" />
                            <input {...register('phone')} placeholder="Телефон" />
                            <input {...register('position')} placeholder="Должность" />
                            <input {...register('badgeId')} placeholder="ID Бейджика" />
                            <select {...register('role')}>
                                <option value="user">Сотрудник</option>
                                <option value="manager">Менеджер</option>
                                <option value="admin">Администратор</option>
                                <option value="scanner">Оператор сканера</option>
                            </select>
                            <textarea {...register('description')} placeholder="Описание" rows={3} />

                            <div className="modal__actions">
                                <button type="submit" disabled={isSavingUser}>
                                    {isSavingUser ? '⏳ Сохранение...' : (selectedUser ? 'Сохранить изменения' : 'Создать сотрудника')}
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
            {isViewModalOpen && activeUser && (
                <div className="modal">
                    <div className="modal__content modal__content--large">
                        <h2>Профиль — {activeUser.fullName}</h2>
                        <button className="modal__close" onClick={() => setIsViewModalOpen(false)}>✕</button>

                        <div className="user-info">
                            <p><strong>Логин:</strong> {activeUser.login}</p>
                            <p><strong>Телефон:</strong> {activeUser.phone || '—'}</p>
                            <p><strong>Должность:</strong> {activeUser.position || '—'}</p>
                            <p><strong>Роль:</strong> {activeUser.role}</p>
                            <p><strong>ID Бейджика:</strong> {activeUser.badgeId || '—'}</p>
                            {activeUser.description && <p><strong>Описание:</strong><br/>{activeUser.description}</p>}
                        </div>

                        <h3>Смены</h3>
                        <div className="history-list">
                            {getAllUserSessions(activeUser.id).length === 0 ? (
                                <p>Смен нет</p>
                            ) : (
                                getAllUserSessions(activeUser.id).map(session => (
                                    <div key={session.id} className="history-item">
                                        <div className="history-date">{formatShiftPeriod(session)}</div>
                                        <div className="history-time">{formatTime(session.startTime)} — {formatTime(session.endTime)}</div>
                                        <div className="history-duration">{formatDuration(session)}</div>
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                            <button 
                                                onClick={() => openEditSessionModal(session)} 
                                                className="btn-edit-small"
                                                disabled={isShiftActionPending(session.id)}
                                            >
                                                ✎
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteShift(session.id)} 
                                                className="btn-delete"
                                                style={{ padding: '5px 8px', fontSize: '12px' }}
                                                title="Удалить смену"
                                                disabled={isShiftActionPending(session.id)}
                                            >
                                                {isShiftActionPending(session.id) ? '⏳' : '🗑'}
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
                <div className="modal">
                    <div className="modal__content">
                        <h2>Редактирование смены</h2>
                        <p><strong>{activeUser?.fullName}</strong> — {formatShiftPeriod(editingSession)}</p>

                        <form onSubmit={handleSubmit(onSubmitEditSession)}>
                            {/* === Дата и время НАЧАЛА === */}
                            <div style={{ marginBottom: 12 }}>
                                <label style={{ fontSize: 13, color: '#555', display: 'block', marginBottom: 4 }}>
                                    Дата начала смены
                                </label>
                                <input 
                                    type="date" 
                                    {...register('startDate')} 
                                />
                            </div>

                            <input {...register('startTime', { required: true })} placeholder="Время прихода (ЧЧ:ММ)" />

                            {/* === Дата и время ОКОНЧАНИЯ === */}
                            <div style={{ marginTop: 16 }}>
                                <label style={{ fontSize: 13, color: '#555', display: 'block', marginBottom: 4 }}>
                                    Дата окончания смены
                                </label>
                                <select {...register('endDateType')} defaultValue="same">
                                    <option value="same">В тот же день</option>
                                    <option value="next">На следующий день</option>
                                    <option value="custom">Другая дата</option>
                                </select>

                                {watch('endDateType') === 'custom' && (
                                    <input 
                                        type="date" 
                                        {...register('customEndDate')} 
                                        style={{ marginTop: 8, display: 'block' }}
                                    />
                                )}
                            </div>

                            <input {...register('endTime')} placeholder="Время ухода (оставьте пустым если активна)" />

                            {/* Ручной ввод продолжительности (приоритет для сложных случаев) */}
                            <input 
                                {...register('manualDurationHours')} 
                                type="number" 
                                step="0.25" 
                                placeholder="Или укажи продолжительность вручную в часах (например 25.5)"
                                style={{ marginTop: 12 }}
                            />

                            <div className="modal__actions">
                                <button type="submit" disabled={isSavingShift}>
                                    {isSavingShift ? '⏳ Сохранение...' : 'Сохранить'}
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
            {/* Модальное окно QR-кода */}
            {isQrModalOpen && qrUser && (
                <div className="modal print-qr-modal-wrapper">
                    <div className="modal__content print-qr-section">
                        <h2>Карточка сотрудника</h2>
                        <div className="qr-code-box" style={{ margin: '20px 0', display: 'flex', justifyContent: 'center' }}>
                            <QRCodeSVG value={qrUser.badgeId} size={200} />
                        </div>
                        <p style={{ fontSize: '18px', fontWeight: 'bold', margin: '10px 0' }}>{qrUser.fullName}</p>
                        <p style={{ color: '#666', fontStyle: 'italic', marginBottom: '20px' }}>ID: {qrUser.badgeId}</p>
                        
                        <div className="modal__actions qr-modal-buttons">
                            <button onClick={() => window.print()} className="btn-print" style={{ background: '#10b981', color: 'white' }}>
                                Распечатать
                            </button>
                            <button onClick={() => { setIsQrModalOpen(false); setQrUser(null); }}>
                                Закрыть
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Admin;