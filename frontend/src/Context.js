import React, { createContext, useState, useEffect } from 'react';
import axios from 'axios';
import bcrypt from 'bcryptjs';
import { differenceInMinutes, parseISO, addDays, format } from 'date-fns';

export const CustomContext = createContext();

const API_BASE = 'http://localhost:8080';

/**
 * Надёжный расчёт продолжительности смены.
 * Поддерживает:
 * - Ночные смены (переход через полночь)
 * - Смены длиннее 24 часов
 * - Смены, которые заканчиваются на следующий день
 */
const calculateShiftDuration = (startDate, startTime, endDate, endTime) => {
  if (!startDate || !startTime || !endDate || !endTime) return null;

  try {
    // Собираем полноценные ISO строки
    const startStr = `${startDate}T${startTime}`;
    const endStr = `${endDate}T${endTime}`;

    const start = parseISO(startStr);
    let end = parseISO(endStr);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;

    // Если время окончания раньше времени начала — значит смена перешла на следующий день
    if (end < start) {
      end = addDays(end, 1);
    }

    const minutes = differenceInMinutes(end, start);
    return Math.max(0, minutes);
  } catch (e) {
    console.error('Ошибка расчёта продолжительности смены:', e);
    return null;
  }
};

/** Форматирование продолжительности в читаемый вид */
const formatDuration = (minutes) => {
  if (minutes == null) return '—';
  const days = Math.floor(minutes / (24 * 60));
  const hours = Math.floor((minutes % (24 * 60)) / 60);
  const mins = minutes % 60;

  if (days > 0) {
    return `${days} д ${hours} ч ${mins} мин`;
  }
  return `${hours} ч ${mins} мин`;
};

