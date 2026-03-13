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
    const {currentUser, logout} = useContext(CustomContext); // будем брать из контекста
    console.log('Header рендерится. currentUser:', currentUser);

    // Если вдруг currentUser ещё не загрузился — не рендерим хедер
    if (!currentUser) return null;

    const handleLogout = () => {
        logout(); // функция из контекста, очистим состояние
        navigate('/'); // на страницу логина
    };


    const toTop = () => {
        animateScroll.scrollToTop({
            delay: 0,
            duration: 0,
            smooth: true
        })
    };


    // Определяем активный путь (упростим логику)
    const isActive = (path) => location.pathname === path;

    return (
        <header className="header">
            <div className="header__top">
                <Link to="/home">
                    <img src={logo} alt="TimeTrack Logo" className="header__top__logo"/>
                </Link>
                <div className="header__top__right">
                    <button onClick={handleLogout} className="header__top__right__logout-btn">
                        <img src={exitImg} alt=""/>
                        Выйти
                    </button>

                    <div className="header__top__right__user">
                        <img
                            src={currentUser.avatar || defaultAvatar}
                            alt="Avatar"
                            className="header__top__right__user__avatar"
                        />
                        <span className="header__top__right__user__username">{currentUser.fullName}</span>
                    </div>
                </div>
            </div>
            <div className="header__menu_nav_left">
                <p className="header__menu_nav_left__name">Management</p>
                <nav className="">
                    {currentUser.role === 'admin' && (
                        <>
                            <Link to="/admin" onClick={()=>toTop()}>
                                <p className={isActive('/admin') ? 'header__menu_nav_left__active' : 'header__menu_nav_left__botton'}>
                                    Панель администратора
                                </p>
                            </Link>
                            <Link to="/edit_mebel" onClick={()=>toTop()}>
                                <p className={isActive('/edit_mebel') ? 'header__menu_nav_left__active' : 'header__menu_nav_left__botton'}>
                                    Редактор мебели
                                </p>
                            </Link>
                        </>
                    )}
                    <Link to="/catalog" onClick={()=>toTop()}>
                        <p className={isActive('/catalog') ? 'header__menu_nav_left__active' : 'header__menu_nav_left__botton'}>
                            Каталог мебели
                        </p>
                    </Link>


                </nav>
            </div>
        </header>
    );
};

export default Header;