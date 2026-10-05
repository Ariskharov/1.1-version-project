import React, { useState, useEffect, useMemo, useContext, useRef, useCallback } from 'react';
import { useDialogA11y } from '../../../hooks/useDialogA11y';
import { createPortal } from 'react-dom';
import { Link, useParams } from 'react-router-dom';
import './order.scss';
import { CustomContext } from '../../../Context';
import { LoadingPage } from '../../../components/ui/LoadingSpinner';
import { useCatalogTheme } from '../../../context/CatalogThemeContext';
import {
    downloadCommercialProposal,
    downloadFullContract,
    downloadSpecification,
} from '../../../utils/contractDocuments';

import { API_BASE, resolveImageUrl } from '../../../config/api';
import { calculatePositionDetails } from '../../../utils/orderConvenience';

const getQty = (item) => Number(item.quantity || item.userInputs?.coll || 1) || 1;

const getLineTotal = (item) => Number(item.price || 0) * getQty(item);

const getItemImageSrc = (item) => resolveImageUrl(item?.img);

const DIMENSION_LABELS = {
    shirina: 'Ширина',
    glubina: 'Глубина',
    visota: 'Высота',
};

const isCustomPosition = (item) => {
    if (!item) return false;
    if (item.isCustom === true) return true;
    if (item.isCustom === false) return false;
    return !(item.details?.length || item.variables?.length || item.calculatedDetails?.length);
};

const formatFactValue = (name, value) => {
    if (typeof value === 'boolean') return value ? 'Да' : 'Нет';
    if (value === null || value === undefined || value === '') return '—';
    if (DIMENSION_LABELS[name] && value !== '' && !Number.isNaN(Number(value))) {
        return `${value} мм`;
    }
    return String(value);
};

