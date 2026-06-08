import React, { useState, useEffect } from 'react';
import './edit_mebel.scss';
import { useModal } from '../../ModalContext';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8080';
const API_URL = `${API_BASE}/product`;
const UPLOAD_URL = `${API_BASE}/upload`;

function FurnitureEditor() {
    const [products, setProducts] = useState([]);
    const [selected, setSelected] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [pendingActions, setPendingActions] = useState({});
    const { showAlert, showConfirm } = useModal();

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
        if (!selected?.id) return;
        try {
            const response = await fetch(`${API_URL}/${selected.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(selected),
            });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            showAlert('Изменения сохранены!', 'success');
            setSelected(null);
            fetchProducts();
        } catch (err) {
            console.error('Ошибка сохранения:', err);
            showAlert('Ошибка сохранения: ' + err.message, 'error');
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
            showAlert('Ошибка сохранения фото: ' + err.message, 'error');
        }
    };

    const addNewProduct = async () => {
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
            showAlert('Новая мебель добавлена!', 'success');
            fetchProducts();
            setSelected(addedProduct);
        } catch (err) {
            console.error('Ошибка добавления:', err);
            showAlert('Ошибка добавления: ' + err.message, 'error');
        }
    };

    const deleteProduct = async (id) => {
        const ok = await showConfirm(`Удалить мебель ID ${id}?`);
        if (!ok) return;

        try {
            const response = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            showAlert('Мебель удалена!', 'success');
            fetchProducts();
            if (selected?.id === id) setSelected(null);
        } catch (err) {
            console.error('Ошибка удаления:', err);
            showAlert('Ошибка удаления: ' + err.message, 'error');
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
            if (!selected?.id) showAlert('Сохраните мебель сначала, чтобы присвоить ID.', 'error');
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
        } catch (err) {
            console.error('Ошибка загрузки фото:', err);
            showAlert('Ошибка загрузки фото: ' + err.message, 'error');
        }
    };

    const deletePhoto = async () => {
        if (!selected.img) return;
        const ok = await showConfirm('Удалить фото?');
        if (!ok) return;

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
        } catch (err) {
            console.error('Ошибка удаления фото:', err);
            showAlert('Ошибка удаления фото: ' + err.message, 'error');
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

  const closeDrawer = () => {
    setSelected(null);
  };

  // Закрытие по Escape
  React.useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && selected) {
        closeDrawer();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [selected]);

  // Блокировка прокрутки фона при открытом drawer
  React.useEffect(() => {
    if (selected) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [selected]);

  const filteredProducts = products.filter(p =>
    p.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="furniture-editor">
        <div className="loading-state">Загрузка мебели...</div>
      </div>
    );
  }

  return (
    <div className="furniture-editor">
      {/* Шапка страницы */}
      <div className="editor-header">
        <h1>Редактор мебели</h1>

        <div className="header-actions">
          <div className="search-wrapper">
            <input
              type="text"
              className="search-input"
              placeholder="Поиск по названию..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <button 
            onClick={() => withLoading('add', addNewProduct)} 
            className="btn btn-add"
            disabled={isPending('add')}
          >
            {isPending('add') ? (
              <><span className="spinner" /> Добавляем...</>
            ) : (
              '+ Добавить новую мебель'
            )}
          </button>
        </div>
      </div>

      {/* Сетка карточек */}
      <div className="products-grid">
        {filteredProducts.length > 0 ? (
          filteredProducts.map(p => (
            <div
              key={p.id}
              className="product-card"
              onClick={() => openDrawer(p)}
            >
              <div className="product-card-image">
                {p.img ? (
                  <img 
                    src={p.img} 
                    alt={p.title} 
                    loading="lazy" 
                    decoding="async" 
                  />
                ) : (
                  <div className="no-image">📷</div>
                )}
              </div>

              <div className="product-card-content">
                <div className="product-card-title">{p.title}</div>
                <div className="product-card-meta">
                  <span className="product-card-id">ID: {p.id}</span>
                  {p.price && (
                    <span className="product-card-price">{p.price} сом</span>
                  )}
                </div>
              </div>

              <div className="product-card-actions">
                <button
                  className="btn-delete"
                  disabled={isPending(`delete-${p.id}`)}
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    withLoading(`delete-${p.id}`, () => deleteProduct(p.id)); 
                  }}
                  title="Удалить"
                >
                  {isPending(`delete-${p.id}`) ? '...' : '×'}
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state">
            <p>Ничего не найдено</p>
            <button onClick={addNewProduct} className="btn btn-add">
              Добавить первую мебель
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
          />
          
          <div className={`drawer ${selected ? 'open' : ''}`}>
            {/* Шапка drawer */}
            <div className="drawer-header">
              <div className="mini-photo">
                {selected.img ? (
                  <img src={selected.img} alt="" />
                ) : (
                  <div className="no-photo">📷</div>
                )}
              </div>

              <div className="title-area">
                <input
                  value={selected.title}
                  onChange={e => update(['title'], e.target.value)}
                  placeholder="Название мебели"
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
                    style={{ display: 'none' }}
                    accept="image/*"
                    onChange={handleFileUploadWithLoading}
                  />
                </div>

                <div style={{ marginTop: 16 }}>
                  <input
                    value={selected.img || ''}
                    onChange={e => update(['img'], e.target.value)}
                    placeholder="Или вставьте прямую ссылку на фото"
                    className="input-full"
                  />
                  <p className="hint">Прямая ссылка или загруженный файл</p>
                </div>

                <div style={{ marginTop: 12 }}>
                  <input
                    type="number"
                    value={selected.price || ''}
                    onChange={e => update(['price'], e.target.value)}
                    placeholder="Цена (сом)"
                    className="input-full"
                  />
                </div>
              </div>

              {/* Переменные */}
              <div className="form-section">
                <div className="form-section-title">Переменные (размеры и параметры)</div>
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
                <div className="form-section-title">Условия (флаги)</div>
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
                <div className="form-section-title">Детали (формулы расчёта)</div>
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