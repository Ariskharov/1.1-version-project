import './App.scss';
import React, { Suspense, useContext, useEffect, useRef, useState } from 'react';
import { Route, Routes, Navigate, useLocation } from 'react-router-dom';
import Layout from "./Layout/Layout";
import Catalog from "./all_pages/legacy/catalog/catalog";
import { CustomContext } from './Context';
import { LoadingPage } from './components/ui/LoadingSpinner';
import ProtectedRoute from './components/routing/ProtectedRoute';
import AdminRoute from './components/routing/AdminRoute';

// Ленивый импорт всех страниц для оптимизации сборки и ускорения загрузки
const SingIn = React.lazy(() => import("./all_pages/auth/auth"));
const Admin = React.lazy(() => import("./all_pages/admin/admin"));
const EditMebel = React.lazy(() => import("./all_pages/legacy/furniture_editor/edit_mebel"));
const Order = React.lazy(() => import("./all_pages/legacy/order/order"));
const OrderEditor = React.lazy(() => import("./all_pages/legacy/order_editor/order_editor"));
const PlacingAnOrder = React.lazy(() => import("./all_pages/legacy/order_form/placing_an_order"));
const ClientRequest = React.lazy(() => import("./all_pages/request/request"));
const ViewOrders = React.lazy(() => import("./all_pages/legacy/view_orders/view_orders"));
const PersonalCabinet = React.lazy(() => import("./all_pages/cabinet/cabinet"));
const Scan = React.lazy(() => import("./all_pages/scan/scan"));

const PageFallback = () => <LoadingPage message="Загрузка страницы..." />;

const pageNameFromPath = (pathname) => {
    if (pathname === '/' || pathname === '/catalog') return 'Каталог мебели';
    if (pathname === '/signin') return 'Вход';
    if (pathname === '/scan') return 'Сканирование бейджа';
    if (pathname === '/cabinet') return 'Личный кабинет';
    if (pathname === '/view_orders') return 'Просмотр заказов';
    if (pathname === '/admin') return 'Панель администратора';
    if (pathname === '/edit_mebel') return 'Редактор мебели';
    if (pathname === '/placing_an_order') return 'Оформление заказа';
    if (pathname === '/zayavka') return 'Заявка на заказ';
    if (pathname.startsWith('/order_editor/')) return 'Редактор заказа';
    if (pathname.startsWith('/order/')) return 'Просмотр заказа';
    return 'ТокмокУПП-КОСиКОГ';
};

const isTextField = (el) => {
    if (!el || el === document.body || el === document.documentElement) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
};

const isUnavailable = (el) => !el || !el.isConnected || Boolean(el.closest('[aria-hidden="true"], [inert]'));

const findPageHeading = () => {
    const nodes = document.querySelectorAll('main h1, h1');
    for (const node of nodes) {
        if (!isUnavailable(node)) return node;
    }
    return null;
};

const focusHeading = (heading) => {
    if (!heading || isUnavailable(heading)) return;
    if (heading.tabIndex < 0) heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
};

