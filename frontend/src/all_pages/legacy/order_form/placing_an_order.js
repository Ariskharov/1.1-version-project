import React, { useState, useEffect, useMemo, useContext } from 'react';
import { createPortal } from 'react-dom';
import { evaluate } from 'mathjs';
import { useNavigate } from 'react-router-dom';
import './placing_an_order.scss';
import { CustomContext } from '../../../Context';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import { useCatalogTheme } from '../../../context/CatalogThemeContext';
import { uploadPhoto } from '../../../utils/uploadService';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8080';

const PlacingAnOrder = () => {
    const navigate = useNavigate();
    const { resolvedTheme } = useCatalogTheme();
    const { showToast, confirm } = useContext(CustomContext);

    const [order, setOrder] = useState({
        name_client: '',
        name_compony: '',
        address: '',
        phone: '',
        email: '',
        order_note: '',
        positions: []
    });

    const [modalOpen, setModalOpen] = useState(false);
    const [modalType, setModalType] = useState('catalog'); // 'catalog' | 'custom'
    const [editingItemId, setEditingItemId] = useState(null); // ID редактируемой позиции
    const [productSearch, setProductSearch] = useState(''); // поиск в каталоге модалки

    // Защита от повторных нажатий
    const [isSaving, setIsSaving] = useState(false);

    // Для отслеживания изменений и автосохранения
    const [isDirty, setIsDirty] = useState(false);
    const [lastSaved, setLastSaved] = useState(null);

    // Скидка на весь заказ (в процентах)
    const [discountPercent, setDiscountPercent] = useState(0);

    // Для каталога
    const [products, setProducts] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [inputs, setInputs] = useState({});
    const [customDesc, setCustomDesc] = useState('');

    // Простые текстовые поля для цветов (вместо сложного выбора палитры)
    const [bodyColor, setBodyColor] = useState('');     // Цвет корпуса
    const [facadeColor, setFacadeColor] = useState(''); // Цвет фасадов

    // Для произвольной позиции
    const [customItem, setCustomItem] = useState({
        title: '',
        price: '',
        quantity: 1,
        description: ''
    });

    // Фильтрованные продукты для модалки (зависит от поиска)
    const filteredProducts = useMemo(() => {
        if (!productSearch.trim()) return products;
        const q = productSearch.toLowerCase().trim();
        return products.filter(p => p.title && p.title.toLowerCase().includes(q));
    }, [products, productSearch]);

    const DRAFT_KEY = 'order_draft';

    // Загрузка черновика из localStorage при монтировании
    useEffect(() => {
        const savedDraft = localStorage.getItem(DRAFT_KEY);
        if (savedDraft) {
            try {
                const parsed = JSON.parse(savedDraft);
                setOrder(parsed);
                setLastSaved(new Date());
            } catch (e) {
                console.warn('Не удалось загрузить черновик заказа');
            }
        }
    }, []);

    // Автосохранение черновика при изменении заказа
    useEffect(() => {
        if (order.positions.length > 0 || order.name_client || order.name_compony) {
            const timeout = setTimeout(() => {
                localStorage.setItem(DRAFT_KEY, JSON.stringify(order));
                setLastSaved(new Date());
                setIsDirty(true);
            }, 800);

            return () => clearTimeout(timeout);
        }
    }, [order]);

    // Предупреждение при уходе со страницы
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (isDirty && order.positions.length > 0) {
                e.preventDefault();
                e.returnValue = '';
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isDirty, order.positions.length]);

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

        // Сброс цветов при смене товара
        setBodyColor('');
        setFacadeColor('');
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
                    description: itemToEdit.description || '',
                    img: itemToEdit.img || ''
                });
                // Цвета для произвольных позиций не используются (есть описание)
                setBodyColor('');
                setFacadeColor('');
            } else {
                // Для товаров из каталога
                setSelectedProduct(products.find(p => p.id === itemToEdit.productId) || null);
                setInputs({ ...itemToEdit.userInputs });
                setCustomDesc(itemToEdit.description || '');

                // Загружаем простые цвета (с поддержкой старых colorSelection из черновиков)
                if (itemToEdit.bodyColor || itemToEdit.facadeColor) {
                    setBodyColor(itemToEdit.bodyColor || '');
                    setFacadeColor(itemToEdit.facadeColor || '');
                } else if (itemToEdit.colorSelection) {
                    const cs = itemToEdit.colorSelection;
                    if (cs.mode === 'unified' && cs.unified?.name) {
                        setBodyColor(cs.unified.name);
                        setFacadeColor(cs.unified.name);
                    } else {
                        setBodyColor(cs.body?.name || '');
                        setFacadeColor(cs.facade?.name || '');
                    }
                } else {
                    setBodyColor('');
                    setFacadeColor('');
                }
            }
        } else {
            setEditingItemId(null);
            setSelectedProduct(null);
            setInputs({});
            setCustomDesc('');
            setCustomItem({ title: '', price: '', quantity: 1, description: '', img: '' });
            setBodyColor('');
            setFacadeColor('');
            if (type === 'catalog') setProductSearch('');
        }
    };

    const closeModal = () => {
        setModalOpen(false);
        setEditingItemId(null);
        setSelectedProduct(null);
        setInputs({});
        setCustomDesc('');
        setCustomItem({ title: '', price: '', quantity: 1, description: '', img: '' });
        setBodyColor('');
        setFacadeColor('');
        setProductSearch('');
    };

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
                details: selectedProduct.details,
                // Простые названия цветов (вместо сложного выбора)
                bodyColor: (bodyColor || '').trim(),
                facadeColor: (facadeColor || '').trim()
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
                showToast('error', 'Укажите название и цену позиции');
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
                img: customItem.img || null
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

    const removePosition = async (id) => {
        const confirmed = await confirm({
            message: 'Удалить эту позицию?',
            confirmLabel: 'Удалить',
            danger: true,
        });
        if (!confirmed) return;

        setOrder(prev => ({
            ...prev,
            positions: prev.positions.filter(item => item.id !== id)
        }));
        setIsDirty(true);
    };

    const duplicatePosition = (item) => {
        const duplicated = {
            ...item,
            id: Date.now(),
            title: item.title + ' (копия)',
            // Убираем старые сложные данные по цвету
            colorSelection: undefined
        };

        setOrder(prev => ({
            ...prev,
            positions: [...prev.positions, duplicated]
        }));
        setIsDirty(true);
    };

    // Очистка всей формы
    const clearForm = async () => {
        const confirmed = await confirm({
            message: 'Очистить всю форму? Все несохранённые данные будут потеряны.',
            confirmLabel: 'Очистить',
            danger: true,
        });
        if (!confirmed) return;

        setOrder({
            name_client: '',
            name_compony: '',
            address: '',
            phone: '',
            email: '',
            order_note: '',
            positions: []
        });
        setDiscountPercent(0);
        localStorage.removeItem(DRAFT_KEY);
        setIsDirty(false);
        setLastSaved(null);
        showToast('success', 'Форма очищена');
    };

    const handleOrderChange = (field, value) => {
        setOrder(prev => ({ ...prev, [field]: value }));
        setIsDirty(true);
    };

    const calculateTotal = () => {
        const subtotal = order.positions.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
        if (discountPercent > 0) {
            return Math.round(subtotal * (1 - discountPercent / 100));
        }
        return subtotal;
    };

    const getSubtotal = () => {
        return order.positions.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
    };

    // Валидация заказа перед сохранением
    const validateOrder = () => {
        const errors = [];

        if (!order.name_client.trim()) {
            errors.push('Укажите ФИО клиента');
        }
        if (!order.phone.trim()) {
            errors.push('Укажите телефон клиента');
        }
        if (order.positions.length === 0) {
            errors.push('Добавьте хотя бы одну позицию в заказ');
        }

        return errors;
    };

    const saveOrder = async (asDraft = false) => {
        if (isSaving) return;

        // Валидация перед сохранением
        const validationErrors = validateOrder();
        if (validationErrors.length > 0) {
            showToast('error', validationErrors.join('. '));
            return;
        }

        setIsSaving(true);

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

            if (!asDraft) {
                localStorage.removeItem(DRAFT_KEY);
                setIsDirty(false);
                if (createdId) {
                    navigate(`/order/${createdId}`);
                    return;
                }
            } else {
                setIsDirty(false);
            }

            showToast('success', asDraft ? 'Черновик успешно сохранён' : 'Заказ успешно оформлен!');
        } catch (err) {
            showToast('error', 'Ошибка сохранения: ' + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const paoClassName = (extra = '') =>
        ['placing_an_order', `placing_an_order--theme-${resolvedTheme}`, extra].filter(Boolean).join(' ');

    const paoModalClassName = () =>
        ['pao-modal', `pao-modal--theme-${resolvedTheme}`].join(' ');

    return (
        <section className={paoClassName()}>
            <div className="pao-ambient" aria-hidden="true">
                <div className="pao-ambient__orb pao-ambient__orb--1" />
                <div className="pao-ambient__orb pao-ambient__orb--2" />
                <div className="pao-ambient__grain" />
            </div>

            <div className="placing_an_order__content">
                <header className="placing_an_order__hero">
                    <div className="placing_an_order__hero-intro">
                        <span className="placing_an_order__badge">Новый заказ</span>
                        <h1 className="placing_an_order__hero-title">Оформление заказа</h1>
                    </div>

                    <div className="placing_an_order__summary">
                        <div className="placing_an_order__summary-item">
                            <div className="placing_an_order__summary-label">Позиций</div>
                            <div className="placing_an_order__summary-value">{order.positions.length}</div>
                        </div>
                        <div className="placing_an_order__summary-item placing_an_order__summary-item--discount">
                            <div className="placing_an_order__summary-label">Скидка %</div>
                            <input
                                className="placing_an_order__discount-input"
                                type="number"
                                min="0"
                                max="100"
                                value={discountPercent}
                                onChange={e => {
                                    const val = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                                    setDiscountPercent(val);
                                    setIsDirty(true);
                                }}
                                placeholder="0"
                            />
                        </div>
                        <div className="placing_an_order__summary-item">
                            <div className="placing_an_order__summary-label">Итого</div>
                            <div className="placing_an_order__summary-value">{calculateTotal().toLocaleString()} сом</div>
                        </div>
                    </div>
                </header>

                {lastSaved && (
                    <p className="placing_an_order__autosave" role="status">
                        Черновик сохранён локально · {lastSaved.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                )}
                <article className="placing_an_order__info-card">
                    <h2 className="placing_an_order__section-title">Данные клиента</h2>
                    <p className="placing_an_order__section-subtitle">
                        Основные контакты для заказа. Реквизиты для договора заполняются позже в редакторе.
                    </p>

                    <div className="placing_an_order__fields">
                        <label className="placing_an_order__field">
                            <span>ФИО клиента *</span>
                            <input
                                value={order.name_client}
                                onChange={e => handleOrderChange('name_client', e.target.value)}
                                placeholder="Иванов Иван Иванович"
                            />
                        </label>
                        <label className="placing_an_order__field">
                            <span>Организация</span>
                            <input
                                value={order.name_compony}
                                onChange={e => handleOrderChange('name_compony', e.target.value)}
                                placeholder='МП "...", ОсОО "..."'
                            />
                        </label>
                        <label className="placing_an_order__field">
                            <span>Телефон *</span>
                            <input
                                value={order.phone}
                                onChange={e => handleOrderChange('phone', e.target.value)}
                                placeholder="+996 ..."
                            />
                        </label>
                        <label className="placing_an_order__field">
                            <span>Email</span>
                            <input
                                type="email"
                                value={order.email}
                                onChange={e => handleOrderChange('email', e.target.value)}
                                placeholder="client@example.com"
                            />
                        </label>
                        <label className="placing_an_order__field placing_an_order__field--full">
                            <span>Адрес</span>
                            <input
                                value={order.address}
                                onChange={e => handleOrderChange('address', e.target.value)}
                                placeholder="Юридический или фактический адрес"
                            />
                        </label>
                        <label className="placing_an_order__field placing_an_order__field--full">
                            <span>Примечание к заказу</span>
                            <textarea
                                value={order.order_note}
                                onChange={e => handleOrderChange('order_note', e.target.value)}
                                placeholder="Пожелания, сроки, особые условия..."
                            />
                        </label>
                    </div>
                </article>

                <div className="placing_an_order__add-wrap">
                    <button type="button" className="placing_an_order__add-button placing_an_order__add-button--catalog" onClick={() => openModal('catalog')}>
                        ＋ Добавить из каталога
                    </button>
                    <button type="button" className="placing_an_order__add-button placing_an_order__add-button--custom" onClick={() => openModal('custom')}>
                        ＋ Добавить произвольную позицию
                    </button>
                </div>

                {/* Модальное окно (portal — избегаем конфликтов глобальных стилей) */}
                {modalOpen && createPortal(
                    <div className={paoModalClassName()} role="dialog" aria-modal="true">
                        <div className="pao-modal__overlay" onClick={closeModal}>
                            <div className="pao-modal__dialog" onClick={e => e.stopPropagation()}>
                                <div className="pao-modal__header">
                                    <h3>
                                        {editingItemId ? 'Редактирование позиции' :
                                            modalType === 'catalog' ? 'Добавить из каталога' : 'Новая произвольная позиция'}
                                    </h3>
                                    <button type="button" className="pao-modal__close" onClick={closeModal} aria-label="Закрыть">×</button>
                                </div>

                                {modalType === 'catalog' ? (
                                    <div className="pao-modal__body pao-modal__body--catalog">
                                        <div className="pao-modal__search">
                                            <input
                                                type="text"
                                                placeholder="Поиск по названию мебели..."
                                                value={productSearch}
                                                onChange={(e) => setProductSearch(e.target.value)}
                                            />
                                            {productSearch && (
                                                <button
                                                    type="button"
                                                    className="pao-modal__search-clear"
                                                    onClick={() => setProductSearch('')}
                                                    title="Очистить поиск"
                                                >
                                                    ×
                                                </button>
                                            )}
                                        </div>

                                        <div className="pao-modal__split">
                                            <div className="pao-modal__products-pane">
                                                {filteredProducts.length === 0 ? (
                                                    <div className="pao-modal__products-empty">Ничего не найдено</div>
                                                ) : (
                                                    <div className="pao-modal__products-list">
                                                        {filteredProducts.map(p => {
                                                            const isActive = selectedProduct?.id === p.id;
                                                            const price = p.price ? `${Number(p.price).toLocaleString()} сом` : '';
                                                            return (
                                                                <div
                                                                    key={p.id}
                                                                    className={`pao-modal__catalog-card${isActive ? ' is-active' : ''}`}
                                                                    onClick={() => setSelectedProduct(p)}
                                                                    role="button"
                                                                    tabIndex={0}
                                                                    onKeyDown={(e) => e.key === 'Enter' && setSelectedProduct(p)}
                                                                >
                                                                    <div className="pao-modal__catalog-card-img">
                                                                        {p.img ? <img src={p.img} alt={p.title} /> : <div className="pao-modal__catalog-card-placeholder">🪑</div>}
                                                                    </div>
                                                                    <div className="pao-modal__catalog-card-info">
                                                                        <div className="pao-modal__catalog-card-title">{p.title}</div>
                                                                        {price && <div className="pao-modal__catalog-card-price">{price}</div>}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="pao-modal__config-pane">
                                                {selectedProduct ? (
                                                    <div className="pao-modal__config-content">
                                                        <div className="pao-modal__config-header">
                                                            <h4>{selectedProduct.title}</h4>
                                                            {selectedProduct.price && (
                                                                <div className="pao-modal__config-price">{Number(selectedProduct.price).toLocaleString()} сом / шт</div>
                                                            )}
                                                        </div>

                                                        {(selectedProduct.variables || []).length > 0 && (
                                                            <div className="pao-modal__config-section">
                                                                <div className="pao-modal__section-label">Параметры</div>
                                                                <div className="pao-modal__inputs">
                                                                    {(selectedProduct.variables || []).map(v => (
                                                                        <label key={v.name} className="pao-modal__field">
                                                                            <span>{v.label}</span>
                                                                            <input
                                                                                type="number"
                                                                                value={inputs[v.name] ?? ''}
                                                                                onChange={e => setInputs(prev => ({ ...prev, [v.name]: e.target.value }))}
                                                                            />
                                                                        </label>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {(selectedProduct.conditions || []).some(c => c.type === 'flag') && (
                                                            <div className="pao-modal__config-section">
                                                                <div className="pao-modal__section-label">Опции</div>
                                                                <div className="pao-modal__checkboxes">
                                                                    {(selectedProduct.conditions || []).map(c => c.type === 'flag' && (
                                                                        <label key={c.name} className="pao-modal__checkbox">
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={!!inputs[c.name]}
                                                                                onChange={() => setInputs(prev => ({ ...prev, [c.name]: !prev[c.name] }))}
                                                                            />
                                                                            {c.label}
                                                                        </label>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        <div className="pao-modal__config-section">
                                                            <div className="pao-modal__section-label">Цвета</div>
                                                            <div className="pao-modal__colors-row">
                                                                <label className="pao-modal__field">
                                                                    <span>Цвет корпуса</span>
                                                                    <input
                                                                        value={bodyColor}
                                                                        onChange={e => setBodyColor(e.target.value)}
                                                                        placeholder="Дуб Сонома, Венге..."
                                                                    />
                                                                </label>
                                                                <label className="pao-modal__field">
                                                                    <span>Цвет фасадов</span>
                                                                    <input
                                                                        value={facadeColor}
                                                                        onChange={e => setFacadeColor(e.target.value)}
                                                                        placeholder="Белый, ЛДСП..."
                                                                    />
                                                                </label>
                                                            </div>
                                                        </div>

                                                        <div className="pao-modal__config-section">
                                                            <label className="pao-modal__field">
                                                                <span>Описание позиции / примечание</span>
                                                                <textarea
                                                                    value={customDesc}
                                                                    onChange={e => setCustomDesc(e.target.value)}
                                                                    placeholder="Дополнительные пожелания..."
                                                                />
                                                            </label>
                                                        </div>

                                                        <div className="pao-modal__config-actions">
                                                            {editingItemId && (
                                                                <button
                                                                    type="button"
                                                                    className="pao-modal__delete-btn"
                                                                    onClick={async () => {
                                                                        const confirmed = await confirm({
                                                                            message: 'Удалить эту позицию из заказа?',
                                                                            confirmLabel: 'Удалить',
                                                                            danger: true,
                                                                        });
                                                                        if (!confirmed) return;
                                                                        await removePosition(editingItemId);
                                                                        closeModal();
                                                                    }}
                                                                >
                                                                    Удалить позицию
                                                                </button>
                                                            )}

                                                            <button type="button" className="pao-modal__save-btn" onClick={savePosition}>
                                                                {editingItemId ? 'Сохранить изменения' : 'Добавить в заказ'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="pao-modal__config-placeholder">
                                                        <div className="pao-modal__placeholder-icon">🛠️</div>
                                                        <p>Выберите позицию слева</p>
                                                        <small>Настройте размеры, цвета и описание выбранной мебели</small>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="pao-modal__body">
                                        <div className="pao-modal__form">
                                            <div className="pao-modal__form-row">
                                                <label className="pao-modal__field">
                                                    <span>Название позиции *</span>
                                                    <input
                                                        value={customItem.title}
                                                        onChange={e => setCustomItem(p => ({ ...p, title: e.target.value }))}
                                                        placeholder="Например: Стол обеденный"
                                                    />
                                                </label>
                                                <label className="pao-modal__field">
                                                    <span>Цена за единицу (сом) *</span>
                                                    <input
                                                        type="number"
                                                        value={customItem.price}
                                                        onChange={e => setCustomItem(p => ({ ...p, price: e.target.value }))}
                                                    />
                                                </label>
                                            </div>

                                            <div className="pao-modal__form-row">
                                                <label className="pao-modal__field">
                                                    <span>Количество</span>
                                                    <input
                                                        type="number"
                                                        value={customItem.quantity}
                                                        onChange={e => setCustomItem(p => ({ ...p, quantity: e.target.value }))}
                                                    />
                                                </label>
                                            </div>

                                            <label className="pao-modal__field pao-modal__field--full">
                                                <span>Описание / примечание</span>
                                                <textarea
                                                    value={customItem.description}
                                                    onChange={e => setCustomItem(p => ({ ...p, description: e.target.value }))}
                                                    placeholder="Дополнительная информация о позиции..."
                                                />
                                            </label>

                                            <label className="pao-modal__field pao-modal__field--full">
                                                <span>Фотография позиции</span>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={async (e) => {
                                                        const file = e.target.files[0];
                                                        if (!file) return;
                                                        try {
                                                            const path = await uploadPhoto(file);
                                                            setCustomItem(p => ({ ...p, img: path }));
                                                            showToast('success', 'Фото позиции загружено');
                                                        } catch (err) {
                                                            showToast('error', 'Ошибка загрузки фото: ' + err.message);
                                                        }
                                                    }}
                                                />
                                                {customItem.img && (
                                                    <div style={{ marginTop: '8px', color: '#4ade80', fontSize: '13px' }}>
                                                        ✓ Фото прикреплено ({customItem.img})
                                                    </div>
                                                )}
                                            </label>

                                            <button type="button" className="pao-modal__save-btn pao-modal__save-btn--spaced" onClick={savePosition}>
                                                {editingItemId ? 'Сохранить изменения' : 'Добавить в заказ'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>,
                    document.body
                )}

                {/* Список позиций */}
                <div className="placing_an_order__title-row">
                    <h3>Состав заказа ({order.positions.length})</h3>
                    <div className="total-line">
                        {discountPercent > 0 && (
                            <span className="placing_an_order__discount-note">
                                Без скидки: {getSubtotal().toLocaleString()} сом (−{discountPercent}%)
                            </span>
                        )}
                        <strong>Итого: {calculateTotal().toLocaleString()} сом</strong>
                    </div>
                </div>

                <div className="placing_an_order__list">
                    {order.positions.length === 0 ? (
                        <div className="placing_an_order__empty-state">
                            <span className="icon">🛋️</span>
                            <p>Пока нет позиций в заказе</p>
                            <small>Добавьте мебель из каталога или создайте произвольную позицию</small>
                        </div>
                    ) : (
                        order.positions.map((item, index) => (
                            <article
                                key={item.id}
                                className="placing_an_order__item-card"
                                style={{ animationDelay: `${Math.min(index * 0.05, 0.35)}s` }}
                            >
                                {item.img && <img src={item.img} alt={item.title} />}
                                <div className="placing_an_order__item-details">
                                    <h4>{item.title}</h4>
                                    {item.description && (
                                        <div className="meta"><span>Описание</span> {item.description}</div>
                                    )}

                                    {/* Простое отображение названий цветов (корпус / фасады) */}
                                    {item.bodyColor && (
                                        <div className="meta"><span>Цвет корпуса</span> {item.bodyColor}</div>
                                    )}
                                    {item.facadeColor && (
                                        <div className="meta"><span>Цвет фасадов</span> {item.facadeColor}</div>
                                    )}

                                    <div className="price-row">
                                        {item.price.toLocaleString()} × {item.quantity} = <b>{item.totalPrice.toLocaleString()} сом</b>
                                    </div>

                                    <div className="placing_an_order__item-actions">
                                        <button type="button" onClick={() => openModal(item.isCustom ? 'custom' : 'catalog', item)}>
                                            Изменить
                                        </button>
                                        <button type="button" onClick={() => duplicatePosition(item)}>
                                            Дублировать
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
                    <button 
                        className="placing_an_order__clear" 
                        onClick={clearForm}
                        disabled={isSaving || (order.positions.length === 0 && !order.name_client)}
                    >
                        Очистить форму
                    </button>

                    <button 
                        className="placing_an_order__draft" 
                        onClick={() => saveOrder(true)}
                        disabled={isSaving}
                    >
                        {isSaving ? <><LoadingSpinner size="sm" /> Сохранение...</> : 'Сохранить как черновик'}
                    </button>
                    <button 
                        className="placing_an_order__submit" 
                        onClick={() => saveOrder(false)}
                        disabled={isSaving}
                    >
                        {isSaving ? <><LoadingSpinner size="sm" light /> Оформление...</> : 'Оформить заказ'}
                    </button>
                </div>
            </div>

        </section>
    );
};

export default PlacingAnOrder;