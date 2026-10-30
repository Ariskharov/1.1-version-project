import React, { createContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import axios from 'axios';
import { differenceInMinutes, parseISO, addDays, format } from 'date-fns';
import AppUi from './components/ui/AppUi';
import { API_BASE } from './config/api';

export const CustomContext = createContext();

let bcryptPromise = null;
const loadBcrypt = () => {
    if (!bcryptPromise) {
        bcryptPromise = import('bcryptjs').then((mod) => mod.default || mod);
    }
    return bcryptPromise;
};

const sameUserId = (left, right) => (
    left != null && right != null && left !== '' && right !== '' && String(left) === String(right)
);

const setIfChanged = (setter, next) => {
    setter((prev) => {
        try {
            return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
        } catch {
            return next;
        }
    });
};

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

    const handleConfirmOk = useCallback(() => {
        confirmResolverRef.current?.(true);
        confirmResolverRef.current = null;
        setConfirmDialog(null);
    }, []);

    const handleConfirmCancel = useCallback(() => {
        confirmResolverRef.current?.(false);
        confirmResolverRef.current = null;
        setConfirmDialog(null);
    }, []);

    // Одинаковый ответ сервера не меняет ссылку и не перерисовывает страницы.
    const refreshData = useCallback(async () => {
        try {
            const productsRes = await axios.get(`${API_BASE}/product`);
            setIfChanged(setProducts, productsRes.data);
        } catch (err) {
            console.error('Ошибка обновления каталога:', err);
        }

        let token = '';
        try {
            token = localStorage.getItem('token') || '';
        } catch {
            token = '';
        }
        if (!token) {
            setIfChanged(setUsers, []);
            setIfChanged(setWorkSessions, []);
            return;
        }

        let usersData = null;
        try {
            const usersRes = await axios.get(`${API_BASE}/users`);
            usersData = usersRes.data;
            setIfChanged(setUsers, usersData);
        } catch (err) {
            console.error('Ошибка обновления сотрудников:', err);
            if (err.response?.status === 401) setIfChanged(setUsers, []);
        }
        try {
            const sessionsRes = await axios.get(`${API_BASE}/workSessions`);
            setIfChanged(setWorkSessions, sessionsRes.data);
        } catch (err) {
            console.error('Ошибка обновления смен:', err);
            if (err.response?.status === 401) setIfChanged(setWorkSessions, []);
        }

        if (!Array.isArray(usersData)) return;
        setCurrentUser((prev) => {
            if (!prev) return prev;
            const fresh = usersData.find((user) => sameUserId(user.id, prev.id));
            if (!fresh) return prev;
            const next = {
                ...prev,
                login: fresh.login,
                email: fresh.email,
                fullName: fresh.fullName,
                role: fresh.role,
                avatar: fresh.avatar || '',
                phone: fresh.phone || '',
                position: fresh.position || '',
                badgeId: fresh.badgeId || '',
                description: fresh.description || '',
            };
            if (JSON.stringify(prev) === JSON.stringify(next)) return prev;
            localStorage.setItem('currentUser', JSON.stringify(next));
            return next;
        });
    }, []);

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

        refreshData().finally(() => setDataLoaded(true));
    }, [refreshData]);

    // Автообновление данных каждые 10 секунд (для отображения QR-отметок в реальном времени)
    useEffect(() => {
        const interval = setInterval(() => {
            refreshData();
        }, 10000);
        return () => clearInterval(interval);
    }, [refreshData]);

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
    }, [refreshData]);

    // Логин
    const login = useCallback(async (identifier, password) => {
        try {
            const loginRes = await axios.post(`${API_BASE}/login`, { email: identifier, password });
            const data = loginRes.data || {};
            if (!data.token) return { error: 'server' };

            const safeUser = {
                id: data.id,
                login: data.login,
                email: data.email,
                fullName: data.fullName,
                role: data.role,
                avatar: data.avatar || '',
                phone: data.phone || '',
                position: data.position || '',
                badgeId: data.badgeId || '',
                description: data.description || '',
            };

            localStorage.setItem('token', data.token);
            localStorage.setItem('currentUser', JSON.stringify(safeUser));
            setCurrentUser(safeUser);
            return safeUser;
        } catch (err) {
            if (!err.response) return { error: 'network' };
            if (err.response.status === 401) return false;
            console.error('Ошибка входа:', err.response?.data || err.message);
            return { error: 'server' };
        }
    }, []);

    const logout = useCallback(() => {
        setCurrentUser(null);
        setUsers([]);
        setWorkSessions([]);
        localStorage.removeItem('currentUser');
        localStorage.removeItem('token');
    }, []);

    // Удаление пользователя
    const deleteUser = useCallback(async (userId) => {
        if (!userId) return;

        if (currentUser && currentUser.id === userId) {
            showToast('error', 'Вы не можете удалить самого себя!');
            return;
        }

        try {
            await axios.delete(`${API_BASE}/users/${userId}`);

            setUsers(prev => prev.filter(user => !sameUserId(user.id, userId)));
            setWorkSessions(prev => prev.filter(session => !sameUserId(session.userId, userId)));

            console.log(`Пользователь с ID ${userId} успешно удалён`);
        } catch (err) {
            console.error('Ошибка при удалении пользователя:', err);
            showToast('error', 'Не удалось удалить пользователя. Ошибка сервера.');
        }
    }, [currentUser, showToast]);

    // Добавление нового пользователя
    const addUser = useCallback(async (newUser) => {
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
                const bcrypt = await loadBcrypt();
                const salt = bcrypt.genSaltSync(10);
                userToSend.password = bcrypt.hashSync(userToSend.password, salt);
            }

            const res = await axios.post(`${API_BASE}/users`, userToSend);

            setUsers(prev => [...prev, res.data]);
            return res.data;
        } catch (err) {
            console.error('Ошибка добавления:', err.response?.data || err);
            showToast('error', 'Не удалось создать пользователя');
            throw err;
        }
    }, [showToast]);

    // Обновление пользователя
    const updateUser = useCallback(async (userId, updates) => {
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
                const bcrypt = await loadBcrypt();
                const salt = bcrypt.genSaltSync(10);
                dataToSend.password = bcrypt.hashSync(updates.password, salt);
            }

            const res = await axios.patch(`${API_BASE}/users/${userId}`, dataToSend);

            setUsers(prev => prev.map(u => sameUserId(u.id, userId) ? { ...u, ...res.data } : u));
            return res.data;
        } catch (err) {
            console.error('Ошибка обновления:', err.response?.data || err);
            throw err;
        }
    }, []);

    // Начать новую смену
    const manualStartShift = useCallback(async (userId) => {
        const now = new Date();
        const today = format(now, 'yyyy-MM-dd');
        const nowTime = format(now, 'HH:mm:ss');

        // Проверяем открытые смены
        const openShifts = workSessions.filter(s =>
            sameUserId(s.userId, userId) && !s.endTime
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
    }, [workSessions, confirm, currentUser, showToast]);

    const manualEndShift = useCallback(async (sessionId) => {
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
    }, [workSessions, currentUser, showToast]);

    const editSession = useCallback(async (sessionId, updates) => {
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
    }, []);

    // Удаление смены
    const deleteSession = useCallback(async (sessionId) => {
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
    }, [confirm, showToast]);

    const addProduct = useCallback(async (newProduct) => {
        try {
            const res = await axios.post(`${API_BASE}/product`, newProduct);
            setProducts(prev => [...prev, res.data]);
        } catch (err) {
            console.error('Ошибка добавления продукта:', err);
        }
    }, []);

    const updateProduct = useCallback(async (productId, updates) => {
        try {
            const res = await axios.patch(`${API_BASE}/product/${productId}`, updates);
            setProducts(prev => prev.map(p => p.id === productId ? { ...p, ...res.data } : p));
        } catch (err) {
            console.error('Ошибка обновления продукта:', err);
        }
    }, []);

    const deleteProduct = useCallback(async (productId) => {
        try {
            await axios.delete(`${API_BASE}/product/${productId}`);
            setProducts(prev => prev.filter(p => p.id !== productId));
        } catch (err) {
            console.error('Ошибка удаления продукта:', err);
        }
    }, []);

    const value = useMemo(() => ({
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
    }), [
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
        showToast,
        confirm,
    ]);

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