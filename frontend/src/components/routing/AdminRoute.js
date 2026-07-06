import React, { useContext } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { CustomContext } from '../../Context';

/** Только для администраторов */
const AdminRoute = ({ children }) => {
    const { currentUser } = useContext(CustomContext);
    const location = useLocation();

    if (!currentUser) {
        return <Navigate to="/signin" state={{ from: location.pathname }} replace />;
    }

    if (currentUser.role !== 'admin') {
        return <Navigate to="/cabinet" replace />;
    }

    return children;
};

export default AdminRoute;