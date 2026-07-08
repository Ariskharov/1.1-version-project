import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './view_orders.scss';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8080';

// Beautiful inline SVG Icons
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
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><line x1="9" y1="22" x2="9" y2="16"></line><line x1="15" y1="22" x2="15" y2="16"></line><line x1="9" y1="16" x2="15" y2="16"></line><path d="M8 6h2v2H8V6zm4 0h2v2h-2V6zm-4 4h2v2H8v-2zm4 0h2v2h-2v-2zm-4 4h2v2H8v-2zm4 0h2v2h-2v-2z"></path></svg>
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

const SomIcon = () => (
    <span style={{ fontWeight: 600, fontSize: '0.9em', marginLeft: '3px' }}> ╤Б╨╛╨╝</span>
);

const BoxIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"></line><polygon points="12 22.08 12 12 3 6.92 3 17.08 12 22.08"></polygon><polygon points="12 12 21 6.92 21 17.08 12 22.08"></polygon><polygon points="12 2 3 6.92 12 12 21 6.92 12 2"></polygon><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
);

const ViewOrders = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedStatus, setSelectedStatus] = useState('╨Т╤Б╨╡');
    const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
    const [sortBy, setSortBy] = useState('id-desc'); // 'id-desc', 'id-asc', 'client-asc', 'total-desc'

    useEffect(() => {
        const fetchOrders = async () => {
            try {
                const response = await fetch(`${API_BASE}/order`);
                if (!response.ok) {
                    throw new Error(`╨Ю╤И╨╕╨▒╨║╨░ HTTP: ${response.status}`);
                }
                const data = await response.json();
                const ordersData = Array.isArray(data) ? data : data.order || [];
                setOrders(ordersData);
            } catch (err) {
                console.error('╨Ю╤И╨╕╨▒╨║╨░ ╨┐╤А╨╕ fetch:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchOrders();
    }, []);

    // Helper to calculate total cost robustly
    const calculateOrderTotal = (order) => {
        if (order.total && order.total > 0) return order.total;
        return order.product_order?.reduce((sum, item) => {
            const price = Number(item.price || 0);
            const qty = Number(item.quantity || item.userInputs?.coll || 1) || 1;
            return sum + (price * qty);
        }, 0) || 0;
    };

    // Calculate dynamic stats
    const stats = {
        total: orders.length,
        new: orders.filter(o => o.status === '╨Ю╤Д╨╛╤А╨╝╨╗╨╡╨╜' || o.status === '╨з╨╡╤А╨╜╨╛╨▓╨╕╨║' || !o.status).length,
        inProgress: orders.filter(o => o.status === '╨Я╨╕╨╗╨╕╤В╤Б╤П' || o.status === '╨б╨╛╨▒╨╕╤А╨░╨╡╤В╤Б╤П').length,
        delivery: orders.filter(o => o.status === '╨Ю╨╢╨╕╨┤╨░╨╜╨╕╨╡ ╨┤╨╛╤Б╤В╨░╨▓╨║╨╕' || o.status === '╨г╤Б╤В╨░╨╜╨╛╨▓╨║╨░').length,
        completed: orders.filter(o => o.status === '╨Ч╨░╨▓╨╡╤А╤И╨╡╨╜╨╛').length,
    };

    // Filter and Sort orders
    const getFilteredAndSortedOrders = () => {
        return orders
            .filter((order) => {
                // Status Filter
                if (selectedStatus !== '╨Т╤Б╨╡') {
                    if (selectedStatus === '╨Ю╤Д╨╛╤А╨╝╨╗╨╡╨╜') {
                        // Include blank/undefined statuses as "╨Ю╤Д╨╛╤А╨╝╨╗╨╡╨╜" for compatibility
                        return order.status === '╨Ю╤Д╨╛╤А╨╝╨╗╨╡╨╜' || !order.status;
                    }
                    return order.status === selectedStatus;
                }
                return true;
            })
            .filter((order) => {
                // Search term matching ID, Company, Client or Address
                const term = searchTerm.toLowerCase();
                const idString = String(order.id);
                const company = (order.name_compony || '').toLowerCase();
                const client = (order.name_client || '').toLowerCase();
                const address = (order.address || '').toLowerCase();
                return idString.includes(term) || company.includes(term) || client.includes(term) || address.includes(term);
            })
            .sort((a, b) => {
                // Sort handler
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

    // Helper for Status Badge Class and Label
    const getStatusInfo = (status) => {
        const normalized = status || '╨Ю╤Д╨╛╤А╨╝╨╗╨╡╨╜';
        switch (normalized) {
            case '╨з╨╡╤А╨╜╨╛╨▓╨╕╨║':
                return { className: 'status--draft', text: '╨з╨╡╤А╨╜╨╛╨▓╨╕╨║' };
            case '╨Ю╤Д╨╛╤А╨╝╨╗╨╡╨╜':
                return { className: 'status--new', text: '╨Ю╤Д╨╛╤А╨╝╨╗╨╡╨╜' };
            case '╨Я╨╕╨╗╨╕╤В╤Б╤П':
                return { className: 'status--sawing', text: '╨Я╨╕╨╗╨╕╤В╤Б╤П' };
            case '╨б╨╛╨▒╨╕╤А╨░╨╡╤В╤Б╤П':
                return { className: 'status--assembling', text: '╨б╨╛╨▒╨╕╤А╨░╨╡╤В╤Б╤П' };
            case '╨Ю╨╢╨╕╨┤╨░╨╜╨╕╨╡ ╨┤╨╛╤Б╤В╨░╨▓╨║╨╕':
                return { className: 'status--shipping', text: '╨Ф╨╛╤Б╤В╨░╨▓╨║╨░' };
            case '╨г╤Б╤В╨░╨╜╨╛╨▓╨║╨░':
                return { className: 'status--installing', text: '╨г╤Б╤В╨░╨╜╨╛╨▓╨║╨░' };
            case '╨Ч╨░╨▓╨╡╤А╤И╨╡╨╜╨╛':
                return { className: 'status--completed', text: '╨Ч╨░╨▓╨╡╤А╤И╨╡╨╜╨╛' };
            default:
                return { className: 'status--default', text: normalized };
        }
    };

    if (loading) {
        return (
            <div className="view-orders-loading">
                <div className="spinner"></div>
                <p>╨Ч╨░╨│╤А╤Г╨╖╨║╨░ ╤Б╨┐╨╕╤Б╨║╨░ ╨╖╨░╨║╨░╨╖╨╛╨▓...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="view-orders-error">
                <h2>╨Я╤А╨╛╨╕╨╖╨╛╤И╨╗╨░ ╨╛╤И╨╕╨▒╨║╨░</h2>
                <p>{error}</p>
                <button onClick={() => window.location.reload()}>╨Я╨╛╨▓╤В╨╛╤А╨╕╤В╤М ╨┐╨╛╨┐╤Л╤В╨║╤Г</button>
            </div>
        );
    }

    const allStatuses = ['╨Т╤Б╨╡', '╨з╨╡╤А╨╜╨╛╨▓╨╕╨║', '╨Ю╤Д╨╛╤А╨╝╨╗╨╡╨╜', '╨Я╨╕╨╗╨╕╤В╤Б╤П', '╨б╨╛╨▒╨╕╤А╨░╨╡╤В╤Б╤П', '╨Ю╨╢╨╕╨┤╨░╨╜╨╕╨╡ ╨┤╨╛╤Б╤В╨░╨▓╨║╨╕', '╨г╤Б╤В╨░╨╜╨╛╨▓╨║╨░', '╨Ч╨░╨▓╨╡╤А╤И╨╡╨╜╨╛'];

    return (
        <div className="view-orders-container">
            {/* Header section with Stats */}
            <div className="orders-header">
                <div>
                    <h1>╨г╨┐╤А╨░╨▓╨╗╨╡╨╜╨╕╨╡ ╨╖╨░╨║╨░╨╖╨░╨╝╨╕</h1>
                    <p className="subtitle">╨Ю╤В╤Б╨╗╨╡╨╢╨╕╨▓╨░╨╜╨╕╨╡ ╤Н╤В╨░╨┐╨╛╨▓ ╨┐╤А╨╛╨╕╨╖╨▓╨╛╨┤╤Б╤В╨▓╨░ ╨╕ ╨╛╤В╨│╤А╤Г╨╖╨║╨╕ ╨╝╨╡╨▒╨╡╨╗╤М╨╜╤Л╤Е ╨╕╨╖╨┤╨╡╨╗╨╕╨╣</p>
                </div>
                <div className="header-stats">
                    <div className="stat-card">
                        <span className="stat-value">{stats.total}</span>
                        <span className="stat-label">╨Т╤Б╨╡╨│╨╛ ╨╖╨░╨║╨░╨╖╨╛╨▓</span>
                    </div>
                    <div className="stat-card stat-card--new">
                        <span className="stat-value">{stats.new}</span>
                        <span className="stat-label">╨Э╨╛╨▓╤Л╨╡ / ╨з╨╡╤А╨╜╨╛╨▓╨╕╨║╨╕</span>
                    </div>
                    <div className="stat-card stat-card--progress">
                        <span className="stat-value">{stats.inProgress}</span>
                        <span className="stat-label">╨Т ╤А╨░╨▒╨╛╤В╨╡</span>
                    </div>
                    <div className="stat-card stat-card--completed">
                        <span className="stat-value">{stats.completed}</span>
                        <span className="stat-label">╨Ч╨░╨▓╨╡╤А╤И╨╡╨╜╨╛</span>
                    </div>
                </div>
            </div>

            {/* Filter controls row */}
            <div className="filters-bar">
                <div className="filters-bar__left">
                    <div className="search-box">
                        <SearchIcon />
                        <input
                            type="text"
                            placeholder="╨Я╨╛╨╕╤Б╨║ ╨┐╨╛ ╨║╨╗╨╕╨╡╨╜╤В╤Г, ╨║╨╛╨╝╨┐╨░╨╜╨╕╨╕, ╨░╨┤╤А╨╡╤Б╤Г ╨╕╨╗╨╕ ID..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {searchTerm && (
                            <button className="clear-btn" onClick={() => setSearchTerm('')}>├Ч</button>
                        )}
                    </div>
                    
                    <div className="sort-box">
                        <label>╨б╨╛╤А╤В╨╕╤А╨╛╨▓╨║╨░:</label>
                        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                            <option value="id-desc">╨б╨╜╨░╤З╨░╨╗╨░ ╨╜╨╛╨▓╤Л╨╡ (ID)</option>
                            <option value="id-asc">╨б╨╜╨░╤З╨░╨╗╨░ ╤Б╤В╨░╤А╤Л╨╡ (ID)</option>
                            <option value="client-asc">╨Я╨╛ ╨╕╨╝╨╡╨╜╨╕ ╨║╨╗╨╕╨╡╨╜╤В╨░</option>
                            <option value="total-desc">╨Я╨╛ ╤Б╤Г╨╝╨╝╨╡ ╨╖╨░╨║╨░╨╖╨░</option>
                        </select>
                    </div>
                </div>

                <div className="view-toggle">
                    <button 
                        className={`toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
                        onClick={() => setViewMode('grid')}
                        title="╨б╨╡╤В╨║╨░"
                    >
                        <GridIcon />
                    </button>
                    <button 
                        className={`toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
                        onClick={() => setViewMode('list')}
                        title="╨в╨░╨▒╨╗╨╕╤Ж╨░"
                    >
                        <ListIcon />
                    </button>
                </div>
            </div>

            {/* Status tabs */}
            <div className="status-tabs">
                {allStatuses.map((status) => {
                    const count = status === '╨Т╤Б╨╡' 
                        ? orders.length 
                        : status === '╨Ю╤Д╨╛╤А╨╝╨╗╨╡╨╜'
                            ? orders.filter(o => o.status === '╨Ю╤Д╨╛╤А╨╝╨╗╨╡╨╜' || !o.status).length
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

            {/* Main Orders Display */}
            {filteredOrders.length === 0 ? (
                <div className="empty-orders">
                    <div className="empty-icon">ЁЯУВ</div>
                    <h3>╨Ч╨░╨║╨░╨╖╤Л ╨╜╨╡ ╨╜╨░╨╣╨┤╨╡╨╜╤Л</h3>
                    <p>╨Я╨╛╨┐╤А╨╛╨▒╤Г╨╣╤В╨╡ ╤Б╨▒╤А╨╛╤Б╨╕╤В╤М ╤Д╨╕╨╗╤М╤В╤А╤Л ╨┐╨╛╨╕╤Б╨║╨░ ╨╕╨╗╨╕ ╨╕╨╖╨╝╨╡╨╜╨╕╤В╤М ╨▓╤Л╨▒╤А╨░╨╜╨╜╤Л╨╣ ╤Б╤В╨░╤В╤Г╤Б ╨╖╨░╨║╨░╨╖╨░.</p>
                    <button onClick={() => { setSearchTerm(''); setSelectedStatus('╨Т╤Б╨╡'); }}>
                        ╨б╨▒╤А╨╛╤Б╨╕╤В╤М ╤Д╨╕╨╗╤М╤В╤А╤Л
                    </button>
                </div>
            ) : viewMode === 'grid' ? (
                /* GRID VIEW */
                <div className="orders-grid">
                    {filteredOrders.map((order) => {
                        const statusInfo = getStatusInfo(order.status);
                        const totalCost = calculateOrderTotal(order);
                        const itemsCount = order.product_order?.length || 0;

                        return (
                            <div key={order.id} className="order-card-new">
                                <div className="card-top">
                                    <span className="order-id">╨Ч╨░╨║╨░╨╖ #{order.id}</span>
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
                                            {order.address || <span className="placeholder-text">╨Р╨┤╤А╨╡╤Б ╨╜╨╡ ╤Г╨║╨░╨╖╨░╨╜</span>}
                                        </span>
                                    </div>
                                </div>

                                <div className="card-details">
                                    <div className="items-header">
                                        <BoxIcon />
                                        <span>╨б╨╛╨┤╨╡╤А╨╢╨╕╨╝╨╛╨╡ ({itemsCount})</span>
                                    </div>
                                    <div className="items-preview">
                                        {order.product_order && order.product_order.length > 0 ? (
                                            order.product_order.slice(0, 3).map((item, index) => (
                                                <div key={index} className="item-preview-row">
                                                    <span className="item-title">{item.title}</span>
                                                    <span className="item-qty">
                                                        {item.quantity || item.userInputs?.coll || 1} ╤И╤В.
                                                    </span>
                                                </div>
                                            ))
                                        ) : (
                                            <span className="placeholder-text">╨Э╨╡╤В ╨┐╨╛╨╖╨╕╤Ж╨╕╨╣</span>
                                        )}
                                        {itemsCount > 3 && (
                                            <div className="more-items">...╨╕ ╨╡╤Й╨╡ {itemsCount - 3} ╨┐╨╛╨╖.</div>
                                        )}
                                    </div>
                                </div>

                                <div className="card-footer">
                                    <div className="price-container">
                                        <span className="price-label">╨б╤Г╨╝╨╝╨░ ╨╖╨░╨║╨░╨╖╨░:</span>
                                        <span className="price-value">
                                            {totalCost > 0 ? totalCost.toLocaleString('ru-RU') : '0'}
                                            <SomIcon />
                                        </span>
                                    </div>
                                    <div className="action-buttons">
                                        <Link to={`/order/${order.id}`} className="action-btn action-btn--view" title="╨Я╤А╨╛╤Б╨╝╨╛╤В╤А">
                                            <EyeIcon />
                                            <span>╨Ф╨╡╤В╨░╨╗╨╕</span>
                                        </Link>
                                        <Link to={`/order_editor/${order.id}`} className="action-btn action-btn--edit" title="╨а╨╡╨┤╨░╨║╤В╨╕╤А╨╛╨▓╨░╤В╤М">
                                            <EditIcon />
                                            <span>╨Ш╨╖╨╝╨╡╨╜╨╕╤В╤М</span>
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                /* TABLE/LIST VIEW */
                <div className="orders-table-wrapper">
                    <table className="orders-table">
                        <thead>
                            <tr>
                                <th width="10%">ID</th>
                                <th width="25%">╨Ъ╨╗╨╕╨╡╨╜╤В / ╨Ъ╨╛╨╝╨┐╨░╨╜╨╕╤П</th>
                                <th width="20%">╨Р╨┤╤А╨╡╤Б ╨┤╨╛╤Б╤В╨░╨▓╨║╨╕</th>
                                <th width="20%">╨б╨╛╨┤╨╡╤А╨╢╨╕╨╝╨╛╨╡</th>
                                <th width="12%">╨б╤Г╨╝╨╝╨░</th>
                                <th width="13%">╨б╤В╨░╤В╤Г╤Б</th>
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
                                                <span className="client-name">{order.name_client || 'тАФ'}</span>
                                                {order.name_compony && (
                                                    <span className="company-name">{order.name_compony}</span>
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            <span className="table-address" title={order.address}>
                                                {order.address || <span className="placeholder-text">╨Э╨╡ ╤Г╨║╨░╨╖╨░╨╜</span>}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="table-items-preview">
                                                {order.product_order && order.product_order.length > 0 ? (
                                                    order.product_order.slice(0, 2).map((item, idx) => (
                                                        <div key={idx} className="table-item-chip">
                                                            {item.title} ({item.quantity || item.userInputs?.coll || 1} ╤И╤В.)
                                                        </div>
                                                    ))
                                                ) : (
                                                    <span className="placeholder-text">╨Я╤Г╤Б╤В╨╛╨╣ ╨╖╨░╨║╨░╨╖</span>
                                                )}
                                                {itemsCount > 2 && (
                                                    <span className="table-more-badge">+{itemsCount - 2} ╨┐╨╛╨╖.</span>
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
                                                <Link to={`/order/${order.id}`} className="table-action-btn view" title="╨Я╤А╨╛╤Б╨╝╨╛╤В╤А">
                                                    <EyeIcon />
                                                </Link>
                                                <Link to={`/order_editor/${order.id}`} className="table-action-btn edit" title="╨а╨╡╨┤╨░╨║╤В╨╕╤А╨╛╨▓╨░╤В╤М">
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
