import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import {BrowserRouter} from "react-router-dom"
import {Context} from "./Context";
import { ModalProvider } from './ModalContext';
import { CatalogThemeProvider } from './context/CatalogThemeContext';
import { registerServiceWorker } from './utils/pushNotifications';
import '../src/all_adaptation.scss'

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <React.StrictMode>
        <BrowserRouter>
            <ModalProvider>
                <Context>
                    <CatalogThemeProvider>
                        <App />
                    </CatalogThemeProvider>
                </Context>
            </ModalProvider>
        </BrowserRouter>
    </React.StrictMode>,
);

if (process.env.NODE_ENV === 'production' || window.location.hostname === 'localhost') {
    registerServiceWorker().catch(() => {});
}
