import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { evaluate } from 'mathjs';
import './order_editor.scss';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8080';

const OrderEditor = () => {
    const { id } = useParams();
    const navigate = useNavigate();

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

    // Toggle деталировки
    const [showDetails, setShowDetails] = useState(true);

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

    const deletePosition = (productId) => {
        if (!window.confirm('Удалить эту позицию?')) return;
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
        if (!window.confirm('Удалить весь заказ? Действие необратимо!')) return;
        try {
            await fetch(`${API_BASE}/order/${id}`, { method: 'DELETE' });
            alert('Заказ удалён');
            navigate('/view_orders');
        } catch (err) {
            alert('Ошибка: ' + err.message);
        }
    };

    const saveOrder = async () => {
        if (!order) return;
        const subtotal = order.product_order.reduce((s, p) =>
            s + Number(p.price || 0) * (Number(p.quantity || p.userInputs?.coll || 1) || 1), 0);

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
                alert('Заказ успешно сохранён');
                navigate(`/order/${id}`);
            }
        } catch (err) {
            alert('Ошибка сохранения: ' + err.message);
        }
    };

    const openAddModal = () => {
        setModalMode('catalog');
        setModalOpen(true);
    };

    const savePosition = () => {
        if (modalMode === 'catalog' && !selectedNewProduct) return;
        if (modalMode === 'custom' && !customItem.title) {
            alert('Введите название позиции');
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
                details: selectedNewProduct.details
            };
        } else {
            newItem = {
                id: Date.now(),
                isCustom: true,
                title: customItem.title,
                description: customItem.description,
                price: Number(customItem.price),
                quantity: Number(customItem.quantity),
                totalPrice: Number(customItem.price) * Number(customItem.quantity)
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
    };

    if (loading) return <div className="loading">Загрузка...</div>;
    if (error) return <div className="error">{error}</div>;
    if (!order) return <div>Заказ не найден</div>;

    const subtotal = order.product_order?.reduce((s, p) =>
        s + Number(p.price || 0) * (Number(p.quantity || p.userInputs?.coll || 1) || 1), 0) || 0;

    return (
        <section className="order_editor">
            <div className="order_editor__header">
                <div className="order_editor__status-bar">
                    {['Оформлен', 'Пилится', 'Собирается', 'Ожидание доставки', 'Установка', 'Завершено'].map((step, i) => (
                        <div
                            key={step}
                            className={`order_editor__status-step ${step === status ? 'order_editor__status-step--active' : ''}`}
                            onClick={() => setStatus(step)}
                        >
                            <span>{i + 1}</span>
                            <p>{step}</p>
                        </div>
                    ))}
                </div>
                <button className="order_editor__delete-order-btn" onClick={deleteEntireOrder}>
                    🗑 Удалить весь заказ
                </button>
            </div>

            <div className="order_editor__layout">
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
                                {item.img && <img src={item.img.startsWith('http') ? item.img : `/utilse/${item.img.split('/').pop()}`} alt={item.title} />}
                                <div>
                                    <h4>{item.title}</h4>
                                    <p>{item.isCustom ? 'Произвольная позиция' : `${item.userInputs?.shirina || '?'} × ${item.userInputs?.visota || '?'} мм`}</p>
                                </div>
                                <strong>{Number(item.price || 0).toLocaleString()} сом</strong>

                                <button className="order_editor__delete-position-btn"
                                        onClick={(e) => { e.stopPropagation(); deletePosition(item.id); }}>
                                    🗑
                                </button>
                            </article>
                        ))}
                    </div>

                    <button className="order_editor__add-position" onClick={openAddModal}>
                        + Добавить позицию
                    </button>
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
                                <button onClick={saveOrder}>Сохранить изменения</button>
                            </div>

                            <div className="order_editor__specs">
                                <article>
                                    <h4>Параметры изделия</h4>
                                    <div className="order_editor__sizes-grid">
                                        <div className="size-input">
                                            <label>Цена за единицу (сом)</label>
                                            <input type="number" value={selectedProduct.price || ''} onChange={e => handleItemPrice(e.target.value)} />
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
                        <button onClick={saveOrder}>Сохранить / Подтвердить</button>
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

            {/* Модальное окно */}
            {modalOpen && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>{modalMode === 'catalog' ? 'Добавить из каталога' : 'Добавить произвольную позицию'}</h3>
                            <button className="modal-close" onClick={closeModal}>×</button>
                        </div>

                        {modalMode === 'catalog' ? (
                            <div>
                                <div className="modal-products">
                                    {products.map(p => (
                                        <div key={p.id} className={`modal-product ${selectedNewProduct?.id === p.id ? 'active' : ''}`}
                                             onClick={() => {
                                                 setSelectedNewProduct(p);
                                                 const init = {};
                                                 (p.variables || []).forEach(v => init[v.name] = v.default);
                                                 setNewInputs(init);
                                             }}>
                                            <img src={p.img} alt={p.title} />
                                            <p>{p.title}</p>
                                        </div>
                                    ))}
                                </div>

                                {selectedNewProduct && (
                                    <div className="modal-form">
                                        <h4>{selectedNewProduct.title}</h4>
                                        <div className="modal-fields">
                                            {selectedNewProduct.variables?.map(v => (
                                                <label key={v.name}>
                                                    <span>{v.label}</span>
                                                    <input type="number" value={newInputs[v.name] ?? v.default ?? ''}
                                                           onChange={e => setNewInputs(prev => ({...prev, [v.name]: e.target.value}))} />
                                                </label>
                                            ))}
                                            {selectedNewProduct.conditions?.map(c => c.type === 'flag' && (
                                                <label key={c.name} className="checkbox">
                                                    <input type="checkbox" checked={!!newInputs[c.name]}
                                                           onChange={() => setNewInputs(prev => ({...prev, [c.name]: !prev[c.name]}))} />
                                                    {c.label}
                                                </label>
                                            ))}
                                        </div>
                                        <textarea placeholder="Описание позиции" value={customDesc} onChange={e => setCustomDesc(e.target.value)} />
                                        <button className="modal-add-btn" onClick={savePosition}>Добавить в заказ</button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="modal-form">
                                <label><span>Название позиции</span><input value={customItem.title} onChange={e => setCustomItem(p => ({...p, title: e.target.value}))} /></label>
                                <label><span>Цена за единицу</span><input type="number" value={customItem.price} onChange={e => setCustomItem(p => ({...p, price: e.target.value}))} /></label>
                                <label><span>Количество</span><input type="number" value={customItem.quantity} onChange={e => setCustomItem(p => ({...p, quantity: e.target.value}))} /></label>
                                <label><span>Описание</span><textarea value={customItem.description} onChange={e => setCustomItem(p => ({...p, description: e.target.value}))} /></label>
                                <button className="modal-add-btn" onClick={savePosition}>Добавить в заказ</button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </section>
    );
};

export default OrderEditor;