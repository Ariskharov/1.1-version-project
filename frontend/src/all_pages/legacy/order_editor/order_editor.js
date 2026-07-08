import React, { useState, useEffect, useMemo, useContext, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { evaluate } from 'mathjs';
import './order_editor.scss';
import { CustomContext } from '../../../Context';
import LoadingSpinner, { LoadingPage } from '../../../components/ui/LoadingSpinner';
import { useCatalogTheme } from '../../../context/CatalogThemeContext';
import {
    downloadCommercialProposal,
    downloadFullContract,
    downloadSpecification,
} from '../../../utils/contractDocuments';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8080';

const resolveImageUrl = (img) => {
    if (!img || typeof img !== 'string') return null;
    if (img.startsWith('http')) return img;
    const file = img.split('/').pop();
    return `/utilse/${file}`;
};

const getLineTotal = (item) =>
    Number(item.price || 0) * (Number(item.quantity || item.userInputs?.coll || 1) || 1);

const calculateDetails = (product) => {
    if (!product || product.isCustom || !product.details) return [];

    const nums = { ...product.userInputs };
    (product.variables || []).forEach(v => { nums[v.name] = Number(nums[v.name]) || v.default || 0; });
    (product.conditions || []).forEach(c => {
        if (c.type === 'flag') nums[c.name] = !!nums[c.name];
    });

    return (product.details || []).map(detail => {
        if (detail.if_condition && !nums[detail.if_condition]) return null;
        try {
            const w = evaluate(detail.formula_width || '0', nums);
            const h = detail.formula_height ? evaluate(detail.formula_height, nums) : null;
            const cnt = evaluate(detail.count_formula || '1', nums);

            const size = h ? `${Math.round(w)} × ${Math.round(h)} мм` : `${Math.round(w)} мм`;
            return { key: detail.key, label: detail.label, size, count: Math.max(0, Math.round(cnt)) };
        } catch {
            return { key: detail.key, label: detail.label, size: 'Ошибка', count: 0 };
        }
    }).filter(Boolean);
};

const recalcOrderTotals = (orderLike) => {
    const sum = (orderLike.product_order || []).reduce((s, p) => s + getLineTotal(p), 0);
    const discount = orderLike.discountAmount || 0;
    const tax = orderLike.taxAmount || 0;
    return { subtotal: sum, total: sum - discount + tax };
};

const syncItemTotal = (item) => {
    const quantity = Math.max(1, Number(item.quantity || item.userInputs?.coll || 1) || 1);
    return {
        ...item,
        quantity,
        totalPrice: Number(item.price || 0) * quantity,
    };
};

const createPositionId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const getEffectiveStatus = (status, customStatus) => {
    const trimmed = (customStatus || '').trim();
    if (trimmed) return trimmed;
    return status || 'Оформлен';
};

const PRESET_STATUSES = [
    'Оформлен',
    'Пилится',
    'Собирается',
    'Ожидание доставки',
    'Установка',
    'Завершено',
];

const OrderEditor = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { resolvedTheme } = useCatalogTheme();
    const { showToast, confirm } = useContext(CustomContext);

    const pageClassName = (extra = '') =>
        ['order_editor', `order_editor--theme-${resolvedTheme}`, extra].filter(Boolean).join(' ');

    const oedModalClassName = () =>
        ['oed-modal', `oed-modal--theme-${resolvedTheme}`].join(' ');

    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedProductId, setSelectedProductId] = useState(null);
    const [status, setStatus] = useState('Оформлен');
    const [customStatus, setCustomStatus] = useState('');

    // Модальное окно
    const [modalOpen, setModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('catalog'); // 'catalog' | 'custom'
    const [products, setProducts] = useState([]);
    const [selectedNewProduct, setSelectedNewProduct] = useState(null);
    const [newInputs, setNewInputs] = useState({});
    const [customDesc, setCustomDesc] = useState('');
    const [customItem, setCustomItem] = useState({ title: '', price: '', quantity: 1, description: '' });

    // Цвета для добавления новой позиции (как в новом оформлении заказа)
    const [addBodyColor, setAddBodyColor] = useState('');
    const [addFacadeColor, setAddFacadeColor] = useState('');

    // Поиск в каталоге модалки добавления (как в placing_an_order)
    const [productSearch, setProductSearch] = useState('');

    // Toggle деталировки
    const [showDetails, setShowDetails] = useState(true);

    // Состояния загрузки на кнопках — защита от дабл-кликов + анимация
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [isDocLoading, setIsDocLoading] = useState(null);
    const skipDirtyRef = useRef(true);

    const closeModal = useCallback(() => {
        setModalOpen(false);
        setSelectedNewProduct(null);
        setNewInputs({});
        setCustomDesc('');
        setCustomItem({ title: '', price: '', quantity: 1, description: '' });
        setAddBodyColor('');
        setAddFacadeColor('');
        setProductSearch('');
    }, []);

    // Получение данных заказа
    useEffect(() => {
        skipDirtyRef.current = true;
        setIsDirty(false);
        setLoading(true);
        setError(null);
        setCustomStatus('');

        const fetchOrder = async () => {
            try {
                const res = await fetch(`${API_BASE}/order/${id}`);
                if (!res.ok) throw new Error('Заказ не найден');
                const data = await res.json();
                let loaded = data.order?.[0] || data;

                loaded.product_order = (loaded.product_order || []).map(item => syncItemTotal({
                    ...item,
                    userInputs: { ...item.userInputs },
                    bodyColor: typeof item.bodyColor === 'string' ? item.bodyColor : '',
                    facadeColor: typeof item.facadeColor === 'string' ? item.facadeColor : '',
                    calculatedDetails: item.calculatedDetails?.length
                        ? item.calculatedDetails
                        : calculateDetails(item),
                }));

                if (!loaded.contract_date) {
                    loaded.contract_date = new Date().toISOString().slice(0, 10);
                }
                if (!loaded.contract_city) loaded.contract_city = 'Токмок';
                if (!loaded.contract_no) loaded.contract_no = String(loaded.id || id);
                if (!loaded.buyer_rep_title) loaded.buyer_rep_title = 'директора';
                if (!loaded.delivery_days) loaded.delivery_days = '30';

                setOrder(loaded);
                const loadedStatus = loaded.status || 'Оформлен';
                setStatus(loadedStatus);
                setCustomStatus(PRESET_STATUSES.includes(loadedStatus) ? '' : loadedStatus);

                if (loaded.product_order?.length > 0) {
                    setSelectedProductId(loaded.product_order[0].id);
                }
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        const fetchProducts = async () => {
            try {
                const res = await fetch(`${API_BASE}/product`);
                if (!res.ok) throw new Error('Каталог недоступен');
                const data = await res.json();
                const list = Array.isArray(data) ? data : (data ? [data] : []);
                setProducts(list.filter(Boolean));
            } catch (err) {
                console.error('Ошибка каталога:', err);
                showToast?.('error', 'Не удалось загрузить каталог мебели');
            }
        };

        fetchOrder();
        fetchProducts();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    useEffect(() => {
        if (loading || !order) return;
        if (skipDirtyRef.current) {
            skipDirtyRef.current = false;
            return;
        }
        setIsDirty(true);
    }, [order, status, loading]);

    useEffect(() => {
        const onBeforeUnload = (e) => {
            if (!isDirty) return;
            e.preventDefault();
            e.returnValue = '';
        };
        window.addEventListener('beforeunload', onBeforeUnload);
        return () => window.removeEventListener('beforeunload', onBeforeUnload);
    }, [isDirty]);

    useEffect(() => {
        if (!modalOpen) return undefined;
        const onKeyDown = (e) => {
            if (e.key === 'Escape') closeModal();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [modalOpen, closeModal]);

    const selectedProduct = order?.product_order?.find(p => p.id === selectedProductId);

    const subtotal = useMemo(
        () => (order?.product_order || []).reduce((s, p) => s + getLineTotal(p), 0),
        [order?.product_order]
    );

    const orderTotal = useMemo(
        () => subtotal - (order?.discountAmount || 0) + (order?.taxAmount || 0),
        [subtotal, order?.discountAmount, order?.taxAmount]
    );

    const handleDocDownload = async (type) => {
        if (!order) return;
        if (!order.product_order?.length) {
            showToast('error', 'Добавьте позиции в заказ перед формированием документов');
            return;
        }
        if (!order.name_compony?.trim()) {
            showToast('error', 'Укажите организацию покупателя в блоке «Данные для договора»');
            return;
        }

        setIsDocLoading(type);
        try {
            if (type === 'kp') await downloadCommercialProposal(order, orderTotal);
            if (type === 'spec') await downloadSpecification(order, orderTotal);
            if (type === 'contract') await downloadFullContract(order, orderTotal);
            showToast('success', 'Документ скачан — откройте в Word и распечатайте');
        } catch (err) {
            showToast('error', 'Ошибка формирования документа: ' + err.message);
        } finally {
            setIsDocLoading(null);
        }
    };

    // Фильтрованные продукты для модалки добавления из каталога
    const filteredProducts = useMemo(() => {
        if (!productSearch.trim()) return products;
        const q = productSearch.toLowerCase().trim();
        return products.filter(p => p.title && p.title.toLowerCase().includes(q));
    }, [products, productSearch]);

    const updateProduct = (updater) => {
        setOrder(prev => {
            const product_order = prev.product_order.map(p =>
                p.id === selectedProductId ? syncItemTotal(updater(p)) : p
            );
            return { ...prev, product_order, ...recalcOrderTotals({ ...prev, product_order }) };
        });
    };

    const handleItemInput = (varName, value) => {
        const numVal = isNaN(value) ? value : Number(value);
        updateProduct(p => {
            const newUserInputs = { ...p.userInputs, [varName]: numVal };
            return {
                ...p,
                userInputs: newUserInputs,
                calculatedDetails: calculateDetails({ ...p, userInputs: newUserInputs })
            };
        });
    };

    const handleFlagChange = (flagName) => {
        updateProduct(p => {
            const newUserInputs = { ...p.userInputs, [flagName]: !p.userInputs?.[flagName] };
            return {
                ...p,
                userInputs: newUserInputs,
                calculatedDetails: calculateDetails({ ...p, userInputs: newUserInputs })
            };
        });
    };

    const handleItemPrice = (value) => updateProduct(p => ({ ...p, price: Number(value) || 0 }));
    const handleItemTitle = (value) => updateProduct(p => ({ ...p, title: value }));
    const handleItemDescri = (value) => updateProduct(p => ({ ...p, description: value }));
    const handleOrderInput = (field, value) => setOrder(prev => ({ ...prev, [field]: value }));

    const handleFinanceChange = (field, value) => {
        const num = Math.max(0, Number(value) || 0);
        setOrder(prev => {
            const sum = (prev.product_order || []).reduce((s, p) => s + getLineTotal(p), 0);
            const discount = field === 'discountAmount' ? num : (prev.discountAmount || 0);
            const tax = field === 'taxAmount' ? num : (prev.taxAmount || 0);
            return {
                ...prev,
                [field]: num,
                subtotal: sum,
                total: sum - discount + tax,
            };
        });
    };

    const deletePosition = async (productId) => {
        const confirmed = await confirm({
            message: 'Удалить эту позицию?',
            confirmLabel: 'Удалить',
            danger: true,
        });
        if (!confirmed) return;
        const updated = order.product_order.filter(p => p.id !== productId);
        if (selectedProductId === productId) {
            setSelectedProductId(updated.length > 0 ? updated[0].id : null);
        }
        setOrder(prev => ({
            ...prev,
            product_order: updated,
            ...recalcOrderTotals({ ...prev, product_order: updated }),
        }));
    };

    const deleteEntireOrder = async () => {
        if (isDeleting) return;
        const confirmed = await confirm({
            message: 'Удалить весь заказ? Действие необратимо!',
            confirmLabel: 'Удалить',
            danger: true,
        });
        if (!confirmed) return;
        setIsDeleting(true);
        try {
            await fetch(`${API_BASE}/order/${id}`, { method: 'DELETE' });
            setIsDirty(false);
            showToast('success', 'Заказ удалён');
            navigate('/view_orders');
        } catch (err) {
            showToast('error', 'Ошибка: ' + err.message);
        } finally {
            setIsDeleting(false);
        }
    };

    const saveOrder = async () => {
        if (isSaving || !order) return;
        const totals = recalcOrderTotals(order);

        setIsSaving(true);
        try {
            const { subtotal, total } = totals;
            const effectiveStatus = getEffectiveStatus(status, customStatus);
            const product_order = (order.product_order || []).map(syncItemTotal);
            const res = await fetch(`${API_BASE}/order/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...order,
                    product_order,
                    status: effectiveStatus,
                    subtotal,
                    total,
                    updatedAt: new Date().toISOString()
                })
            });
            if (res.ok) {
                setIsDirty(false);
                showToast('success', 'Заказ успешно сохранён');
                navigate(`/order/${id}`);
            } else {
                showToast('error', 'Не удалось сохранить заказ');
            }
        } catch (err) {
            showToast('error', 'Ошибка сохранения: ' + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const selectPresetStatus = (preset) => {
        setStatus(preset);
        setCustomStatus('');
    };

    const handleCustomStatusChange = (value) => {
        setCustomStatus(value);
        const trimmed = value.trim();
        if (trimmed) {
            setStatus(trimmed);
        } else if (!PRESET_STATUSES.includes(status)) {
            setStatus('Оформлен');
        }
    };

    const isCustomStatusActive = customStatus.trim() !== '' && !PRESET_STATUSES.includes(status);

    const openAddModal = (mode = 'catalog') => {
        setModalMode(mode);
        setModalOpen(true);
        if (mode === 'catalog') setProductSearch('');
    };

    const savePosition = () => {
        if (modalMode === 'catalog' && !selectedNewProduct) return;
        if (modalMode === 'custom' && !customItem.title) {
            showToast('error', 'Введите название позиции');
            return;
        }

        let newItem;

        if (modalMode === 'catalog') {
            const catalogProduct = { ...selectedNewProduct, userInputs: { ...newInputs } };
            const details = calculateDetails(catalogProduct);
            const qty = Number(newInputs.coll) || 1;
            newItem = syncItemTotal({
                id: createPositionId(),
                isCustom: false,
                title: selectedNewProduct.title,
                img: selectedNewProduct.img,
                description: customDesc,
                price: Number(selectedNewProduct.price || 0),
                quantity: qty,
                totalPrice: Number(selectedNewProduct.price || 0) * qty,
                userInputs: { ...newInputs },
                calculatedDetails: details,
                variables: selectedNewProduct.variables,
                conditions: selectedNewProduct.conditions,
                details: selectedNewProduct.details,
                bodyColor: (addBodyColor || '').trim(),
                facadeColor: (addFacadeColor || '').trim()
            });
        } else {
            newItem = syncItemTotal({
                id: createPositionId(),
                isCustom: true,
                title: customItem.title.trim(),
                description: customItem.description,
                price: Number(customItem.price),
                quantity: Number(customItem.quantity) || 1,
            });
        }

        setOrder(prev => {
            const product_order = [...(prev.product_order || []), newItem];
            return { ...prev, product_order, ...recalcOrderTotals({ ...prev, product_order }) };
        });

        setTimeout(() => setSelectedProductId(newItem.id), 80);
        closeModal();
    };

    const renderSaveLabel = (idleText, savingText = 'Сохранение...') => (
        isSaving ? <><LoadingSpinner size="sm" light /> {savingText}</> : idleText
    );

    if (loading) {
        return (
            <div className={pageClassName('order_editor--loading')}>
                <LoadingPage message="Загрузка заказа..." />
            </div>
        );
    }
    if (error) {
        return (
            <div className={pageClassName('order_editor--error')}>
                <Link to="/view_orders" className="order_editor__back">← К списку заказов</Link>
                <p className="order_editor__error-msg">{error}</p>
            </div>
        );
    }
    if (!order) {
        return (
            <div className={pageClassName()}>
                <p className="order_editor__error-msg">Заказ не найден</p>
            </div>
        );
    }

    return (
        <section className={pageClassName()}>
            <div className="oed-ambient" aria-hidden="true">
                <div className="oed-ambient__orb oed-ambient__orb--1" />
                <div className="oed-ambient__orb oed-ambient__orb--2" />
                <div className="oed-ambient__grain" />
            </div>

            <div className="order_editor__body">
            <div className="order_editor__nav">
                <Link to="/view_orders" className="order_editor__back">← К списку заказов</Link>
                <Link to={`/order/${id}`} className="order_editor__back">👁 Просмотр</Link>
                {isDirty && <span className="order_editor__dirty-badge">Есть несохранённые изменения</span>}
            </div>

            {/* Современный хедер */}
            <div className="order_editor__top">
                <div>
                    {order.name_compony && <p className="order_editor__company">{order.name_compony}</p>}
                    <h1>Редактор заказа <span className="order-id">#{id}</span></h1>
                    <div className="order_editor__status-block">
                        <div className="status-pills">
                            {PRESET_STATUSES.map(s => (
                                <button
                                    key={s}
                                    type="button"
                                    className={`pill ${status === s && !isCustomStatusActive ? 'active' : ''}`}
                                    onClick={() => selectPresetStatus(s)}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                        <div className={`order_editor__custom-status ${isCustomStatusActive ? 'order_editor__custom-status--active' : ''}`}>
                            <label htmlFor="order-custom-status" className="order_editor__custom-status-label">
                                Свой статус
                            </label>
                            <input
                                id="order-custom-status"
                                type="text"
                                className="order_editor__custom-status-input"
                                value={customStatus}
                                onChange={e => handleCustomStatusChange(e.target.value)}
                                placeholder="Например: Ожидание замеров, Ожидание машины..."
                            />
                            {isCustomStatusActive && (
                                <span className="order_editor__custom-status-hint">Текущий: {status}</span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="top-actions">
                    <button
                        className="btn btn-danger"
                        disabled={isDeleting || isSaving}
                        onClick={deleteEntireOrder}
                    >
                        {isDeleting ? <><LoadingSpinner size="sm" /> Удаление...</> : 'Удалить заказ'}
                    </button>
                    <button
                        className="btn btn-primary"
                        disabled={isSaving || isDeleting}
                        onClick={saveOrder}
                    >
                        {renderSaveLabel('Сохранить изменения')}
                    </button>
                </div>
            </div>

            <div className="order_editor__main">
                {/* Левая панель */}
                <aside className="order_editor__left">
                    <div className="order_editor__left-head">
                        <h3>Позиции заказа</h3>
                        <span>{order.product_order?.length || 0} поз.</span>
                    </div>

                    <div className="order_editor__positions">
                        {order.product_order?.length === 0 && (
                            <p className="order_editor__positions-empty">Позиций пока нет — добавьте из каталога или произвольную</p>
                        )}
                        {order.product_order?.map(item => (
                            <article
                                key={item.id}
                                className={`order_editor__position-card ${selectedProductId === item.id ? 'order_editor__position-card--active' : ''}`}
                                onClick={() => setSelectedProductId(item.id)}
                            >
                                <div className="pos-photo">
                                    {resolveImageUrl(item.img) ? (
                                        <img src={resolveImageUrl(item.img)} alt={item.title} />
                                    ) : (
                                        <div className="no-photo">🪑</div>
                                    )}
                                </div>

                                <div className="pos-info">
                                    <h4>{item.title}</h4>
                                    <p className="pos-price-value">
                                        {Number(item.price || 0).toLocaleString()} сом
                                    </p>
                                    <p className="pos-qty">
                                        {item.quantity || item.userInputs?.coll || 1} шт.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    className="order_editor__delete-position-btn"
                                    onClick={(e) => { e.stopPropagation(); deletePosition(item.id); }}
                                    title="Удалить позицию"
                                    aria-label="Удалить позицию"
                                >
                                    🗑
                                </button>
                            </article>
                        ))}
                    </div>

                    <div className="order_editor__add-buttons">
                        <button type="button" className="order_editor__add-btn order_editor__add-btn--catalog" onClick={() => openAddModal('catalog')}>
                            ＋ Из каталога
                        </button>
                        <button type="button" className="order_editor__add-btn order_editor__add-btn--custom" onClick={() => openAddModal('custom')}>
                            ＋ Произвольная
                        </button>
                    </div>
                </aside>

                {/* Центральная часть */}
                <main className="order_editor__center">
                    {selectedProduct ? (
                        <div className="order_editor__center-body" key={selectedProductId}>
                            <div className="order_editor__center-head">
                                <div>
                                    {selectedProduct.isCustom ? (
                                        <div className="order_editor__title-edit">
                                            <label htmlFor="custom-position-title" className="order_editor__title-label">
                                                Название позиции
                                            </label>
                                            <input
                                                id="custom-position-title"
                                                className="order_editor__title-input"
                                                type="text"
                                                value={selectedProduct.title || ''}
                                                onChange={e => handleItemTitle(e.target.value)}
                                                placeholder="Например: Доставка, Сборка, Стол на заказ..."
                                            />
                                        </div>
                                    ) : (
                                        <h2>{selectedProduct.title}</h2>
                                    )}
                                    <p>ID: {selectedProduct.id} {selectedProduct.isCustom && '• Произвольная'}</p>
                                </div>
                                <button
                                    disabled={isSaving || isDeleting}
                                    onClick={saveOrder}
                                >
                                    {renderSaveLabel('Сохранить изменения')}
                                </button>
                            </div>

                            <div className="order_editor__specs">
                                <article>
                                    <h4>{selectedProduct.isCustom ? 'Параметры позиции' : 'Параметры изделия'}</h4>
                                    <div className="order_editor__sizes-grid">
                                        <div className="size-input">
                                            <label>Количество</label>
                                            <input
                                                type="number"
                                                min="1"
                                                value={selectedProduct.quantity || selectedProduct.userInputs?.coll || 1}
                                                onChange={e => {
                                                    const q = Math.max(1, Number(e.target.value) || 1);
                                                    updateProduct(p => ({
                                                        ...p,
                                                        quantity: q,
                                                        // если есть coll в inputs — синхронизируем
                                                        userInputs: p.userInputs ? { ...p.userInputs, coll: q } : { coll: q }
                                                    }));
                                                }}
                                            />
                                        </div>

                                        <div className="size-input">
                                            <label>Цена за единицу (сом)</label>
                                            <input type="number" value={selectedProduct.price || ''} onChange={e => handleItemPrice(e.target.value)} />
                                        </div>

                                        {!selectedProduct.isCustom && (
                                            <div className="size-input size-input--full">
                                                <label>Цвета (текстом)</label>
                                                <div className="colors-row order_editor__colors-row">
                                                    <input
                                                        placeholder="Цвет корпуса"
                                                        value={selectedProduct.bodyColor || ''}
                                                        onChange={e => updateProduct(p => ({ ...p, bodyColor: e.target.value }))}
                                                    />
                                                    <input
                                                        placeholder="Цвет фасадов"
                                                        value={selectedProduct.facadeColor || ''}
                                                        onChange={e => updateProduct(p => ({ ...p, facadeColor: e.target.value }))}
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {!selectedProduct.isCustom && selectedProduct.conditions?.map(c => c.type === 'flag' && (
                                            <label key={c.name} className="checkbox">
                                                <input type="checkbox" checked={!!selectedProduct.userInputs?.[c.name]} onChange={() => handleFlagChange(c.name)} />
                                                {c.label}
                                            </label>
                                        ))}

                                        {!selectedProduct.isCustom && selectedProduct.variables?.map(v => (
                                            <div className="size-input" key={v.name}>
                                                <label>{v.label}</label>
                                                <input type="number" value={selectedProduct.userInputs?.[v.name] ?? v.default ?? ''}
                                                       onChange={e => handleItemInput(v.name, e.target.value)} />
                                            </div>
                                        ))}
                                    </div>
                                </article>

                                <article>
                                    <h4>Описание позиции</h4>
                                    <textarea className="nice-textarea" value={selectedProduct.description || ''}
                                              onChange={e => handleItemDescri(e.target.value)} placeholder="Дополнительное описание..." />
                                </article>
                            </div>

                            {!selectedProduct.isCustom && (
                            <div className="order_editor__details-section">
                                <div className="order_editor__details-head">
                                    <h4>Деталировка</h4>
                                    <button type="button" className="order_editor__toggle-btn" onClick={() => setShowDetails(!showDetails)}>
                                        {showDetails ? 'Скрыть' : 'Показать'}
                                    </button>
                                </div>
                                {showDetails && (
                                    selectedProduct.calculatedDetails?.length > 0 ? (
                                        <div className="order_editor__details-table-wrap">
                                            <table className="order_editor__details-table">
                                                <thead>
                                                    <tr><th>Деталь</th><th>Размер</th><th>Кол-во</th></tr>
                                                </thead>
                                                <tbody>
                                                    {selectedProduct.calculatedDetails.map(d => (
                                                        <tr key={d.key}>
                                                            <td>{d.label}</td>
                                                            <td>{d.size}</td>
                                                            <td>{d.count}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : <p className="order_editor__details-empty">Нет данных для деталировки</p>
                                )}
                            </div>
                            )}

                            <div className="order_editor__preview">
                                <div className="order_editor__preview-head"><h5>Предпросмотр</h5></div>
                                <div className="order_editor__preview-image">
                                    {resolveImageUrl(selectedProduct.img) && (
                                        <img src={resolveImageUrl(selectedProduct.img)} alt={selectedProduct.title} />
                                    )}
                                    <p>{selectedProduct.title}</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <p className="no-selection">Выберите позицию слева для редактирования</p>
                    )}
                </main>

                {/* Правая панель */}
                <aside className="order_editor__right">
                    <section className="order_editor__summary">
                        <h3>Сводка</h3>
                        <div className="order_editor__summary-rows">
                            <p><span>Сумма товаров:</span><strong>{subtotal.toLocaleString()} сом</strong></p>
                            <p><span>НДС / Налог:</span>
                                <input type="number" value={order.taxAmount || 0} onChange={e => handleFinanceChange('taxAmount', e.target.value)} className="finance-input" />
                            </p>
                            <p><span>Скидка:</span>
                                <input type="number" value={order.discountAmount || 0} onChange={e => handleFinanceChange('discountAmount', e.target.value)} className="finance-input" />
                            </p>
                        </div>
                        <div className="order_editor__total">
                            <p>ИТОГО</p>
                            <strong>{orderTotal.toLocaleString()} сом</strong>
                        </div>
                        <button
                            disabled={isSaving || isDeleting}
                            onClick={saveOrder}
                        >
                            {renderSaveLabel('Сохранить / Подтвердить')}
                        </button>
                    </section>

                    <section className="order_editor__client">
                        <h4>Клиент</h4>
                        <input className="nice-input" value={order.name_client || ''} onChange={e => handleOrderInput('name_client', e.target.value)} placeholder="ФИО клиента" />
                        <input className="nice-input" value={order.phone || ''} onChange={e => handleOrderInput('phone', e.target.value)} placeholder="Телефон" />
                        <input className="nice-input" value={order.email || ''} onChange={e => handleOrderInput('email', e.target.value)} placeholder="Email" />
                        <textarea className="nice-textarea" value={order.order_note || ''} onChange={e => handleOrderInput('order_note', e.target.value)} placeholder="Примечание к заказу" />
                    </section>

                    <section className="order_editor__contract">
                        <h4>Данные для договора</h4>
                        <div className="order_editor__contract-grid">
                            <label className="order_editor__field">
                                <span>№ договора</span>
                                <input className="nice-input" value={order.contract_no || ''} onChange={e => handleOrderInput('contract_no', e.target.value)} placeholder="Напр. 24" />
                            </label>
                            <label className="order_editor__field">
                                <span>Дата договора</span>
                                <input className="nice-input" type="date" value={order.contract_date || ''} onChange={e => handleOrderInput('contract_date', e.target.value)} />
                            </label>
                            <label className="order_editor__field">
                                <span>Город</span>
                                <input className="nice-input" value={order.contract_city || ''} onChange={e => handleOrderInput('contract_city', e.target.value)} placeholder="Токмок" />
                            </label>
                            <label className="order_editor__field order_editor__field--full">
                                <span>Организация покупателя</span>
                                <input className="nice-input" value={order.name_compony || ''} onChange={e => handleOrderInput('name_compony', e.target.value)} placeholder='МП "...", ОсОО "..."' />
                            </label>
                            <label className="order_editor__field">
                                <span>Должность представителя</span>
                                <input className="nice-input" value={order.buyer_rep_title || ''} onChange={e => handleOrderInput('buyer_rep_title', e.target.value)} placeholder="директора" />
                            </label>
                            <label className="order_editor__field">
                                <span>ФИО представителя</span>
                                <input className="nice-input" value={order.buyer_rep_name || ''} onChange={e => handleOrderInput('buyer_rep_name', e.target.value)} placeholder="Иванов И.И." />
                            </label>
                            <label className="order_editor__field order_editor__field--full">
                                <span>Основание (приказ / положение)</span>
                                <input className="nice-input" value={order.buyer_basis || ''} onChange={e => handleOrderInput('buyer_basis', e.target.value)} placeholder="приказ №1-05/56 от 29.04.2026 г." />
                            </label>
                            <label className="order_editor__field">
                                <span>ИНН покупателя</span>
                                <input className="nice-input" value={order.buyer_inn || ''} onChange={e => handleOrderInput('buyer_inn', e.target.value)} />
                            </label>
                            <label className="order_editor__field">
                                <span>Срок поставки (дней)</span>
                                <input className="nice-input" value={order.delivery_days || ''} onChange={e => handleOrderInput('delivery_days', e.target.value)} placeholder="30" />
                            </label>
                            <label className="order_editor__field order_editor__field--full">
                                <span>Адрес покупателя</span>
                                <input className="nice-input" value={order.address || ''} onChange={e => handleOrderInput('address', e.target.value)} placeholder="Юридический адрес" />
                            </label>
                            <label className="order_editor__field order_editor__field--full">
                                <span>Банк покупателя</span>
                                <input className="nice-input" value={order.buyer_bank || ''} onChange={e => handleOrderInput('buyer_bank', e.target.value)} placeholder='ОАО "Оптима Банк"' />
                            </label>
                            <label className="order_editor__field">
                                <span>БИК</span>
                                <input className="nice-input" value={order.buyer_bik || ''} onChange={e => handleOrderInput('buyer_bik', e.target.value)} />
                            </label>
                            <label className="order_editor__field">
                                <span>Р/счёт</span>
                                <input className="nice-input" value={order.buyer_account || ''} onChange={e => handleOrderInput('buyer_account', e.target.value)} />
                            </label>
                            <label className="order_editor__field">
                                <span>Подпись (инициалы)</span>
                                <input className="nice-input" value={order.buyer_sign || ''} onChange={e => handleOrderInput('buyer_sign', e.target.value)} placeholder="Иванов И.И." />
                            </label>
                            <label className="order_editor__field order_editor__field--full">
                                <span>Основание госзакупки</span>
                                <textarea className="nice-textarea order_editor__contract-note" value={order.procurement_basis || ''} onChange={e => handleOrderInput('procurement_basis', e.target.value)} placeholder="Текст основания закупки..." />
                            </label>
                        </div>
                    </section>

                    <section className="order_editor__docs">
                        <h4>Документы</h4>
                        <button type="button" className="order_editor__doc-btn order_editor__doc-btn--primary" disabled={!!isDocLoading} onClick={() => handleDocDownload('kp')}>
                            {isDocLoading === 'kp' ? 'Формирование...' : 'Скачать коммерческое предложение'}
                        </button>
                        <button type="button" className="order_editor__doc-btn" disabled={!!isDocLoading} onClick={() => handleDocDownload('spec')}>
                            {isDocLoading === 'spec' ? 'Формирование...' : 'Скачать спецификацию'}
                        </button>
                        <button type="button" className="order_editor__doc-btn order_editor__doc-btn--accent" disabled={!!isDocLoading} onClick={() => handleDocDownload('contract')}>
                            {isDocLoading === 'contract' ? 'Формирование...' : 'Скачать полный договор'}
                        </button>
                    </section>
                </aside>
            </div>
            </div>

            {modalOpen && createPortal(
                <div className={oedModalClassName()} role="dialog" aria-modal="true">
                    <div className="oed-modal__overlay" onClick={closeModal}>
                        <div className="oed-modal__dialog" onClick={e => e.stopPropagation()}>
                            <div className="oed-modal__header">
                                <h3>
                                    {modalMode === 'catalog' ? 'Добавить мебель из каталога' : 'Добавить произвольную позицию'}
                                </h3>
                                <button type="button" className="oed-modal__close" onClick={closeModal} aria-label="Закрыть">×</button>
                            </div>

                            {modalMode === 'catalog' ? (
                                <div className="oed-modal__body oed-modal__body--catalog">
                                    <div className="oed-modal__search">
                                        <input
                                            type="text"
                                            placeholder="Поиск по названию мебели..."
                                            value={productSearch}
                                            onChange={(e) => setProductSearch(e.target.value)}
                                        />
                                        {productSearch && (
                                            <button type="button" className="oed-modal__search-clear" onClick={() => setProductSearch('')} title="Очистить поиск">×</button>
                                        )}
                                    </div>

                                    <div className="oed-modal__split">
                                        <div className="oed-modal__products-pane">
                                            {filteredProducts.length === 0 ? (
                                                <div className="oed-modal__products-empty">Ничего не найдено</div>
                                            ) : (
                                                <div className="oed-modal__products-list">
                                                    {filteredProducts.map(p => {
                                                        const isActive = selectedNewProduct?.id === p.id;
                                                        const price = p.price ? `${Number(p.price).toLocaleString()} сом` : '';
                                                        return (
                                                            <div
                                                                key={p.id}
                                                                className={`oed-modal__catalog-card${isActive ? ' is-active' : ''}`}
                                                                onClick={() => {
                                                                    setSelectedNewProduct(p);
                                                                    const init = {};
                                                                    (p.variables || []).forEach(v => { init[v.name] = v.default; });
                                                                    (p.conditions || []).forEach(c => {
                                                                        if (c.type === 'flag') init[c.name] = !!c.default;
                                                                    });
                                                                    setNewInputs(init);
                                                                    setAddBodyColor('');
                                                                    setAddFacadeColor('');
                                                                }}
                                                                role="button"
                                                                tabIndex={0}
                                                                onKeyDown={(e) => e.key === 'Enter' && setSelectedNewProduct(p)}
                                                            >
                                                                <div className="oed-modal__catalog-card-img">
                                                                    {resolveImageUrl(p.img) ? (
                                                                        <img src={resolveImageUrl(p.img)} alt={p.title} />
                                                                    ) : (
                                                                        <div className="oed-modal__catalog-card-placeholder">🪑</div>
                                                                    )}
                                                                </div>
                                                                <div className="oed-modal__catalog-card-info">
                                                                    <div className="oed-modal__catalog-card-title">{p.title}</div>
                                                                    {price && <div className="oed-modal__catalog-card-price">{price}</div>}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>

                                        <div className="oed-modal__config-pane">
                                            {selectedNewProduct ? (
                                                <div className="oed-modal__config-content">
                                                    <div className="oed-modal__config-header">
                                                        <h4>{selectedNewProduct.title}</h4>
                                                        {selectedNewProduct.price && (
                                                            <div className="oed-modal__config-price">{Number(selectedNewProduct.price).toLocaleString()} сом / шт</div>
                                                        )}
                                                    </div>

                                                    {(selectedNewProduct.variables || []).length > 0 && (
                                                        <div className="oed-modal__config-section">
                                                            <div className="oed-modal__section-label">Параметры</div>
                                                            <div className="oed-modal__inputs">
                                                                {(selectedNewProduct.variables || []).map(v => (
                                                                    <label key={v.name} className="oed-modal__field">
                                                                        <span>{v.label}</span>
                                                                        <input
                                                                            type="number"
                                                                            value={newInputs[v.name] ?? ''}
                                                                            onChange={e => setNewInputs(prev => ({ ...prev, [v.name]: e.target.value }))}
                                                                        />
                                                                    </label>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {(selectedNewProduct.conditions || []).some(c => c.type === 'flag') && (
                                                        <div className="oed-modal__config-section">
                                                            <div className="oed-modal__section-label">Опции</div>
                                                            <div className="oed-modal__checkboxes">
                                                                {(selectedNewProduct.conditions || []).map(c => c.type === 'flag' && (
                                                                    <label key={c.name} className="oed-modal__checkbox">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={!!newInputs[c.name]}
                                                                            onChange={() => setNewInputs(prev => ({ ...prev, [c.name]: !prev[c.name] }))}
                                                                        />
                                                                        {c.label}
                                                                    </label>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div className="oed-modal__config-section">
                                                        <div className="oed-modal__section-label">Цвета</div>
                                                        <div className="oed-modal__colors-row">
                                                            <label className="oed-modal__field">
                                                                <span>Цвет корпуса</span>
                                                                <input value={addBodyColor} onChange={e => setAddBodyColor(e.target.value)} placeholder="Дуб Сонома, Венге..." />
                                                            </label>
                                                            <label className="oed-modal__field">
                                                                <span>Цвет фасадов</span>
                                                                <input value={addFacadeColor} onChange={e => setAddFacadeColor(e.target.value)} placeholder="Белый глянец, ЛДСП..." />
                                                            </label>
                                                        </div>
                                                    </div>

                                                    <div className="oed-modal__config-section">
                                                        <label className="oed-modal__field">
                                                            <span>Описание позиции / примечание</span>
                                                            <textarea value={customDesc} onChange={e => setCustomDesc(e.target.value)} placeholder="Дополнительные пожелания..." />
                                                        </label>
                                                    </div>

                                                    <div className="oed-modal__config-actions">
                                                        <button type="button" className="oed-modal__save-btn" onClick={savePosition}>Добавить в заказ</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="oed-modal__config-placeholder">
                                                    <div className="oed-modal__placeholder-icon">🛠️</div>
                                                    <p>Выберите позицию слева</p>
                                                    <small>Настройте размеры, цвета и описание выбранной мебели</small>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="oed-modal__body">
                                    <div className="oed-modal__form">
                                        <div className="oed-modal__form-row">
                                            <label className="oed-modal__field">
                                                <span>Название позиции *</span>
                                                <input value={customItem.title} onChange={e => setCustomItem(p => ({ ...p, title: e.target.value }))} placeholder="Например: Стол обеденный, Доставка..." />
                                            </label>
                                            <label className="oed-modal__field">
                                                <span>Цена за единицу (сом) *</span>
                                                <input type="number" value={customItem.price} onChange={e => setCustomItem(p => ({ ...p, price: e.target.value }))} />
                                            </label>
                                        </div>
                                        <div className="oed-modal__form-row">
                                            <label className="oed-modal__field">
                                                <span>Количество</span>
                                                <input type="number" min="1" value={customItem.quantity} onChange={e => setCustomItem(p => ({ ...p, quantity: e.target.value }))} />
                                            </label>
                                        </div>
                                        <label className="oed-modal__field oed-modal__field--full">
                                            <span>Описание / примечание</span>
                                            <textarea value={customItem.description} onChange={e => setCustomItem(p => ({ ...p, description: e.target.value }))} placeholder="Дополнительная информация о позиции..." />
                                        </label>
                                        <button type="button" className="oed-modal__save-btn oed-modal__save-btn--spaced" onClick={savePosition}>Добавить в заказ</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </section>
    );
};

export default OrderEditor;