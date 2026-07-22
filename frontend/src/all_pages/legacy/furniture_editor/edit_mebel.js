import React, { useState, useEffect, useContext, useMemo, useRef, useCallback } from 'react';
import './edit_mebel.scss';
import { CustomContext } from '../../../Context';
import { LoadingPage } from '../../../components/ui/LoadingSpinner';
import { useCatalogTheme } from '../../../context/CatalogThemeContext';
import { useDialogA11y } from '../../../hooks/useDialogA11y';

const API_URL = 'http://localhost:8080/product';
const UPLOAD_URL = 'http://localhost:8080/upload';

function FurnitureEditor() {
    const { resolvedTheme } = useCatalogTheme();
    const { showToast, confirm } = useContext(CustomContext);
    const [products, setProducts] = useState([]);
    const [selected, setSelected] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [pendingActions, setPendingActions] = useState({}); // защита от повторных кликов

    useEffect(() => {
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        try {
            setLoading(true);
            const res = await fetch(API_URL);
            const data = await res.json();
            setProducts(Array.isArray(data) ? data : [data]);
        } catch (err) {
            console.error('Ошибка загрузки:', err);
        } finally {
            setLoading(false);
        }
    };

    const selectProduct = (p) => {
        setSelected(JSON.parse(JSON.stringify(p)));
    };

    const save = async () => {
        if (!selected?.id || isPending('save')) return;
        setPending('save', true);
        try {
            const response = await fetch(`${API_URL}/${selected.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(selected),
            });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            showToast('success', 'Изменения сохранены!');
            setSelected(null);
            fetchProducts();
        } catch (err) {
            console.error('Ошибка сохранения:', err);
            showToast('error', 'Ошибка сохранения: ' + err.message);
        } finally {
            setPending('save', false);
        }
    };

    const saveImg = async (productToSave = null) => {
        const product = productToSave || selected;
        if (!product?.id) return;
        try {
            const response = await fetch(`${API_URL}/${product.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(product),
            });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const updatedProduct = await response.json();
            setSelected(updatedProduct);
            fetchProducts();
        } catch (err) {
            console.error('Ошибка сохранения фото:', err);
            showToast('error', 'Ошибка сохранения фото: ' + err.message);
        }
    };

    const addNewProduct = async () => {
        if (isPending('add')) return;
        setPending('add', true);
        const newId = Math.max(0, ...products.map(p => p.id)) + 1;
        const newProduct = {
            id: newId,
            title: 'Новая мебель',
            img: '',
            price: '',
            variables: [
                { name: 'shirina', label: 'Ширина', default: 800 },
                { name: 'glubina', label: 'Глубина', default: 400 },
                { name: 'visota', label: 'Высота', default: 2000 },
                { name: 'coll', label: 'Количество', default: 1 }
            ],
            conditions: [],
            details: []
        };

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newProduct),
            });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const addedProduct = await response.json();
            showToast('success', 'Новая мебель добавлена!');
            fetchProducts();
            setSelected(addedProduct);
        } catch (err) {
            console.error('Ошибка добавления:', err);
            showToast('error', 'Ошибка добавления: ' + err.message);
        } finally {
            setPending('add', false);
        }
    };

    const deleteProduct = async (id) => {
        const confirmed = await confirm({
            message: `Удалить мебель ID ${id}?`,
            confirmLabel: 'Удалить',
            danger: true,
        });
        if (!confirmed || isPending(`delete-${id}`)) return;
        setPending(`delete-${id}`, true);

        try {
            const response = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            showToast('success', 'Мебель удалена!');
            fetchProducts();
            if (selected?.id === id) setSelected(null);
        } catch (err) {
            console.error('Ошибка удаления:', err);
            showToast('error', 'Ошибка удаления: ' + err.message);
        } finally {
            setPending(`delete-${id}`, false);
        }
    };

    const update = (path, value) => {
        setSelected(prev => {
            const copy = JSON.parse(JSON.stringify(prev));
            let ref = copy;
            for (let i = 0; i < path.length - 1; i++) {
                ref = ref[path[i]];
            }
            ref[path[path.length - 1]] = value;
            return copy;
        });
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file || !selected?.id) {
            if (!selected?.id) showToast('info', 'Сохраните мебель сначала, чтобы присвоить ID.');
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch(UPLOAD_URL, { method: 'POST', body: formData });
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            
            const { path } = await res.json();
            const updatedProduct = { ...selected, img: path };
            setSelected(updatedProduct);
            await saveImg(updatedProduct);
            showToast('success', 'Фото загружено');
        } catch (err) {
            console.error('Ошибка загрузки фото:', err);
            showToast('error', 'Ошибка загрузки фото: ' + err.message);
        }
    };

    const deletePhoto = async () => {
        if (!selected.img) return;
        const confirmed = await confirm({
            message: 'Удалить фото?',
            confirmLabel: 'Удалить',
            danger: true,
        });
        if (!confirmed || isPending('delete-photo')) return;
        setPending('delete-photo', true);

        try {
            const fileName = selected.img.replace(/^\/utilse\//, '');
            await fetch(UPLOAD_URL, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fileName }),
            });

            const updatedProduct = { ...selected, img: '' };
            setSelected(updatedProduct);
            await saveImg(updatedProduct);
            showToast('success', 'Фото удалено');
        } catch (err) {
            console.error('Ошибка удаления фото:', err);
            showToast('error', 'Ошибка удаления фото: ' + err.message);
        } finally {
            setPending('delete-photo', false);
        }
    };

    // === Переменные ===
    const addVariable = () => {
        update(['variables'], [
            ...(selected.variables || []),
            { name: 'new_var', label: 'Новая переменная', default: 0 }
        ]);
    };

    const removeVariable = (idx) => {
        update(['variables'], selected.variables.filter((_, i) => i !== idx));
    };

    // === Условия ===
    const addCondition = () => {
        update(['conditions'], [
            ...(selected.conditions || []),
            { name: 'new_condition', label: 'Новое условие', type: 'flag', default: false }
        ]);
    };

    const removeCondition = (idx) => {
        update(['conditions'], selected.conditions.filter((_, i) => i !== idx));
    };

    // === Детали ===
    const addDetail = () => {
        update(['details'], [
            ...(selected.details || []),
            {
                key: 'new_detail',
                label: 'Новая деталь',
                formula_width: 'shirina',
                formula_height: 'glubina',
                count_formula: 'coll * 1',
                if_condition: ''
            }
        ]);
    };

    const removeDetail = (idx) => {
        update(['details'], selected.details.filter((_, i) => i !== idx));
    };

    // ===== Защита от повторных кликов + анимация загрузки =====
    const withLoading = async (key, fn) => {
        if (pendingActions[key]) return; // уже выполняется
        setPendingActions(prev => ({ ...prev, [key]: true }));
        try {
            await fn();
        } finally {
            setPendingActions(prev => {
                const next = { ...prev };
                delete next[key];
                return next;
            });
        }
    };

    const isPending = (key) => !!pendingActions[key];

    const setPending = (key, active) => {
        setPendingActions(prev => {
            if (active) return { ...prev, [key]: true };
            const next = { ...prev };
            delete next[key];
            return next;
        });
    };

    // ===== Управление drawer'ом =====
  const openDrawer = (product) => {
    selectProduct(product);
  };

  // Обёртка для загрузки фото с защитой от повторных кликов
  const handleFileUploadWithLoading = (e) => {
    // Сохраняем файл сразу, потому что React может очистить event
    const file = e.target.files?.[0];
    if (!file) return;

    withLoading('upload-photo', async () => {
      // Создаём новый синтетический event с файлом
      const fakeEvent = { target: { files: [file] } };
      await handleFileUpload(fakeEvent);
    });
  };

  const drawerRef = useRef(null);
  const closeDrawer = useCallback(() => {
    setSelected(null);
  }, []);

  useDialogA11y(Boolean(selected), closeDrawer, drawerRef);

  const filteredProducts = products.filter(p =>
    p.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const editorStats = useMemo(() => ({
    total: products.length,
    filtered: filteredProducts.length,
    withPhoto: products.filter(p => p.img).length,
  }), [products, filteredProducts]);

  const editorClassName = (extra = '') =>
    ['furniture-editor', `furniture-editor--theme-${resolvedTheme}`, extra].filter(Boolean).join(' ');

  if (loading) {
    return (
      <div className={editorClassName('furniture-editor--loading')}>
        <LoadingPage message="Загрузка мебели..." />
      </div>
    );
  }

  return (
    <div className={editorClassName()}>
      <div className="editor-ambient" aria-hidden="true">
        <div className="editor-ambient__orb editor-ambient__orb--1" />
        <div className="editor-ambient__orb editor-ambient__orb--2" />
        <div className="editor-ambient__grain" />
      </div>

      <header className="editor-hero">
        <div className="editor-hero__intro">
          <span className="editor-hero__badge">Конфигуратор</span>
          <h1 className="editor-hero__title">Редактор мебели</h1>
        </div>
        <div className="editor-hero__stats">
          <div className="editor-stat">
            <span className="editor-stat__value">{editorStats.total}</span>
            <span className="editor-stat__label">позиций</span>
          </div>
          <div className="editor-stat">
            <span className="editor-stat__value">{editorStats.withPhoto}</span>
            <span className="editor-stat__label">с фото</span>
          </div>
          {searchTerm && (
            <div className="editor-stat">
              <span className="editor-stat__value">{editorStats.filtered}</span>
              <span className="editor-stat__label">в поиске</span>
            </div>
          )}
        </div>
      </header>

      <div className="editor-toolbar">
        <div className="editor-search">
          <svg className="editor-search__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
            <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            className="editor-search__input"
            placeholder="Поиск по названию..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label="Поиск по названию в редакторе"
          />
          {searchTerm && (
            <button
              type="button"
              className="editor-search__clear"
              onClick={() => setSearchTerm('')}
              aria-label="Очистить поиск"
            >
              ×
            </button>
          )}
        </div>

        <button
          onClick={() => withLoading('add', addNewProduct)}
          className="btn btn-add"
          disabled={isPending('add')}
        >
          {isPending('add') ? (
            <><span className="spinner" /> Добавляем...</>
          ) : (
            '+ Добавить мебель'
          )}
        </button>
      </div>

      {/* Сетка карточек */}
      <div className="products-grid">
        {filteredProducts.length > 0 ? (
          filteredProducts.map((p, idx) => (
            <div
              key={p.id}
              className="product-card"
              style={{ '--card-delay': `${idx * 45}ms` }}
              onClick={() => openDrawer(p)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  openDrawer(p);
                }
              }}
              role="button"
              tabIndex={0}
              aria-labelledby={`editor-card-title-${p.id}`}
            >
              <span className="product-card__shine" aria-hidden="true" />

              <div className="product-card-image">
                <span className="product-card-id-badge">#{p.id}</span>
                {p.img ? (
                  <img
                    src={p.img}
                    alt={p.title}
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div className="no-image">
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
                      <circle cx="9" cy="10" r="2" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M21 16l-5-5-4 4-2-2-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span>Нет фото</span>
                  </div>
                )}
                <div className="product-card-overlay">
                  <span className="product-card-edit-hint">Редактировать</span>
                </div>
              </div>

                <div className="product-card-content">
                <div id={`editor-card-title-${p.id}`} className="product-card-title">{p.title}</div>
                <div className="product-card-meta">
                  {p.price ? (
                    <span className="product-card-price">{p.price} сом</span>
                  ) : (
                    <span className="product-card-price product-card-price--empty">Цена не указана</span>
                  )}
                </div>
                <div className="product-card-tags">
                  <span className="product-card-tag">{p.variables?.length || 0} перем.</span>
                  <span className="product-card-tag">{p.details?.length || 0} деталей</span>
                </div>
              </div>

              <div className="product-card-actions">
                <button
                  type="button"
                  className="btn-delete"
                  disabled={isPending(`delete-${p.id}`)}
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    withLoading(`delete-${p.id}`, () => deleteProduct(p.id)); 
                  }}
                  title="Удалить"
                  aria-label={`Удалить: ${p.title}`}
                >
                  {isPending(`delete-${p.id}`) ? '...' : '×'}
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state">
            <span className="empty-state__icon" aria-hidden="true">◇</span>
            <p>{searchTerm ? 'По запросу ничего не найдено' : 'Каталог пуст — добавьте первую позицию'}</p>
            <button onClick={() => withLoading('add', addNewProduct)} className="btn btn-add" disabled={isPending('add')}>
              {isPending('add') ? 'Добавляем...' : 'Добавить первую мебель'}
            </button>
          </div>
        )}
      </div>

      {/* DRAWER — редактор */}
      {selected && (
        <>
          <div
            className={`drawer-backdrop ${selected ? 'open' : ''}`}
            onClick={closeDrawer}
            role="presentation"
          />

          <div
            ref={drawerRef}
            className={`drawer ${selected ? 'open' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="editor-drawer-title"
            tabIndex={-1}
          >
            {/* Шапка drawer */}
            <div className="drawer-header">
              <div className="mini-photo">
                {selected.img ? (
                  <img src={selected.img} alt="" />
                ) : (
                  <div className="no-photo" aria-hidden="true">📷</div>
                )}
              </div>

              <div className="title-area">
                <input
                  id="editor-drawer-title"
                  value={selected.title}
                  onChange={e => update(['title'], e.target.value)}
                  placeholder="Название мебели"
                  aria-label="Название мебели"
                />
              </div>

              <div className="drawer-actions">
                <button 
                  onClick={() => withLoading('save', save)} 
                  className="btn btn-success"
                  disabled={isPending('save')}
                >
                  {isPending('save') ? (
                    <><span className="spinner" /> Сохраняем...</>
                  ) : 'Сохранить'}
                </button>
                <button 
                  onClick={closeDrawer} 
                  className="btn btn-danger"
                  disabled={isPending('save')}
                >
                  Отмена
                </button>
              </div>
            </div>

            <div className="drawer-body">
              {/* Основное */}
              <div className="form-section">
                <div className="form-section-title">Основное</div>

                {/* Фото */}
                <div 
                  className={`photo-upload-zone ${selected.img ? 'has-image' : ''} ${isPending('upload-photo') ? 'uploading' : ''}`}
                  onClick={() => !selected.img && !isPending('upload-photo') && document.getElementById('fileInput').click()}
                >
                  {selected.img ? (
                    <>
                      <img src={selected.img} alt="Фото мебели" />
                      <button 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          withLoading('delete-photo', deletePhoto); 
                        }} 
                        className="delete-photo-btn"
                        disabled={isPending('delete-photo') || isPending('upload-photo')}
                      >
                        {isPending('delete-photo') ? '...' : '×'}
                      </button>
                    </>
                  ) : isPending('upload-photo') ? (
                    <div className="upload-loading">
                      <span className="spinner" /> Загружаем фото...
                    </div>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); document.getElementById('fileInput').click(); }}
                      className="btn btn-upload"
                    >
                      Загрузить фото
                    </button>
                  )}
                  <input
                    type="file"
                    id="fileInput"
                    className="editor-file-input"
                    accept="image/*"
                    onChange={handleFileUploadWithLoading}
                  />
                </div>

                <div className="editor-form-group">
                  <label className="editor-label">Ссылка на фото</label>
                  <input
                    value={selected.img || ''}
                    onChange={e => update(['img'], e.target.value)}
                    placeholder="Прямая ссылка или путь после загрузки"
                    className="input-full"
                  />
                  <p className="hint">Прямая ссылка или загруженный файл</p>
                </div>

                <div className="editor-form-group">
                  <label className="editor-label">Цена (сом)</label>
                  <input
                    type="number"
                    value={selected.price || ''}
                    onChange={e => update(['price'], e.target.value)}
                    placeholder="0"
                    className="input-full"
                  />
                </div>
              </div>

              <div className="form-section">
                <div className="form-section-title">
                  Переменные
                  <span className="form-section-count">{selected.variables?.length || 0}</span>
                </div>
                <p className="form-section-desc">Размеры и параметры для калькулятора</p>
                {selected.variables?.map((v, idx) => (
                  <div key={idx} className="variable-row">
                    <input 
                      value={v.name} 
                      onChange={e => update(['variables', idx, 'name'], e.target.value)} 
                      placeholder="Имя" 
                      className="input-small" 
                    />
                    <input 
                      value={v.label} 
                      onChange={e => update(['variables', idx, 'label'], e.target.value)} 
                      placeholder="Подпись" 
                      className="input-medium" 
                    />
                    <input 
                      type="number" 
                      value={v.default} 
                      onChange={e => update(['variables', idx, 'default'], +e.target.value)} 
                      placeholder="По умолчанию" 
                      className="input-small" 
                    />
                    <button onClick={() => removeVariable(idx)} className="btn btn-remove">Удалить</button>
                  </div>
                ))}
                <button onClick={addVariable} className="btn btn-secondary">+ Добавить переменную</button>
              </div>

              {/* Условия */}
              <div className="form-section">
                <div className="form-section-title">
                  Условия
                  <span className="form-section-count">{selected.conditions?.length || 0}</span>
                </div>
                <p className="form-section-desc">Флаги для формул деталей</p>
                {selected.conditions?.map((c, idx) => (
                  <div key={idx} className="condition-row">
                    <input 
                      value={c.name} 
                      onChange={e => update(['conditions', idx, 'name'], e.target.value)} 
                      placeholder="Имя" 
                      className="input-small" 
                    />
                    <input 
                      value={c.label} 
                      onChange={e => update(['conditions', idx, 'label'], e.target.value)} 
                      placeholder="Подпись" 
                      className="input-medium" 
                    />
                    <button onClick={() => removeCondition(idx)} className="btn btn-remove">Удалить</button>
                  </div>
                ))}
                <button onClick={addCondition} className="btn btn-secondary">+ Добавить условие</button>
              </div>

              {/* Детали */}
              <div className="form-section">
                <div className="form-section-title">
                  Детали
                  <span className="form-section-count">{selected.details?.length || 0}</span>
                </div>
                <p className="form-section-desc">Формулы расчёта материалов</p>
                {selected.details?.map((d, idx) => (
                  <div key={idx} className="detail-card">
                    <div className="detail-header">
                      <input 
                        value={d.key} 
                        onChange={e => update(['details', idx, 'key'], e.target.value)} 
                        placeholder="Ключ" 
                        className="input-small" 
                      />
                      <input 
                        value={d.label} 
                        onChange={e => update(['details', idx, 'label'], e.target.value)} 
                        placeholder="Название детали" 
                        className="input-medium" 
                      />
                      <button onClick={() => removeDetail(idx)} className="btn btn-remove">Удалить</button>
                    </div>
                    <div className="detail-formulas">
                      <input 
                        value={d.formula_width || ''} 
                        onChange={e => update(['details', idx, 'formula_width'], e.target.value)} 
                        placeholder="Формула ширины" 
                      />
                      <input 
                        value={d.formula_height || ''} 
                        onChange={e => update(['details', idx, 'formula_height'], e.target.value)} 
                        placeholder="Формула высоты" 
                      />
                      <input 
                        value={d.count_formula || ''} 
                        onChange={e => update(['details', idx, 'count_formula'], e.target.value)} 
                        placeholder="Формула количества" 
                      />
                      <select 
                        value={d.if_condition || ''} 
                        onChange={e => update(['details', idx, 'if_condition'], e.target.value)}
                      >
                        <option value="">Без условия</option>
                        {selected.conditions?.map(c => (
                          <option key={c.name} value={c.name}>{c.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
                <button onClick={addDetail} className="btn btn-primary">+ Добавить деталь</button>
              </div>
            </div>

            {/* Футер drawer */}
            <div className="drawer-footer">
              <button 
                onClick={() => withLoading('save', save)} 
                className="btn btn-success"
                disabled={isPending('save')}
              >
                {isPending('save') ? (
                  <><span className="spinner" /> СОХРАНЯЕМ...</>
                ) : 'СОХРАНИТЬ ИЗМЕНЕНИЯ'}
              </button>
              <button 
                onClick={closeDrawer} 
                className="btn btn-danger"
                disabled={isPending('save')}
              >
                Отмена
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default FurnitureEditor;