import './App.scss';
import React, { Suspense, useContext } from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
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
const ViewOrders = React.lazy(() => import("./all_pages/legacy/view_orders/view_orders"));
const PersonalCabinet = React.lazy(() => import("./all_pages/cabinet/cabinet"));
const Scan = React.lazy(() => import("./all_pages/scan/scan"));

const PageFallback = () => <LoadingPage message="Загрузка страницы..." />;

function App() {
    const { currentUser, loading } = useContext(CustomContext);

    if (loading) {
        return <LoadingPage message="Загрузка приложения..." dark />;
    }

    return (
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
    );
}

export default App;
