import React, { useState, useEffect } from 'react';
import { evaluate } from 'mathjs';
import { useNavigate } from 'react-router-dom';
import './placing_an_order.scss';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8080';

const PlacingAnOrder = () => {
    const navigate = useNavigate();

    const [order, setOrder] = useState({
        name_client: '',
        name_compony: '',
        address: '',
        phone: '',
        email: '',
        order_color: '',
        order_note: '',
        description_for_order: '',
        positions: []
    });

    const [modalOpen, setModalOpen] = useState(false);
    const [modalType, setModalType] = useState('catalog'); // 'catalog' | 'custom'
    const [editingItemId, setEditingItemId] = useState(null); // ID редактируемой позиции

    // Для каталога
    const [products, setProducts] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [inputs, setInputs] = useState({});
    const [customDesc, setCustomDesc] = useState('');

    // Для произвольной позиции
    const [customItem, setCustomItem] = useState({
        title: '',
        price: '',
        quantity: 1,
        description: ''
    });

    // Загрузка каталога
    useEffect(() => {
        fetch(`${API_BASE}/product`)
            .then(res => res.json())
            .then(data => setProducts(Array.isArray(data) ? data : [data]))
            .catch(err => console.error('Ошибка каталога:', err));
    }, []);

    // Инициализация при выборе товара или при редактировании
    useEffect(() => {
        if (!selectedProduct) return;
        const init = {};
        (selectedProduct.variables || []).forEach(v => init[v.name] = v.default);
        (selectedProduct.conditions || []).forEach(c => {
            if (c.type === 'flag') init[c.name] = !!c.default;
        });
        setInputs(init);
        setCustomDesc('');
    }, [selectedProduct]);

    const calculateDetails = (product, userInputs) => {
        if (!product?.details) return [];

        const nums = { ...userInputs };
        (product.variables || []).forEach(v => nums[v.name] = Number(nums[v.name]) || v.default || 0);
        (product.conditions || []).forEach(c => {
            if (c.type === 'flag') nums[c.name] = !!nums[c.name];
        });

        return product.details.map(detail => {
            if (detail.if_condition && !nums[detail.if_condition]) return null;
            try {
                const w = evaluate(detail.formula_width || '0', nums);
                const h = detail.formula_height ? evaluate(detail.formula_height, nums) : null;
                const cnt = evaluate(detail.count_formula || '1', nums);

                const size = h ? `${Math.round(w)} × ${Math.round(h)} мм` : `${Math.round(w)} мм`;
                return { key: detail.key, label: detail.label, size, count: Math.max(0, Math.round(cnt)) };
            } catch {
                return { key: detail.key, label: detail.label, size: 'Ошибка расчёта', count: 0 };
            }
        }).filter(Boolean);
    };

    // Открытие модалки для добавления / редактирования
    const openModal = (type, itemToEdit = null) => {
        setModalType(type);
        setModalOpen(true);

        if (itemToEdit) {
            setEditingItemId(itemToEdit.id);

            if (type === 'custom') {
                setCustomItem({
                    title: itemToEdit.title,
                    price: itemToEdit.price,
                    quantity: itemToEdit.quantity,
                    description: itemToEdit.description || ''
                });
            } else {
                // Для товаров из каталога
                setSelectedProduct(products.find(p => p.id === itemToEdit.productId) || null);
                setInputs({ ...itemToEdit.userInputs });
                setCustomDesc(itemToEdit.description || '');
            }
        } else {
            setEditingItemId(null);
            setSelectedProduct(null);
            setInputs({});
            setCustomDesc('');
            setCustomItem({ title: '', price: '', quantity: 1, description: '' });
        }
    };

    const closeModal = () => {
        setModalOpen(false);
        setEditingItemId(null);
        setSelectedProduct(null);
        setInputs({});
        setCustomDesc('');
        setCustomItem({ title: '', price: '', quantity: 1, description: '' });
    };

    useEffect(() => {
        if (modalOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [modalOpen]);

    // Добавление / Обновление позиции
    const savePosition = () => {
        if (modalType === 'catalog') {
            if (!selectedProduct) return;

            const calcDetails = calculateDetails(selectedProduct, inputs);
            const quantity = Number(inputs.coll) || 1;
            const price = Number(selectedProduct.price || 0);

            const newItem = {
                id: editingItemId || Date.now(),
                isCustom: false,
                productId: selectedProduct.id,
                title: selectedProduct.title,
                img: selectedProduct.img,
                description: customDesc,
                price,
                quantity,
                totalPrice: price * quantity,
                userInputs: { ...inputs },
                calculatedDetails: calcDetails,
                variables: selectedProduct.variables,
                conditions: selectedProduct.conditions,
                details: selectedProduct.details
            };

            setOrder(prev => ({
                ...prev,
                positions: editingItemId
                    ? prev.positions.map(item => item.id === editingItemId ? newItem : item)
                    : [...prev.positions, newItem]
            }));
        }
        else { // custom
            if (!customItem.title || !customItem.price) {
                alert('Укажите название и цену');
                return;
            }

            const price = Number(customItem.price);
            const quantity = Number(customItem.quantity) || 1;

            const newItem = {
                id: editingItemId || Date.now(),
                isCustom: true,
                title: customItem.title.trim(),
                description: customItem.description,
                price,
                quantity,
                totalPrice: price * quantity,
                img: null
            };

            setOrder(prev => ({
                ...prev,
                positions: editingItemId
                    ? prev.positions.map(item => item.id === editingItemId ? newItem : item)
                    : [...prev.positions, newItem]
            }));
        }

        closeModal();
    };

    const removePosition = (id) => {
        if (!window.confirm('Удалить эту позицию?')) return;
        setOrder(prev => ({
            ...prev,
            positions: prev.positions.filter(item => item.id !== id)
        }));
    };

    const handleOrderChange = (field, value) => {
        setOrder(prev => ({ ...prev, [field]: value }));
    };

    const calculateTotal = () => {
        return order.positions.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
    };

    const saveOrder = async (asDraft = false) => { /* ... оставил без изменений ... */
        if (order.positions.length === 0) {
            alert('Добавьте хотя бы одну позицию');
            return;
        }

        const payload = {
            ...order,
            product_order: order.positions,
            subtotal: calculateTotal(),
            total: calculateTotal(),
            status: asDraft ? 'Черновик' : 'Оформлен'
        };

        try {
            const res = await fetch(`${API_BASE}/order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error('Ошибка сервера');
            const data = await res.json();
            const createdId = data.id || data[0]?.id;

            alert(asDraft ? 'Черновик сохранён' : 'Заказ успешно оформлен!');
            if (!asDraft && createdId) navigate(`/order/${createdId}`);
        } catch (err) {
            alert('Ошибка сохранения: ' + err.message);
        }
    };

    return (
        <section className="placing_an_order">
            <div className="placing_an_order__content">
                {/* Основная информация — без изменений */}
                <article className="placing_an_order__info-card">
                    <h2 className="placing_an_order__section-title">Основная информация о заказе</h2>
                    <p className="placing_an_order__section-subtitle">Введите данные контрагента для формирования договора</p>

                    <div className="placing_an_order__fields">
                        <label className="placing_an_order__field"><span>ФИО Клиента</span>
                            <input value={order.name_client} onChange={e => handleOrderChange('name_client', e.target.value)} />
                        </label>
                        <label className="placing_an_order__field"><span>Компания</span>
                            <input value={order.name_compony} onChange={e => handleOrderChange('name_compony', e.target.value)} />
                        </label>
                        <label className="placing_an_order__field"><span>Адрес</span>
                            <input value={order.address} onChange={e => handleOrderChange('address', e.target.value)} />
                        </label>
                        <label className="placing_an_order__field"><span>Телефон</span>
                            <input value={order.phone} onChange={e => handleOrderChange('phone', e.target.value)} />
                        </label>
                        <label className="placing_an_order__field"><span>Email</span>
                            <input value={order.email} onChange={e => handleOrderChange('email', e.target.value)} />
                        </label>
                        <label className="placing_an_order__field"><span>Цвет материала</span>
                            <input value={order.order_color} onChange={e => handleOrderChange('order_color', e.target.value)} />
                        </label>
                        <label className="placing_an_order__field"><span>Примечание</span>
                            <textarea value={order.order_note} onChange={e => handleOrderChange('order_note', e.target.value)} />
                        </label>
                        <label className="placing_an_order__field"><span>Описание заказа</span>
                            <textarea value={order.description_for_order} onChange={e => handleOrderChange('description_for_order', e.target.value)} />
                        </label>
                    </div>
                </article>

                <div className="placing_an_order__add-wrap">
                    <button className="placing_an_order__add-button" onClick={() => openModal('catalog')}>
                        ＋ Добавить из каталога
                    </button>
                    <button className="placing_an_order__add-button" onClick={() => openModal('custom')} style={{ background: '#10b981' }}>
                        ＋ Добавить произвольную позицию
                    </button>
                </div>

                {/* Модальное окно */}
                {modalOpen && (
                    <div className="modal-overlay" onClick={closeModal}>
                        <div className="modal-content" onClick={e => e.stopPropagation()}>
                            <div className="modal-header">
                                <h3>
                                    {editingItemId ? 'Редактирование позиции' :
                                        modalType === 'catalog' ? 'Добавить из каталога' : 'Новая произвольная позиция'}
                                </h3>
                                <button className="modal-close-btn" onClick={closeModal}>×</button>
                            </div>

                            {modalType === 'catalog' ? (
                                /* Каталог */
                                <div>
                                    <div className="modal-products-grid">
                                        {products.map(p => (
                                            <div key={p.id} className={`modal-product-card ${selectedProduct?.id === p.id ? 'active' : ''}`}
                                                 onClick={() => setSelectedProduct(p)}>
                                                <img src={p.img} alt={p.title} />
                                                <p>{p.title}</p>
                                            </div>
                                        ))}
                                    </div>

                                    {selectedProduct && (
                                        <div className="modal-form">
                                            <h4>{selectedProduct.title}</h4>
                                            <div className="modal-inputs">
                                                {(selectedProduct.variables || []).map(v => (
                                                    <label key={v.name} className="modal-field">
                                                        <span>{v.label}</span>
                                                        <input type="number" value={inputs[v.name] ?? ''}
                                                               onChange={e => setInputs(prev => ({ ...prev, [v.name]: e.target.value }))} />
                                                    </label>
                                                ))}
                                                {(selectedProduct.conditions || []).map(c => c.type === 'flag' && (
                                                    <label key={c.name} className="modal-checkbox">
                                                        <input type="checkbox" checked={!!inputs[c.name]}
                                                               onChange={() => setInputs(prev => ({ ...prev, [c.name]: !prev[c.name] }))} />
                                                        {c.label}
                                                    </label>
                                                ))}
                                            </div>

                                            <label className="modal-field" style={{ gridColumn: '1 / -1' }}>
                                                <span>Описание позиции</span>
                                                <textarea value={customDesc} onChange={e => setCustomDesc(e.target.value)} />
                                            </label>

                                            <button className="modal-save-btn" onClick={savePosition}>
                                                {editingItemId ? 'Сохранить изменения' : 'Добавить в заказ'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                /* Произвольная позиция */
                                <div className="modal-form">
                                    <label className="modal-field"><span>Название позиции *</span>
                                        <input value={customItem.title} onChange={e => setCustomItem(p => ({...p, title: e.target.value}))} />
                                    </label>
                                    <label className="modal-field"><span>Цена за единицу (сом) *</span>
                                        <input type="number" value={customItem.price} onChange={e => setCustomItem(p => ({...p, price: e.target.value}))} />
                                    </label>
                                    <label className="modal-field"><span>Количество</span>
                                        <input type="number" value={customItem.quantity} onChange={e => setCustomItem(p => ({...p, quantity: e.target.value}))} />
                                    </label>
                                    <label className="modal-field" style={{gridColumn: '1/-1'}}>
                                        <span>Описание</span>
                                        <textarea value={customItem.description} onChange={e => setCustomItem(p => ({...p, description: e.target.value}))} />
                                    </label>

                                    <button className="modal-save-btn" onClick={savePosition}>
                                        {editingItemId ? 'Сохранить изменения' : 'Добавить в заказ'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Список позиций */}
                <div className="placing_an_order__title-row">
                    <h3>Состав заказа ({order.positions.length})</h3>
                    <strong>Итого: {calculateTotal().toLocaleString()} сом</strong>
                </div>

                <div className="placing_an_order__list">
                    {order.positions.length === 0 ? (
                        <p style={{ textAlign: 'center', padding: '80px 20px', color: '#6b7280', fontSize: '18px' }}>
                            Пока нет позиций в заказе. Добавьте первую.
                        </p>
                    ) : (
                        order.positions.map(item => (
                            <article key={item.id} className="placing_an_order__item-card">
                                {item.img && <img src={item.img} alt={item.title} />}
                                <div className="placing_an_order__item-details">
                                    <h4>{item.title}</h4>
                                    {item.description && <p><span>Описание</span> {item.description}</p>}
                                    <p><span>Цена</span> {item.price.toLocaleString()} × {item.quantity} = <b>{item.totalPrice.toLocaleString()} сом</b></p>

                                    <div className="placing_an_order__item-actions">
                                        <button type="button" onClick={() => openModal(item.isCustom ? 'custom' : 'catalog', item)}>
                                            Изменить
                                        </button>
                                        <button className="placing_an_order__delete" onClick={() => removePosition(item.id)}>
                                            Удалить
                                        </button>
                                    </div>
                                </div>
                            </article>
                        ))
                    )}
                </div>

                <div className="placing_an_order__footer-actions">
                    <button className="placing_an_order__draft" onClick={() => saveOrder(true)}>
                        Сохранить как черновик
                    </button>
                    <button className="placing_an_order__submit" onClick={() => saveOrder(false)}>
                        Оформить заказ
                    </button>
                </div>
            </div>
        </section>
    );
};

export default PlacingAnOrder;