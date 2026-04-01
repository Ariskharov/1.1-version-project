import './App.scss';
import React, { useContext } from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
import Layout from "./Layout/Layout";
import SingIn from "./all_pages/sing_in/sing_in";
import Admin from "./all_pages/admin/admin";
import Catalog from "./all_pages/catalog_mebeli/catalog";
import EditMebel from "./all_pages/edit_mebel/edit_mebel";
import { CustomContext } from './Context';

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
            <Route path="/" element={<Layout />}>
                <Route index element={<Catalog />} />
                <Route path="edit_mebel" element={<EditMebel />} />
                <Route path="admin" element={<Admin />} />
            </Route>

            {/* Редирект для всех остальных путей */}
            <Route path="*" element={<Navigate to="/" />} />
        </Routes>
    );
}

export default App;
