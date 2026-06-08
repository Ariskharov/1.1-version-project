import './App.scss';
import React, { useContext } from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
import Layout from "./Layout/Layout";
import SingIn from "./all_pages/sing_in/sing_in";
import Admin from "./all_pages/admin/admin";
import Catalog from "./all_pages/catalog_mebeli/catalog";
import EditMebel from "./all_pages/edit_mebel/edit_mebel";
import { CustomContext } from './Context';
import Order from "./all_pages/order/order";
import OrderEditor from "./all_pages/order_editor/order_editor";
import PlacingAnOrder from "./all_pages/placing_an_order/placing_an_order";
import ViewOrders from './all_pages/view_orders/view_orders'
import Scan from "./all_pages/scan/scan";
import PersonalCabinet from "./all_pages/cabinet/cabinet";

function App() {
    const { currentUser, loading } = useContext(CustomContext);

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#121212', color: 'white' }}>
                <h2>Загрузка...</h2>
            </div>
        );
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
                {(currentUser?.role === 'admin' || currentUser?.role === 'user') && (
                    <>
                        <Route path="edit_mebel" element={<EditMebel />}/>
                        <Route path="/placing_an_order" element={<PlacingAnOrder />} />
                        <Route path="/view_orders" element={<ViewOrders />} />
                        <Route path="/order_editor/:id" element={<OrderEditor />} />
                        <Route path="cabinet" element={<PersonalCabinet />} />
                    </>
                )}
                {currentUser?.role === 'admin' && (
                    <Route path="admin" element={<Admin />} />
                )}
                <Route index element={(currentUser?.role === 'admin' || !currentUser) ? <Catalog /> : <Navigate to="/cabinet" replace />}/>
                <Route path="/order/:id" element={<Order />} />
            </Route>

            {/* Редирект для всех остальных путей */}
            <Route path="*" element={<Navigate to={currentUser ? (currentUser.role === 'scanner' ? "/scan" : "/") : "/signin"} replace />} />
        </Routes>
    );
}

export default App;
