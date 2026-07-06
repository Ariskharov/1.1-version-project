import React, { useState, useContext, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CustomContext } from '../../Context';
import './auth.scss';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

const SingIn = () => {
    const [login, setLogin] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { login: loginUser, currentUser } = useContext(CustomContext);
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
            // Остаёмся на странице логина
        }
    };

    return (
        <div className="auth">
            <div className="auth__main">
                <div className="auth__main__center">
                    <h1>TimeTrack</h1>
                    <p>Войдите, чтобы продолжить работу</p>
                </div>

                <div className="auth__main__bottom">
                    <form onSubmit={handleSubmit}>
                        <p>Логин или email</p>
                        <input
                            type="text"
                            placeholder="1234 или emir"
                            value={login}
                            onChange={(e) => setLogin(e.target.value)}
                            autoFocus
                        />

                        <p>Пароль</p>
                        <input
                            type="password"
                            placeholder="Введите ваш пароль"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />

                        {error && <p className="auth__error">{error}</p>}

                        <button type="submit" disabled={loading}>
                            {loading ? <><LoadingSpinner size="sm" light /> Вход...</> : 'Войти'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default SingIn;