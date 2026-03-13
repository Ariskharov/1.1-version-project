import React, {useContext, useState} from 'react';
import { useForm } from "react-hook-form";
import './admin.scss';
import { CustomContext } from '../../Context'; // Проверь путь! Если Context в src/, то '../Context' или './Context'

const Admin = () => {
    const {
        currentUser,
        users,
        workSessions,
        manualStartShift,
        manualEndShift,
        editSession,
        addUser,
        updateUser,
    } = useContext(CustomContext);

    // === ВСЕ ХУКИ ТОЛЬКО ЗДЕСЬ, В НАЧАЛЕ ===
    const [editingUser, setEditingUser] = useState(null);
    const [isAdding, setIsAdding] = useState(false);
    const { register, handleSubmit, reset } = useForm();
    const [modalUser, setModalUser] = useState(false);
    const [openUse,setOpenUse] = useState({});
    const [seenIds,setSeenIds] = useState([]);

    const today = new Date().toISOString().split('T')[0];

    // Проверка прав доступа
    if (!currentUser || currentUser.role !== 'admin') {
        return <div className="access_denied">Доступ запрещён</div>;
    }

    // Получаем все сессии сотрудника за сегодня
    const getTodaySessions = (userId) => {
        return workSessions
            .filter(s => s.userId === userId && s.date === today)
            .sort((a, b) => a.startTime.localeCompare(b.startTime));
    };

    const formatTime = (time) => (time ? time.slice(0, 5) : '-');

    const formatDuration = (session) => {
        if (!session.durationMinutes && session.durationMinutes !== 0) {
            return session.endTime ? '-' : 'Активна';
        }
        const h = Math.floor(session.durationMinutes / 60);
        const m = session.durationMinutes % 60;
        return `${h} ч ${m} мин`;
    };

    // Редактирование смены (prompt — временно, потом модалка)
    const handleEdit = (session) => {
        const newStartInput = prompt('Время прихода (ЧЧ:ММ, например 9:30 или 09:30)', session.startTime.slice(0, 5));
        if (!newStartInput) return; // отмена

        // Нормализуем и валидируем время
        const normalizedStart = normalizeTime(newStartInput);
        if (!normalizedStart) {
            alert('Неверный формат времени. Используйте ЧЧ:ММ (например 9:30 или 09:30)');
            return;
        }

        let newEndInput = '';
        if (session.endTime) {
            newEndInput = prompt('Время ухода (ЧЧ:ММ) — оставьте пустым, чтобы не менять', session.endTime.slice(0, 5));
        } else {
            newEndInput = prompt('Время ухода (ЧЧ:ММ) — оставьте пустым, чтобы оставить активной', '');
        }

        if (newEndInput === null) return;

        let normalizedEnd = null;
        if (newEndInput !== '') {
            normalizedEnd = normalizeTime(newEndInput);
            if (!normalizedEnd) {
                alert('Неверный формат времени ухода');
                return;
            }
        }

        const updates = {
            startTime: normalizedStart + ':00',
            status: 'manually_edited',
            editedBy: currentUser.id
        };

        let shouldCalculateDuration = false;
        let finalEndTime = session.endTime;

        if (normalizedEnd) {
            // Ввели новое время ухода
            finalEndTime = normalizedEnd + ':00';
            updates.endTime = finalEndTime;
            shouldCalculateDuration = true;
        } else if (session.endTime) {
            // Оставили пустым — сохраняем старое
            shouldCalculateDuration = true;
        }
        // Если нет endTime и не ввели — остаётся активной

        if (shouldCalculateDuration) {
            const start = new Date(`1970-01-01T${updates.startTime}Z`);
            const end = new Date(`1970-01-01T${finalEndTime}Z`);
            let duration = Math.round((end - start) / 60000);
            if (duration < 0) duration = 0;
            updates.durationMinutes = duration;
        } else {
            updates.durationMinutes = null;
        }

        editSession(session.id, updates);
        alert('Смена успешно обновлена!');
    };

// Вспомогательная функция — нормализация времени
    const normalizeTime = (input) => {
        const trimmed = input.trim();
        const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
        if (!match) return null;

        let hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);

        if (hours > 23 || minutes > 59) return null;

        // Добавляем ведущий ноль
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    };

    // Обработчик формы добавления/редактирования сотрудника
    const onSubmitUser = async (data) => {
        data.role = data.role || 'user';

        if (editingUser) {
            await updateUser(editingUser.id, data);
            setEditingUser(null);
        } else {
            await addUser(data);
            setIsAdding(false);
        }
        reset();
    };


    const userSee = () =>{
        setModalUser(false)
        setOpenUse({})

    }
    console.log(workSessions)
    console.log(modalUser)
    console.log(openUse)








    return (
        <div className="admin">
            <div className="admin__top">
                <div className="admin__top__left">
                    <h1>Панель администратора</h1>

                    {/* Таблица смен */}
                    <div className="admin__top__left__table">
                        <div className="admin__top__left__table__header">
                            <span>Сотрудник</span>
                            <span>Дата</span>
                            <span>Приход</span>
                            <span>Уход</span>
                            <span>Отработано</span>
                            <span>Статус</span>
                            <span>Действия</span>
                        </div>

                        {users.map(user => {
                            const sessions = getTodaySessions(user.id);

                            return (
                                <div key={user.id} className="admin__top__left__table__row-group">
                                    <div className="admin__top__left__table__user-header">
                                        <span className="admin__top__left__table__user-name">{user.fullName}</span>
                                    </div>

                                    <div className="admin__top__left__table__sessions-list">
                                        {sessions.length === 0 ? (
                                            <div className="admin__top__left__table__row admin__top__left__table__row--no-sessions">
                                                <span></span>
                                                <span>{today.split('-').reverse().join('.')}</span>
                                                <span>-</span>
                                                <span>-</span>
                                                <span>-</span>
                                                <span className="admin__top__left__table__status">Нет смены</span>
                                                <span className="admin__top__left__table__actions">
                                            <button onClick={() => manualStartShift(user.id)} className="admin__top__left__table__btn admin__top__left__table__btn--start">
                                                Начать смену
                                            </button>
                                        </span>
                                            </div>
                                        ) : (
                                            sessions.map(session => {
                                                const isActive = !session.endTime;
                                                return (
                                                    <div key={session.id} className="admin__top__left__table__row">
                                                        <span></span>
                                                        <span>{today.split('-').reverse().join('.')}</span>
                                                        <span>{formatTime(session.startTime)}</span>
                                                        <span>{formatTime(session.endTime)}</span>
                                                        <span>{formatDuration(session)}</span>
                                                        <span className={`admin__top__left__table__status admin__top__left__table__status--${session.status || 'completed'}`}>
                                                    {isActive ? '● На работе' :
                                                        session.status === 'manually_edited' ? 'Редактирована' :
                                                            'Завершена'}
                                                </span>
                                                        <span className="admin__top__left__table__actions">
                                                    {isActive && (
                                                        <button onClick={() => manualEndShift(session.id)} className="admin__top__left__table__btn admin__top__left__table__btn--end">
                                                            Завершить
                                                        </button>
                                                    )}
                                                            <button onClick={() => handleEdit(session)} className="admin__top__left__table__btn admin__top__left__table__btn--edit">
                                                        ✎ Ред.
                                                    </button>
                                                </span>
                                                    </div>
                                                );
                                            })
                                        )}

                                        <div className="admin__top__left__table__row admin__top__left__table__row--add">
                                            <span></span><span></span><span></span><span></span><span></span><span></span>
                                            <span className="admin__top__left__table__actions">
                                        <button onClick={() => manualStartShift(user.id)} className="admin__top__left__table__btn admin__top__left__table__btn--start">
                                            + Начать новую смену
                                        </button>
                                    </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Раздел управления сотрудниками */}
                <div className="admin__top__right">
                    <h2>Управление сотрудниками</h2>

                    <button
                        onClick={() => {
                            setIsAdding(true);
                            setEditingUser(null);
                            reset();
                        }}
                        className="admin__top__right__btn-add"
                    >
                        + Добавить сотрудника
                    </button>

                    <div className="admin__top__right__users-list">
                        {users.map(user => (
                            <div key={user.id} className="admin__top__right__user-item">
                                <span>{user.fullName} ({user.role})</span>
                                <button
                                    onClick={() => {
                                        setEditingUser(user);
                                        reset(user);
                                        setIsAdding(false);
                                        setOpenUse(user);
                                        setModalUser(true);
                                    }}
                                    className="admin__top__right__btn-edit"
                                >
                                    Редактировать
                                </button>
                                <button
                                    onClick={() => {
                                        setOpenUse(user);
                                        setModalUser(true);
                                    }}
                                    className="admin__top__right__btn-edit"
                                >
                                    Посмотреть
                                </button>
                            </div>
                        ))}
                    </div>

                    {(isAdding || editingUser) && (
                        <form onSubmit={handleSubmit(onSubmitUser)} className="admin__top__right__user-form">
                            <input {...register('fullName', { required: true })} placeholder="ФИО" />
                            <input {...register('login', { required: true })} placeholder="Логин" />
                            <input {...register('email', { required: true })} placeholder="Email" />
                            <input {...register('password', { required: true })} type="password" placeholder="Пароль" />
                            <input {...register('badgeId')} placeholder="ID бейджика" />
                            <select {...register('role')}>
                                <option value="user">User</option>
                                <option value="admin">Admin</option>
                                <option value="manager">Manager</option>
                                <option value="other">Other</option>
                            </select>

                            <div className="admin__top__right__form-actions">
                                <button type="submit">
                                    {editingUser ? 'Сохранить изменения' : 'Добавить сотрудника'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsAdding(false);
                                        setEditingUser(null);
                                        reset();
                                    }}
                                >
                                    Отмена
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
            <div className="admin__bottom">
                <div className="admin__bottom__modal">
                    {
                        modalUser === true && (
                            <div className="admin__bottom__modal__true">
                                <h1>{openUse.fullName}</h1>
                                <button onClick={()=>userSee()}>close</button>
                                {
                                    workSessions
                                   .map(ai=>(
                                            <div>
                                                <div className="">
                                                    <h1>{ai.date}</h1>
                                                </div>
                                            </div>
                                        ))
                                }
                            </div>
                        )
                    }

                </div>
            </div>
        </div>
    );
};

export default Admin;