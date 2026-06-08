import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import {BrowserRouter} from "react-router-dom"
import {Context} from "./Context";
import { ModalProvider } from './ModalContext';
import '../src/all_adaptation.scss'

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <React.StrictMode>
        <BrowserRouter>
            <ModalProvider>
                <Context>
                    <App />
                </Context>
            </ModalProvider>
        </BrowserRouter>
    </React.StrictMode>,
);