export const Context = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [users, setUsers] = useState([]);
    const [workSessions, setWorkSessions] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);

    // Загрузка данных при старте
    useEffect(() => {
        const loadData = async () => {
            try {
                const [usersRes, sessionsRes, productsRes] = await Promise.all([
                    axios.get(`${API_BASE}/users`),
                    axios.get(`${API_BASE}/workSessions`),
                    axios.get(`${API_BASE}/product`)
                ]);
                setUsers(usersRes.data);
                setWorkSessions(sessionsRes.data);
                setProducts(productsRes.data);

                const saved = localStorage.getItem('currentUser');
                if (saved) {
                    try {
                        const user = JSON.parse(saved);
                        setCurrentUser(user);
                    } catch (e) {
                        localStorage.removeItem('currentUser');
                    }
                }
            } catch (err) {
                console.error('Ошибка загрузки данных:', err);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, []);

    // Логин
    const login = async (identifier, password) => {
        console.log('Попытка входа:', identifier, password);

        try {
            const candidates = users.filter(u =>
                u.login === identifier ||
                u.email === identifier ||
                (u.login && u.login.toLowerCase() === identifier.toLowerCase()) ||
                u.fullName === identifier
            );

            if (candidates.length === 0) {
                console.log('Пользователь не найден');
                return false;
            }

            let foundUser = null;
            for (const u of candidates) {
                let match = false;
                if (u.password?.startsWith('$2a$')) {
                    match = bcrypt.compareSync(password, u.password);
                } else {
                    match = (u.password === password);
                }

                if (match) {
                    foundUser = u;
                    break;
                }
            }

            if (!foundUser) {
                console.log('Неверный пароль для всех совпадений');
                return false;
            }

            const safeUser = {
                id: foundUser.id,
                login: foundUser.login,
                email: foundUser.email,
                fullName: foundUser.fullName,
                role: foundUser.role,
                avatar: foundUser.avatar || ""
            };

            console.log('Успешный вход:', safeUser);

            setCurrentUser(safeUser);
            localStorage.setItem('currentUser', JSON.stringify(safeUser));

            return safeUser;

        } catch (err) {
            console.error('Ошибка в login:', err);
            return false;
        }
    };

    const logout = () => {
        setCurrentUser(null);
        localStorage.removeItem('currentUser');
        localStorage.removeItem('token');
    };

    // Удаление пользователя
    const deleteUser = async (userId) => {
        if (!userId) return;

        if (currentUser && currentUser.id === userId) {
            alert("Вы не можете удалить самого себя!");
            return;
        }

        try {
            await axios.delete(`${API_BASE}/users/${userId}`);

            setUsers(prev => prev.filter(user => user.id !== userId));
            setWorkSessions(prev => prev.filter(session => session.userId !== userId));

            console.log(`Пользователь с ID ${userId} успешно удалён`);
        } catch (err) {
            console.error('Ошибка при удалении пользователя:', err);
            alert('Не удалось удалить пользователя. Ошибка сервера.');
        }
    };

    // Добавление нового пользователя
    const addUser = async (newUser) => {
        try {
            let userToSend = {
                fullName: newUser.fullName,
                login: newUser.login,
                password: newUser.password,
                phone: newUser.phone || null,
                position: newUser.position || null,
                description: newUser.description || null,
                badgeId: newUser.badgeId || null,
                role: newUser.role || 'user',
                email: null,
                avatar: null
            };

            // Хэшируем пароль
            if (userToSend.password) {
                const salt = bcrypt.genSaltSync(10);
                userToSend.password = bcrypt.hashSync(userToSend.password, salt);
            }

            console.log("Отправляем на сервер:", userToSend);

            const res = await axios.post(`${API_BASE}/users`, userToSend);

            setUsers(prev => [...prev, res.data]);
            console.log("✅ Ответ от сервера:", res.data);
            return res.data;
        } catch (err) {
            console.error('Ошибка добавления:', err.response?.data || err);
            alert('Не удалось создать пользователя');
        }
    };

    // Обновление пользователя
    const updateUser = async (userId, updates) => {
        try {
            let dataToSend = {
                fullName: updates.fullName,
                login: updates.login,
                phone: updates.phone || null,
                position: updates.position || null,
                description: updates.description || null,
                badgeId: updates.badgeId || null,
                role: updates.role,
            };

            if (updates.password) {
                const salt = bcrypt.genSaltSync(10);
                dataToSend.password = bcrypt.hashSync(updates.password, salt);
            }

            console.log("Обновляем пользователя:", dataToSend);

            const res = await axios.patch(`${API_BASE}/users/${userId}`, dataToSend);

            setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...res.data } : u));
            console.log('✅ Пользователь обновлён:', res.data);
        } catch (err) {
            console.error('Ошибка обновления:', err.response?.data || err);
        }
    };
    // Остальные функции
    // Начать новую смену (поддерживает несколько смен в день + гибкие сценарии)
    const manualStartShift = async (userId) => {
        const now = new Date();
        const today = format(now, 'yyyy-MM-dd');
        const nowTime = format(now, 'HH:mm:ss');

        // Проверяем открытые смены
        const openShifts = workSessions.filter(s => 
            s.userId === userId && !s.endTime
        );

        if (openShifts.length > 0) {
            const confirmStart = window.confirm(
                `У этого сотрудника есть ${openShifts.length} незакрытая смена(ы).\n\n` +
                `Хотите начать новую смену? (Предыдущую рекомендуется закрыть)`
            );
            if (!confirmStart) return null;
        }

        const newSession = {
            userId,
            date: today,
            startTime: nowTime,
            endTime: null,
            durationMinutes: null,
            status: "active",
            editedBy: currentUser?.id
        };

        try {
            const res = await axios.post(`${API_BASE}/workSessions`, newSession);
            setWorkSessions(prev => [...prev, res.data]);
            return res.data;
        } catch (err) {
            console.error('Ошибка начала смены:', err);
            alert('Не удалось начать смену');
        }
    };

    const manualEndShift = async (sessionId) => {
        const session = workSessions.find(s => s.id === sessionId);
        if (!session || session.endTime) return;

        const now = new Date();
        const endDate = format(now, 'yyyy-MM-dd');
        const endTime = format(now, 'HH:mm:ss');

        // Правильный расчёт даже если смена перешла на следующий день
        const durationMinutes = calculateShiftDuration(
            session.date, 
            session.startTime, 
            endDate, 
            endTime
        );

        try {
            await axios.patch(`${API_BASE}/workSessions/${sessionId}`, {
                endDate,                    // Сохраняем дату окончания (важно для смен через сутки)
                endTime,
                durationMinutes,
                status: "manually_edited",
                editedBy: currentUser?.id
            });

            setWorkSessions(prev => prev.map(s =>
                s.id === sessionId
                    ? { ...s, endDate, endTime, durationMinutes, status: "manually_edited", editedBy: currentUser?.id }
                    : s
            ));
        } catch (err) {
            console.error('Ошибка завершения смены:', err);
            alert('Не удалось закрыть смену');
        }
    };

    const editSession = async (sessionId, updates) => {
        try {
            const res = await axios.patch(`${API_BASE}/workSessions/${sessionId}`, updates);

            console.log('[EDIT SHIFT] Ответ от сервера:', res.data);

            if (!res.data) {
                throw new Error('Бэкенд вернул пустой ответ при обновлении смены');
            }

            // Безопасное слияние: сохраняем старые поля, если бэкенд вернул неполный объект
            setWorkSessions(prev => prev.map(s => {
                if (s.id !== sessionId) return s;
                const merged = { ...s, ...res.data };
                // Защита от потери важных полей
                if (!merged.date && s.date) merged.date = s.date;
                if (!merged.startTime && s.startTime) merged.startTime = s.startTime;
                return merged;
            }));
            return res.data;
        } catch (err) {
            const backendError = err.response?.data?.error || err.response?.data || err.message;
            console.error('Ошибка редактирования сессии:', backendError);
            throw new Error(`Ошибка сохранения смены: ${backendError}`);
        }
    };

    // Удаление смены (удобно для очистки тестовых данных)
    const deleteSession = async (sessionId) => {
        if (!window.confirm('Вы уверены, что хотите удалить эту смену? Это действие нельзя отменить.')) {
            return;
        }

        try {
            await axios.delete(`${API_BASE}/workSessions/${sessionId}`);
            setWorkSessions(prev => prev.filter(s => s.id !== sessionId));
            console.log(`[DELETE SHIFT] Смена ${sessionId} успешно удалена`);
        } catch (err) {
            console.error('Ошибка удаления смены:', err.response?.data || err);
            alert('Не удалось удалить смену. Смотри ошибку в консоли.');
        }
    };

    const addProduct = async (newProduct) => {
        try {
            const res = await axios.post(`${API_BASE}/product`, newProduct);
            setProducts(prev => [...prev, res.data]);
        } catch (err) {
            console.error('Ошибка добавления продукта:', err);
        }
    };

    const updateProduct = async (productId, updates) => {
        try {
            const res = await axios.patch(`${API_BASE}/product/${productId}`, updates);
            setProducts(prev => prev.map(p => p.id === productId ? { ...p, ...res.data } : p));
        } catch (err) {
            console.error('Ошибка обновления продукта:', err);
        }
    };

    const deleteProduct = async (productId) => {
        try {
            await axios.delete(`${API_BASE}/product/${productId}`);
            setProducts(prev => prev.filter(p => p.id !== productId));
        } catch (err) {
            console.error('Ошибка удаления продукта:', err);
        }
    };

    const value = {
        currentUser,
        users,
        workSessions,
        products,
        loading,
        login,
        logout,
        manualStartShift,
        manualEndShift,
        editSession,
        deleteSession,
        addUser,
        updateUser,
        deleteUser,
        addProduct,
        updateProduct,
        deleteProduct,
        formatDuration
    };

    return (
        <CustomContext.Provider value={value}>
            {children}
        </CustomContext.Provider>
    );
};