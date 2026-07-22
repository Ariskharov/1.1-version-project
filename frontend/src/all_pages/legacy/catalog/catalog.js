import React, { useState, useMemo, useEffect, useCallback, useRef, memo } from 'react';
import { useFurnitureCalculator } from './useFurnitureCalculator';
import './catalog.scss';
import { LoadingPage } from '../../../components/ui/LoadingSpinner';
import { useCatalogTheme } from '../../../context/CatalogThemeContext';
import { useDialogA11y } from '../../../hooks/useDialogA11y';

const SORT_OPTIONS = [
    { value: 'name-asc', label: 'По названию А–Я' },
    { value: 'name-desc', label: 'По названию Я–А' },
    { value: 'price-asc', label: 'Сначала дешевле' },
    { value: 'price-desc', label: 'Сначала дороже' },
];

const CatalogCard = memo(({ product, index, onOpen }) => (
    <li>
        <button
            type="button"
            className="catalog-card"
            style={{ '--card-delay': `${Math.min(index, 12) * 50}ms` }}
            onClick={() => onOpen(product)}
            aria-labelledby={`catalog-card-title-${product.id}`}
            aria-describedby={product.price ? `catalog-card-price-${product.id}` : undefined}
        >
            <div className="catalog-card__shine" aria-hidden="true" />
            <div className="catalog-card__image-wrap" aria-hidden="true">
                <img
                    src={product.img}
                    alt=""
                    className="catalog-card__image"
                    loading="lazy"
                    decoding="async"
                />
                <div className="catalog-card__overlay">
                    <span className="catalog-card__cta">Рассчитать</span>
                </div>
            </div>
            <div className="catalog-card__body">
                <span id={`catalog-card-title-${product.id}`} className="catalog-card__title">{product.title}</span>
                {product.price && (
                    <div id={`catalog-card-price-${product.id}`} className="catalog-card__price">
                        <span className="catalog-card__price-value">{product.price}</span>
                        <span className="catalog-card__price-currency">сом</span>
                    </div>
                )}
            </div>
        </button>
    </li>
));

const parsePrice = (price) => {
    if (price == null || price === '') return null;
    const num = parseFloat(String(price).replace(/[^\d.,]/g, '').replace(',', '.'));
    return Number.isFinite(num) ? num : null;
};

