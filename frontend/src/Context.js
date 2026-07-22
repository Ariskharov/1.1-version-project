import React, { createContext, useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import bcrypt from 'bcryptjs';
import { differenceInMinutes, parseISO, addDays, format } from 'date-fns';
import AppUi from './components/ui/AppUi';

export const CustomContext = createContext();

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8080';

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
    const [dataLoaded, setDataLoaded] = useState(false);

    const [toast, setToast] = useState(null);
    const [confirmDialog, setConfirmDialog] = useState(null);
    const toastTimerRef = useRef(null);
    const confirmResolverRef = useRef(null);

    const showToast = useCallback((type, message) => {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        setToast({ type, message });
        toastTimerRef.current = setTimeout(() => setToast(null), 4000);
    }, []);

    const confirm = useCallback((options) => {
        const opts = typeof options === 'string' ? { message: options } : options;
        return new Promise((resolve) => {
            confirmResolverRef.current = resolve;
            setConfirmDialog({
                message: opts.message,
                confirmLabel: opts.confirmLabel || 'Подтвердить',
                cancelLabel: opts.cancelLabel || 'Отмена',
                danger: opts.danger ?? false,
            });
        });
    }, []);

    const handleConfirmOk = () => {
        confirmResolverRef.current?.(true);
        confirmResolverRef.current = null;
        setConfirmDialog(null);
    };

    const handleConfirmCancel = () => {
        confirmResolverRef.current?.(false);
        confirmResolverRef.current = null;
        setConfirmDialog(null);
    };

    // Функция обновления данных (переиспользуемая)
    const refreshData = async () => {
        try {
            const [usersRes, sessionsRes, productsRes] = await Promise.all([
                axios.get(`${API_BASE}/users`),
                axios.get(`${API_BASE}/workSessions`),
                axios.get(`${API_BASE}/product`)
            ]);
            setUsers(usersRes.data);
            setWorkSessions(sessionsRes.data);
            setProducts(productsRes.data);
        } catch (err) {
            console.error('Ошибка обновления данных:', err);
        }
    };

    // Загрузка данных при старте: не блокируем каталог ожиданием всех API
    useEffect(() => {
        const saved = localStorage.getItem('currentUser');
        if (saved) {
            try {
                const user = JSON.parse(saved);
                setCurrentUser(user);
            } catch (e) {
                localStorage.removeItem('currentUser');
            }
        }
        setLoading(false);

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
            } catch (err) {
                console.error('Ошибка загрузки данных:', err);
            } finally {
                setDataLoaded(true);
            }
        };

        loadData();
    }, []);

    // Автообновление данных каждые 10 секунд (для отображения QR-отметок в реальном времени)
    useEffect(() => {
        const interval = setInterval(() => {
            refreshData();
        }, 10000);
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Мгновенная синхронизация при действиях на соседних вкладках (например, сканнер)
    useEffect(() => {
        const handleStorageChange = (e) => {
            if (e.key === 'qr-update') {
                console.log('[Context] Обнаружена QR-отметка, обновление данных...');
                refreshData();
            }
        };
        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
                if (u.password?.startsWith('$2a$') || u.password?.startsWith('$2b$')) {
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

            // Получаем JWT токен с бэкенда для последующих запросов
            try {
                const loginRes = await axios.post(`${API_BASE}/login`, { email: identifier, password });
                if (loginRes.data && loginRes.data.token) {
                    localStorage.setItem('token', loginRes.data.token);
                }
            } catch (err) {
                console.error('Ошибка получения JWT токена:', err.response?.data || err.message);
            }

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
            showToast('error', 'Вы не можете удалить самого себя!');
            return;
        }

        try {
            await axios.delete(`${API_BASE}/users/${userId}`);

            setUsers(prev => prev.filter(user => user.id !== userId));
            setWorkSessions(prev => prev.filter(session => session.userId !== userId));

            console.log(`Пользователь с ID ${userId} успешно удалён`);
        } catch (err) {
            console.error('Ошибка при удалении пользователя:', err);
            showToast('error', 'Не удалось удалить пользователя. Ошибка сервера.');
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
            showToast('error', 'Не удалось создать пользователя');
            throw err;
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

            setUsers(prev => prev.map(u => Number(u.id) === Number(userId) ? { ...u, ...res.data } : u));
            console.log('✅ Пользователь обновлён:', res.data);
            return res.data;
        } catch (err) {
            console.error('Ошибка обновления:', err.response?.data || err);
            throw err;
        }
    };

    // Начать новую смену
    const manualStartShift = async (userId) => {
        const now = new Date();
        const today = format(now, 'yyyy-MM-dd');
        const nowTime = format(now, 'HH:mm:ss');

        // Проверяем открытые смены
        const openShifts = workSessions.filter(s => 
            s.userId === userId && !s.endTime
        );

        if (openShifts.length > 0) {
            const confirmStart = await confirm({
                message: `У этого сотрудника есть ${openShifts.length} незакрытая смена(ы).\n\nХотите начать новую смену? (Предыдущую рекомендуется закрыть)`,
                confirmLabel: 'Начать смену',
            });
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
            showToast('error', 'Не удалось начать смену');
        }
    };

    const manualEndShift = async (sessionId) => {
        const session = workSessions.find(s => s.id === sessionId);
        if (!session || session.endTime) return;

        const now = new Date();
        const endDate = format(now, 'yyyy-MM-dd');
        const endTime = format(now, 'HH:mm:ss');

        const durationMinutes = calculateShiftDuration(
            session.date, 
            session.startTime, 
            endDate, 
            endTime
        );

        try {
            await axios.patch(`${API_BASE}/workSessions/${sessionId}`, {
                endDate,
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
            showToast('error', 'Не удалось закрыть смену');
        }
    };

    const editSession = async (sessionId, updates) => {
        try {
            const res = await axios.patch(`${API_BASE}/workSessions/${sessionId}`, updates);
            console.log('[EDIT SHIFT] Ответ от сервера:', res.data);

            if (!res.data) {
                throw new Error('Бэкенд вернул пустой ответ при обновлении смены');
            }

            setWorkSessions(prev => prev.map(s => {
                if (s.id !== sessionId) return s;
                const merged = { ...s, ...res.data };
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

    // Удаление смены
    const deleteSession = async (sessionId) => {
        const confirmed = await confirm({
            message: 'Вы уверены, что хотите удалить эту смену? Это действие нельзя отменить.',
            confirmLabel: 'Удалить',
            danger: true,
        });
        if (!confirmed) return;

        try {
            await axios.delete(`${API_BASE}/workSessions/${sessionId}`);
            setWorkSessions(prev => prev.filter(s => s.id !== sessionId));
            showToast('success', 'Смена удалена');
        } catch (err) {
            console.error('Ошибка удаления смены:', err.response?.data || err);
            showToast('error', 'Не удалось удалить смену');
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
        dataLoaded,
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
        refreshData,
        formatDuration,
        showToast,
        confirm,
    };

    return (
        <CustomContext.Provider value={value}>
            {children}
            <AppUi
                toast={toast}
                confirmDialog={confirmDialog}
                onConfirm={handleConfirmOk}
                onCancel={handleConfirmCancel}
            />
        </CustomContext.Provider>
    );
};