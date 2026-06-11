import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { evaluate } from 'mathjs';
import './order_editor.scss';
import { useModal } from '../../ModalContext';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8080';

const OrderEditor = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { showConfirm, showAlert } = useModal();

    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedProductId, setSelectedProductId] = useState(null);
    const [status, setStatus] = useState('Оформлен');

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

    // Получение данных заказа
    useEffect(() => {
        const fetchOrder = async () => {
            try {
                const res = await fetch(`${API_BASE}/order/${id}`);
                if (!res.ok) throw new Error('Заказ не найден');
                const data = await res.json();
                let loaded = data.order?.[0] || data;

                loaded.product_order = (loaded.product_order || []).map(item => ({
                    ...item,
                    userInputs: { ...item.userInputs },
                    bodyColor: typeof item.bodyColor === 'string' ? item.bodyColor : '',
                    facadeColor: typeof item.facadeColor === 'string' ? item.facadeColor : '',
                    calculatedDetails: item.calculatedDetails?.length
                        ? item.calculatedDetails
                        : calculateDetails(item)
                }));

                setOrder(loaded);
                setStatus(loaded.status || 'Оформлен');

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
                const data = await res.json();
                setProducts(Array.isArray(data) ? data : [data]);
            } catch (err) {
                console.error('Ошибка каталога:', err);
            }
        };

        fetchOrder();
        fetchProducts();
    }, [id]);

    const selectedProduct = order?.product_order?.find(p => p.id === selectedProductId);

    // Фильтрованные продукты для модалки добавления из каталога
    const filteredProducts = useMemo(() => {
        if (!productSearch.trim()) return products;
        const q = productSearch.toLowerCase().trim();
        return products.filter(p => p.title && p.title.toLowerCase().includes(q));
    }, [products, productSearch]);

    const calculateDetails = (product) => {
        if (!product || product.isCustom || !product.details) return [];

        const nums = { ...product.userInputs };
        (product.variables || []).forEach(v => nums[v.name] = Number(nums[v.name]) || v.default || 0);
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

    const updateProduct = (updater) => {
        setOrder(prev => ({
            ...prev,
            product_order: prev.product_order.map(p =>
                p.id === selectedProductId ? updater(p) : p
            )
        }));
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
    const handleItemDescri = (value) => updateProduct(p => ({ ...p, description: value }));
    const handleOrderInput = (field, value) => setOrder(prev => ({ ...prev, [field]: value }));

    const handleFinanceChange = (field, value) => {
        const num = Number(value) || 0;
        setOrder(prev => {
            const subtotal = prev.product_order.reduce((s, p) =>
                s + Number(p.price || 0) * (Number(p.quantity || p.userInputs?.coll || 1) || 1), 0);
            return { ...prev, [field]: num, total: subtotal - (prev.discountAmount || 0) + (field === 'taxAmount' ? num : (prev.taxAmount || 0)) };
        });
    };

    const deletePosition = async (productId) => {
        const ok = await showConfirm('Удалить эту позицию?');
        if (!ok) return;
        setOrder(prev => {
            const updated = prev.product_order.filter(p => p.id !== productId);
            return { ...prev, product_order: updated };
        });
        if (selectedProductId === productId) {
            const remaining = order.product_order.filter(p => p.id !== productId);
            setSelectedProductId(remaining.length > 0 ? remaining[0].id : null);
        }
    };

    const deleteEntireOrder = async () => {
        if (isDeleting) return;
        const ok = await showConfirm('Удалить весь заказ? Действие необратимо!');
        if (!ok) return;
        setIsDeleting(true);
        try {
            await fetch(`${API_BASE}/order/${id}`, { method: 'DELETE' });
            showAlert('Заказ удалён', 'success');
            navigate('/view_orders');
        } catch (err) {
            showAlert('Ошибка: ' + err.message, 'error');
        } finally {
            setIsDeleting(false);
        }
    };

    const saveOrder = async () => {
        if (isSaving || !order) return;
        const subtotal = order.product_order.reduce((s, p) =>
            s + Number(p.price || 0) * (Number(p.quantity || p.userInputs?.coll || 1) || 1), 0);

        setIsSaving(true);
        try {
            const res = await fetch(`${API_BASE}/order/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...order,
                    status,
                    subtotal,
                    total: order.total || subtotal,
                    updatedAt: new Date().toISOString()
                })
            });
            if (res.ok) {
                showAlert('Заказ успешно сохранён', 'success');
                navigate(`/order/${id}`);
            }
        } catch (err) {
            showAlert('Ошибка сохранения: ' + err.message, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const openAddModal = (mode = 'catalog') => {
        setModalMode(mode);
        setModalOpen(true);
        if (mode === 'catalog') setProductSearch('');
    };

    const savePosition = () => {
        if (modalMode === 'catalog' && !selectedNewProduct) return;
        if (modalMode === 'custom' && !customItem.title) {
            showAlert('Введите название позиции', 'error');
            return;
        }

        let newItem;

        if (modalMode === 'catalog') {
            const details = calculateDetails(selectedNewProduct);
            const qty = Number(newInputs.coll) || 1;
            newItem = {
                id: Date.now(),
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
            };
        } else {
            // Произвольная позиция — без цветовых полей (описание достаточно)
            newItem = {
                id: Date.now(),
                isCustom: true,
                title: customItem.title.trim(),
                description: customItem.description,
                price: Number(customItem.price),
                quantity: Number(customItem.quantity) || 1,
                totalPrice: Number(customItem.price) * (Number(customItem.quantity) || 1)
            };
        }

        setOrder(prev => ({
            ...prev,
            product_order: [...(prev.product_order || []), newItem]
        }));

        setTimeout(() => setSelectedProductId(newItem.id), 80);
        closeModal();
    };

    const closeModal = () => {
        setModalOpen(false);
        setSelectedNewProduct(null);
        setNewInputs({});
        setCustomDesc('');
        setCustomItem({ title: '', price: '', quantity: 1, description: '' });
        setAddBodyColor('');
        setAddFacadeColor('');
        setProductSearch('');
    };

    if (loading) return <div className="loading">Загрузка...</div>;
    if (error) return <div className="error">{error}</div>;
    if (!order) return <div>Заказ не найден</div>;

    const subtotal = order.product_order?.reduce((s, p) =>
        s + Number(p.price || 0) * (Number(p.quantity || p.userInputs?.coll || 1) || 1), 0) || 0;

    return (
        <section className="order_editor">
            {/* Современный хедер */}
            <div className="order_editor__top">
                <div>
                    <h1>Редактор заказа <span className="order-id">#{id}</span></h1>
                    <div className="status-pills">
                        {['Оформлен', 'Пилится', 'Собирается', 'Ожидание доставки', 'Установка', 'Завершено'].map(s => (
                            <button
                                key={s}
                                className={`pill ${status === s ? 'active' : ''}`}
                                onClick={() => setStatus(s)}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="top-actions">
                    <button 
                        className={`btn btn-danger ${isDeleting ? 'is-loading' : ''}`} 
                        disabled={isDeleting} 
                        onClick={deleteEntireOrder}
                    >
                        {isDeleting ? 'Удаление...' : 'Удалить заказ'}
                    </button>
                    <button 
                        className={`btn btn-primary ${isSaving ? 'is-loading' : ''}`} 
                        disabled={isSaving} 
                        onClick={saveOrder}
                    >
                        {isSaving ? 'Сохранение...' : 'Сохранить изменения'}
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
                        {order.product_order?.map(item => (
                            <article
                                key={item.id}
                                className={`order_editor__position-card ${selectedProductId === item.id ? 'order_editor__position-card--active' : ''}`}
                                onClick={() => setSelectedProductId(item.id)}
                            >
                                <div className="pos-photo">
                                    {item.img && typeof item.img === 'string' ? (
                                        <img 
                                            src={item.img.startsWith('http') ? item.img : `/utilse/${item.img.split('/').pop()}`} 
                                            alt={item.title} 
                                        />
                                    ) : (
                                        <div className="no-photo">🪑</div>
                                    )}
                                </div>

                                <div className="pos-info">
                                    <h4>{item.title}</h4>
                                    <p className="pos-meta">
                                        {item.isCustom ? 'Произвольная' : (item.userInputs?.shirina ? `${item.userInputs.shirina} × ${item.userInputs.visota || '?'} мм` : '')}
                                    </p>

                                    {(item.bodyColor || item.facadeColor) && (
                                        <div className="pos-colors">
                                            {item.bodyColor && <span>Корпус: {item.bodyColor}</span>}
                                            {item.facadeColor && <span>Фасады: {item.facadeColor}</span>}
                                        </div>
                                    )}
                                </div>

                                <div className="pos-price">
                                    <strong>{Number(item.price || 0).toLocaleString()} сом</strong>
                                    <span>× {item.quantity || item.userInputs?.coll || 1}</span>
                                    <div style={{ fontSize: '11px', color: '#0F74C7', fontWeight: 600, marginTop: '2px' }}>
                                        {(Number(item.price || 0) * (Number(item.quantity || item.userInputs?.coll || 1))).toLocaleString()} сом
                                    </div>
                                </div>

                                <button 
                                    className="order_editor__delete-position-btn"
                                    onClick={(e) => { e.stopPropagation(); deletePosition(item.id); }}
                                    title="Удалить позицию"
                                >
                                    🗑
                                </button>
                            </article>
                        ))}
                    </div>

                    <div className="order_editor__add-buttons">
                        <button className="order_editor__add-btn catalog" onClick={() => openAddModal('catalog')}>
                            ＋ Из каталога
                        </button>
                        <button className="order_editor__add-btn custom" onClick={() => openAddModal('custom')}>
                            ＋ Произвольная
                        </button>
                    </div>
                </aside>

                {/* Центральная часть */}
                <main className="order_editor__center">
                    {selectedProduct ? (
                        <>
                            <div className="order_editor__center-head">
                                <div>
                                    <h2>{selectedProduct.title}</h2>
                                    <p>ID: {selectedProduct.id} {selectedProduct.isCustom && '• Кастомная'}</p>
                                </div>
                                <button 
                                    className={isSaving ? 'is-loading' : ''} 
                                    disabled={isSaving} 
                                    onClick={saveOrder}
                                >
                                    {isSaving ? 'Сохранение...' : 'Сохранить изменения'}
                                </button>
                            </div>

                            <div className="order_editor__specs">
                                <article>
                                    <h4>Параметры изделия</h4>
                                    <div className="order_editor__sizes-grid">
                                        {/* Количество — всегда доступно и удобно */}
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

                                        {/* Редактирование цветов (текстом) — в колонку, удобно и без переполнения */}
                                        <div className="size-input" style={{ gridColumn: '1 / -1' }}>
                                            <label style={{ display: 'block', marginBottom: '4px' }}>Цвета (текстом)</label>
                                            <div className="colors-row" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                <input 
                                                    placeholder="Цвет корпуса" 
                                                    value={selectedProduct.bodyColor || ''} 
                                                    onChange={e => updateProduct(p => ({...p, bodyColor: e.target.value}))} 
                                                />
                                                <input 
                                                    placeholder="Цвет фасадов" 
                                                    value={selectedProduct.facadeColor || ''} 
                                                    onChange={e => updateProduct(p => ({...p, facadeColor: e.target.value}))} 
                                                />
                                            </div>
                                        </div>

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

                            {/* Деталировка с toggle */}
                            <div className="order_editor__details-section">
                                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px'}}>
                                    <h4>Деталировка</h4>
                                    <button onClick={() => setShowDetails(!showDetails)} style={{fontSize: '14px', padding: '6px 14px'}}>
                                        {showDetails ? 'Скрыть' : 'Показать'}
                                    </button>
                                </div>
                                {showDetails && (
                                    selectedProduct.calculatedDetails?.length > 0 ? (
                                        <table className="details-table">
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
                                    ) : <p>Нет данных для деталировки</p>
                                )}
                            </div>

                            <div className="order_editor__preview">
                                <div className="order_editor__preview-head"><h5>Предпросмотр</h5></div>
                                <div className="order_editor__preview-image">
                                    {selectedProduct.img && <img src={selectedProduct.img} alt={selectedProduct.title} />}
                                    <p>{selectedProduct.title}</p>
                                </div>
                            </div>
                        </>
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
                            <strong>{(order.total || subtotal - (order.discountAmount || 0) + (order.taxAmount || 0)).toLocaleString()} сом</strong>
                        </div>
                        <button 
                            className={isSaving ? 'is-loading' : ''} 
                            disabled={isSaving} 
                            onClick={saveOrder}
                        >
                            {isSaving ? 'Сохранение...' : 'Сохранить / Подтвердить'}
                        </button>
                    </section>

                    <section className="order_editor__client">
                        <h4>Клиент</h4>
                        <input className="nice-input" value={order.name_client || ''} onChange={e => handleOrderInput('name_client', e.target.value)} placeholder="ФИО клиента" />
                        <input className="nice-input" value={order.phone || ''} onChange={e => handleOrderInput('phone', e.target.value)} placeholder="Телефон" />
                        <textarea className="nice-textarea" value={order.address || ''} onChange={e => handleOrderInput('address', e.target.value)} placeholder="Адрес" />
                        <textarea className="nice-textarea" value={order.order_note || ''} onChange={e => handleOrderInput('order_note', e.target.value)} placeholder="Примечание к заказу" />
                    </section>

                    <button className="order_editor__doc-btn">Печать договора</button>
                    <button className="order_editor__doc-btn">Спецификация материалов</button>
                </aside>
            </div>

            {/* Модальное окно — полностью новый удобный дизайн (как в placing_an_order) */}
            {modalOpen && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal-content order-editor-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>
                                {modalMode === 'catalog' ? 'Добавить мебель из каталога' : 'Добавить произвольную позицию'}
                            </h3>
                            <button className="modal-close-btn" onClick={closeModal}>×</button>
                        </div>

                        {modalMode === 'catalog' ? (
                            /* ДВУХПАНЕЛЬНЫЙ КАТАЛОГ — квадратные карточки + полностью видимые фото + цвета в колонку */
                            <div className="modal-body catalog-modal">
                                {/* Поиск */}
                                <div className="catalog-search">
                                    <input
                                        type="text"
                                        placeholder="Поиск по названию мебели..."
                                        value={productSearch}
                                        onChange={(e) => setProductSearch(e.target.value)}
                                    />
                                    {productSearch && (
                                        <button className="search-clear" onClick={() => setProductSearch('')} title="Очистить поиск">×</button>
                                    )}
                                </div>

                                <div className="catalog-split">
                                    {/* Левая: список мебели (квадратные карточки, фото contain, текст отдельно) */}
                                    <div className="products-pane">
                                        {filteredProducts.length === 0 ? (
                                            <div className="products-empty">Ничего не найдено</div>
                                        ) : (
                                            <div className="products-list">
                                                {filteredProducts.map(p => {
                                                    const isActive = selectedNewProduct?.id === p.id;
                                                    const price = p.price ? `${Number(p.price).toLocaleString()} сом` : '';
                                                    return (
                                                        <div
                                                            key={p.id}
                                                            className={`product-card ${isActive ? 'active' : ''}`}
                                                            onClick={() => {
                                                                setSelectedNewProduct(p);
                                                                const init = {};
                                                                (p.variables || []).forEach(v => init[v.name] = v.default);
                                                                (p.conditions || []).forEach(c => {
                                                                    if (c.type === 'flag') init[c.name] = !!c.default;
                                                                });
                                                                setNewInputs(init);
                                                                setAddBodyColor('');
                                                                setAddFacadeColor('');
                                                            }}
                                                        >
                                                            <div className="product-card-img">
                                                                {p.img ? (
                                                                    <img src={p.img} alt={p.title} />
                                                                ) : (
                                                                    <div className="no-img">🪑</div>
                                                                )}
                                                            </div>
                                                            <div className="product-card-info">
                                                                <div className="product-title">{p.title}</div>
                                                                {price && <div className="product-price">{price}</div>}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    {/* Правая: конфигурация выбранной */}
                                    <div className="config-pane">
                                        {selectedNewProduct ? (
                                            <div className="config-content">
                                                <div className="config-header">
                                                    <h4>{selectedNewProduct.title}</h4>
                                                    {selectedNewProduct.price && (
                                                        <div className="config-price">{Number(selectedNewProduct.price).toLocaleString()} сом / шт</div>
                                                    )}
                                                </div>

                                                {/* Параметры (variables) */}
                                                {(selectedNewProduct.variables || []).length > 0 && (
                                                    <div className="config-section">
                                                        <div className="section-label">Параметры</div>
                                                        <div className="modal-inputs">
                                                            {(selectedNewProduct.variables || []).map(v => (
                                                                <label key={v.name} className="modal-field">
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

                                                {/* Опции / флаги */}
                                                {(selectedNewProduct.conditions || []).some(c => c.type === 'flag') && (
                                                    <div className="config-section">
                                                        <div className="section-label">Опции</div>
                                                        <div className="modal-checkboxes">
                                                            {(selectedNewProduct.conditions || []).map(c => c.type === 'flag' && (
                                                                <label key={c.name} className="modal-checkbox">
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

                                                {/* Цвета — в колонку, без переполнения */}
                                                <div className="config-section">
                                                    <div className="section-label">Цвета</div>
                                                    <div className="colors-row">
                                                        <label className="modal-field">
                                                            <span>Цвет корпуса</span>
                                                            <input
                                                                value={addBodyColor}
                                                                onChange={e => setAddBodyColor(e.target.value)}
                                                                placeholder="Дуб Сонома, Венге..."
                                                            />
                                                        </label>
                                                        <label className="modal-field">
                                                            <span>Цвет фасадов</span>
                                                            <input
                                                                value={addFacadeColor}
                                                                onChange={e => setAddFacadeColor(e.target.value)}
                                                                placeholder="Белый глянец, ЛДСП..."
                                                            />
                                                        </label>
                                                    </div>
                                                </div>

                                                {/* Описание */}
                                                <div className="config-section">
                                                    <label className="modal-field">
                                                        <span>Описание позиции / примечание</span>
                                                        <textarea
                                                            value={customDesc}
                                                            onChange={e => setCustomDesc(e.target.value)}
                                                            placeholder="Дополнительные пожелания..."
                                                        />
                                                    </label>
                                                </div>

                                                <div className="config-actions">
                                                    <button className="modal-save-btn" onClick={savePosition}>
                                                        Добавить в заказ
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="config-placeholder">
                                                <div className="placeholder-icon">🛠️</div>
                                                <p>Выберите позицию слева</p>
                                                <small>Настройте размеры, цвета и описание выбранной мебели</small>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            /* ЧИСТАЯ ФОРМА ПРОИЗВОЛЬНОЙ ПОЗИЦИИ (без цветов — только описание) */
                            <div className="modal-body">
                                <div className="modal-form custom-form">
                                    <div className="form-row">
                                        <label className="modal-field">
                                            <span>Название позиции *</span>
                                            <input
                                                value={customItem.title}
                                                onChange={e => setCustomItem(p => ({...p, title: e.target.value}))}
                                                placeholder="Например: Стол обеденный, Доставка, Сборка..."
                                            />
                                        </label>
                                        <label className="modal-field">
                                            <span>Цена за единицу (сом) *</span>
                                            <input
                                                type="number"
                                                value={customItem.price}
                                                onChange={e => setCustomItem(p => ({...p, price: e.target.value}))}
                                            />
                                        </label>
                                    </div>

                                    <div className="form-row">
                                        <label className="modal-field">
                                            <span>Количество</span>
                                            <input
                                                type="number"
                                                value={customItem.quantity}
                                                onChange={e => setCustomItem(p => ({...p, quantity: e.target.value}))}
                                            />
                                        </label>
                                    </div>

                                    <label className="modal-field" style={{ gridColumn: '1/-1', marginTop: '8px' }}>
                                        <span>Описание / примечание</span>
                                        <textarea
                                            value={customItem.description}
                                            onChange={e => setCustomItem(p => ({...p, description: e.target.value}))}
                                            placeholder="Любая дополнительная информация о позиции..."
                                        />
                                    </label>

                                    <button className="modal-save-btn" onClick={savePosition} style={{ marginTop: '20px' }}>
                                        Добавить в заказ
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </section>
    );
};

export default OrderEditor;