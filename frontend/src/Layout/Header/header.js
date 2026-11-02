import React, { useContext, useState, useEffect, useRef, useCallback } from 'react';
import './header.scss';
import logo from '../img_layout/logo-light-ui.jpg';
import exitImg from '../img_layout/exit_img.svg';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { CustomContext } from '../../Context';
import ThemeToggle from '../../components/ui/ThemeToggle';
import { resolveImageUrl } from '../../config/api';
import { useDialogA11y } from '../../hooks/useDialogA11y';
import { ROLES, bottomNav, staffNav } from '../../utils/roles';

const QRCodeSVG = React.lazy(() => import('qrcode.react').then((mod) => ({
    default: mod.QRCodeSVG || (mod.default && mod.default.QRCodeSVG) || mod.default,
})));

const getInitials = (name) => {
    if (!name) return '??';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
};

const Header = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { currentUser, logout } = useContext(CustomContext);

    const [menuOpen, setMenuOpen] = useState(false);
    const [qrOpen, setQrOpen] = useState(false);
    const qrDialogRef = useRef(null);
    const catalogUrl = `${window.location.origin}/catalog`;
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
    const staffLinks = currentUser ? staffNav(currentUser.role) : [];
    const roleLabel = ROLES[currentUser?.role]?.label || '';
    const quickLinks = bottomNav(currentUser?.role);
    const linkActive = (to) => (to === '/' ? isCatalogActive : isActive(to));

    const toggleMobileMenu = () => setMenuOpen((prev) => !prev);

    const closeCatalogQr = useCallback(() => setQrOpen(false), []);
    const openCatalogQr = () => {
        setMenuOpen(false);
        setQrOpen(true);
    };

    useDialogA11y(qrOpen, closeCatalogQr, qrDialogRef);

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
                            <div className="header__top__right__user" aria-label={`Пользователь: ${currentUser.fullName}${roleLabel ? `, ${roleLabel}` : ''}`}>
                                {resolveImageUrl(currentUser.avatar) ? (
                                    <img src={resolveImageUrl(currentUser.avatar)} alt="" className="header__avatar" />
                                ) : (
                                    <div className="header__avatar-initials">{getInitials(currentUser.fullName)}</div>
                                )}
                                <span className="header__user-text">
                                    <span className="header__top__right__user__username">{currentUser.fullName}</span>
                                    {roleLabel && <span className="header__role">{roleLabel}</span>}
                                </span>
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
                        <Link
                            to="/zayavka"
                            onClick={toTop}
                            className={navLinkClass(isActive('/zayavka'))}
                            aria-current={isActive('/zayavka') ? 'page' : undefined}
                        >
                            Заявка
                        </Link>

                        {staffLinks.map((item) => (
                            <Link
                                key={item.to}
                                to={item.to}
                                onClick={toTop}
                                className={navLinkClass(linkActive(item.to))}
                                aria-current={linkActive(item.to) ? 'page' : undefined}
                            >
                                {item.label}
                            </Link>
                        ))}


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
                            <div
                                className="header__mobile-top-user"
                                onClick={toggleMobileMenu}
                                title={currentUser.fullName}
                                role="button"
                                tabIndex={0}
                                aria-label={`Профиль: ${currentUser.fullName}`}
                                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleMobileMenu()}
                            >
                                {resolveImageUrl(currentUser.avatar) ? (
                                    <img src={resolveImageUrl(currentUser.avatar)} alt="" className="header__mobile-top-avatar" />
                                ) : (
                                    <span className="header__mobile-top-initials">{getInitials(currentUser.fullName)}</span>
                                )}
                            </div>
                        ) : (
                            <>
                                <Link to="/zayavka" className={`header__mobile-login-btn${isActive('/zayavka') ? ' is-active' : ''}`} aria-current={isActive('/zayavka') ? 'page' : undefined}>
                                    Заявка
                                </Link>
                                <Link to="/signin" className="header__mobile-login-btn">
                                    Войти
                                </Link>
                            </>
                        )}
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
                            <button
                                type="button"
                                className="header__mobile-link header__mobile-qr"
                                onClick={openCatalogQr}
                            >
                                Показать QR-код
                            </button>
                            <Link
                                to="/"
                                onClick={() => { toTop(); closeMobileMenu(); }}
                                className={`header__mobile-link ${isCatalogActive ? 'active' : ''}`}
                                aria-current={isCatalogActive ? 'page' : undefined}
                            >
                                Каталог мебели
                            </Link>
                            <Link
                                to="/zayavka"
                                onClick={() => { toTop(); closeMobileMenu(); }}
                                className={`header__mobile-link ${isActive('/zayavka') ? 'active' : ''}`}
                                aria-current={isActive('/zayavka') ? 'page' : undefined}
                            >
                                Заявка
                            </Link>

                            {staffLinks.map((item) => (
                                <Link
                                    key={item.to}
                                    to={item.to}
                                    onClick={() => { toTop(); closeMobileMenu(); }}
                                    className={`header__mobile-link ${linkActive(item.to) ? 'active' : ''}`}
                                    aria-current={linkActive(item.to) ? 'page' : undefined}
                                >
                                    {item.label}
                                </Link>
                            ))}
                        </nav>

                        {currentUser && (
                            <div className="header__mobile-user">
                                <div className="header__mobile-user__info">
                                    {resolveImageUrl(currentUser.avatar) ? (
                                        <img src={resolveImageUrl(currentUser.avatar)} alt="" className="header__mobile-avatar" />
                                    ) : (
                                        <div className="header__mobile-avatar-initials">{getInitials(currentUser.fullName)}</div>
                                    )}
                                    <span className="header__mobile-username">
                                        {currentUser.fullName}
                                        {roleLabel && <span className="header__role">{roleLabel}</span>}
                                    </span>
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
            {currentUser?.role !== 'scanner' && (
                <nav
                    className={`header__bottom-nav${menuOpen ? ' header__bottom-nav--hidden' : ''}`}
                    aria-label="Быстрые разделы"
                    aria-hidden={menuOpen || undefined}
                    {...(menuOpen ? { inert: true } : {})}
                >
                    {quickLinks.map((item) => {
                        const active = linkActive(item.to);
                        return (
                            <Link
                                key={item.to}
                                to={item.to}
                                className={active ? 'is-active' : ''}
                                aria-current={active ? 'page' : undefined}
                                aria-label={item.to === '/placing_an_order' ? 'Новый заказ' : undefined}
                                onClick={toTop}
                            >
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>
            )}
            {qrOpen && (
                <div
                    className="catalog-qr"
                    ref={qrDialogRef}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="catalog-qr-title"
                >
                    <div className="catalog-qr__backdrop" onClick={closeCatalogQr} />
                    <div className="catalog-qr__card">
                        <h2 id="catalog-qr-title">Каталог по QR</h2>
                        <p>
                            Наведите камеру на код. Откроется каталог: можно посмотреть мебель и оставить заявку.
                        </p>
                        <div className="catalog-qr__code">
                            <React.Suspense fallback={null}>
                                <QRCodeSVG
                                    value={catalogUrl}
                                    size={232}
                                    level="Q"
                                    includeMargin
                                    bgColor="#ffffff"
                                    fgColor="#1a1612"
                                />
                            </React.Suspense>
                        </div>
                        <p className="catalog-qr__url">{catalogUrl}</p>
                        <button type="button" className="catalog-qr__close" onClick={closeCatalogQr}>
                            Закрыть
                        </button>
                    </div>
                </div>
            )}
        </header>
    );
};

export default Header;