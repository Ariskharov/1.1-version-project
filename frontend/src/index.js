import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import {BrowserRouter} from "react-router-dom"
import {Context} from "./Context";
import '../src/all_adaptation.scss'

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <React.StrictMode>
        <BrowserRouter>
            <Context>
                <App />
            </Context>
        </BrowserRouter>
    </React.StrictMode>,
);
