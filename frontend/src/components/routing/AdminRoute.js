import React, { useContext } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { CustomContext } from '../../Context';
import { can, homeFor } from '../../utils/roles';

/** Страница открыта только роли с нужной возможностью. */
const AdminRoute = ({ children, cap = 'adminPanel' }) => {
    const { currentUser } = useContext(CustomContext);
    const location = useLocation();

    let token = '';
    try {
        token = localStorage.getItem('token') || '';
    } catch {
        token = '';
    }
    if (!currentUser || !token) {
        return <Navigate to="/signin" state={{ from: location.pathname }} replace />;
    }

    if (!can(currentUser.role, cap)) {
        return <Navigate to={homeFor(currentUser.role)} replace />;
    }

    return children;
};

export default AdminRoute;