// Голосовой проигрыватель не слышит смену страницы в одностраничном сайте,
// пока фокус не перейдёт на заголовок и название не прозвучит отдельно.
const RouteAnnouncer = () => {
    const { pathname } = useLocation();
    const pageName = pageNameFromPath(pathname);
    const [message, setMessage] = useState('');
    const first = useRef(true);

    useEffect(() => {
        document.title = pageName === 'ТокмокУПП-КОСиКОГ'
            ? pageName
            : `${pageName} — ТокмокУПП-КОСиКОГ`;

        // Сначала очищаем текст, иначе повтор того же названия страницы не зачитывается.
        setMessage('');
        const announceTimer = window.setTimeout(() => {
            setMessage(`Открыта страница: ${pageName}`);
        }, 40);

        const startedActive = document.activeElement;
        const startedHeading = findPageHeading();
        const firstLoad = first.current;
        first.current = false;

        // Не забирать фокус у поля, в которое пользователь уже попал (автофокус входа).
        if (isTextField(startedActive)) {
            return () => window.clearTimeout(announceTimer);
        }

        if (firstLoad && startedHeading) {
            focusHeading(startedHeading);
            return () => window.clearTimeout(announceTimer);
        }

        let timer = 0;
        let cancelled = false;
        const started = Date.now();
        const tryFocus = () => {
            if (cancelled) return;
            const nowActive = document.activeElement;
            const userMoved = nowActive
                && nowActive !== startedActive
                && nowActive !== document.body
                && nowActive !== document.documentElement;
            if (userMoved || isTextField(nowActive)) return;

            const heading = findPageHeading();
            if (heading && heading !== startedHeading) {
                focusHeading(heading);
                return;
            }
            if (Date.now() - started > 3000) {
                const fallback = heading || document.getElementById('main-content');
                if (fallback && !isUnavailable(fallback)) focusHeading(fallback);
                return;
            }
            timer = window.setTimeout(tryFocus, 50);
        };
        timer = window.setTimeout(tryFocus, 0);

        return () => {
            cancelled = true;
            window.clearTimeout(timer);
            window.clearTimeout(announceTimer);
        };
    }, [pathname, pageName]);

    return (
        <div className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
            {message}
        </div>
    );
};

function App() {
    const { currentUser, loading } = useContext(CustomContext);

    if (loading) {
        return <LoadingPage message="Загрузка приложения..." dark />;
    }

    return (
        <>
        <RouteAnnouncer />
        <Suspense fallback={<PageFallback />}>
            <Routes>
                <Route path="/signin" element={<SingIn />} />

                {/* Если вошел сканер, редиректим его с корня на страницу сканирования */}
                {currentUser?.role === 'scanner' && (
                    <Route path="/" element={<Navigate to="/scan" replace />} />
                )}

                {/* Страница сканирования доступна только scanner и admin */}
                <Route 
                    path="/scan" 
                    element={
                        (currentUser?.role === 'admin' || currentUser?.role === 'scanner') ? (
                            <Scan />
                        ) : (
                            currentUser ? <Navigate to="/" replace /> : <Navigate to="/signin" replace />
                        )
                    } 
                />

                <Route path="/" element={<Layout />}>
                    {/* === Публичные страницы === */}
                    <Route index element={<Catalog />} />
                    <Route path="catalog" element={<Catalog />} />
                    <Route path="zayavka" element={<ClientRequest />} />
                    <Route path="order/:id" element={<Order />} />

                    {/* === Только авторизованные === */}
                    <Route
                        path="cabinet"
                        element={(
                            <ProtectedRoute>
                                <PersonalCabinet />
                            </ProtectedRoute>
                        )}
                    />
                    <Route
                        path="view_orders"
                        element={(
                            <ProtectedRoute>
                                <ViewOrders />
                            </ProtectedRoute>
                        )}
                    />

                    {/* === Только администратор === */}
                    <Route
                        path="edit_mebel"
                        element={(
                            <AdminRoute>
                                <EditMebel />
                            </AdminRoute>
                        )}
                    />
                    <Route
                        path="admin"
                        element={(
                            <AdminRoute>
                                <Admin />
                            </AdminRoute>
                        )}
                    />
                    <Route
                        path="placing_an_order"
                        element={(
                            <AdminRoute>
                                <PlacingAnOrder />
                            </AdminRoute>
                        )}
                    />
                    <Route
                        path="order_editor/:id"
                        element={(
                            <AdminRoute>
                                <OrderEditor />
                            </AdminRoute>
                        )}
                    />
                </Route>

                {/* Редирект для всех остальных путей */}
                <Route path="*" element={<Navigate to={currentUser ? (currentUser.role === 'scanner' ? "/scan" : "/") : "/signin"} replace />} />
            </Routes>
        </Suspense>
        </>
    );
}

export default App;
