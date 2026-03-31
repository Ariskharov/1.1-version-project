import React, { createContext, useState, useEffect } from 'react';
import axios from 'axios';
import bcrypt from 'bcryptjs';

export const CustomContext = createContext();

const API_BASE = 'http://localhost:8080';

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

                // Проверяем, залогинен ли пользователь (по localStorage)
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

    // Логин — улучшенный поиск (поддержка дубликатов логинов и поиска по ФИО)
    const login = async (identifier, password) => {
        console.log('Попытка входа:', identifier, password);

        try {
            // Ищем всех кандидатов (по логину, email или ФИО)
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

            // Перебираем всех найденных, пока не встретим верный пароль
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

            // Если пароль верный — создаём safeUser и сохраняем
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

            // Обновим сессии
            try {
                const sessionsRes = await axios.get(`${API_BASE}/workSessions`);
                setWorkSessions(sessionsRes.data);
            } catch (e) {}

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

    // Завершить смену
    const endShift = async (sessionId) => {
        const now = new Date();
        const endTime = now.toTimeString().slice(0, 8);

        const session = workSessions.find(s => s.id === sessionId);
        if (!session) return;

        const start = new Date(`1970-01-01T${session.startTime}Z`);
        const end = new Date(`1970-01-01T${endTime}Z`);
        const durationMinutes = Math.round((end - start) / 60000);

        try {
            await axios.patch(`${API_BASE}/workSessions/${sessionId}`, {
                endTime,
                durationMinutes,
                status: 'completed'
            });

            setWorkSessions(prev => prev.map(s =>
                s.id === sessionId
                    ? { ...s, endTime, durationMinutes, status: 'completed' }
                    : s
            ));
        } catch (err) {
            console.error('Ошибка завершения смены:', err);
        }
    };

    // Вручную начать смену для пользователя
    const manualStartShift = async (userId) => {
        const today = new Date().toISOString().split('T')[0];
        const nowTime = new Date().toTimeString().slice(0, 8);

        const newSession = {
            userId,
            date: today,
            startTime: nowTime,
            endTime: null,
            durationMinutes: null,
            status: "active",
            editedBy: currentUser.id
        };

        try {
            const res = await axios.post(`${API_BASE}/workSessions`, newSession);
            setWorkSessions(prev => [...prev, res.data]);
            return res.data;
        } catch (err) {
            console.error('Ошибка начала смены:', err);
        }
    };

// Вручную завершить смену
    const manualEndShift = async (sessionId, userId) => {
        const session = workSessions.find(s => s.id === sessionId);
        if (!session || session.endTime) return;

        const nowTime = new Date().toTimeString().slice(0, 8);
        const start = new Date(`1970-01-01T${session.startTime}Z`);
        const end = new Date(`1970-01-01T${nowTime}Z`);
        const durationMinutes = Math.round((end - start) / 60000);

        try {
            await axios.patch(`${API_BASE}/workSessions/${sessionId}`, {
                endTime: nowTime,
                durationMinutes,
                status: "manually_edited",
                editedBy: currentUser.id
            });

            setWorkSessions(prev => prev.map(s =>
                s.id === sessionId
                    ? { ...s, endTime: nowTime, durationMinutes, status: "manually_edited", editedBy: currentUser.id }
                    : s
            ));
        } catch (err) {
            console.error('Ошибка завершения смены:', err);
        }
    };

// Редактировать сессию (пока просто пример — можно расширить модалкой)
    const editSession = async (sessionId, updates) => {
        try {
            const res = await axios.patch(`${API_BASE}/workSessions/${sessionId}`, updates);
            setWorkSessions(prev => prev.map(s => s.id === sessionId ? { ...s, ...res.data } : s));
        } catch (err) {
            console.error('Ошибка редактирования:', err);
        }
    };

    // Добавить нового сотрудника
    const addUser = async (newUser) => {
        try {
            const res = await axios.post(`${API_BASE}/users`, newUser);
            setUsers(prev => [...prev, res.data]);
        } catch (err) {
            console.error('Ошибка добавления:', err);
        }
    };

// Редактировать сотрудника
    const updateUser = async (userId, updates) => {
        try {
            const res = await axios.patch(`${API_BASE}/users/${userId}`, updates);
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...res.data } : u));
        } catch (err) {
            console.error('Ошибка обновления:', err);
        }
    };



// Добавление новой мебели
    // eslint-disable-next-line no-unused-vars
    const addProduct = async (newProduct) => {
        try {
            const res = await axios.post(`${API_BASE}/product`, newProduct);
            setProducts(prev => [...prev, res.data]);
        } catch (err) {
            console.error('Ошибка добавления мебели:', err);
        }
    };

// Обновление мебели
    // eslint-disable-next-line no-unused-vars
    const updateProduct = async (productId, updates) => {
        try {
            const res = await axios.patch(`${API_BASE}/product/${productId}`, updates);
            setProducts(prev => prev.map(p => p.id === productId ? { ...p, ...res.data } : p));
        } catch (err) {
            console.error('Ошибка обновления мебели:', err);
        }
    };

// Удаление мебели
    // eslint-disable-next-line no-unused-vars
    const deleteProduct = async (productId) => {
        try {
            await axios.delete(`${API_BASE}/product/${productId}`);
            setProducts(prev => prev.filter(p => p.id !== productId));
        } catch (err) {
            console.error('Ошибка удаления мебели:', err);
        }
    };

    const value = {
        currentUser,
        users,
        workSessions,
        loading,
        login,
        logout,
        endShift,
        manualStartShift,
        manualEndShift,
        editSession,
        addUser,
        updateUser,
        products
        // addProduct,
        // updateProduct,
        // deleteProduct
        // Дальше добавим: createSession, editSession и т.д.
    };

    return (
        <CustomContext.Provider value={value}>
            {children}
        </CustomContext.Provider>
    );
};