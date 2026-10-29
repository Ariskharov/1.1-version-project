import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { API_BASE, resolveImageUrl } from '../../config/api';
import { useCatalogTheme } from '../../context/CatalogThemeContext';
import { CustomContext } from '../../Context';
import { useDialogA11y } from '../../hooks/useDialogA11y';
import '../legacy/order_form/placing_an_order.scss';
import PhotoUploadSlot from '../../components/ui/PhotoUploadSlot';
import { uploadPhoto } from '../../utils/uploadService';
import { evaluateReady } from '../../utils/formulaEval';
import {
    buildCatalogPosition,
    calculatePositionDetails,
    clearClientRequest,
    parseMoney,
    readClientRequest,
    writeClientRequest,
} from '../../utils/orderConvenience';
import './request.scss';

const emptyForm = () => ({
    name_client: '',
    phone: '',
    name_compony: '',
    address: '',
    email: '',
    order_note: '',
    positions: [],
});

const emptyCustom = () => ({ title: '', description: '', quantity: 1, img: '' });

const asText = (value) => (typeof value === 'string' ? value : value == null ? '' : String(value));

const clampQty = (value) => Math.min(999, Math.max(1, Math.round(Number(value) || 1)));

const normalizeForm = (draft) => {
    const source = draft && typeof draft === 'object' ? draft : {};
    const positions = Array.isArray(source.positions) ? source.positions : [];
    return {
        ...emptyForm(),
        name_client: asText(source.name_client),
        phone: asText(source.phone),
        name_compony: asText(source.name_compony),
        address: asText(source.address),
        email: asText(source.email),
        order_note: asText(source.order_note),
        positions: positions.filter((item) => item && typeof item === 'object').map((item, index) => ({
            ...item,
            id: item.id != null && item.id !== '' ? item.id : `draft-${index}`,
            title: asText(item.title),
            description: asText(item.description),
            quantity: clampQty(item.quantity),
        })),
    };
};

const norm = (value) => String(value || '').toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').trim();

const money = (value) => `${Number(value || 0).toLocaleString('ru-RU')} сом`;

const piecesLabel = (count) => {
    const n10 = count % 10;
    const n100 = count % 100;
    if (n10 === 1 && n100 !== 11) return 'изделие';
    if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return 'изделия';
    return 'изделий';
};

const detailText = (item) => (item.calculatedDetails || [])
    .slice(0, 3)
    .map((detail) => [detail.label, detail.size].filter(Boolean).join(': '))
    .filter(Boolean)
    .join(' · ');

const colorText = (item) => [
    item.bodyColor ? `Корпус: ${item.bodyColor}` : '',
    item.facadeColor ? `Фасады: ${item.facadeColor}` : '',
].filter(Boolean).join(' · ');

const hasCollVariable = (product) => (product?.variables || []).some((variable) => variable.name === 'coll');

const initInputs = (product, saved) => {
    const init = {};
    (product?.variables || []).forEach((variable) => {
        init[variable.name] = variable.default ?? '';
    });
    (product?.conditions || []).forEach((condition) => {
        if (condition.type === 'flag') init[condition.name] = !!condition.default;
    });
    if (saved && typeof saved === 'object') {
        Object.entries(saved).forEach(([key, value]) => {
            init[key] = value;
        });
    }
    if (init.coll == null || init.coll === '') init.coll = 1;
    return init;
};

const publicPosition = (item) => {
    const position = {
        productId: item.isCustom ? null : (item.productId || null),
        title: item.title || '',
        quantity: item.quantity || 1,
        description: item.description || '',
        userInputs: item.userInputs || {},
        calculatedDetails: item.calculatedDetails || [],
        bodyColor: item.bodyColor || '',
        facadeColor: item.facadeColor || '',
    };
    if (item.isCustom) position.img = item.img || null;
    return position;
};

function Photo({ src, title }) {
    const photo = resolveImageUrl(src);
    if (photo) return <img src={photo} alt="" />;
    return <span className="client-request__no-photo" aria-hidden="true">{(title || '◇').slice(0, 1)}</span>;
}

