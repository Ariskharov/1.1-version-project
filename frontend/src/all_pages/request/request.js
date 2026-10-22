import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { API_BASE, resolveImageUrl } from '../../config/api';
import { useCatalogTheme } from '../../context/CatalogThemeContext';
import { CustomContext } from '../../Context';
import {
    buildCatalogPosition,
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

const asText = (value) => (typeof value === 'string' ? value : value == null ? '' : String(value));

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

const clampQty = (value) => Math.min(999, Math.max(1, Math.round(Number(value) || 1)));

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

const publicPosition = (item) => ({
    productId: item.productId || null,
    title: item.title || '',
    quantity: item.quantity || 1,
    description: item.description || '',
    userInputs: item.userInputs || {},
    calculatedDetails: item.calculatedDetails || [],
});

const withQty = (item, quantity) => {
    const qty = clampQty(quantity);
    const price = Number(item.price) || 0;
    return { ...item, quantity: qty, totalPrice: price * qty };
};

function QtyStepper({ value, onChange, label }) {
    const qty = clampQty(value);
    return (
        <div className="client-request__stepper">
            <button
                type="button"
                aria-label={`${label}: меньше`}
                onClick={() => onChange(qty - 1)}
                disabled={qty <= 1}
            >
                −
            </button>
            <input
                type="number"
                min="1"
                max="999"
                inputMode="numeric"
                aria-label={label}
                value={qty}
                onChange={(event) => onChange(clampQty(event.target.value))}
            />
            <button
                type="button"
                aria-label={`${label}: больше`}
                onClick={() => onChange(qty + 1)}
                disabled={qty >= 999}
            >
                +
            </button>
        </div>
    );
}

function Photo({ src, title }) {
    const photo = resolveImageUrl(src);
    if (photo) return <img src={photo} alt="" />;
    return <span className="client-request__no-photo" aria-hidden="true">{(title || '◇').slice(0, 1)}</span>;
}

const ClientRequest = () => {
    const { resolvedTheme } = useCatalogTheme();
    const { showToast, currentUser, products, dataLoaded } = useContext(CustomContext);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [form, setForm] = useState(() => normalizeForm(readClientRequest()));
    const [query, setQuery] = useState('');
    const [showAll, setShowAll] = useState(false);
    const [customItem, setCustomItem] = useState({ title: '', description: '', quantity: 1 });
    const [customError, setCustomError] = useState('');
    const [fieldErrors, setFieldErrors] = useState({});
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const [created, setCreated] = useState(null);
    const [copied, setCopied] = useState('');
    const [trap, setTrap] = useState('');
    const trapRef = useRef(null);
    const nameRef = useRef(null);
    const phoneRef = useRef(null);
    const emailRef = useRef(null);
    const noteRef = useRef(null);
    const listRef = useRef(null);

    const pageLink = typeof window !== 'undefined' ? `${window.location.origin}/zayavka` : '/zayavka';
    const catalog = useMemo(
        () => (Array.isArray(products) ? products.filter(Boolean) : []),
        [products]
    );

    useEffect(() => {
        if (created) return;
        writeClientRequest(form);
    }, [form, created]);

    useEffect(() => {
        const productId = Number(searchParams.get('product'));
        if (!productId || !catalog.length) return;
        const product = catalog.find((item) => Number(item.id) === productId);
        if (!product) return;
        setForm((prev) => {
            if (prev.positions.some((item) => Number(item.productId) === productId)) return prev;
            return {
                ...prev,
                positions: [...prev.positions, buildCatalogPosition(product, { coll: 1 }, [])],
            };
        });
        navigate('/zayavka', { replace: true });
    }, [catalog, searchParams, navigate]);

    const visibleProducts = useMemo(() => {
        const needle = norm(query);
        const list = needle
            ? catalog.filter((product) => norm(product.title).includes(needle))
            : catalog;
        if (needle || showAll) return list;
        return list.slice(0, 8);
    }, [catalog, query, showAll]);

    const counts = useMemo(() => {
        const map = {};
        form.positions.forEach((item) => {
            if (!item.productId) return;
            const key = String(item.productId);
            map[key] = (map[key] || 0) + (Number(item.quantity) || 1);
        });
        return map;
    }, [form.positions]);

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

    const addCatalogProduct = (product) => {
        setForm((prev) => {
            const existing = prev.positions.find((item) => (
                !item.isCustom
                && Number(item.productId) === Number(product.id)
                && !asText(item.description).trim()
                && !(Array.isArray(item.calculatedDetails) && item.calculatedDetails.length)
            ));
            if (existing) {
                return {
                    ...prev,
                    positions: prev.positions.map((item) => (
                        item.id === existing.id ? withQty(item, (Number(item.quantity) || 1) + 1) : item
                    )),
                };
            }
            return {
                ...prev,
                positions: [...prev.positions, buildCatalogPosition(product, { coll: 1 }, [])],
            };
        });
        setFieldErrors((prev) => (prev.order_note ? { ...prev, order_note: '' } : prev));
        setError('');
    };

    const addCustomItem = () => {
        const title = customItem.title.trim();
        if (!title) {
            setCustomError('Напишите, какое изделие нужно');
            return;
        }
        const description = customItem.description.trim();
        const quantity = clampQty(customItem.quantity);
        setForm((prev) => {
            const existing = prev.positions.find((item) => (
                item.isCustom
                && norm(item.title) === norm(title)
                && (item.description || '') === description
            ));
            if (existing) {
                return {
                    ...prev,
                    positions: prev.positions.map((item) => (
                        item.id === existing.id ? withQty(item, (Number(item.quantity) || 1) + quantity) : item
                    )),
                };
            }
            return {
                ...prev,
                positions: [...prev.positions, {
                    id: `${Date.now()}-custom-${Math.random().toString(36).slice(2, 7)}`,
                    isCustom: true,
                    title,
                    description,
                    quantity,
                    price: 0,
                    totalPrice: 0,
                }],
            };
        });
        setCustomItem({ title: '', description: '', quantity: 1 });
        setCustomError('');
        setFieldErrors((prev) => (prev.order_note ? { ...prev, order_note: '' } : prev));
        setError('');
    };

    const removePosition = (id) => {
        setForm((prev) => ({ ...prev, positions: prev.positions.filter((item) => item.id !== id) }));
    };

    const setPositionQty = (id, value) => {
        setForm((prev) => ({
            ...prev,
            positions: prev.positions.map((item) => (item.id === id ? withQty(item, value) : item)),
        }));
    };

    const setPositionNote = (id, description) => {
        setForm((prev) => ({
            ...prev,
            positions: prev.positions.map((item) => (item.id === id ? { ...item, description } : item)),
        }));
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
        setCreated(null);
        setForm(emptyForm());
        setQuery('');
        setShowAll(false);
        setCustomItem({ title: '', description: '', quantity: 1 });
        setCustomError('');
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
    const hiddenCount = !norm(query) && !showAll ? Math.max(0, catalog.length - visibleProducts.length) : 0;

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
                            Напишите, как с вами связаться и какая мебель нужна. Сотрудник увидит заявку и перезвонит.
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

                            {catalogLoading && (
                                <div className="client-request__skeleton" aria-hidden="true">
                                    <span /><span /><span /><span />
                                </div>
                            )}

                            {catalogEmpty && (
                                <p className="client-request__empty">Каталог сейчас пуст или не открылся. Опишите изделие своими словами.</p>
                            )}

                            {catalog.length > 0 && (
                                <div className="client-request__catalog">
                                    <label className="client-request__field">
                                        <span className="client-request__label">Найти в каталоге</span>
                                        <input
                                            type="search"
                                            value={query}
                                            onChange={(event) => setQuery(event.target.value)}
                                            placeholder="Шкаф, стол, кухня"
                                            aria-label="Поиск изделия"
                                        />
                                    </label>
                                    {visibleProducts.length === 0 ? (
                                        <p className="client-request__empty">В каталоге нет такого названия. Добавьте изделие своими словами ниже.</p>
                                    ) : (
                                        <ul className="client-request__picker">
                                            {visibleProducts.map((product) => {
                                                const price = parseMoney(product.price);
                                                const count = counts[String(product.id)] || 0;
                                                return (
                                                    <li key={product.id}>
                                                        <button
                                                            type="button"
                                                            className={`client-request__pick${count ? ' is-in' : ''}`}
                                                            onClick={() => addCatalogProduct(product)}
                                                            aria-label={`Добавить ${product.title}${price > 0 ? `, ${money(price)}` : ''}`}
                                                        >
                                                            <Photo src={product.img} title={product.title} />
                                                            <span className="client-request__pick-title">{product.title}</span>
                                                            <span className="client-request__pick-price">
                                                                {price > 0 ? money(price) : 'цену уточним'}
                                                            </span>
                                                            {count > 0 && <span className="client-request__pick-count">{count}</span>}
                                                        </button>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    )}
                                    {hiddenCount > 0 && (
                                        <button type="button" className="client-request__text-btn" onClick={() => setShowAll(true)}>
                                            Показать ещё {hiddenCount}
                                        </button>
                                    )}
                                    <p className="client-request__note">Нажмите на изделие, чтобы добавить его. Повторное нажатие увеличивает количество.</p>
                                </div>
                            )}

                            <div className="client-request__compose">
                                <label className={`client-request__field client-request__compose-title${customError ? ' is-invalid' : ''}`}>
                                    <span className="client-request__label">Своё изделие</span>
                                    <input
                                        value={customItem.title}
                                        onChange={(event) => {
                                            setCustomItem((prev) => ({ ...prev, title: event.target.value }));
                                            setCustomError('');
                                        }}
                                        placeholder="Шкаф, стол, тумба"
                                        aria-invalid={customError ? 'true' : undefined}
                                    />
                                    {customError && <span className="client-request__hint">{customError}</span>}
                                </label>
                                <label className="client-request__field client-request__compose-qty">
                                    <span className="client-request__label">Количество</span>
                                    <QtyStepper
                                        value={customItem.quantity}
                                        label="Количество своего изделия"
                                        onChange={(quantity) => setCustomItem((prev) => ({ ...prev, quantity }))}
                                    />
                                </label>
                                <label className="client-request__field client-request__compose-note">
                                    <span className="client-request__label">Размеры и пожелания</span>
                                    <input
                                        value={customItem.description}
                                        onChange={(event) => setCustomItem((prev) => ({ ...prev, description: event.target.value }))}
                                        placeholder="Ширина 1200, белый корпус"
                                    />
                                </label>
                                <button type="button" className="client-request__secondary client-request__compose-action" onClick={addCustomItem}>
                                    Добавить своё изделие
                                </button>
                            </div>

                            {form.positions.length === 0 ? (
                                <p className="client-request__empty client-request__empty--box">Пока нет изделий. Можно описать заказ в комментарии.</p>
                            ) : (
                                <ul className="client-request__list">
                                    {form.positions.map((item) => {
                                        const line = (Number(item.price) || 0) * (Number(item.quantity) || 1);
                                        return (
                                            <li key={item.id}>
                                                <div className="client-request__line-photo">
                                                    <Photo src={item.img} title={item.title} />
                                                </div>
                                                <div className="client-request__line-body">
                                                    <strong>{item.title}</strong>
                                                    <input
                                                        className="client-request__line-note"
                                                        value={item.description || ''}
                                                        placeholder="Размеры, цвет, комментарий"
                                                        aria-label={`Комментарий: ${item.title}`}
                                                        onChange={(event) => setPositionNote(item.id, event.target.value)}
                                                    />
                                                    {detailText(item) ? <small className="client-request__line-details">{detailText(item)}</small> : null}
                                                    <span className={line > 0 ? 'client-request__line-price' : 'client-request__line-later'}>
                                                        {line > 0 ? money(line) : 'цену назовёт сотрудник'}
                                                    </span>
                                                </div>
                                                <div className="client-request__line-actions">
                                                    <QtyStepper
                                                        value={item.quantity}
                                                        label={`Количество: ${item.title}`}
                                                        onChange={(quantity) => setPositionQty(item.id, quantity)}
                                                    />
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
        </section>
    );
};

export default ClientRequest;
