import React, {useContext} from 'react';
import './header.scss';
import logo from '../img_layout/logo.svg'; // поправь путь, если нужно
import defaultAvatar from '../img_layout/avatar_img.jpg'; // заглушка
import exitImg from '../img_layout/exit_img.svg';
import {Link, useLocation, useNavigate} from 'react-router-dom';
import {CustomContext} from '../../Context'; // путь к твоему Context
import {animateScroll} from "react-scroll";


const Header = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { currentUser, logout } = useContext(CustomContext);

    console.log('Header рендерится. currentUser:', currentUser);

    const handleLogout = () => {
        logout();
        navigate('/'); // или '/signin', куда у тебя страница входа
    };

    const toTop = () => {
        animateScroll.scrollToTop({ delay: 0, duration: 0, smooth: true });
    };

    const isActive = (path) => location.pathname === path;

    return (
        <header className="header">
            <div className="header__top">
                <Link to="/home">
                    <img src={logo} alt="TimeTrack Logo" className="header__top__logo"/>
                </Link>

                {currentUser ? (
                    <div className="header__top__right">
                        <div className="header__top__right__user">
                            {currentUser.avatar ? (
                                <img src={currentUser.avatar} alt="avatar" className="header__avatar" />
                            ) : (
                                <img
                                    src={currentUser.avatar || defaultAvatar}
                                    alt="Avatar"
                                    className="header__top__right__user__avatar"
                                />
                            )}
                            <span className="header__top__right__user__username">{currentUser.fullName}</span>
                        </div>

                        <button onClick={handleLogout} className="header__top__right__logout-btn">
                            <img src={exitImg} alt="exit" />
                            Выйти
                        </button>
                    </div>
                ) : (
                    <Link to="/signin" className="header__top__right__logout-btn">
                        Войти
                    </Link>
                )}

            </div>
            <div className="header__menu_nav_left">
                <p className="header__menu_nav_left__name">Management</p>
                <nav className="">
                    {currentUser?.role === 'admin' && (
                        <>
                            <Link
                                to="/admin"
                                onClick={toTop}
                                className={`header__link ${isActive('/admin') ? 'header__menu_nav_left__active' : 'header__menu_nav_left__botton'}`}
                            >
                                Панель администратора
                            </Link>
                            <Link
                                to="/edit_mebel"
                                onClick={toTop}
                                className={`header__link ${isActive('/edit_mebel') ? 'header__menu_nav_left__active' : 'header__menu_nav_left__botton'}`}
                            >
                                Редактор мебели
                            </Link>
                        </>
                    )}
                    <Link to="/" onClick={() => toTop()}>
                        <p className={isActive('/') ? 'header__menu_nav_left__active' : 'header__menu_nav_left__botton'}>
                            Каталог мебели
                        </p>
                    </Link>


                </nav>
            </div>
        </header>
    );
};

export default Header;