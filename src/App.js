import './App.scss';
import {Route, Routes} from 'react-router-dom';
import Layout from "./Layout/Layout";
import SingIn from "./all_pages/sing_in/sing_in";
import Admin from "./all_pages/admin/admin";
import Catalog from "./all_pages/catalog_mebeli/catalog";
import EditMebel from "./all_pages/edit_mebel/edit_mebel";

function App() {
    return (
        <>
            <Routes>
                <Route path="/signin" element={<SingIn />} />
                <Route path="/" element={<Layout />}>
                    <Route path="/" element={<Catalog />} />
                    <Route path="/edit_mebel" element={<EditMebel />} />
                    <Route path="/admin" element={<Admin />} />
                </Route>
            </Routes>
        </>
    );
}

export default App;