const ClientRequest = () => {
    const { resolvedTheme } = useCatalogTheme();
    const { showToast, confirm, currentUser, products, dataLoaded } = useContext(CustomContext);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [form, setForm] = useState(() => normalizeForm(readClientRequest()));
    const [customItem, setCustomItem] = useState(emptyCustom);
    const [customError, setCustomError] = useState('');
    const [fieldErrors, setFieldErrors] = useState({});
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const [created, setCreated] = useState(null);
    const [copied, setCopied] = useState('');
    const [trap, setTrap] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [modalType, setModalType] = useState('catalog');
    const [editingItemId, setEditingItemId] = useState(null);
    const [productSearch, setProductSearch] = useState('');
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [inputs, setInputs] = useState({});
    const [customDesc, setCustomDesc] = useState('');
    const [bodyColor, setBodyColor] = useState('');
    const [facadeColor, setFacadeColor] = useState('');
    const [calcReady, setCalcReady] = useState(false);
    const trapRef = useRef(null);
    const nameRef = useRef(null);
    const phoneRef = useRef(null);
    const emailRef = useRef(null);
    const noteRef = useRef(null);
    const listRef = useRef(null);
    const addModalRef = useRef(null);
    const openedFromQuery = useRef(false);

    const pageLink = typeof window !== 'undefined' ? `${window.location.origin}/zayavka` : '/zayavka';
    const catalog = useMemo(
        () => (Array.isArray(products) ? products.filter(Boolean) : []),
        [products]
    );

    useEffect(() => {
        let active = true;
        evaluateReady
            .then(() => { if (active) setCalcReady(true); })
            .catch(() => {});
        return () => { active = false; };
    }, []);

    useEffect(() => {
        if (created) return;
        writeClientRequest(form);
    }, [form, created]);

    const closeModal = useCallback(() => {
        setModalOpen(false);
        setEditingItemId(null);
        setSelectedProduct(null);
        setInputs({});
        setCustomDesc('');
        setBodyColor('');
        setFacadeColor('');
        setProductSearch('');
        setCustomItem(emptyCustom());
        setCustomError('');
    }, []);

    useDialogA11y(modalOpen, closeModal, addModalRef);

    const selectCatalogProduct = (product, savedItem = null) => {
        setSelectedProduct(product);
        setInputs(initInputs(product, savedItem?.userInputs));
        setCustomDesc(savedItem?.description || '');
        setBodyColor(savedItem?.bodyColor || '');
        setFacadeColor(savedItem?.facadeColor || '');
    };

    const openModal = (type, itemToEdit = null) => {
        setCustomError('');
        setProductSearch('');
        if (itemToEdit && !itemToEdit.isCustom) {
            const product = catalog.find((item) => Number(item.id) === Number(itemToEdit.productId));
            if (!product) {
                showToast?.('error', 'Этого изделия уже нет в каталоге. Добавьте его как своё.');
                return;
            }
            setModalType('catalog');
            setEditingItemId(itemToEdit.id);
            selectCatalogProduct(product, itemToEdit);
            setModalOpen(true);
            return;
        }
        setModalType(type);
        setModalOpen(true);
        setSelectedProduct(null);
        setInputs({});
        setCustomDesc('');
        setBodyColor('');
        setFacadeColor('');
        if (itemToEdit) {
            setEditingItemId(itemToEdit.id);
            setCustomItem({
                title: itemToEdit.title || '',
                description: itemToEdit.description || '',
                quantity: clampQty(itemToEdit.quantity),
                img: itemToEdit.img || '',
            });
            return;
        }
        setEditingItemId(null);
        setCustomItem(emptyCustom());
    };

    useEffect(() => {
        const productId = Number(searchParams.get('product'));
        if (!productId || !catalog.length || openedFromQuery.current) return;
        const product = catalog.find((item) => Number(item.id) === productId);
        if (!product) return;
        openedFromQuery.current = true;
        setModalType('catalog');
        setEditingItemId(null);
        setCustomItem(emptyCustom());
        selectCatalogProduct(product);
        setModalOpen(true);
        navigate('/zayavka', { replace: true });
    }, [catalog, searchParams, navigate]);

    const filteredProducts = useMemo(() => {
        const needle = norm(productSearch);
        if (!needle) return catalog;
        return catalog.filter((product) => norm(product.title).includes(needle));
    }, [catalog, productSearch]);

    const previewDetails = useMemo(() => {
        if (!calcReady || !selectedProduct) return [];
        try {
            return calculatePositionDetails(selectedProduct, inputs);
        } catch {
            return [];
        }
    }, [calcReady, selectedProduct, inputs]);

    const estimate = useMemo(
        () => form.positions.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1), 0),
        [form.positions]
    );

    const contactsReady = form.name_client.trim().length >= 2 && form.phone.replace(/\D/g, '').length >= 6;
    const itemsReady = form.positions.length > 0 || form.order_note.trim().length >= 5;
    const catalogLoading = !dataLoaded && catalog.length === 0;
    const catalogEmpty = dataLoaded && catalog.length === 0;

    const setField = (field, value) => {
        setForm((prev) => ({ ...prev, [field]: value }));
        setFieldErrors((prev) => (prev[field] ? { ...prev, [field]: '' } : prev));
        setError('');
    };

    const putPosition = (position) => {
        setForm((prev) => ({
            ...prev,
            positions: editingItemId
                ? prev.positions.map((item) => (item.id === editingItemId ? position : item))
                : [...prev.positions, position],
        }));
        setFieldErrors((prev) => (prev.order_note ? { ...prev, order_note: '' } : prev));
        setError('');
        closeModal();
    };

    const savePosition = async () => {
        if (modalType === 'catalog') {
            if (!selectedProduct) {
                showToast?.('error', 'Выберите изделие слева');
                return;
            }
            try {
                await evaluateReady;
            } catch {
                showToast?.('error', 'Не удалось рассчитать размеры');
                return;
            }
            const quantity = clampQty(inputs.coll);
            const nextInputs = { ...inputs, coll: quantity };
            let details = [];
            try {
                details = calculatePositionDetails(selectedProduct, nextInputs);
            } catch {
                showToast?.('error', 'Не удалось рассчитать размеры');
                return;
            }
            const position = buildCatalogPosition(selectedProduct, nextInputs, details);
            putPosition({
                ...position,
                id: editingItemId || position.id,
                description: customDesc.trim(),
                bodyColor: bodyColor.trim(),
                facadeColor: facadeColor.trim(),
            });
            return;
        }

        const title = customItem.title.trim();
        if (!title) {
            setCustomError('Напишите, какое изделие нужно');
            return;
        }
        const quantity = clampQty(customItem.quantity);
        putPosition({
            id: editingItemId || `${Date.now()}-custom-${Math.random().toString(36).slice(2, 7)}`,
            isCustom: true,
            title,
            description: customItem.description.trim(),
            quantity,
            price: 0,
            totalPrice: 0,
            img: customItem.img || null,
        });
    };

    const removePosition = async (id) => {
        const confirmed = await confirm?.({
            message: 'Удалить эту позицию из заявки?',
            confirmLabel: 'Удалить',
            danger: true,
        });
        if (!confirmed) return false;
        setForm((prev) => ({ ...prev, positions: prev.positions.filter((item) => item.id !== id) }));
        return true;
    };

    const copyText = async (text, key) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(key);
            window.setTimeout(() => setCopied(''), 2000);
        } catch {
            showToast?.('error', 'Не удалось скопировать. Выделите ссылку и скопируйте её вручную.');
        }
    };

    const submit = async (event) => {
        event.preventDefault();
        if (saving) return;
        const next = {};
        if (form.name_client.trim().length < 2) next.name_client = 'Укажите имя';
        if (form.phone.replace(/\D/g, '').length < 6) next.phone = 'Укажите телефон';
        const email = form.email.trim();
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = 'Проверьте адрес почты';
        if (!form.positions.length && form.order_note.trim().length < 5) {
            next.order_note = 'Добавьте изделие или опишите, что нужно сделать';
        }
        setFieldErrors(next);
        const firstMessage = Object.values(next)[0] || '';
        setError(firstMessage);
        if (firstMessage) {
            const target = next.name_client ? nameRef : next.phone ? phoneRef : next.email ? emailRef : noteRef;
            target.current?.focus();
            target.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        setSaving(true);
        try {
            const trapValue = trapRef.current?.value || trap;
            const res = await fetch(`${API_BASE}/order-request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name_client: form.name_client,
                    phone: form.phone,
                    name_compony: form.name_compony,
                    address: form.address,
                    email: form.email,
                    order_note: form.order_note,
                    positions: form.positions.map(publicPosition),
                    company_url_confirm: trapValue,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Не удалось отправить заявку');
            clearClientRequest();
            if (!data.id) {
                setCreated({ id: null, link: '' });
                return;
            }
            setCreated({
                id: data.id,
                link: `${window.location.origin}/order/${data.id}`,
            });
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const startAnother = () => {
        closeModal();
        setCreated(null);
        setForm(emptyForm());
        setFieldErrors({});
        setError('');
        setCopied('');
        setTrap('');
    };

    const scrollTo = (ref) => {
        ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const canShare = Boolean(currentUser && currentUser.role !== 'scanner');
    const pageClass = ['client-request', `client-request--theme-${resolvedTheme}`].join(' ');
    const modalClass = ['pao-modal', `pao-modal--theme-${resolvedTheme}`].join(' ');

    return (
        <section className={pageClass}>
            <div className="client-request__ambient" aria-hidden="true">
                <span className="client-request__orb client-request__orb--1" />
                <span className="client-request__orb client-request__orb--2" />
            </div>

            {created ? (
                <div className="client-request__card client-request__card--success">
                    <p className="client-request__badge">Заявка принята</p>
                    <h1>{created.id ? `Заявка №${created.id}` : 'Мы получили заявку'}</h1>
                    <p>
                        {created.id
                            ? 'Мы свяжемся с вами по телефону. Сохраните ссылку: по ней открывается эта заявка, вход не нужен.'
                            : 'Мы свяжемся с вами по телефону.'}
                    </p>
                    {created.id && (
                        <>
                            <label className="client-request__field">
                                <span className="client-request__label">Ссылка на заявку</span>
                                <input readOnly value={created.link} aria-label="Ссылка на заявку" />
                            </label>
                            <div className="client-request__actions">
                                <button type="button" className="client-request__primary" onClick={() => copyText(created.link, 'order')}>
                                    {copied === 'order' ? 'Ссылка скопирована' : 'Скопировать ссылку'}
                                </button>
                                <Link className="client-request__secondary" to={`/order/${created.id}`}>Открыть заявку</Link>
                            </div>
                        </>
                    )}
                    <button type="button" className="client-request__secondary client-request__another" onClick={startAnother}>
                        Новая заявка
                    </button>
                </div>
            ) : (
                <>
                    <header className="client-request__hero">
                        <p className="client-request__badge">Без регистрации</p>
                        <h1>Заявка на заказ</h1>
                        <p>
                            Напишите, как с вами связаться. Мебель выбирается из каталога: там же указываются размеры и цвета.
                            Своё изделие можно описать без цены — её посчитает сотрудник и перезвонит.
                            {canShare ? ' Эту страницу можно отправить клиенту.' : ''}
                        </p>
                        <div className="client-request__steps" aria-label="Шаги заявки">
                            <button type="button" className={contactsReady ? 'is-done' : ''} onClick={() => scrollTo(nameRef)}>
                                <b>1</b> Контакты
                            </button>
                            <button type="button" className={itemsReady ? 'is-done' : ''} onClick={() => scrollTo(listRef)}>
                                <b>2</b> Изделия
                            </button>
                            <button type="button" className={contactsReady && itemsReady ? 'is-done' : ''} onClick={() => scrollTo(noteRef)}>
                                <b>3</b> Отправка
                            </button>
                        </div>
                        {canShare && (
                            <div className="client-request__share">
                                <input readOnly value={pageLink} aria-label="Ссылка на страницу заявки" />
                                <button type="button" onClick={() => copyText(pageLink, 'page')}>
                                    {copied === 'page' ? 'Скопировано' : 'Скопировать ссылку'}
                                </button>
                            </div>
                        )}
                    </header>

                    <form className="client-request__form" onSubmit={submit} noValidate>
                        <input
                            ref={trapRef}
                            className="client-request__trap"
                            name="company_url_confirm"
                            tabIndex={-1}
                            autoComplete="off"
                            value={trap}
                            onChange={(event) => setTrap(event.target.value)}
                            aria-hidden="true"
                        />

                        <section className="client-request__card" aria-labelledby="request-contacts-title">
                            <h2 id="request-contacts-title">Контакты</h2>
                            <div className="client-request__grid">
                                <label className={`client-request__field${fieldErrors.name_client ? ' is-invalid' : ''}`}>
                                    <span className="client-request__label">Имя *</span>
                                    <input
                                        ref={nameRef}
                                        value={form.name_client}
                                        onChange={(event) => setField('name_client', event.target.value)}
                                        autoComplete="name"
                                        aria-invalid={fieldErrors.name_client ? 'true' : undefined}
                                        required
                                    />
                                    {fieldErrors.name_client && <span className="client-request__hint">{fieldErrors.name_client}</span>}
                                </label>
                                <label className={`client-request__field${fieldErrors.phone ? ' is-invalid' : ''}`}>
                                    <span className="client-request__label">Телефон *</span>
                                    <input
                                        ref={phoneRef}
                                        value={form.phone}
                                        onChange={(event) => setField('phone', event.target.value)}
                                        type="tel"
                                        inputMode="tel"
                                        autoComplete="tel"
                                        placeholder="0555 00 00 00"
                                        aria-invalid={fieldErrors.phone ? 'true' : undefined}
                                        required
                                    />
                                    {fieldErrors.phone && <span className="client-request__hint">{fieldErrors.phone}</span>}
                                </label>
                                <label className="client-request__field">
                                    <span className="client-request__label">Организация</span>
                                    <input
                                        value={form.name_compony}
                                        onChange={(event) => setField('name_compony', event.target.value)}
                                        autoComplete="organization"
                                    />
                                </label>
                                <label className={`client-request__field${fieldErrors.email ? ' is-invalid' : ''}`}>
                                    <span className="client-request__label">Почта</span>
                                    <input
                                        ref={emailRef}
                                        value={form.email}
                                        onChange={(event) => setField('email', event.target.value)}
                                        type="email"
                                        autoComplete="email"
                                        aria-invalid={fieldErrors.email ? 'true' : undefined}
                                    />
                                    {fieldErrors.email && <span className="client-request__hint">{fieldErrors.email}</span>}
                                </label>
                                <label className="client-request__field client-request__field--wide">
                                    <span className="client-request__label">Адрес</span>
                                    <input
                                        value={form.address}
                                        onChange={(event) => setField('address', event.target.value)}
                                        autoComplete="street-address"
                                    />
                                </label>
                            </div>
                        </section>

                        <section className="client-request__card" ref={listRef} aria-labelledby="request-items-title">
                            <div className="client-request__section-head">
                                <h2 id="request-items-title">Изделия</h2>
                                <Link to="/catalog">Смотреть каталог</Link>
                            </div>

                            <div className="client-request__add-wrap">
                                <button
                                    type="button"
                                    className="client-request__add-button client-request__add-button--catalog"
                                    onClick={() => openModal('catalog')}
                                    disabled={catalogLoading || catalogEmpty}
                                >
                                    ＋ Добавить из каталога
                                </button>
                                <button
                                    type="button"
                                    className="client-request__add-button client-request__add-button--custom"
                                    onClick={() => openModal('custom')}
                                >
                                    ＋ Добавить своё изделие
                                </button>
                            </div>
                            {catalogLoading && <p className="client-request__note">Каталог открывается…</p>}
                            {catalogEmpty && <p className="client-request__note">Каталог сейчас пуст. Опишите изделие своими словами.</p>}

                            {form.positions.length === 0 ? (
                                <p className="client-request__empty client-request__empty--box">
                                    Пока нет изделий. Можно описать заказ в комментарии.
                                </p>
                            ) : (
                                <ul className="client-request__list">
                                    {form.positions.map((item) => {
                                        const line = (Number(item.price) || 0) * (Number(item.quantity) || 1);
                                        const colors = colorText(item);
                                        const details = detailText(item);
                                        return (
                                            <li key={item.id}>
                                                <div className="client-request__line-photo">
                                                    <Photo src={item.img} title={item.title} />
                                                </div>
                                                <div className="client-request__line-body">
                                                    <strong>{item.title}</strong>
                                                    {item.description ? <small className="client-request__line-details">{item.description}</small> : null}
                                                    {colors ? <small className="client-request__line-details">{colors}</small> : null}
                                                    {details ? <small className="client-request__line-details">{details}</small> : null}
                                                    <span className={line > 0 ? 'client-request__line-price' : 'client-request__line-later'}>
                                                        {item.quantity} шт
                                                        {' · '}
                                                        {line > 0 ? money(line) : 'цену назовёт сотрудник'}
                                                    </span>
                                                </div>
                                                <div className="client-request__line-actions">
                                                    <button type="button" onClick={() => openModal(item.isCustom ? 'custom' : 'catalog', item)}>
                                                        Изменить
                                                    </button>
                                                    <button type="button" onClick={() => removePosition(item.id)} aria-label={`Удалить ${item.title}`}>
                                                        Удалить
                                                    </button>
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </section>

                        <section className="client-request__card" aria-labelledby="request-note-title">
                            <h2 id="request-note-title">Комментарий</h2>
                            <label className={`client-request__field${fieldErrors.order_note ? ' is-invalid' : ''}`}>
                                <span className="client-request__label">К заказу</span>
                                <textarea
                                    ref={noteRef}
                                    value={form.order_note}
                                    onChange={(event) => setField('order_note', event.target.value)}
                                    rows={4}
                                    placeholder="Срок, доставка, особенности помещения"
                                    aria-invalid={fieldErrors.order_note ? 'true' : undefined}
                                />
                                {fieldErrors.order_note && <span className="client-request__hint">{fieldErrors.order_note}</span>}
                            </label>
                        </section>

                        <div className="client-request__submit">
                            <p className="client-request__estimate">
                                {form.positions.length
                                    ? `${form.positions.length} ${piecesLabel(form.positions.length)} в заявке`
                                    : 'Можно отправить текстом, если список изделий пуст'}
                                {estimate > 0 ? `. Ориентир по каталогу: ${money(estimate)}. Итог подтвердит сотрудник` : ''}
                            </p>
                            <p className="visually-hidden" aria-live="polite">
                                {form.positions.length ? `В заявке ${form.positions.length} ${piecesLabel(form.positions.length)}` : 'Список изделий пуст'}
                            </p>
                            {error && <p className="client-request__error" role="alert">{error}</p>}
                            <button type="submit" className="client-request__primary" disabled={saving}>
                                {saving ? 'Отправляем...' : 'Отправить заявку'}
                            </button>
                        </div>
                    </form>
                </>
            )}

            {modalOpen && createPortal(
                <div className={modalClass} role="presentation">
                    <div className="pao-modal__overlay" onClick={closeModal}>
                        <div
                            ref={addModalRef}
                            className="pao-modal__dialog"
                            onClick={(event) => event.stopPropagation()}
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="request-add-modal-title"
                            tabIndex={-1}
                        >
                            <div className="pao-modal__header">
                                <h3 id="request-add-modal-title">
                                    {editingItemId
                                        ? 'Изменение позиции'
                                        : modalType === 'catalog'
                                            ? 'Добавить из каталога'
                                            : 'Своё изделие'}
                                </h3>
                                <button type="button" className="pao-modal__close" onClick={closeModal} aria-label="Закрыть">×</button>
                            </div>

                            {modalType === 'catalog' ? (
                                <div className="pao-modal__body pao-modal__body--catalog">
                                    <div className="pao-modal__search">
                                        <input
                                            type="search"
                                            placeholder="Поиск по названию мебели..."
                                            value={productSearch}
                                            onChange={(event) => setProductSearch(event.target.value)}
                                            aria-label="Поиск мебели в каталоге"
                                        />
                                        {productSearch && (
                                            <button
                                                type="button"
                                                className="pao-modal__search-clear"
                                                onClick={() => setProductSearch('')}
                                                aria-label="Очистить поиск"
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
                                                    {filteredProducts.map((product) => {
                                                        const isActive = Number(selectedProduct?.id) === Number(product.id);
                                                        const price = parseMoney(product.price);
                                                        const photo = resolveImageUrl(product.img);
                                                        return (
                                                            <div
                                                                key={product.id}
                                                                className={`pao-modal__catalog-card${isActive ? ' is-active' : ''}`}
                                                                onClick={() => {
                                                                    if (isActive) return;
                                                                    selectCatalogProduct(product);
                                                                }}
                                                                role="button"
                                                                tabIndex={0}
                                                                onKeyDown={(event) => {
                                                                    if (event.key === 'Enter' || event.key === ' ') {
                                                                        event.preventDefault();
                                                                        if (!isActive) selectCatalogProduct(product);
                                                                    }
                                                                }}
                                                            >
                                                                <div className="pao-modal__catalog-card-img">
                                                                    {photo
                                                                        ? <img src={photo} alt="" />
                                                                        : <div className="pao-modal__catalog-card-placeholder">🪑</div>}
                                                                </div>
                                                                <div className="pao-modal__catalog-card-info">
                                                                    <div className="pao-modal__catalog-card-title">{product.title}</div>
                                                                    <div className="pao-modal__catalog-card-price">
                                                                        {price > 0 ? money(price) : 'цену уточним'}
                                                                    </div>
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
                                                        <div className="pao-modal__config-price">
                                                            {parseMoney(selectedProduct.price) > 0
                                                                ? `${money(parseMoney(selectedProduct.price))} / шт`
                                                                : 'цену уточним'}
                                                        </div>
                                                    </div>
                                                    {(selectedProduct.variables || []).length > 0 && (
                                                        <div className="pao-modal__config-section">
                                                            <div className="pao-modal__section-label">Параметры</div>
                                                            <div className="pao-modal__inputs">
                                                                {(selectedProduct.variables || []).map((variable) => (
                                                                    <label key={variable.name} className="pao-modal__field">
                                                                        <span>{variable.label}</span>
                                                                        <input
                                                                            type="number"
                                                                            value={inputs[variable.name] ?? ''}
                                                                            onChange={(event) => setInputs((prev) => ({
                                                                                ...prev,
                                                                                [variable.name]: event.target.value,
                                                                            }))}
                                                                        />
                                                                    </label>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {!hasCollVariable(selectedProduct) && (
                                                        <div className="pao-modal__config-section">
                                                            <label className="pao-modal__field">
                                                                <span>Количество</span>
                                                                <input
                                                                    type="number"
                                                                    min="1"
                                                                    max="999"
                                                                    value={inputs.coll ?? 1}
                                                                    onChange={(event) => setInputs((prev) => ({
                                                                        ...prev,
                                                                        coll: event.target.value,
                                                                    }))}
                                                                />
                                                            </label>
                                                        </div>
                                                    )}
                                                    {(selectedProduct.conditions || []).some((condition) => condition.type === 'flag') && (
                                                        <div className="pao-modal__config-section">
                                                            <div className="pao-modal__section-label">Опции</div>
                                                            <div className="pao-modal__checkboxes">
                                                                {(selectedProduct.conditions || []).map((condition) => condition.type === 'flag' && (
                                                                    <label key={condition.name} className="pao-modal__checkbox">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={!!inputs[condition.name]}
                                                                            onChange={() => setInputs((prev) => ({
                                                                                ...prev,
                                                                                [condition.name]: !prev[condition.name],
                                                                            }))}
                                                                        />
                                                                        {condition.label}
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
                                                                    onChange={(event) => setBodyColor(event.target.value)}
                                                                    placeholder="Дуб Сонома, Венге..."
                                                                />
                                                            </label>
                                                            <label className="pao-modal__field">
                                                                <span>Цвет фасадов</span>
                                                                <input
                                                                    value={facadeColor}
                                                                    onChange={(event) => setFacadeColor(event.target.value)}
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
                                                                onChange={(event) => setCustomDesc(event.target.value)}
                                                                placeholder="Дополнительные пожелания..."
                                                            />
                                                        </label>
                                                    </div>
                                                    {previewDetails.length > 0 && (
                                                        <p className="pao-modal__preview">
                                                            {previewDetails.slice(0, 4).map((detail) => (
                                                                [detail.label, detail.size].filter(Boolean).join(': ')
                                                            )).filter(Boolean).join(' · ')}
                                                        </p>
                                                    )}
                                                    <div className="pao-modal__config-actions">
                                                        {editingItemId && (
                                                            <button
                                                                type="button"
                                                                className="pao-modal__delete-btn"
                                                                onClick={() => {
                                                                    setForm((prev) => ({
                                                                        ...prev,
                                                                        positions: prev.positions.filter((item) => item.id !== editingItemId),
                                                                    }));
                                                                    closeModal();
                                                                }}
                                                            >
                                                                Удалить позицию
                                                            </button>
                                                        )}
                                                        <button type="button" className="pao-modal__save-btn" onClick={savePosition}>
                                                            {editingItemId ? 'Сохранить изменения' : 'Добавить в заявку'}
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="pao-modal__config-placeholder">
                                                    <div className="pao-modal__placeholder-icon">🛠️</div>
                                                    <p>Выберите изделие слева</p>
                                                    <small>Укажите размеры, цвета и примечание</small>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="pao-modal__body">
                                    <div className="pao-modal__form">
                                        <PhotoUploadSlot
                                            inputId="request-custom-position-photo"
                                            label="Фото"
                                            hint="Можно приложить фото изделия или места"
                                            variant="card"
                                            className="pao-modal__photo-slot"
                                            previewUrl={customItem.img ? resolveImageUrl(customItem.img) : ''}
                                            onFileChange={async (event) => {
                                                const file = event.target.files?.[0];
                                                event.target.value = '';
                                                if (!file) return;
                                                try {
                                                    const path = await uploadPhoto(file);
                                                    setCustomItem((prev) => ({ ...prev, img: path }));
                                                    showToast?.('success', 'Фото загружено');
                                                } catch (err) {
                                                    showToast?.('error', `Ошибка загрузки фото: ${err.message}`);
                                                }
                                            }}
                                            onRemove={() => setCustomItem((prev) => ({ ...prev, img: '' }))}
                                        />
                                        <label className={`pao-modal__field pao-modal__field--full${customError ? ' is-invalid' : ''}`}>
                                            <span>Название *</span>
                                            <input
                                                value={customItem.title}
                                                onChange={(event) => {
                                                    setCustomItem((prev) => ({ ...prev, title: event.target.value }));
                                                    setCustomError('');
                                                }}
                                                placeholder="Например: Стол обеденный"
                                                aria-invalid={customError ? 'true' : undefined}
                                            />
                                            {customError && <small className="pao-modal__field-error">{customError}</small>}
                                        </label>
                                        <label className="pao-modal__field">
                                            <span>Количество</span>
                                            <input
                                                type="number"
                                                min="1"
                                                max="999"
                                                value={customItem.quantity}
                                                onChange={(event) => setCustomItem((prev) => ({
                                                    ...prev,
                                                    quantity: event.target.value,
                                                }))}
                                            />
                                        </label>
                                        <label className="pao-modal__field pao-modal__field--full">
                                            <span>Размеры и пожелания</span>
                                            <textarea
                                                value={customItem.description}
                                                onChange={(event) => setCustomItem((prev) => ({
                                                    ...prev,
                                                    description: event.target.value,
                                                }))}
                                                placeholder="Ширина 1200, белый корпус, без цены"
                                            />
                                        </label>
                                        <p className="pao-modal__price-note">Цену укажет сотрудник, когда примет заявку.</p>
                                        <button type="button" className="pao-modal__save-btn pao-modal__save-btn--spaced" onClick={savePosition}>
                                            {editingItemId ? 'Сохранить изменения' : 'Добавить в заявку'}
                                        </button>
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

export default ClientRequest;
