import React, {useContext, useState} from 'react';
import './header.scss';
import logo from '../img_layout/logo.svg'; // поправь путь, если нужно
import './header.scss';
import defaultAvatar from '../img_layout/avatar_img.jpg';
import exitImg from '../img_layout/exit_img.svg';
import {Link, useLocation, useNavigate} from 'react-router-dom';
import {CustomContext} from '../../Context';
import {animateScroll} from "react-scroll";

const Header = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { currentUser, logout } = useContext(CustomContext);

    const [menuOpen, setMenuOpen] = useState(false);

    const handleLogout = () => {
        logout();
        navigate('/');
        setMenuOpen(false);
    };

    const isActive = (path) => location.pathname === path;
    const toTop = () => animateScroll.scrollToTop({ delay: 0, duration: 0, smooth: true });

    const toggleMobileMenu = () => setMenuOpen(prev => !prev);


    return (
        <header className="header">
            <div className="header_PC">
                <div className="header__top">

                    <Link to="/home">
                        <img src={logo} alt="TimeTrack Logo" className="header__top__logo"/>
                    </Link>

                    {currentUser ? (
                        <div className="header__top__right">
                            <div className="header__top__right__user">
                                {currentUser.avatar ? (
                                    <img src={currentUser.avatar} alt="avatar" className="header__avatar"/>
                                ) : (
                                    <img src={defaultAvatar} alt="avatar" className="header__top__right__user__avatar"/>
                                )}
                                <span className="header__top__right__user__username">{currentUser.fullName}</span>
                            </div>

                            <button onClick={handleLogout} className="header__top__right__logout-btn">
                                <img src={exitImg} alt="exit"/>
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
            </div>
            <div className="header_Phon">
                <div className="header__mobile-top">
                    <Link to="/home" onClick={toTop}>
                        <img src={logo} alt="TimeTrack Logo" className="header__mobile-logo" />
                    </Link>

                    {currentUser ? (
                        <button
                            className="header__mobile-menu-btn"
                            onClick={toggleMobileMenu}
                        >
                            ☰
                        </button>
                    ) : (
                        <Link to="/signin" className="header__mobile-login-btn">
                            Войти
                        </Link>
                    )}
                </div>

                {/* Мобильное меню (выезжает справа) */}
                <div className={`header__mobile-menu ${menuOpen ? 'active' : ''}`}>
                    <div className="header__mobile-menu__content">
                        {/* Навигация */}
                        <nav className="header__mobile-nav">
                            {currentUser?.role === 'admin' && (
                                <>
                                    <Link
                                        to="/admin"
                                        onClick={() => { toTop(); setMenuOpen(false); }}
                                        className={`header__mobile-link ${isActive('/admin') ? 'active' : ''}`}
                                    >
                                        Панель администратора
                                    </Link>
                                    <Link
                                        to="/edit_mebel"
                                        onClick={() => { toTop(); setMenuOpen(false); }}
                                        className={`header__mobile-link ${isActive('/edit_mebel') ? 'active' : ''}`}
                                    >
                                        Редактор мебели
                                    </Link>
                                </>
                            )}

                            <Link
                                to="/"
                                onClick={() => { toTop(); setMenuOpen(false); }}
                                className={`header__mobile-link ${isActive('/') ? 'active' : ''}`}
                            >
                                Каталог мебели
                            </Link>
                        </nav>

                        {/* Информация об аккаунте + Выход */}
                        {currentUser && (
                            <div className="header__mobile-user">
                                <div className="header__mobile-user__info">
                                    {currentUser.avatar ? (
                                        <img src={currentUser.avatar} alt="avatar" className="header__mobile-avatar" />
                                    ) : (
                                        <img src={defaultAvatar} alt="avatar" className="header__mobile-avatar" />
                                    )}
                                    <span className="header__mobile-username">{currentUser.fullName}</span>
                                </div>

                                <button onClick={handleLogout} className="header__mobile-logout">
                                    <img src={exitImg} alt="exit" />
                                    Выйти
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Затемнение фона при открытом меню */}
                {menuOpen && (
                    <div
                        className="header__mobile-overlay"
                        onClick={() => setMenuOpen(false)}
                    />
                )}
            </div>
        </header>
    );
};

export default Header;