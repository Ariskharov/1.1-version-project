import React, { useContext } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { CustomContext } from '../../Context';

/** Только для авторизованных пользователей */
const ProtectedRoute = ({ children }) => {
    const { currentUser } = useContext(CustomContext);
    const location = useLocation();

    if (!currentUser) {
        return <Navigate to="/signin" state={{ from: location.pathname }} replace />;
    }

    return children;
};

export default ProtectedRoute;