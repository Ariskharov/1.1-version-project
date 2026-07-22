import React, { useContext, useState, useEffect, useRef } from 'react';
import './header.scss';
import logo from '../img_layout/logo.svg';
import defaultAvatar from '../img_layout/avatar_img.jpg';
import exitImg from '../img_layout/exit_img.svg';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { CustomContext } from '../../Context';
import ThemeToggle from '../../components/ui/ThemeToggle';

const Header = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { currentUser, logout } = useContext(CustomContext);

    const [menuOpen, setMenuOpen] = useState(false);
    const [isMobileHeader, setIsMobileHeader] = useState(
        () => typeof window !== 'undefined' && window.matchMedia('(max-width: 650px)').matches,
    );
    const mobileMenuRef = useRef(null);
    const menuButtonRef = useRef(null);

    useEffect(() => {
        const mq = window.matchMedia('(max-width: 650px)');
        const onChange = (e) => setIsMobileHeader(e.matches);
        mq.addEventListener('change', onChange);
        return () => mq.removeEventListener('change', onChange);
    }, []);

    const setSubtreeTabIndex = (root, disabled) => {
        if (!root) return;
        root.querySelectorAll('a, button, input, select, textarea, [tabindex]').forEach((el) => {
            if (disabled) {
                if (el.dataset.a11yPrevTabindex === undefined) {
                    el.dataset.a11yPrevTabindex = el.getAttribute('tabindex') ?? '';
                }
                el.setAttribute('tabindex', '-1');
            } else if (el.dataset.a11yPrevTabindex !== undefined) {
                const prev = el.dataset.a11yPrevTabindex;
                if (prev === '') el.removeAttribute('tabindex');
                else el.setAttribute('tabindex', prev);
                delete el.dataset.a11yPrevTabindex;
            }
        });
    };

    useEffect(() => {
        const pc = document.querySelector('.header_PC');
        const phon = document.querySelector('.header_Phon');
        setSubtreeTabIndex(pc, isMobileHeader);
        setSubtreeTabIndex(phon, !isMobileHeader);
    }, [isMobileHeader]);

    useEffect(() => {
        if (!mobileMenuRef.current) return;
        setSubtreeTabIndex(mobileMenuRef.current, !menuOpen);
    }, [menuOpen]);

    const handleLogout = () => {
        logout();
        navigate('/');
        setMenuOpen(false);
    };

    const isActive = (path) => location.pathname === path;
    const isCatalogActive = location.pathname === '/' || location.pathname === '/catalog';
    const toTop = () => window.scrollTo({ top: 0, behavior: 'auto' });

    const toggleMobileMenu = () => setMenuOpen((prev) => !prev);

    /** Закрыть меню и убрать фокус из aria-hidden/inert-ветки */
    const closeMobileMenu = () => {
        const menu = mobileMenuRef.current;
        if (menu?.contains(document.activeElement)) {
            menuButtonRef.current?.focus?.();
        }
        setMenuOpen(false);
    };

    useEffect(() => {
        // Меню закрыто: не оставляем фокус на ссылках внутри aria-hidden
        if (!menuOpen) {
            const menu = mobileMenuRef.current;
            if (menu?.contains(document.activeElement)) {
                menuButtonRef.current?.focus?.() || document.activeElement?.blur?.();
            }
            return undefined;
        }

        const main = document.getElementById('main-content');
        // main не содержит меню (меню в header) — можно скрыть
        main?.setAttribute('aria-hidden', 'true');
        try {
            if (main) main.inert = true;
        } catch {
            /* ignore */
        }

        const menu = mobileMenuRef.current;
        // Убедиться, что меню само не inert/aria-hidden в момент фокуса
        menu?.removeAttribute('aria-hidden');
        try {
            if (menu) menu.inert = false;
        } catch {
            /* ignore */
        }

        const focusables = menu?.querySelectorAll('a[href], button:not([disabled])');
        const first = focusables?.[0];
        requestAnimationFrame(() => first?.focus?.());

        const onKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                closeMobileMenu();
                menuButtonRef.current?.focus?.();
                return;
            }
            if (e.key !== 'Tab' || !menu) return;
            const items = Array.from(menu.querySelectorAll('a[href], button:not([disabled])'));
            if (!items.length) return;
            const firstEl = items[0];
            const lastEl = items[items.length - 1];
            if (e.shiftKey && document.activeElement === firstEl) {
                e.preventDefault();
                lastEl.focus();
            } else if (!e.shiftKey && document.activeElement === lastEl) {
                e.preventDefault();
                firstEl.focus();
            }
        };

        document.addEventListener('keydown', onKeyDown, true);

        return () => {
            document.removeEventListener('keydown', onKeyDown, true);
            main?.removeAttribute('aria-hidden');
            try {
                if (main) main.inert = false;
            } catch {
                /* ignore */
            }
        };
    }, [menuOpen]);

    const navLinkClass = (active) => (
        active ? 'header__menu_nav_left__active' : 'header__menu_nav_left__botton'
    );

    return (
        <header className="header">
            <div
                className="header_PC"
                aria-hidden={isMobileHeader ? true : undefined}
                {...(isMobileHeader ? { inert: true } : {})}
            >
                <div className="header__top">

                    <Link to="/" aria-label="TimeTrack — на главную">
                        <img src={logo} alt="" className="header__top__logo" />
                    </Link>

                    <div className="header__top__right">
                        <ThemeToggle />

                        {currentUser ? (
                            <>
                            <div className="header__top__right__user" aria-label={`Пользователь: ${currentUser.fullName}`}>
                                {currentUser.avatar ? (
                                    <img src={currentUser.avatar} alt="" className="header__avatar" />
                                ) : (
                                    <img src={defaultAvatar} alt="" className="header__top__right__user__avatar" />
                                )}
                                <span className="header__top__right__user__username">{currentUser.fullName}</span>
                            </div>

                            <button type="button" onClick={handleLogout} className="header__top__right__logout-btn">
                                <img src={exitImg} alt="" aria-hidden="true" />
                                Выйти
                            </button>
                        </>
                    ) : (
                        <Link to="/signin" className="header__top__right__logout-btn">
                            Войти
                        </Link>
                    )}
                    </div>

                </div>
                <div className="header__menu_nav_left">
                    <p className="header__menu_nav_left__name" aria-hidden="true">Management</p>
                    <nav aria-label="Основная навигация">
                        <Link
                            to="/"
                            onClick={() => toTop()}
                            className={navLinkClass(isCatalogActive)}
                            aria-current={isCatalogActive ? 'page' : undefined}
                        >
                            Каталог мебели
                        </Link>

                        {currentUser && currentUser.role !== 'admin' && (
                            <>
                                <Link
                                    to="/cabinet"
                                    onClick={toTop}
                                    className={navLinkClass(isActive('/cabinet'))}
                                    aria-current={isActive('/cabinet') ? 'page' : undefined}
                                >
                                    Личный кабинет
                                </Link>
                                <Link
                                    to="/view_orders"
                                    onClick={toTop}
                                    className={navLinkClass(isActive('/view_orders'))}
                                    aria-current={isActive('/view_orders') ? 'page' : undefined}
                                >
                                    Просмотр заказов
                                </Link>
                            </>
                        )}

                        {currentUser?.role === 'admin' && (
                            <>
                                <Link
                                    to="/admin"
                                    onClick={toTop}
                                    className={navLinkClass(isActive('/admin'))}
                                    aria-current={isActive('/admin') ? 'page' : undefined}
                                >
                                    Панель администратора
                                </Link>
                                <Link
                                    to="/edit_mebel"
                                    onClick={toTop}
                                    className={navLinkClass(isActive('/edit_mebel'))}
                                    aria-current={isActive('/edit_mebel') ? 'page' : undefined}
                                >
                                    Редактор мебели
                                </Link>
                                <Link
                                    to="/placing_an_order"
                                    onClick={toTop}
                                    className={navLinkClass(isActive('/placing_an_order'))}
                                    aria-current={isActive('/placing_an_order') ? 'page' : undefined}
                                >
                                    Оформление заказа
                                </Link>
                                <Link
                                    to="/view_orders"
                                    onClick={toTop}
                                    className={navLinkClass(isActive('/view_orders'))}
                                    aria-current={isActive('/view_orders') ? 'page' : undefined}
                                >
                                    Просмотр заказов
                                </Link>
                                <Link
                                    to="/cabinet"
                                    onClick={toTop}
                                    className={navLinkClass(isActive('/cabinet'))}
                                    aria-current={isActive('/cabinet') ? 'page' : undefined}
                                >
                                    Личный кабинет
                                </Link>
                            </>
                        )}


                    </nav>
                </div>
            </div>
            <div
                className="header_Phon"
                aria-hidden={!isMobileHeader ? true : undefined}
                {...(!isMobileHeader ? { inert: true } : {})}
            >
                <div className="header__mobile-top">
                    <Link to="/" onClick={toTop} aria-label="TimeTrack — на главную">
                        <img src={logo} alt="" className="header__mobile-logo" />
                    </Link>

                    <div className="header__mobile-top__actions">
                        <ThemeToggle className="theme-toggle--compact" />
                        {currentUser ? (
                            <button
                                type="button"
                                ref={menuButtonRef}
                                className="header__mobile-menu-btn"
                                onClick={toggleMobileMenu}
                                aria-label={menuOpen ? 'Закрыть меню' : 'Открыть меню'}
                                aria-expanded={menuOpen}
                                aria-controls="mobile-nav"
                            >
                                ☰
                            </button>
                        ) : (
                            <Link to="/signin" className="header__mobile-login-btn">
                                Войти
                            </Link>
                        )}
                    </div>
                </div>

                <div
                    id="mobile-nav"
                    ref={mobileMenuRef}
                    className={`header__mobile-menu ${menuOpen ? 'active' : ''}`}
                    role={menuOpen ? 'dialog' : undefined}
                    aria-modal={menuOpen ? 'true' : undefined}
                    aria-label={menuOpen ? 'Мобильное меню' : undefined}
                    aria-hidden={menuOpen ? undefined : true}
                    {...(!menuOpen ? { inert: true } : {})}
                >
                    <div className="header__mobile-menu__content">
                        <nav className="header__mobile-nav" aria-label="Основная навигация">
                            <Link
                                to="/"
                                onClick={() => { toTop(); closeMobileMenu(); }}
                                className={`header__mobile-link ${isCatalogActive ? 'active' : ''}`}
                                aria-current={isCatalogActive ? 'page' : undefined}
                            >
                                Каталог мебели
                            </Link>

                            {currentUser && currentUser.role !== 'admin' && (
                                <>
                                    <Link
                                        to="/cabinet"
                                        onClick={() => { toTop(); closeMobileMenu(); }}
                                        className={`header__mobile-link ${isActive('/cabinet') ? 'active' : ''}`}
                                        aria-current={isActive('/cabinet') ? 'page' : undefined}
                                    >
                                        Личный кабинет
                                    </Link>
                                    <Link
                                        to="/view_orders"
                                        onClick={() => { toTop(); closeMobileMenu(); }}
                                        className={`header__mobile-link ${isActive('/view_orders') ? 'active' : ''}`}
                                        aria-current={isActive('/view_orders') ? 'page' : undefined}
                                    >
                                        Просмотр заказов
                                    </Link>
                                </>
                            )}

                            {currentUser?.role === 'admin' && (
                                <>
                                    <Link
                                        to="/admin"
                                        onClick={() => { toTop(); closeMobileMenu(); }}
                                        className={`header__mobile-link ${isActive('/admin') ? 'active' : ''}`}
                                        aria-current={isActive('/admin') ? 'page' : undefined}
                                    >
                                        Панель администратора
                                    </Link>
                                    <Link
                                        to="/edit_mebel"
                                        onClick={() => { toTop(); closeMobileMenu(); }}
                                        className={`header__mobile-link ${isActive('/edit_mebel') ? 'active' : ''}`}
                                        aria-current={isActive('/edit_mebel') ? 'page' : undefined}
                                    >
                                        Редактор мебели
                                    </Link>
                                    <Link
                                        to="/placing_an_order"
                                        onClick={() => { toTop(); closeMobileMenu(); }}
                                        className={`header__mobile-link ${isActive('/placing_an_order') ? 'active' : ''}`}
                                        aria-current={isActive('/placing_an_order') ? 'page' : undefined}
                                    >
                                        Оформить заказ
                                    </Link>
                                    <Link
                                        to="/view_orders"
                                        onClick={() => { toTop(); closeMobileMenu(); }}
                                        className={`header__mobile-link ${isActive('/view_orders') ? 'active' : ''}`}
                                        aria-current={isActive('/view_orders') ? 'page' : undefined}
                                    >
                                        Просмотр заказов
                                    </Link>
                                    <Link
                                        to="/cabinet"
                                        onClick={() => { toTop(); closeMobileMenu(); }}
                                        className={`header__mobile-link ${isActive('/cabinet') ? 'active' : ''}`}
                                        aria-current={isActive('/cabinet') ? 'page' : undefined}
                                    >
                                        Личный кабинет
                                    </Link>
                                </>
                            )}
                        </nav>

                        {currentUser && (
                            <div className="header__mobile-user">
                                <div className="header__mobile-user__info">
                                    {currentUser.avatar ? (
                                        <img src={currentUser.avatar} alt="" className="header__mobile-avatar" />
                                    ) : (
                                        <img src={defaultAvatar} alt="" className="header__mobile-avatar" />
                                    )}
                                    <span className="header__mobile-username">{currentUser.fullName}</span>
                                </div>

                                <button type="button" onClick={handleLogout} className="header__mobile-logout">
                                    <img src={exitImg} alt="" aria-hidden="true" />
                                    Выйти
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {menuOpen && (
                    <div
                        className="header__mobile-overlay"
                        role="button"
                        tabIndex={0}
                        onClick={closeMobileMenu}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                closeMobileMenu();
                            }
                        }}
                        aria-label="Закрыть меню"
                    />
                )}
            </div>
        </header>
    );
};

export default Header;