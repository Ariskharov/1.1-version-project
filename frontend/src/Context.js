import React, { createContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import axios from 'axios';
import { differenceInMinutes, parseISO, addDays } from 'date-fns';
import AppUi from './components/ui/AppUi';
import { API_BASE } from './config/api';
import { normalizeProduct, readProductOrder } from './utils/orderConvenience';

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

const bishkekNow = () => {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bishkek',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map((part) => [part.type, part.value]));
  const hour = parts.hour === '24' ? '00' : parts.hour;
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${hour}:${parts.minute}:${parts.second}`,
  };
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
    const [orders, setOrders] = useState([]);
    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dataLoaded, setDataLoaded] = useState(false);
    const [catalogLoadError, setCatalogLoadError] = useState('');
    const stampsRef = useRef({});
    const syncingRef = useRef(false);
    const refreshAgainRef = useRef(false);
    const syncRetryAtRef = useRef(0);
    const syncFailLoggedRef = useRef(false);

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

    const dropExpiredSession = useCallback(() => {
        setCurrentUser(null);
        setUsers([]);
        setWorkSessions([]);
        setOrders([]);
        stampsRef.current = {};
        try {
            localStorage.removeItem('currentUser');
            localStorage.removeItem('token');
        } catch {
            /* приватный режим */
        }
    }, []);

    const applyCollection = useCallback((name, rows) => {
        if (name === 'product') setIfChanged(setProducts, rows.map((row) => normalizeProduct(row)));
        else if (name === 'users') {
            setIfChanged(setUsers, rows);
            setCurrentUser((prev) => {
                if (!prev) return prev;
                const fresh = rows.find((user) => sameUserId(user.id, prev.id));
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
                try {
                    localStorage.setItem('currentUser', JSON.stringify(next));
                } catch {
                    /* приватный режим */
                }
                return next;
            });
        } else if (name === 'workSessions') setIfChanged(setWorkSessions, rows);
        else if (name === 'order') {
            setIfChanged(setOrders, rows.map((order) => ({
                ...order,
                product_order: readProductOrder(order.product_order),
            })));
        } else if (name === 'announcements') setIfChanged(setAnnouncements, rows);
    }, []);

    const readToken = () => {
        try {
            return localStorage.getItem('token') || '';
        } catch {
            return '';
        }
    };

    const pullCollection = useCallback(async (name, headers) => {
        const res = await axios.get(`${API_BASE}/${name}`, {
            headers,
            timeout: 20000,
            params: { t: Date.now() },
        });
        const rows = Array.isArray(res.data) ? res.data : [];
        applyCollection(name, rows);
        if (name === 'product') setCatalogLoadError('');
    }, [applyCollection]);

    // Если /sync недоступен, каталог всё равно читаем напрямую: иначе витрина пустая.
    const pullDirect = useCallback(async (headers, names) => {
        await Promise.all(names.map(async (name) => {
            try {
                await pullCollection(name, headers);
            } catch (err) {
                if (err.response?.status === 401) dropExpiredSession();
                else console.error(`Ошибка обновления ${name}:`, err);
                if (name === 'product') setCatalogLoadError('Проверьте соединение и обновите страницу.');
            }
        }));
    }, [dropExpiredSession, pullCollection]);

    // Сначала крошечный номер версии. Полный список качается только если он вырос.
    const refreshData = useCallback(async () => {
        if (syncingRef.current) {
            refreshAgainRef.current = true;
            return;
        }
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
        syncingRef.current = true;
        const token = readToken();
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const publicNames = ['product', 'announcements'];
        const privateNames = ['order', 'users', 'workSessions'];
        try {
            // Пока /sync не отвечает, списки качаем сразу. Через 15 секунд пробуем штампы снова.
            if (Date.now() < syncRetryAtRef.current) {
                await pullDirect(headers, token ? publicNames.concat(privateNames) : publicNames);
                return;
            }
            const syncRes = await axios.get(`${API_BASE}/sync`, {
                headers,
                timeout: 8000,
                params: { t: Date.now() },
            });
            const stamps = syncRes.data;
            const syncOk = stamps && typeof stamps === 'object' && !Array.isArray(stamps) && stamps.product != null && !stamps.error;
            if (!syncOk) {
                syncRetryAtRef.current = Date.now() + 15000;
                await pullDirect(headers, token ? publicNames.concat(privateNames) : publicNames);
            } else {
                syncRetryAtRef.current = 0;
                syncFailLoggedRef.current = false;
                if (!token) {
                    setIfChanged(setOrders, []);
                    setIfChanged(setUsers, []);
                    setIfChanged(setWorkSessions, []);
                    delete stampsRef.current.order;
                    delete stampsRef.current.users;
                    delete stampsRef.current.workSessions;
                }

                const jobs = Object.entries(stamps).map(async ([name, stamp]) => {
                    if (stampsRef.current[name] === stamp) return;
                    try {
                        await pullCollection(name, headers);
                        stampsRef.current[name] = stamp;
                    } catch (err) {
                        if (err.response?.status === 401) dropExpiredSession();
                        else console.error(`Ошибка обновления ${name}:`, err);
                        if (name === 'product') setCatalogLoadError('Проверьте соединение и обновите страницу.');
                    }
                });
                await Promise.all(jobs);
            }
        } catch (err) {
            if (err.response?.status === 401) {
                dropExpiredSession();
            } else {
                syncRetryAtRef.current = Date.now() + 15000;
                if (!syncFailLoggedRef.current) {
                    syncFailLoggedRef.current = true;
                    console.error('Ошибка синхронизации:', err);
                }
            }
            const still = readToken();
            await pullDirect(still ? { Authorization: `Bearer ${still}` } : {}, still ? publicNames.concat(privateNames) : publicNames);
        } finally {
            syncingRef.current = false;
            setDataLoaded(true);
            if (refreshAgainRef.current) {
                refreshAgainRef.current = false;
                refreshData();
            }
        }
    }, [dropExpiredSession, pullCollection, pullDirect]);

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

        // dataLoaded ставит сам refreshData, когда списки уже приехали.
        // Ранний finally помечал загрузку до объявлений, и все старые новости выглядели новыми.
        refreshData();
    }, [refreshData]);

    // Живое обновление: раз в 3 секунды, и сразу когда вкладка снова видна.
    useEffect(() => {
        const interval = setInterval(refreshData, 3000);
        const onVisible = () => {
            if (document.visibilityState === 'visible') refreshData();
        };
        document.addEventListener('visibilitychange', onVisible);
        window.addEventListener('focus', refreshData);
        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', onVisible);
            window.removeEventListener('focus', refreshData);
        };
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
            stampsRef.current = {};
            refreshData();
            return safeUser;
        } catch (err) {
            if (!err.response) return { error: 'network' };
            if (err.response.status === 401) return false;
            console.error('Ошибка входа:', err.response?.data || err.message);
            return { error: 'server' };
        }
    }, [refreshData]);

    const logout = useCallback(() => {
        setCurrentUser(null);
        setUsers([]);
        setWorkSessions([]);
        setOrders([]);
        stampsRef.current = {};
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
        const clock = bishkekNow();
        const today = clock.date;
        const nowTime = clock.time;

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

        const clock = bishkekNow();
        const endDate = clock.date;
        const endTime = clock.time;
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
        orders,
        setOrders,
        announcements,
        loading,
        dataLoaded,
        catalogLoadError,
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
        orders,
        setOrders,
        announcements,
        loading,
        dataLoaded,
        catalogLoadError,
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