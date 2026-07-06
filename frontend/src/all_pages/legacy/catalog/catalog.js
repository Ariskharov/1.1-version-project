import React, { useState } from 'react';
import { useFurnitureCalculator } from './useFurnitureCalculator';
import './catalog.scss';
import { LoadingPage } from '../../../components/ui/LoadingSpinner';

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

    // Состояния для просмотра фото в модалке (лайтбокс)
    const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);

    // Поиск
    const [searchTerm, setSearchTerm] = useState('');

    // Показываем загрузку
    if (isLoading) {
        return (
            <div className="catalog container">
                <LoadingPage message="Загрузка каталога..." />
            </div>
        );
    }

    // Показываем ошибку
    if (error) {
        return (
            <div className="catalog container">
                <h2>Расчёт мебели</h2>
                <div className="error-message">{error}</div>
            </div>
        );
    }

    if (products.length === 0) {
        return (
            <div className="catalog container">
                <h2>Расчёт мебели</h2>
                <p>Каталог пуст.</p>
            </div>
        );
    }

    return (
        <div className="catalog">
            <div className="catalog-header">
                <h1>Расчёт мебели</h1>
                <p className="subtitle">Выберите изделие и рассчитайте необходимые материалы</p>
                
                {/* Поиск */}
                <div className="search-wrapper">
                    <input 
                        type="text" 
                        placeholder="Поиск по названию..." 
                        className="search-input"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                        <button 
                            className="search-clear" 
                            onClick={() => setSearchTerm('')}
                            aria-label="Очистить поиск"
                        >
                            ×
                        </button>
                    )}
                </div>
            </div>

            {/* Сетка товаров */}
            <div className="products-section">
                <div className="products-grid">
                    {products
                        .filter(product => 
                            product.title.toLowerCase().includes(searchTerm.toLowerCase())
                        )
                        .map(product => (
                        <div 
                            key={product.id} 
                            className="product-card"
                            onClick={() => selectProduct(product)}
                        >
                            <div className="product-image-wrapper">
                                <img 
                                    src={product.img} 
                                    alt={product.title} 
                                    className="product-image"
                                />
                            </div>
                            <div className="product-info">
                                <h3 className="product-title">{product.title}</h3>
                                {product.price && (
                                    <div className="product-price">{product.price} сом</div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Модальное окно с калькулятором */}
            {selectedProduct && (
                <div className="catalog-modal-overlay" onClick={() => {
                    selectProduct(null);
                    setIsImageViewerOpen(false);
                }}>
                    <div className="catalog-modal-content" onClick={e => e.stopPropagation()}>
                        <button 
                            className="catalog-modal-close" 
                            onClick={() => {
                                selectProduct(null);
                                setIsImageViewerOpen(false);
                            }}
                        >
                            ×
                        </button>

                        <div className="catalog-modal-header">
                            <h2>{selectedProduct.title}</h2>
                            {selectedProduct.price && (
                                <div className="catalog-modal-price">{selectedProduct.price} сом</div>
                            )}
                        </div>

                        {/* Кликабельное фото для просмотра в большом размере */}
                        {selectedProduct.img && (
                            <div 
                                className="catalog-modal-image-wrapper"
                                onClick={() => setIsImageViewerOpen(true)}
                            >
                                <img 
                                    src={selectedProduct.img} 
                                    alt={selectedProduct.title} 
                                    className="catalog-modal-product-image"
                                />
                                <div className="catalog-image-hint">Нажмите, чтобы увеличить</div>
                            </div>
                        )}

                        <form onSubmit={e => { e.preventDefault(); calculate(); }}>
                            
                            {/* Параметры */}
                            <div className="form-section">
                                <h4 className="section-title">Параметры</h4>
                                <div className="inputs-grid">
                                    {(selectedProduct.variables || []).map(v => (
                                        <div key={v.name} className="input-group">
                                            <label>{v.label}</label>
                                            <input
                                                type="number"
                                                placeholder={v.label}
                                                value={inputs[v.name] ?? ''}
                                                onChange={e => handleInputChange(v.name, e.target.value)}
                                                className={validationErrors[v.name] ? 'input-error' : ''}
                                            />
                                            {validationErrors[v.name] && (
                                                <span className="error-text">{validationErrors[v.name]}</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Дополнительные опции */}
                            {(selectedProduct.conditions || []).some(c => c.type === 'flag') && (
                                <div className="form-section">
                                    <h4 className="section-title">Дополнительные опции</h4>
                                    <div className="checkbox-grid">
                                        {(selectedProduct.conditions || []).map(c => (
                                            c.type === 'flag' && (
                                                <label key={c.name} className="checkbox-label">
                                                    <input
                                                        type="checkbox"
                                                        checked={inputs[c.name] ?? false}
                                                        onChange={() => handleCheckboxChange(c.name)}
                                                    />
                                                    <span>{c.label}</span>
                                                </label>
                                            )
                                        ))}
                                    </div>
                                </div>
                            )}

                            <button type="submit" className="calculate-btn">
                                Рассчитать
                            </button>
                        </form>

                        {/* Результаты */}
                        {resultsArray.length > 0 && (
                            <div className="results-section">
                                <h4 className="section-title">Результат расчёта</h4>
                                <div className="results-grid">
                                    {resultsArray.map(([key, value]) => {
                                        const [label, details] = value.split(' — ');
                                        return (
                                            <div key={key} className="result-card">
                                                <div className="result-label">{label}</div>
                                                <div className="result-details">{details}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Лайтбокс для просмотра фото */}
            {isImageViewerOpen && selectedProduct?.img && (
                <div 
                    className="catalog-image-viewer-overlay" 
                    onClick={() => setIsImageViewerOpen(false)}
                >
                    <div className="catalog-image-viewer-content" onClick={e => e.stopPropagation()}>
                        <button 
                            className="catalog-image-viewer-close"
                            onClick={() => setIsImageViewerOpen(false)}
                        >
                            ×
                        </button>
                        <img 
                            src={selectedProduct.img} 
                            alt={selectedProduct.title} 
                            className="catalog-image-viewer-img"
                        />
                        <div className="catalog-image-viewer-hint">Кликните в любом месте, чтобы закрыть</div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Catalog;