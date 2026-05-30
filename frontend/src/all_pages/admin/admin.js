import React, { useContext, useState, useMemo } from 'react';
import { useForm } from "react-hook-form";
import './admin.scss';
import { CustomContext } from '../../Context';
import { parseISO, differenceInMinutes, addDays, format } from 'date-fns';

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

    // ==================== СОСТОЯНИЯ ====================
    const [selectedUser, setSelectedUser] = useState(null);
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [isEditSessionModalOpen, setIsEditSessionModalOpen] = useState(false);
    const [editingSession, setEditingSession] = useState(null);

    const [dateFilter, setDateFilter] = useState('today');
    const [customDate, setCustomDate] = useState(new Date().toISOString().split('T')[0]);

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

    // ==================== ФИЛЬТРАЦИЯ ====================
    const filteredSessions = useMemo(() => {
        let sessions = [...workSessions];
        const today = new Date().toISOString().split('T')[0];

        if (dateFilter === 'today') {
            // Улучшенная логика для отображения смен в день их завершения:
            // - Смены, начатые сегодня
            // - Смены, которые закончились сегодня (даже если начались вчера или раньше) — использует endDate
            // - Все активные (незакрытые) смены, независимо от даты начала (важно для охраны и длинных смен)
            sessions = sessions.filter(s => {
                const startedToday = s.date === today;
                const endedToday = s.endDate === today;
                const isStillActive = !s.endTime;

                // Для старых смен без endDate — показываем по дате начала (fallback)
                const noEndDateButRelevant = !s.endDate && !s.endTime && startedToday;

                return startedToday || endedToday || isStillActive || noEndDateButRelevant;
            });
        } else if (dateFilter === 'custom' && customDate) {
            // Для конкретной даты показываем смены, которые либо начались, либо закончились в этот день
            sessions = sessions.filter(s => {
                const startedOnDate = s.date === customDate;
                const endedOnDate = s.endDate === customDate;
                return startedOnDate || endedOnDate;
            });
        } else if (dateFilter === 'all') {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const agoStr = thirtyDaysAgo.toISOString().split('T')[0];

            sessions = sessions.filter(s => {
                const startOk = s.date >= agoStr;
                const endOk = s.endDate && s.endDate >= agoStr;
                return startOk || endOk;
            });
        }

        return sortSessions(sessions);
    }, [workSessions, dateFilter, customDate]);

    if (!currentUser || currentUser.role !== 'admin') {
        return <div className="access_denied">Доступ запрещён</div>;
    }

    const getUserSessions = (userId) => sortSessions(filteredSessions.filter(s => s.userId === userId));

    const getAllUserSessions = (userId) =>
        sortSessions(workSessions.filter(s => s.userId === userId));

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
                alert('Данные сотрудника обновлены!');
            } else {
                // Создание нового
                const newUserData = {
                    ...data,
                    email: null,           // если нужно
                    avatar: null
                };
                await addUser(newUserData);
                alert('Новый сотрудник успешно создан!');
            }

            setIsUserModalOpen(false);
            reset();
        } catch (err) {
            console.error("Ошибка при сохранении:", err);
            alert('Ошибка при сохранении. Проверьте консоль.');
        } finally {
            setIsSavingUser(false);
        }
    };

    const handleDeleteUser = async (user) => {
        if (window.confirm(`Вы уверены, что хотите удалить сотрудника "${user.fullName}"?`)) {
            await deleteUser(user.id);
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
            alert('Неверный формат времени прихода');
            return;
        }

        let normalizedEnd = null;
        if (data.endTime?.trim()) {
            normalizedEnd = normalizeTime(data.endTime);
            if (!normalizedEnd) {
                alert('Неверный формат времени ухода');
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
            alert('Смена успешно обновлена!');
            setIsEditSessionModalOpen(false);
            setEditingSession(null);
        } catch (err) {
            console.error('Ошибка при сохранении смены:', err);
            alert('Не удалось сохранить изменения смены.\n\nСмотри подробности в консоли браузера (F12 → Console).');
            // Не закрываем модалку при ошибке — пользователь может исправить данные
        } finally {
            setIsSavingShift(false);
        }
    };

    return (
        <div className="admin">
            <div className="admin__top">
                <div className="admin__top__left">
                    <h1>Панель администратора</h1>

                    <div className="admin__filter">
                        <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}>
                            <option value="today">Сегодня</option>
                            <option value="all">Последние 30 дней</option>
                            <option value="custom">Выбрать дату</option>
                        </select>
                        {dateFilter === 'custom' && (
                            <input type="date" value={customDate} onChange={(e) => setCustomDate(e.target.value)} />
                        )}
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

                        {users.map(user => {
                            const sessions = getUserSessions(user.id);
                            return (
                                <div key={user.id} className="admin__table__user-group">
                                    <div className="admin__table__user-header">
                                        <strong>{user.fullName}</strong>
                                        {user.position && <span className="user-position"> — {user.position}</span>}
                                    </div>

                                    {sessions.length === 0 ? (
                                        <div className="admin__table__row admin__table__row--empty">
                                            <span>Смены отсутствуют</span>
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
            {isViewModalOpen && selectedUser && (
                <div className="modal">
                    <div className="modal__content modal__content--large">
                        <h2>Профиль — {selectedUser.fullName}</h2>
                        <button className="modal__close" onClick={() => setIsViewModalOpen(false)}>✕</button>

                        <div className="user-info">
                            <p><strong>Логин:</strong> {selectedUser.login}</p>
                            <p><strong>Телефон:</strong> {selectedUser.phone || '—'}</p>
                            <p><strong>Должность:</strong> {selectedUser.position || '—'}</p>
                            <p><strong>Роль:</strong> {selectedUser.role}</p>
                            <p><strong>ID Бейджика:</strong> {selectedUser.badgeId || '—'}</p>
                            {selectedUser.description && <p><strong>Описание:</strong><br/>{selectedUser.description}</p>}
                        </div>

                        <h3>Смены</h3>
                        <div className="history-list">
                            {getAllUserSessions(selectedUser.id).length === 0 ? (
                                <p>Смен нет</p>
                            ) : (
                                getAllUserSessions(selectedUser.id).map(session => (
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
                        <p><strong>{selectedUser?.fullName}</strong> — {formatShiftPeriod(editingSession)}</p>

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
        </div>
    );
};

export default Admin;