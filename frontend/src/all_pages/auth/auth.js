import React, { useState, useContext, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { CustomContext } from '../../Context';
import { useCatalogTheme } from '../../context/CatalogThemeContext';
import ThemeToggle from '../../components/ui/ThemeToggle';
import './auth.scss';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

const PasswordToggle = ({ visible, onToggle }) => (
    <button
        type="button"
        className="auth__password-toggle"
        onClick={onToggle}
        aria-label={visible ? 'Скрыть пароль' : 'Показать пароль'}
        title={visible ? 'Скрыть пароль' : 'Показать пароль'}
    >
        {visible ? (
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M10.58 10.58A3 3 0 0 0 12 15a3 3 0 0 0 2.83-2M9.88 5.09A10.94 10.94 0 0 1 12 5c5 0 9.27 3.11 11 7.5a11.8 11.8 0 0 1-2.16 3.19M6.61 6.61A11.33 11.33 0 0 0 1 12.5C2.73 16.89 7 20 12 20a10.9 10.9 0 0 0 5.39-1.43" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
        ) : (
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M2 12.5C3.73 8.11 8 5 13 5s9.27 3.11 11 7.5c-1.73 4.39-6 7.5-11 7.5S3.73 16.89 2 12.5z" stroke="currentColor" strokeWidth="1.8" />
                <circle cx="13" cy="12.5" r="3" stroke="currentColor" strokeWidth="1.8" />
            </svg>
        )}
    </button>
);

const SingIn = () => {
    const [login, setLogin] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { login: loginUser, currentUser } = useContext(CustomContext);
    const { resolvedTheme } = useCatalogTheme();
    const navigate = useNavigate();
    const location = useLocation();
    const redirectTo = location.state?.from;

    useEffect(() => {
        if (currentUser) {
            navigate(currentUser.role === 'admin' ? '/edit_mebel' : '/cabinet', { replace: true });
        }
    }, [currentUser, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        if (!login.trim() || !password.trim()) {
            setError('Заполните все поля');
            setLoading(false);
            return;
        }

        const success = await loginUser(login, password);

        setLoading(false);
        if (success) {
            if (redirectTo && redirectTo !== '/signin') {
                navigate(redirectTo, { replace: true });
            } else if (success.role === 'admin') {
                navigate('/edit_mebel', { replace: true });
            } else {
                navigate('/cabinet', { replace: true });
            }
        } else {
            setError('Неверный логин или пароль');
        }
    };

    return (
        <div className={`auth auth--theme-${resolvedTheme}`}>
            <a href="#auth-main" className="skip-link">
                Перейти к форме входа
            </a>
            <div className="auth__ambient" aria-hidden="true">
                <div className="auth__ambient-orb auth__ambient-orb--1" />
                <div className="auth__ambient-orb auth__ambient-orb--2" />
            </div>

            <header className="auth__toolbar">
                <Link to="/catalog" className="auth__back">
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    В каталог
                </Link>
                <ThemeToggle className="theme-toggle--compact" />
            </header>

            <main id="auth-main" className="auth__main" tabIndex={-1}>
                <div className="auth__main__center">
                    <span className="auth__badge">Вход в систему</span>
                    <h1>TimeTrack</h1>
                    <p>Войдите, чтобы продолжить работу</p>
                </div>

                <div className="auth__main__bottom">
                    <form onSubmit={handleSubmit} aria-label="Форма входа">
                        <label className="auth__field" htmlFor="auth-login">
                            <span className="auth__label">Логин или email</span>
                            <input
                                id="auth-login"
                                type="text"
                                placeholder="1234 или emir"
                                value={login}
                                onChange={(e) => setLogin(e.target.value)}
                                autoComplete="username"
                                autoFocus
                            />
                        </label>

                        <label className="auth__field" htmlFor="auth-password">
                            <span className="auth__label">Пароль</span>
                            <span className="auth__password-wrap">
                                <input
                                    id="auth-password"
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="Введите ваш пароль"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    autoComplete="current-password"
                                />
                                <PasswordToggle
                                    visible={showPassword}
                                    onToggle={() => setShowPassword((v) => !v)}
                                />
                            </span>
                        </label>

                        {error && <p className="auth__error" role="alert">{error}</p>}

                        <button type="submit" className="auth__submit" disabled={loading}>
                            {loading ? <><LoadingSpinner size="sm" light /> Вход...</> : 'Войти'}
                        </button>
                    </form>

                    <p className="auth__hint">
                        Вход не обязателен —{' '}
                        <Link to="/catalog">просмотр каталога доступен без авторизации</Link>
                    </p>
                </div>
            </main>
        </div>
    );
};

export default SingIn;