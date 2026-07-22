import React, { Component } from 'react';
import Header from './Header/header.js';
import { Outlet } from 'react-router-dom';

class Layout extends Component {
    render() {
        return (
            <>
                <a href="#main-content" className="skip-link">
                    Перейти к содержимому
                </a>
                <Header />
                <main id="main-content" className="main" tabIndex={-1}>
                    <Outlet />
                </main>
            </>
        );
    }
}

export default Layout;