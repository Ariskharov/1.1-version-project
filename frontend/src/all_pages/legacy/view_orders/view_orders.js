import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './view_orders.scss';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8080';

const SearchIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
);

const GridIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
);

const ListIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
);

const UserIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
);

const CompanyIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><line x1="9" y1="22" x2="9" y2="16"></line><line x1="15" y1="22" x2="15" y2="16"></line><line x1="9" y1="16" x2="15" y2="16"></line></svg>
);

const MapPinIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
);

const EyeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
);

const EditIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"></path></svg>
);

const BoxIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"></line><polygon points="12 22.08 12 12 3 6.92 3 17.08 12 22.08"></polygon><polygon points="12 12 21 6.92 21 17.08 12 22.08"></polygon><polygon points="12 2 3 6.92 12 12 21 6.92 12 2"></polygon><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
);

const SomIcon = () => (
    <span style={{ fontWeight: 600, fontSize: '0.9em', marginLeft: '3px' }}>сом</span>
);

const ViewOrders = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedStatus, setSelectedStatus] = useState('Все');
    const [viewMode, setViewMode] = useState('grid');
    const [sortBy, setSortBy] = useState('id-desc');

    useEffect(() => {
        const fetchOrders = async () => {
            try {
                const response = await fetch(`${API_BASE}/order`);
                if (!response.ok) {
                    throw new Error(`Ошибка HTTP: ${response.status}`);
                }
                const data = await response.json();
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

    const calculateOrderTotal = (order) => {
        if (order.total && order.total > 0) return order.total;
        return order.product_order?.reduce((sum, item) => {
            const price = Number(item.price || 0);
            const qty = Number(item.quantity || item.userInputs?.coll || 1) || 1;
            return sum + (price * qty);
        }, 0) || 0;
    };

    const stats = {
        total: orders.length,
        new: orders.filter(o => o.status === 'Оформлен' || o.status === 'Черновик' || !o.status).length,
        inProgress: orders.filter(o => o.status === 'Пилится' || o.status === 'Собирается').length,
        delivery: orders.filter(o => o.status === 'Ожидание доставки' || o.status === 'Установка').length,
        completed: orders.filter(o => o.status === 'Завершено').length,
    };

    const getFilteredAndSortedOrders = () => {
        return orders
            .filter((order) => {
                if (selectedStatus !== 'Все') {
                    if (selectedStatus === 'Оформлен') {
                        return order.status === 'Оформлен' || !order.status;
                    }
                    return order.status === selectedStatus;
                }
                return true;
            })
            .filter((order) => {
                const term = searchTerm.toLowerCase();
                const idString = String(order.id);
                const company = (order.name_compony || '').toLowerCase();
                const client = (order.name_client || '').toLowerCase();
                const address = (order.address || '').toLowerCase();
                return idString.includes(term) || company.includes(term) || client.includes(term) || address.includes(term);
            })
            .sort((a, b) => {
                if (sortBy === 'id-desc') return b.id - a.id;
                if (sortBy === 'id-asc') return a.id - b.id;
                if (sortBy === 'client-asc') {
                    return (a.name_client || '').localeCompare(b.name_client || '');
                }
                if (sortBy === 'total-desc') {
                    return calculateOrderTotal(b) - calculateOrderTotal(a);
                }
                return 0;
            });
    };

    const filteredOrders = getFilteredAndSortedOrders();

    const getStatusInfo = (status) => {
        const normalized = status || 'Оформлен';
        switch (normalized) {
            case 'Черновик':
                return { className: 'status--draft', text: 'Черновик' };
            case 'Оформлен':
                return { className: 'status--new', text: 'Оформлен' };
            case 'Пилится':
                return { className: 'status--sawing', text: 'Пилится' };
            case 'Собирается':
                return { className: 'status--assembling', text: 'Собирается' };
            case 'Ожидание доставки':
                return { className: 'status--shipping', text: 'Доставка' };
            case 'Установка':
                return { className: 'status--installing', text: 'Установка' };
            case 'Завершено':
                return { className: 'status--completed', text: 'Завершено' };
            default:
                return { className: 'status--default', text: normalized };
        }
    };

    if (loading) {
        return (
            <div className="view-orders-loading">
                <div className="vo-spinner"></div>
                <p>Загрузка списка заказов...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="view-orders-error">
                <h2>Произошла ошибка</h2>
                <p>{error}</p>
                <button onClick={() => window.location.reload()}>Повторить попытку</button>
            </div>
        );
    }

    const allStatuses = ['Все', 'Черновик', 'Оформлен', 'Пилится', 'Собирается', 'Ожидание доставки', 'Установка', 'Завершено'];

    return (
        <div className="view-orders-container">
            {/* Header */}
            <div className="orders-header">
                <div>
                    <h1>Управление заказами</h1>
                    <p className="subtitle">Отслеживание этапов производства и отгрузки мебельных изделий</p>
                </div>
                <div className="header-stats">
                    <div className="stat-card">
                        <span className="stat-value">{stats.total}</span>
                        <span className="stat-label">Всего заказов</span>
                    </div>
                    <div className="stat-card stat-card--new">
                        <span className="stat-value">{stats.new}</span>
                        <span className="stat-label">Новые / Черновики</span>
                    </div>
                    <div className="stat-card stat-card--progress">
                        <span className="stat-value">{stats.inProgress}</span>
                        <span className="stat-label">В работе</span>
                    </div>
                    <div className="stat-card stat-card--completed">
                        <span className="stat-value">{stats.completed}</span>
                        <span className="stat-label">Завершено</span>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="filters-bar">
                <div className="filters-bar__left">
                    <div className="search-box">
                        <SearchIcon />
                        <input
                            type="text"
                            placeholder="Поиск по клиенту, компании, адресу или ID..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {searchTerm && (
                            <button className="clear-btn" onClick={() => setSearchTerm('')}>✕</button>
                        )}
                    </div>

                    <div className="sort-box">
                        <label>Сортировка:</label>
                        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                            <option value="id-desc">Сначала новые (ID)</option>
                            <option value="id-asc">Сначала старые (ID)</option>
                            <option value="client-asc">По имени клиента</option>
                            <option value="total-desc">По сумме заказа</option>
                        </select>
                    </div>
                </div>

                <div className="view-toggle">
                    <button
                        className={`toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
                        onClick={() => setViewMode('grid')}
                        title="Сетка"
                    >
                        <GridIcon />
                    </button>
                    <button
                        className={`toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
                        onClick={() => setViewMode('list')}
                        title="Таблица"
                    >
                        <ListIcon />
                    </button>
                </div>
            </div>

            {/* Status tabs */}
            <div className="status-tabs">
                {allStatuses.map((status) => {
                    const count = status === 'Все'
                        ? orders.length
                        : status === 'Оформлен'
                            ? orders.filter(o => o.status === 'Оформлен' || !o.status).length
                            : orders.filter(o => o.status === status).length;
                    return (
                        <button
                            key={status}
                            className={`status-tab-btn ${selectedStatus === status ? 'active' : ''}`}
                            onClick={() => setSelectedStatus(status)}
                        >
                            {status}
                            <span className="count-badge">{count}</span>
                        </button>
                    );
                })}
            </div>

            {/* Orders Display */}
            {filteredOrders.length === 0 ? (
                <div className="empty-orders">
                    <div className="empty-icon">📦</div>
                    <h3>Заказы не найдены</h3>
                    <p>Попробуйте сбросить фильтры поиска или изменить выбранный статус заказа.</p>
                    <button onClick={() => { setSearchTerm(''); setSelectedStatus('Все'); }}>
                        Сбросить фильтры
                    </button>
                </div>
            ) : viewMode === 'grid' ? (
                <div className="orders-grid">
                    {filteredOrders.map((order) => {
                        const statusInfo = getStatusInfo(order.status);
                        const totalCost = calculateOrderTotal(order);
                        const itemsCount = order.product_order?.length || 0;

                        return (
                            <div key={order.id} className="order-card-new">
                                <div className="card-top">
                                    <span className="order-id">Заказ #{order.id}</span>
                                    <span className={`status-badge-new ${statusInfo.className}`}>
                                        {statusInfo.text}
                                    </span>
                                </div>

                                <div className="card-middle">
                                    {order.name_client && (
                                        <div className="info-row">
                                            <UserIcon />
                                            <span className="value">{order.name_client}</span>
                                        </div>
                                    )}
                                    {order.name_compony && (
                                        <div className="info-row">
                                            <CompanyIcon />
                                            <span className="value">{order.name_compony}</span>
                                        </div>
                                    )}
                                    <div className="info-row">
                                        <MapPinIcon />
                                        <span className="value" title={order.address}>
                                            {order.address || <span className="placeholder-text">Адрес не указан</span>}
                                        </span>
                                    </div>
                                </div>

                                <div className="card-details">
                                    <div className="items-header">
                                        <BoxIcon />
                                        <span>Содержимое ({itemsCount})</span>
                                    </div>
                                    <div className="items-preview">
                                        {order.product_order && order.product_order.length > 0 ? (
                                            order.product_order.slice(0, 3).map((item, index) => (
                                                <div key={index} className="item-preview-row">
                                                    <span className="item-title">{item.title}</span>
                                                    <span className="item-qty">
                                                        {item.quantity || item.userInputs?.coll || 1} шт.
                                                    </span>
                                                </div>
                                            ))
                                        ) : (
                                            <span className="placeholder-text">Нет позиций</span>
                                        )}
                                        {itemsCount > 3 && (
                                            <div className="more-items">...и ещё {itemsCount - 3} поз.</div>
                                        )}
                                    </div>
                                </div>

                                <div className="card-footer">
                                    <div className="price-container">
                                        <span className="price-label">Сумма заказа:</span>
                                        <span className="price-value">
                                            {totalCost > 0 ? totalCost.toLocaleString('ru-RU') : '0'}
                                            <SomIcon />
                                        </span>
                                    </div>
                                    <div className="action-buttons">
                                        <Link to={`/order/${order.id}`} className="action-btn action-btn--view" title="Просмотр">
                                            <EyeIcon />
                                            <span>Детали</span>
                                        </Link>
                                        <Link to={`/order_editor/${order.id}`} className="action-btn action-btn--edit" title="Редактировать">
                                            <EditIcon />
                                            <span>Изменить</span>
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="orders-table-wrapper">
                    <table className="orders-table">
                        <thead>
                            <tr>
                                <th width="10%">ID</th>
                                <th width="25%">Клиент / Компания</th>
                                <th width="20%">Адрес доставки</th>
                                <th width="20%">Содержимое</th>
                                <th width="12%">Сумма</th>
                                <th width="13%">Статус</th>
                                <th width="10%"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredOrders.map((order) => {
                                const statusInfo = getStatusInfo(order.status);
                                const totalCost = calculateOrderTotal(order);
                                const itemsCount = order.product_order?.length || 0;

                                return (
                                    <tr key={order.id}>
                                        <td>
                                            <span className="table-order-id">#{order.id}</span>
                                        </td>
                                        <td>
                                            <div className="table-client-info">
                                                <span className="client-name">{order.name_client || '—'}</span>
                                                {order.name_compony && (
                                                    <span className="company-name">{order.name_compony}</span>
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            <span className="table-address" title={order.address}>
                                                {order.address || <span className="placeholder-text">Не указан</span>}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="table-items-preview">
                                                {order.product_order && order.product_order.length > 0 ? (
                                                    order.product_order.slice(0, 2).map((item, idx) => (
                                                        <div key={idx} className="table-item-chip">
                                                            {item.title} ({item.quantity || item.userInputs?.coll || 1} шт.)
                                                        </div>
                                                    ))
                                                ) : (
                                                    <span className="placeholder-text">Пустой заказ</span>
                                                )}
                                                {itemsCount > 2 && (
                                                    <span className="table-more-badge">+{itemsCount - 2} поз.</span>
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            <span className="table-price">
                                                {totalCost > 0 ? totalCost.toLocaleString('ru-RU') : '0'}
                                                <SomIcon />
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`status-badge-new ${statusInfo.className}`}>
                                                {statusInfo.text}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="table-actions">
                                                <Link to={`/order/${order.id}`} className="table-action-btn view" title="Просмотр">
                                                    <EyeIcon />
                                                </Link>
                                                <Link to={`/order_editor/${order.id}`} className="table-action-btn edit" title="Редактировать">
                                                    <EditIcon />
                                                </Link>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default ViewOrders;
