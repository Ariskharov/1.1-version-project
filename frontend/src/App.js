import './App.scss';
import React, { useContext } from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
import Layout from "./Layout/Layout";
import SingIn from "./all_pages/auth/auth";
import Admin from "./all_pages/admin/admin";
import Catalog from "./all_pages/legacy/catalog/catalog";
import EditMebel from "./all_pages/legacy/furniture_editor/edit_mebel";
import { CustomContext } from './Context';
import Order from "./all_pages/legacy/order/order";
import OrderEditor from './all_pages/legacy/order_editor/order_editor';
import PlacingAnOrder from "./all_pages/legacy/order_form/placing_an_order";
import ViewOrders from './all_pages/legacy/view_orders/view_orders';
import PersonalCabinet from "./all_pages/cabinet/cabinet";
import Scan from "./all_pages/scan/scan";
import { LoadingPage } from './components/ui/LoadingSpinner';
import ProtectedRoute from './components/routing/ProtectedRoute';
import AdminRoute from './components/routing/AdminRoute';

function App() {
    const { currentUser, loading } = useContext(CustomContext);

    if (loading) {
        return <LoadingPage message="Загрузка приложения..." dark />;
    }

    return (
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
                {/* === Публичные страницы (без входа) === */}
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
    );
}

export default App;
