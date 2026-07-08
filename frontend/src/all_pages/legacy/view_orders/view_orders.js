import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import './view_orders.scss';
import { CustomContext } from '../../../Context';
import { LoadingPage } from '../../../components/ui/LoadingSpinner';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8080';

const ViewOrders = () => {
    const { currentUser } = useContext(CustomContext);
    const isAdmin = currentUser?.role === 'admin';

    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Роль определяется через Context выше

    useEffect(() => {
        const fetchOrders = async () => {
            try {
                const response = await fetch(`${API_BASE}/order`);
                if (!response.ok) {
                    throw new Error(`Ошибка HTTP: ${response.status}`);
                }
                const data = await response.json();
                console.log('Полученные данные от API:', data); // Для отладки
                // Адаптируем под возможные структуры: если data - массив, берем его; иначе data.order или []
                const ordersData = Array.isArray(data) ? data : data.order || [];
                setOrders(ordersData);
            } catch (err) {
                console.error('Ошибка при fetch:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchOrders();
    }, []);

    if (loading) {
        return <LoadingPage message="Загрузка заказов..." />;
    }

    if (error) {
        return <div className="error">Ошибка: {error}</div>;
    }

    // Для дополнительной отладки: лог длины orders на финальном рендере
    console.log('Orders length на рендере:', orders.length);

    return (
        <div className="view-orders">
            <h1>Просмотр заказов</h1>
            {orders.length === 0 ? (
                <p>Нет доступных заказов.</p>
            ) : (
                <div className="orders-list">
                    {orders.map((order) => (
                        <div key={order.id} className="order-card">
                            <h2>Заказ #{order.id}</h2>
                            <p><strong>Компания:</strong> {order.name_compony || 'Не указано'}</p>
                            <p><strong>Адрес доставки:</strong> {order.address || 'Не указано'}</p>
                            <p><strong>Статус:</strong> {order.status || 'Не указан'}</p>
                            <div className="buttons">
                                <Link to={`/order/${order.id}`} className="button view">
                                    Просмотреть заказ
                                </Link>
                                {isAdmin && (
                                    <Link to={`/order_editor/${order.id}`} className="button edit">
                                        Редактировать заказ
                                    </Link>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ViewOrders;