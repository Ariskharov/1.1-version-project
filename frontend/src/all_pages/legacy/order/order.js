import React, { useState, useEffect, useMemo, useContext } from 'react';
import { Link, useParams } from 'react-router-dom';
import './order.scss';
import { CustomContext } from '../../../Context';
import { LoadingPage } from '../../../components/ui/LoadingSpinner';
import {
    downloadCommercialProposal,
    downloadFullContract,
    downloadSpecification,
} from '../../../utils/contractDocuments';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8080';

const getQty = (item) => Number(item.quantity || item.userInputs?.coll || 1) || 1;

const getLineTotal = (item) => Number(item.price || 0) * getQty(item);

const getItemImageSrc = (item) => {
    if (!item?.img) return null;
    return item.img.startsWith('http') ? item.img : `/utilse/${item.img.split('/').pop()}`;
};

const statusClass = (status) => {
    const s = (status || '').toLowerCase();
    if (s.includes('черновик')) return 'order-page__status--draft';
    if (s.includes('отмен')) return 'order-page__status--cancelled';
    if (s.includes('выполн') || s.includes('заверш')) return 'order-page__status--done';
    if (s.includes('работ')) return 'order-page__status--progress';
    return '';
};

const Order = () => {
    const { id } = useParams();
    const { currentUser, showToast } = useContext(CustomContext);
    const isAdmin = currentUser?.role === 'admin';

    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [detailsItem, setDetailsItem] = useState(null);
    const [isDocLoading, setIsDocLoading] = useState(null);

    const closeDetailsModal = () => setDetailsItem(null);

    useEffect(() => {
        if (!detailsItem) return undefined;
        const onKeyDown = (e) => {
            if (e.key === 'Escape') closeDetailsModal();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [detailsItem]);

    useEffect(() => {
        fetch(`${API_BASE}/order/${id}`)
            .then((res) => {
                if (!res.ok) throw new Error('Заказ не найден');
                return res.json();
            })
            .then((data) => {
                const loaded = data.order?.[0] || data;

                loaded.product_order = (loaded.product_order || []).map((item) => {
                    if (!item.calculatedDetails?.length) {
                        const nums = item.userInputs || {};
                        const details = (item.details || [])
                            .map((d) => {
                                if (d.if_condition && !nums[d.if_condition]) return null;
                                try {
                                    const w = nums[d.formula_width] || 0;
                                    const h = d.formula_height ? nums[d.formula_height] : null;
                                    const cnt = nums[d.count_formula] || 1;
                                    const size = h
                                        ? `${Math.round(w)} × ${Math.round(h)} мм`
                                        : `${Math.round(w)} мм`;
                                    return { key: d.key, label: d.label, size, count: Math.round(cnt) };
                                } catch {
                                    return { key: d.key, label: d.label, size: 'Ошибка', count: 0 };
                                }
                            })
                            .filter(Boolean);
                        return { ...item, calculatedDetails: details };
                    }
                    return item;
                });

                setOrder(loaded);
                setLoading(false);
            })
            .catch(() => {
                setError('Не удалось загрузить заказ');
                setLoading(false);
            });
    }, [id]);

    const subtotal = useMemo(
        () => (order?.product_order || []).reduce((s, p) => s + getLineTotal(p), 0),
        [order]
    );

    const orderTotal = useMemo(
        () => subtotal - (order?.discountAmount || 0) + (order?.taxAmount || 0),
        [subtotal, order?.discountAmount, order?.taxAmount]
    );

    const handleDocDownload = async (type) => {
        if (!order || isDocLoading) return;
        setIsDocLoading(type);
        try {
            if (type === 'kp') await downloadCommercialProposal(order, orderTotal);
            if (type === 'spec') await downloadSpecification(order, orderTotal);
            if (type === 'contract') await downloadFullContract(order, orderTotal);
        } catch (err) {
            showToast?.('error', `Ошибка формирования документа: ${err.message}`);
        } finally {
            setIsDocLoading(null);
        }
    };

    const isGuest = !currentUser;

    if (loading) {
        return (
            <div className="order-page">
                <LoadingPage message="Загрузка заказа..." />
            </div>
        );
    }

    if (error) {
        return (
            <div className="order-page">
                <div className="order-page__content">
                    <div className="order-page__state order-page__state--error">{error}</div>
                    <Link to={isGuest ? '/' : '/view_orders'} className="order-page__back">
                        {isGuest ? '← Каталог мебели' : '← К списку заказов'}
                    </Link>
                </div>
            </div>
        );
    }

    if (!order) {
        return (
            <div className="order-page">
                <div className="order-page__content">
                    <div className="order-page__state">Заказ не найден</div>
                    <Link to={isGuest ? '/' : '/view_orders'} className="order-page__back">
                        {isGuest ? '← Каталог мебели' : '← К списку заказов'}
                    </Link>
                </div>
            </div>
        );
    }

    const positions = order.product_order || [];
    const hasFinanceAdjustments = (order.discountAmount || 0) > 0 || (order.taxAmount || 0) > 0;
    const backLink = currentUser ? '/view_orders' : '/';
    const backLabel = currentUser ? '← Все заказы' : '← Каталог мебели';

    return (
        <div className="order-page">
            <div className="order-page__content">
                <nav className="order-page__nav">
                    <Link to={backLink} className="order-page__back">{backLabel}</Link>
                    {isAdmin && (
                        <Link to={`/order_editor/${order.id}`} className="order-page__edit-link">
                            Редактировать заказ
                        </Link>
                    )}
                </nav>

                <header className="order-page__header">
                    <div className="order-page__title">
                        <h1>Заказ №{order.id}</h1>
                        <span className={`order-page__status ${statusClass(order.status)}`}>
                            {order.status || 'Оформлен'}
                        </span>
                    </div>

                    <div className="order-page__header-actions">
                        <div className="order-page__total-pill">
                            Итого: <strong>{orderTotal.toLocaleString()} сом</strong>
                        </div>
                    </div>
                </header>

                <div className="order-page__meta">
                    <div className="order-page__client-card">
                        <h3>Клиент</h3>
                        <div className="client-name">{order.name_client || '—'}</div>
                        {order.name_compony && (
                            <div className="client-company">{order.name_compony}</div>
                        )}

                        <div className="client-row">
                            <span className="label">Адрес</span>
                            <span className="value">{order.address || '—'}</span>
                        </div>
                        {order.phone && (
                            <div className="client-row">
                                <span className="label">Телефон</span>
                                <span className="value">{order.phone}</span>
                            </div>
                        )}
                        {order.email && (
                            <div className="client-row">
                                <span className="label">Email</span>
                                <span className="value">{order.email}</span>
                            </div>
                        )}
                        {order.order_note && (
                            <div className="note">Примечание: {order.order_note}</div>
                        )}
                    </div>

                    <div className="order-page__meta-card">
                        <div className="meta-row">
                            <span className="label">Позиций</span>
                            <span className="value">{positions.length}</span>
                        </div>
                        <div className="meta-row">
                            <span className="label">Сумма позиций</span>
                            <span className="value">{subtotal.toLocaleString()} сом</span>
                        </div>
                        {hasFinanceAdjustments && (
                            <>
                                {(order.discountAmount || 0) > 0 && (
                                    <div className="meta-row meta-row--discount">
                                        <span className="label">Скидка</span>
                                        <span className="value">−{(order.discountAmount || 0).toLocaleString()} сом</span>
                                    </div>
                                )}
                                {(order.taxAmount || 0) > 0 && (
                                    <div className="meta-row">
                                        <span className="label">НДС / налог</span>
                                        <span className="value">+{(order.taxAmount || 0).toLocaleString()} сом</span>
                                    </div>
                                )}
                            </>
                        )}
                        {order.contract_no && (
                            <div className="meta-row">
                                <span className="label">Договор №</span>
                                <span className="value">{order.contract_no}</span>
                            </div>
                        )}
                        <div className="grand-total">
                            <div className="meta-row">
                                <span className="label">К оплате</span>
                                <span className="value">{orderTotal.toLocaleString()} сом</span>
                            </div>
                        </div>
                    </div>
                </div>

                <section className="order-page__positions">
                    <div className="order-page__positions-header">
                        <h2>Позиции заказа <span>({positions.length})</span></h2>
                    </div>

                    {positions.length === 0 ? (
                        <div className="order-page__empty-positions">
                            <span className="icon">📦</span>
                            <p>В заказе нет позиций</p>
                        </div>
                    ) : (
                        <div className="order-page__positions-list">
                            {positions.map((item, index) => (
                                <article
                                    key={item.id}
                                    className="order-page__position-card"
                                    style={{ animationDelay: `${Math.min(index * 0.05, 0.35)}s` }}
                                >
                                    <div className="order-page__position-photo">
                                        {getItemImageSrc(item) ? (
                                            <img
                                                src={getItemImageSrc(item)}
                                                alt={item.title}
                                                onError={(e) => { e.target.style.display = 'none'; }}
                                            />
                                        ) : (
                                            <span className="no-photo">🪑</span>
                                        )}
                                    </div>

                                    <div className="position-main">
                                        <h3 className="position-title">{item.title}</h3>
                                        {item.description && (
                                            <div className="position-desc">{item.description}</div>
                                        )}

                                        {(item.bodyColor || item.facadeColor) && (
                                            <div className="position-colors">
                                                {item.bodyColor && (
                                                    <span className="color-chip">Корпус: {item.bodyColor}</span>
                                                )}
                                                {item.facadeColor && (
                                                    <span className="color-chip">Фасады: {item.facadeColor}</span>
                                                )}
                                            </div>
                                        )}

                                        {item.colorSelection && (item.colorSelection.unified?.name || item.colorSelection.body?.name) && (
                                            <div className="color-preview">
                                                <div className="color-preview-title">Цвет</div>
                                                {item.colorSelection.mode === 'unified' ? (
                                                    <div className="color-unified">
                                                        {item.colorSelection.unified.image && (
                                                            <img src={item.colorSelection.unified.image} alt="" className="color-swatch-large" />
                                                        )}
                                                        <span className="color-name">{item.colorSelection.unified.name}</span>
                                                    </div>
                                                ) : (
                                                    <div className="color-separate">
                                                        <div className="color-pair">
                                                            <span className="color-pair-label">Корпус</span>
                                                            <span className="color-name">{item.colorSelection.body?.name || '—'}</span>
                                                        </div>
                                                        <div className="color-pair">
                                                            <span className="color-pair-label">Фасады</span>
                                                            <span className="color-name">{item.colorSelection.facade?.name || '—'}</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <div className="position-price">
                                            {Number(item.price).toLocaleString()} сом × {getQty(item)} ={' '}
                                            <strong>{getLineTotal(item).toLocaleString()} сом</strong>
                                        </div>

                                        {item.calculatedDetails?.length > 0 && (
                                            <button
                                                type="button"
                                                className="position-toggle"
                                                onClick={() => setDetailsItem(item)}
                                            >
                                                Показать деталировку
                                            </button>
                                        )}
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </section>

                {detailsItem && (
                    <div className="order-page__details-overlay" onClick={closeDetailsModal}>
                        <div
                            className="order-page__details-modal"
                            onClick={(e) => e.stopPropagation()}
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="order-details-title"
                        >
                            <div className="order-page__details-header">
                                <div>
                                    <h3 id="order-details-title">{detailsItem.title}</h3>
                                    <p>
                                        {Number(detailsItem.price).toLocaleString()} сом × {getQty(detailsItem)} ={' '}
                                        <strong>{getLineTotal(detailsItem).toLocaleString()} сом</strong>
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    className="order-page__details-close"
                                    onClick={closeDetailsModal}
                                    aria-label="Закрыть"
                                >
                                    ×
                                </button>
                            </div>

                            <div className="order-page__details-split">
                                <div className="order-page__details-photo">
                                    {getItemImageSrc(detailsItem) ? (
                                        <img src={getItemImageSrc(detailsItem)} alt={detailsItem.title} />
                                    ) : (
                                        <div className="order-page__details-photo-empty">🪑</div>
                                    )}
                                </div>

                                <div className="order-page__details-panel">
                                    <h4>Деталировка</h4>
                                    {detailsItem.description && (
                                        <p className="order-page__details-note">{detailsItem.description}</p>
                                    )}
                                    {(detailsItem.bodyColor || detailsItem.facadeColor) && (
                                        <div className="order-page__details-colors">
                                            {detailsItem.bodyColor && <span>Корпус: {detailsItem.bodyColor}</span>}
                                            {detailsItem.facadeColor && <span>Фасады: {detailsItem.facadeColor}</span>}
                                        </div>
                                    )}
                                    <div className="order-page__details-table-wrap">
                                        <table className="details-table">
                                            <thead>
                                                <tr>
                                                    <th>Деталь</th>
                                                    <th>Размер</th>
                                                    <th>Кол-во</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {detailsItem.calculatedDetails.map((d) => (
                                                    <tr key={d.key}>
                                                        <td>{d.label}</td>
                                                        <td>{d.size}</td>
                                                        <td>{d.count}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {!isGuest && (
                    <div className="order-page__docs">
                        <h3>Документы</h3>
                        <p className="order-page__docs-hint">
                            Скачивание в формате Word (.docx) по шаблонам договоров. Реквизиты настраиваются в редакторе заказа.
                        </p>
                        <div className="order-page__docs-actions">
                            <button
                                type="button"
                                className="order-page__doc-btn order-page__doc-btn--primary"
                                disabled={!!isDocLoading}
                                onClick={() => handleDocDownload('kp')}
                            >
                                {isDocLoading === 'kp' ? 'Формирование...' : 'Коммерческое предложение'}
                            </button>
                            <button
                                type="button"
                                className="order-page__doc-btn"
                                disabled={!!isDocLoading}
                                onClick={() => handleDocDownload('spec')}
                            >
                                {isDocLoading === 'spec' ? 'Формирование...' : 'Спецификация'}
                            </button>
                            <button
                                type="button"
                                className="order-page__doc-btn order-page__doc-btn--accent"
                                disabled={!!isDocLoading}
                                onClick={() => handleDocDownload('contract')}
                            >
                                {isDocLoading === 'contract' ? 'Формирование...' : 'Полный договор'}
                            </button>
                        </div>
                    </div>
                )}

                <div className="order-page__summary-bar">
                    <div className="summary-text">
                        Итого к оплате: <strong>{orderTotal.toLocaleString()} сом</strong>
                    </div>
                    {isAdmin && (
                        <Link to={`/order_editor/${order.id}`} className="order-page__edit-btn">
                            Открыть в редакторе
                        </Link>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Order;