const Catalog = () => {
    const {
        products,
        selectedProduct,
        inputs,
        resultsArray,
        isLoading,
        error,
        validationErrors,
        selectProduct,
        handleInputChange,
        handleCheckboxChange,
        calculate,
    } = useFurnitureCalculator();

    const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState('name-asc');
    const [viewMode, setViewMode] = useState('grid');
    const [copiedResults, setCopiedResults] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const { resolvedTheme } = useCatalogTheme();
    const modalRef = useRef(null);
    const lightboxRef = useRef(null);

    const catalogClassName = (extra = '') =>
        ['catalog', `catalog--theme-${resolvedTheme}`, extra].filter(Boolean).join(' ');

    const closeModal = useCallback(() => {
        selectProduct(null);
        setIsImageViewerOpen(false);
        setModalVisible(false);
        setCopiedResults(false);
    }, [selectProduct]);

    const openProduct = useCallback((product) => {
        selectProduct(product);
        setModalVisible(true);
        setCopiedResults(false);
    }, [selectProduct]);

    useEffect(() => {
        if (selectedProduct) {
            requestAnimationFrame(() => setModalVisible(true));
        }
    }, [selectedProduct]);

    useDialogA11y(
        Boolean(selectedProduct && modalVisible && !isImageViewerOpen),
        closeModal,
        modalRef,
    );
    useDialogA11y(
        isImageViewerOpen,
        () => setIsImageViewerOpen(false),
        lightboxRef,
        { hideBackground: false },
    );

    const filteredProducts = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        let list = products.filter((p) =>
            p.title?.toLowerCase().includes(term)
        );

        const [field, order] = sortBy.split('-');
        list = [...list].sort((a, b) => {
            if (field === 'price') {
                const pa = parsePrice(a.price);
                const pb = parsePrice(b.price);
                if (pa == null && pb == null) return 0;
                if (pa == null) return 1;
                if (pb == null) return -1;
                return order === 'asc' ? pa - pb : pb - pa;
            }
            const ta = (a.title || '').toLowerCase();
            const tb = (b.title || '').toLowerCase();
            const cmp = ta.localeCompare(tb, 'ru');
            return order === 'asc' ? cmp : -cmp;
        });

        return list;
    }, [products, searchTerm, sortBy]);

    const handleCopyResults = async () => {
        if (!resultsArray.length || !selectedProduct) return;
        const text = [
            `Расчёт: ${selectedProduct.title}`,
            ...resultsArray.map(([key, value]) => {
                const [label, details] = value.split(' — ');
                return `${label}: ${details || ''}`;
            }),
        ].join('\n');

        try {
            await navigator.clipboard.writeText(text);
            setCopiedResults(true);
            setTimeout(() => setCopiedResults(false), 2000);
        } catch {
            /* clipboard unavailable */
        }
    };

    if (isLoading) {
        return (
            <div className={catalogClassName('catalog--loading')}>
                <LoadingPage message="Загрузка каталога..." />
            </div>
        );
    }

    if (error) {
        return (
            <div className={catalogClassName('catalog--state')}>
                <div className="catalog-state-card catalog-state-card--error">
                    <span className="catalog-state-icon" aria-hidden="true">!</span>
                    <h2>Не удалось загрузить каталог</h2>
                    <p>{error}</p>
                </div>
            </div>
        );
    }

    if (products.length === 0) {
        return (
            <div className={catalogClassName('catalog--state')}>
                <div className="catalog-state-card">
                    <span className="catalog-state-icon" aria-hidden="true">◇</span>
                    <h2>Каталог пуст</h2>
                    <p>Добавьте изделия в панели администратора</p>
                </div>
            </div>
        );
    }

    return (
        <div className={catalogClassName()}>
            <div className="catalog-ambient" aria-hidden="true">
                <div className="catalog-ambient__orb catalog-ambient__orb--1" />
                <div className="catalog-ambient__orb catalog-ambient__orb--2" />
                <div className="catalog-ambient__grain" />
            </div>

            <header className="catalog-hero" aria-labelledby="catalog-hero-title">
                <p className="catalog-hero__badge">Коллекция мебели</p>
                <h1 id="catalog-hero-title" className="catalog-hero__title">Расчёт мебели</h1>
                <p className="catalog-hero__subtitle">
                    Выберите изделие, задайте параметры и получите точный расчёт материалов
                </p>
                <div className="catalog-hero__stats" role="status" aria-live="polite">
                    <p className="catalog-stat">
                        <span className="catalog-stat__value">{products.length}</span>
                        <span className="catalog-stat__label">позиций в каталоге</span>
                    </p>
                </div>
            </header>

            <div className="catalog-toolbar" role="region" aria-label="Поиск и сортировка каталога">
                <div className="catalog-search" role="search">
                    <svg className="catalog-search__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
                        <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                    <input
                        id="catalog-search-input"
                        type="search"
                        placeholder="Поиск по названию..."
                        className="catalog-search__input"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        aria-label="Поиск по названию в каталоге"
                    />
                    {searchTerm && (
                        <button
                            type="button"
                            className="catalog-search__clear"
                            onClick={() => setSearchTerm('')}
                            aria-label="Очистить поиск"
                        >
                            ×
                        </button>
                    )}
                </div>

                <div className="catalog-toolbar__actions">
                    <label className="catalog-sort" htmlFor="catalog-sort-select">
                        <span className="catalog-sort__label">Сортировка</span>
                        <select
                            id="catalog-sort-select"
                            className="catalog-sort__select"
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            aria-label="Сортировка списка изделий"
                        >
                            {SORT_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    </label>

                    <div className="catalog-view-toggle" role="group" aria-label="Вид каталога">
                        <button
                            type="button"
                            className={`catalog-view-toggle__btn ${viewMode === 'grid' ? 'is-active' : ''}`}
                            onClick={() => setViewMode('grid')}
                            aria-pressed={viewMode === 'grid'}
                            aria-label="Сетка"
                            title="Сетка"
                        >
                            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><rect x="1" y="1" width="7" height="7" rx="1.5" /><rect x="12" y="1" width="7" height="7" rx="1.5" /><rect x="1" y="12" width="7" height="7" rx="1.5" /><rect x="12" y="12" width="7" height="7" rx="1.5" /></svg>
                        </button>
                        <button
                            type="button"
                            className={`catalog-view-toggle__btn ${viewMode === 'list' ? 'is-active' : ''}`}
                            onClick={() => setViewMode('list')}
                            aria-pressed={viewMode === 'list'}
                            aria-label="Список"
                            title="Список"
                        >
                            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><rect x="1" y="3" width="18" height="3" rx="1" /><rect x="1" y="8.5" width="18" height="3" rx="1" /><rect x="1" y="14" width="18" height="3" rx="1" /></svg>
                        </button>
                    </div>
                </div>
            </div>

            <section className="catalog-products" aria-label="Список изделий">
                {filteredProducts.length === 0 ? (
                    <div className="catalog-empty">
                        <p>По запросу «{searchTerm}» ничего не найдено</p>
                        <button type="button" className="catalog-empty__btn" onClick={() => setSearchTerm('')}>
                            Сбросить поиск
                        </button>
                    </div>
                ) : (
                    <ul className={`catalog-grid catalog-grid--${viewMode}`}>
                        {filteredProducts.map((product, index) => (
                            <CatalogCard
                                key={product.id}
                                product={product}
                                index={index}
                                onOpen={openProduct}
                            />
                        ))}
                    </ul>
                )}
            </section>

            {/* Модальное окно калькулятора — вся прежняя логика сохранена */}
            {selectedProduct && (
                <div
                    className={`catalog-modal-overlay ${modalVisible ? 'is-visible' : ''}`}
                    onClick={closeModal}
                    role="presentation"
                >
                    <div
                        ref={modalRef}
                        className={`catalog-modal ${modalVisible ? 'is-visible' : ''}`}
                        onClick={(e) => e.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="catalog-modal-title"
                        aria-describedby="catalog-modal-desc"
                        tabIndex={-1}
                    >
                        <button
                            type="button"
                            className="catalog-modal__close"
                            onClick={closeModal}
                            aria-label="Закрыть"
                        >
                            ×
                        </button>

                        <div className="catalog-modal__layout">
                            <div className="catalog-modal__visual">
                                {selectedProduct.img && (
                                    <div
                                        className="catalog-modal__image-frame"
                                        onClick={() => setIsImageViewerOpen(true)}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                setIsImageViewerOpen(true);
                                            }
                                        }}
                                        aria-label={`Увеличить изображение: ${selectedProduct.title}`}
                                    >
                                        <img
                                            src={selectedProduct.img}
                                            alt={selectedProduct.title}
                                            className="catalog-modal__image"
                                        />
                                        <span className="catalog-modal__zoom-hint">Увеличить</span>
                                    </div>
                                )}
                                <div className="catalog-modal__meta">
                                    <h2 id="catalog-modal-title" className="catalog-modal__title">
                                        {selectedProduct.title}
                                    </h2>
                                    <p id="catalog-modal-desc" className="visually-hidden">
                                        Задайте параметры изделия и нажмите «Рассчитать» для получения результата.
                                    </p>
                                    {selectedProduct.price && (
                                        <div className="catalog-modal__price">
                                            {selectedProduct.price} <span>сом</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="catalog-modal__form-wrap">
                                <form
                                    className="catalog-modal__form"
                                    onSubmit={(e) => { e.preventDefault(); calculate(); }}
                                >
                                    <div className="catalog-form-section">
                                        <h3 className="catalog-form-section__title">Параметры</h3>
                                        <div className="catalog-inputs-grid">
                                            {(selectedProduct.variables || []).map((v) => (
                                                <div key={v.name} className="catalog-input-group">
                                                    <label htmlFor={`catalog-input-${v.name}`}>{v.label}</label>
                                                    <input
                                                        id={`catalog-input-${v.name}`}
                                                        type="number"
                                                        placeholder={v.label}
                                                        value={inputs[v.name] ?? ''}
                                                        onChange={(e) => handleInputChange(v.name, e.target.value)}
                                                        className={validationErrors[v.name] ? 'has-error' : ''}
                                                        aria-invalid={validationErrors[v.name] ? 'true' : undefined}
                                                        aria-describedby={validationErrors[v.name] ? `catalog-error-${v.name}` : undefined}
                                                    />
                                                    {validationErrors[v.name] && (
                                                        <span id={`catalog-error-${v.name}`} className="catalog-input-error" role="alert">{validationErrors[v.name]}</span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {(selectedProduct.conditions || []).some((c) => c.type === 'flag') && (
                                        <div className="catalog-form-section">
                                            <h3 className="catalog-form-section__title">Дополнительные опции</h3>
                                            <div className="catalog-checkbox-grid">
                                                {(selectedProduct.conditions || []).map((c) => (
                                                    c.type === 'flag' && (
                                                        <label key={c.name} className="catalog-checkbox">
                                                            <input
                                                                type="checkbox"
                                                                checked={inputs[c.name] ?? false}
                                                                onChange={() => handleCheckboxChange(c.name)}
                                                            />
                                                            <span className="catalog-checkbox__box" />
                                                            <span className="catalog-checkbox__text">{c.label}</span>
                                                        </label>
                                                    )
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <button type="submit" className="catalog-calc-btn">
                                        <span>Рассчитать</span>
                                        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                            <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    </button>
                                </form>

                                {resultsArray.length > 0 && (
                                    <div className="catalog-results" role="region" aria-label="Результаты расчёта" aria-live="polite">
                                        <div className="catalog-results__head">
                                            <h3 className="catalog-form-section__title">Результат расчёта</h3>
                                            <button
                                                type="button"
                                                className={`catalog-results__copy ${copiedResults ? 'is-copied' : ''}`}
                                                onClick={handleCopyResults}
                                                aria-label={copiedResults ? 'Результаты скопированы' : 'Копировать результаты расчёта'}
                                            >
                                                {copiedResults ? 'Скопировано' : 'Копировать'}
                                            </button>
                                        </div>
                                        <div className="catalog-results__grid">
                                            {resultsArray.map(([key, value]) => {
                                                const [label, details] = value.split(' — ');
                                                return (
                                                    <div key={key} className="catalog-result-item">
                                                        <div className="catalog-result-item__label">{label}</div>
                                                        <div className="catalog-result-item__details">{details}</div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isImageViewerOpen && selectedProduct?.img && (
                <div
                    className="catalog-lightbox"
                    onClick={() => setIsImageViewerOpen(false)}
                    role="presentation"
                >
                    <div
                        ref={lightboxRef}
                        className="catalog-lightbox__inner"
                        onClick={(e) => e.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-label={`Просмотр изображения: ${selectedProduct.title}`}
                        aria-describedby="catalog-lightbox-hint"
                        tabIndex={-1}
                    >
                        <button
                            type="button"
                            className="catalog-lightbox__close"
                            onClick={() => setIsImageViewerOpen(false)}
                            aria-label="Закрыть"
                        >
                            ×
                        </button>
                        <img
                            src={selectedProduct.img}
                            alt={selectedProduct.title}
                            className="catalog-lightbox__img"
                        />
                        <p id="catalog-lightbox-hint" className="catalog-lightbox__hint">Нажмите Escape или кнопку закрытия, чтобы вернуться к расчёту</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Catalog;