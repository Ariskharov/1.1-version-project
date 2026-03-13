import React, {Component} from 'react';
import Header from './Header/header.js'
import Footer from "./Footer/footer.js";
import {Outlet} from "react-router-dom";

class Layout extends Component {
    render() {
        return (
            <>
                <Header/>
                <main style={{paddingTop:'64px',paddingLeft:'256px'}}>
                    <Outlet/>
                </main>
                <Footer/>
            </>
        );
    };
};

export default Layout;