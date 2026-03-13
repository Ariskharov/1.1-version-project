import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { CustomContext } from '../../Context';
import './sing_in.scss';

const SingIn = () => {
    const [login, setLogin] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { login: loginUser } = useContext(CustomContext);
    const navigate = useNavigate();

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
            if (success.role === 'admin') {
                navigate('/admin');
            } else {
                navigate('/sotrudnik');
            }
        } else {
            setError('Неверный логин или пароль');
            // Остаёмся на странице логина
        }
    };

    return (
        <div className="sing_in">
            <div className="sing_in__main">
                <div className="sing_in__main__center">
                    <h1>TimeTrack</h1>
                    <p>Войдите, чтобы продолжить работу</p>
                </div>

                <div className="sing_in__main__bottom">
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

                        {error && <p className="sing_in__error">{error}</p>}

                        <button type="submit" disabled={loading}>
                            {loading ? 'Вход...' : 'Войти'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default SingIn;