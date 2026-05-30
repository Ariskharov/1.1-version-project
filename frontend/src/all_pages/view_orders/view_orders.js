import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './view_orders.scss';

const ViewOrders = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Для отладки: временно отключаем проверку роли, как указано
    // const isAdmin = localStorage.getItem('role') === 'admin';

    useEffect(() => {
        const fetchOrders = async () => {
            try {
                const response = await fetch('http://localhost:8080/order');
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
        return <div className="loading">Загрузка...</div>;
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
                                {/* Временно без условия isAdmin, как указано */}
                                <Link to={`/order_editor/${order.id}`} className="button edit">
                                    Редактировать заказ
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ViewOrders;