const getPositionFacts = (item) => {
    const facts = [];
    const inputs = item?.userInputs || {};
    const seen = new Set();
    const variables = Array.isArray(item?.variables) ? item.variables : [];

    variables.forEach((variable) => {
        if (!variable?.name || variable.name === 'coll') return;
        const raw = inputs[variable.name];
        if (raw === undefined || raw === null || raw === '') return;
        seen.add(variable.name);
        facts.push({
            key: variable.name,
            label: variable.label || DIMENSION_LABELS[variable.name] || variable.name,
            value: formatFactValue(variable.name, raw),
        });
    });

    Object.keys(inputs).forEach((name) => {
        if (name === 'coll' || seen.has(name)) return;
        const raw = inputs[name];
        if (raw === undefined || raw === null || raw === '' || raw === false) return;
        const condition = (item?.conditions || []).find((entry) => entry?.name === name);
        facts.push({
            key: name,
            label: condition?.label || DIMENSION_LABELS[name] || name,
            value: formatFactValue(name, raw),
        });
    });

    return facts;
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
    const { resolvedTheme } = useCatalogTheme();
    const { currentUser, showToast } = useContext(CustomContext);
    const isAdmin = currentUser?.role === 'admin';

    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [detailsItem, setDetailsItem] = useState(null);
    const [photoOpen, setPhotoOpen] = useState(false);
    const [photoFailed, setPhotoFailed] = useState(false);
    const [isDocLoading, setIsDocLoading] = useState(null);
    const photoOpenRef = useRef(false);
    const photoCloseRef = useRef(null);
    const photoButtonRef = useRef(null);
    const photoWasOpenRef = useRef(false);
    photoOpenRef.current = photoOpen;

    const pageClassName = (extra = '') =>
        ['order-page', `order-page--theme-${resolvedTheme}`, extra].filter(Boolean).join(' ');

    const ordModalClassName = () =>
        ['ord-modal', `ord-modal--theme-${resolvedTheme}`].join(' ');

    const detailsModalRef = useRef(null);
    const closeDetailsModal = useCallback(() => {
        if (photoOpenRef.current) {
            setPhotoOpen(false);
            return;
        }
        setDetailsItem(null);
        setPhotoOpen(false);
        setPhotoFailed(false);
    }, []);

    const openPosition = useCallback((item) => {
        setPhotoOpen(false);
        setPhotoFailed(false);
        setDetailsItem(item);
    }, []);

    useDialogA11y(Boolean(detailsItem), closeDetailsModal, detailsModalRef);

    useEffect(() => {
        if (!detailsItem) {
            photoWasOpenRef.current = false;
            return undefined;
        }
        if (photoOpen) {
            photoWasOpenRef.current = true;
            photoCloseRef.current?.focus();
            return undefined;
        }
        if (photoWasOpenRef.current) {
            photoWasOpenRef.current = false;
            photoButtonRef.current?.focus();
        }
        return undefined;
    }, [photoOpen, detailsItem]);

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
                        return {
                            ...item,
                            calculatedDetails: calculatePositionDetails(item, item.userInputs || {}),
                        };
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
            <div className={pageClassName('order-page--loading')}>
                <LoadingPage message="Загрузка заказа..." />
            </div>
        );
    }

    if (error) {
        return (
            <div className={pageClassName()}>
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
            <div className={pageClassName()}>
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
    const openedIsCustom = isCustomPosition(detailsItem);
    const openedPhotoSrc = detailsItem && !photoFailed ? getItemImageSrc(detailsItem) : '';
    const openedDetails = detailsItem?.calculatedDetails || [];
    const openedFacts = detailsItem ? getPositionFacts(detailsItem) : [];
    const hasFinanceAdjustments = (order.discountAmount || 0) > 0 || (order.taxAmount || 0) > 0;
    const backLink = currentUser ? '/view_orders' : '/';
    const backLabel = currentUser ? '← Все заказы' : '← Каталог мебели';

    return (
        <div className={pageClassName()}>
            <div className="ord-ambient" aria-hidden="true">
                <div className="ord-ambient__orb ord-ambient__orb--1" />
                <div className="ord-ambient__orb ord-ambient__orb--2" />
                <div className="ord-ambient__grain" />
            </div>

            <div className="order-page__content">
                <nav className="order-page__nav">
                    <Link to={backLink} className="order-page__back">{backLabel}</Link>
                    {isAdmin && (
                        <Link to={`/order_editor/${order.id}`} className="order-page__edit-link">
                            Редактировать заказ
                        </Link>
                    )}
                </nav>

                <header className="order-page__hero">
                    <div className="order-page__hero-intro">
                        <span className="order-page__badge">Просмотр заказа</span>
                        <div className="order-page__title">
                            <h1>Заказ №{order.id}</h1>
                            <span className={`order-page__status ${statusClass(order.status)}`}>
                                {order.status || 'Оформлен'}
                            </span>
                        </div>
                    </div>

                    <div className="order-page__summary">
                        <div className="order-page__summary-item">
                            <span className="order-page__summary-label">Позиций</span>
                            <span className="order-page__summary-value">{positions.length}</span>
                        </div>
                        <div className="order-page__summary-item order-page__summary-item--total">
                            <span className="order-page__summary-label">К оплате</span>
                            <span className="order-page__summary-value">{orderTotal.toLocaleString()} сом</span>
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
                                        <span className="value">
                                            −{(order.discountAmount || 0).toLocaleString()} сом
                                            {subtotal > 0 && (
                                                <> ({Math.round((Number(order.discountAmount) / subtotal) * 100)}%)</>
                                            )}
                                        </span>
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
                        {positions.length > 0 && (
                            <p className="order-page__positions-hint">
                                Нажмите на карточку, чтобы открыть фото, описание и деталировку
                            </p>
                        )}
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
                                    key={item.id ?? `pos-${index}`}
                                    className="order-page__position-card"
                                    style={{ animationDelay: `${Math.min(index * 0.05, 0.35)}s` }}
                                    role="button"
                                    tabIndex={0}
                                    aria-haspopup="dialog"
                                    aria-label={`Открыть карточку: ${item.title || 'позиция'}`}
                                    onClick={() => openPosition(item)}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter' || event.key === ' ') {
                                            event.preventDefault();
                                            openPosition(item);
                                        }
                                    }}
                                >
                                    <div className="order-page__position-photo">
                                        {getItemImageSrc(item) ? (
                                            <img
                                                src={getItemImageSrc(item)}
                                                alt=""
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
                                        <div className="position-open-hint">Открыть карточку</div>
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </section>

                {detailsItem && createPortal(
                    <div className={ordModalClassName()} role="presentation">
                        <div
                            ref={detailsModalRef}
                            className="ord-modal__shell"
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="order-details-title"
                            tabIndex={-1}
                        >
                            <div
                                className="ord-modal__overlay"
                                inert={photoOpen ? true : undefined}
                                onClick={closeDetailsModal}
                            >
                                <div
                                    className="ord-modal__dialog"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <div className="ord-modal__header">
                                        <div>
                                            <span className="ord-modal__kind">
                                                {openedIsCustom ? 'Произвольная позиция' : 'Мебель'}
                                            </span>
                                            <h3 id="order-details-title">{detailsItem.title || 'Позиция'}</h3>
                                            <p>
                                                {Number(detailsItem.price).toLocaleString()} сом × {getQty(detailsItem)} ={' '}
                                                <strong>{getLineTotal(detailsItem).toLocaleString()} сом</strong>
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            className="ord-modal__close"
                                            onClick={closeDetailsModal}
                                            aria-label="Закрыть"
                                        >
                                            ×
                                        </button>
                                    </div>

                                    <div className="ord-modal__split">
                                        <div className="ord-modal__photo">
                                            {openedPhotoSrc ? (
                                                <button
                                                    ref={photoButtonRef}
                                                    type="button"
                                                    className="ord-modal__photo-btn"
                                                    onClick={() => setPhotoOpen(true)}
                                                    aria-label="Увеличить фото"
                                                >
                                                    <img
                                                        src={openedPhotoSrc}
                                                        alt={detailsItem.title || 'Фото позиции'}
                                                        onError={() => setPhotoFailed(true)}
                                                    />
                                                    <span className="ord-modal__photo-hint">Нажмите, чтобы увеличить</span>
                                                </button>
                                            ) : (
                                                <div className="ord-modal__photo-empty">
                                                    <span aria-hidden="true">🪑</span>
                                                    <p>Фото нет</p>
                                                </div>
                                            )}
                                        </div>

                                        <div className={`ord-modal__panel${openedIsCustom ? ' ord-modal__panel--custom' : ''}`}>
                                            <h4>Описание</h4>
                                            <p className="ord-modal__note">
                                                {detailsItem.description?.trim()
                                                    ? detailsItem.description
                                                    : 'Описание не указано'}
                                            </p>

                                            {(detailsItem.bodyColor || detailsItem.facadeColor) && (
                                                <div className="ord-modal__colors">
                                                    {detailsItem.bodyColor && <span>Корпус: {detailsItem.bodyColor}</span>}
                                                    {detailsItem.facadeColor && <span>Фасады: {detailsItem.facadeColor}</span>}
                                                </div>
                                            )}

                                            {detailsItem.colorSelection && (detailsItem.colorSelection.unified?.name || detailsItem.colorSelection.body?.name) && (
                                                <div className="ord-modal__colors">
                                                    {detailsItem.colorSelection.mode === 'unified' ? (
                                                        <span>
                                                            {detailsItem.colorSelection.unified.image && (
                                                                <img
                                                                    src={detailsItem.colorSelection.unified.image}
                                                                    alt=""
                                                                    className="ord-modal__swatch"
                                                                />
                                                            )}
                                                            Цвет: {detailsItem.colorSelection.unified.name}
                                                        </span>
                                                    ) : (
                                                        <>
                                                            <span>Корпус: {detailsItem.colorSelection.body?.name || '—'}</span>
                                                            <span>Фасады: {detailsItem.colorSelection.facade?.name || '—'}</span>
                                                        </>
                                                    )}
                                                </div>
                                            )}

                                            {openedIsCustom ? (
                                                <div className="ord-modal__facts">
                                                    <div className="ord-modal__fact ord-modal__fact--wide">
                                                        <span>Полное название</span>
                                                        <strong>{detailsItem.title || '—'}</strong>
                                                    </div>
                                                    <div className="ord-modal__fact">
                                                        <span>Цена</span>
                                                        <strong>{Number(detailsItem.price || 0).toLocaleString()} сом</strong>
                                                    </div>
                                                    <div className="ord-modal__fact">
                                                        <span>Количество</span>
                                                        <strong>{getQty(detailsItem)} шт</strong>
                                                    </div>
                                                    <div className="ord-modal__fact">
                                                        <span>Сумма</span>
                                                        <strong>{getLineTotal(detailsItem).toLocaleString()} сом</strong>
                                                    </div>
                                                    {openedFacts.map((fact) => (
                                                        <div className="ord-modal__fact" key={fact.key}>
                                                            <span>{fact.label}</span>
                                                            <strong>{fact.value}</strong>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <>
                                                    {openedFacts.length > 0 && (
                                                        <>
                                                            <h4>Параметры</h4>
                                                            <div className="ord-modal__facts">
                                                                {openedFacts.map((fact) => (
                                                                    <div className="ord-modal__fact" key={fact.key}>
                                                                        <span>{fact.label}</span>
                                                                        <strong>{fact.value}</strong>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </>
                                                    )}
                                                    <h4>Деталировка</h4>
                                                    {openedDetails.length > 0 ? (
                                                        <div className="ord-modal__table-wrap">
                                                            <table className="ord-modal__table">
                                                                <thead>
                                                                    <tr>
                                                                        <th>Деталь</th>
                                                                        <th>Размер</th>
                                                                        <th>Кол-во</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {openedDetails.map((detail, detailIndex) => (
                                                                        <tr key={`${detail.key || detail.label || 'detail'}-${detailIndex}`}>
                                                                            <td>{detail.label}</td>
                                                                            <td>{detail.size}</td>
                                                                            <td>{detail.count}</td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    ) : (
                                                        <p className="ord-modal__note">Деталировка для этой позиции не рассчитана</p>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {photoOpen && openedPhotoSrc && (
                                <div
                                    className="ord-modal__lightbox"
                                    onClick={() => setPhotoOpen(false)}
                                >
                                    <button
                                        ref={photoCloseRef}
                                        type="button"
                                        className="ord-modal__lightbox-close"
                                        aria-label="Закрыть фото"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            setPhotoOpen(false);
                                        }}
                                    >
                                        ×
                                    </button>
                                    <img
                                        src={openedPhotoSrc}
                                        alt={detailsItem.title || 'Фото позиции'}
                                        onClick={(event) => event.stopPropagation()}
                                    />
                                </div>
                            )}
                        </div>
                    </div>,
                    document.body
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