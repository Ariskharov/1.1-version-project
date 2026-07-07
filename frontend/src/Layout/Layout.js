import React, {Component} from 'react';
import Header from './Header/header.js'
import {Outlet} from "react-router-dom";
import { CatalogThemeProvider } from '../context/CatalogThemeContext';

class Layout extends Component {
    render() {
        return (
            <CatalogThemeProvider>
                <Header/>
                <main className='main'>
                    <Outlet/>
                </main>
            </CatalogThemeProvider>
        );
    };
};

export default Layout;