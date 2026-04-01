import React, { useState, useEffect } from 'react';
import './edit_mebel.scss'

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080';
const API_URL = `${BASE_URL}/product`;
const UPLOAD_URL = `${BASE_URL}/upload`;

function FurnitureEditor() {
    const [products, setProducts] = useState([]);
    const [selected, setSelected] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(API_URL)
            .then(r => r.json())
            .then(data => {
                setProducts(Array.isArray(data) ? data : [data]);
                setLoading(false);
            })
            .catch(err => console.error('Ошибка загрузки:', err));
    }, []);

    const selectProduct = (p) => {
        setSelected(JSON.parse(JSON.stringify(p)));
    };

    // Основное сохранение (закрывает редактор)
    const save = async () => {
        if (!selected?.id) return;
        try {
            const response = await fetch(`${API_URL}/${selected.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(selected),
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const updatedProduct = await response.json();
            alert('Изменения сохранены!');
            setSelected(null); // Закрываем только здесь
            fetchProducts();
        } catch (err) {
            console.error('Ошибка сохранения:', err);
            alert('Ошибка сохранения: ' + err.message);
        }
    };

    // Сохранение только img (не закрывает редактор)
    const saveImg = async (productToSave = null) => {
        const product = productToSave || selected;
        if (!product?.id) return;
        try {
            const response = await fetch(`${API_URL}/${product.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(product),
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const updatedProduct = await response.json();
            setSelected(updatedProduct);
            fetchProducts();
            // НЕ закрываем редактор
        } catch (err) {
            console.error('Ошибка сохранения фото:', err);
            alert('Ошибка сохранения фото: ' + err.message);
        }
    };

    const fetchProducts = async () => {
        try {
            const res = await fetch(API_URL);
            const data = await res.json();
            setProducts(Array.isArray(data) ? data : [data]);
        } catch (err) {
            console.error('Ошибка обновления списка:', err);
        }
    };

    const addNewProduct = async () => {
        const newId = products.length + 1;
        const newProduct = {
            id: newId,
            title: 'Новая мебель',
            img: '',
            price:'',
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
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const addedProduct = await response.json();
            alert('Новая мебель добавлена!');
            fetchProducts();
            setSelected(addedProduct);
        } catch (err) {
            console.error('Ошибка добавления:', err);
            alert('Ошибка добавления: ' + err.message);
        }
    };

    const deleteProduct = async (id) => {
        if (!window.confirm(`Удалить мебель ID ${id}?`)) return;

        try {
            const response = await fetch(`${API_URL}/${id}`, {
                method: 'DELETE',
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            alert('Мебель удалена!');
            fetchProducts();
            if (selected?.id === id) setSelected(null);
        } catch (err) {
            console.error('Ошибка удаления:', err);
            alert('Ошибка удаления: ' + err.message);
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

    // Загрузка фото
    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!selected?.id) {
            alert('Сохраните мебель сначала, чтобы присвоить ID.');
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch(UPLOAD_URL, {
                method: 'POST',
                body: formData,
            });
            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }
            const { path } = await res.json();

            // Создаем копию объекта сразу с новым путем к картинке
            const updatedProduct = { ...selected, img: path };

            // Обновляем состояние (для UI)
            setSelected(updatedProduct);

            // Сохраняем напрямую обновленный объект, не дожидаясь setSelected
            await saveImg(updatedProduct);
        } catch (err) {
            console.error('Ошибка загрузки фото:', err);
            alert('Ошибка загрузки фото: ' + err.message);
        }
    };

    // Удаление фото
    const deletePhoto = async () => {
        if (!selected.img || !window.confirm('Удалить фото?')) return;

        try {
            const fileName = selected.img.replace(/^\/utilse\//, '');
            const res = await fetch(UPLOAD_URL, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fileName }),
            });
            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }

            // Создаем копию объекта с пустым путем
            const updatedProduct = { ...selected, img: '' };

            // Обновляем состояние
            setSelected(updatedProduct);

            // Сохраняем напрямую
            await saveImg(updatedProduct);
        } catch (err) {
            console.error('Ошибка удаления фото:', err);
            alert('Ошибка удаления фото: ' + err.message);
        }
    };

    // Добавление новой переменной
    const addVariable = () => {
        update(['variables'], [
            ...(selected.variables || []),
            { name: 'new_var', label: 'Новая переменная', default: 0 }
        ]);
    };

    // Удаление переменной
    const removeVariable = (idx) => {
        update(['variables'], selected.variables.filter((_, i) => i !== idx));
    };

    // Добавление нового условия
    const addCondition = () => {
        update(['conditions'], [
            ...(selected.conditions || []),
            { name: 'new_condition', label: 'Новое условие', type: 'flag', default: false }
        ]);
    };

    // Удаление условия
    const removeCondition = (idx) => {
        update(['conditions'], selected.conditions.filter((_, i) => i !== idx));
    };

    // Добавление новой детали
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

    // Удаление детали
    const removeDetail = (idx) => {
        update(['details'], selected.details.filter((_, i) => i !== idx));
    };

    if (loading) return <div style={{ padding: 40, fontSize: 20 }}>Загрузка мебели...</div>;

    return (
        <div className="furniture-editor">
            <h1 className="editor-title">Редактор мебели</h1>

            {/* Кнопка добавления новой мебели */}
            <button onClick={addNewProduct} className="btn btn-add">
                + Добавить новую мебель
            </button>

            {/* Список мебели с миниатюрами */}
            <div className="products-list">
                {products.map(p => (
                    <div
                        key={p.id}
                        className={`product-item ${selected?.id === p.id ? 'active' : ''}`}
                        onClick={() => selectProduct(p)}
                    >
                        <div className="product-image">
                            {p.img ? (
                                <img src={p.img} alt={p.title} />
                            ) : (
                                <div className="no-image">📷</div>
                            )}
                        </div>
                        <div className="product-info">
                            <span className="product-title">{p.title}</span>
                            <span className="product-id">ID: {p.id}</span>
                        </div>
                        <button
                            onClick={(e) => { e.stopPropagation(); deleteProduct(p.id); }}
                            className="btn-delete-small"
                        >
                            ×
                        </button>
                    </div>
                ))}
            </div>

            {selected && (
                <div className="editor-panel">
                    {/* Название + Фото */}
                    <div className="editor-header">
                        <input
                            value={selected.title}
                            onChange={e => update(['title'], e.target.value)}
                            className="title-input"
                            placeholder="Название мебели"
                        />

                        <div className="photo-upload">
                            {selected.img ? (
                                <>
                                    <img
                                        src={selected.img}
                                        alt="Фото мебели"
                                        className="uploaded-image"
                                    />
                                    <button onClick={deletePhoto} className="delete-photo-btn">
                                        ×
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={() => document.getElementById('fileInput').click()}
                                    className="btn btn-upload"
                                >
                                    Добавить фото
                                </button>
                            )}
                            <input
                                type="file"
                                id="fileInput"
                                style={{ display: 'none' }}
                                accept="image/*"
                                onChange={handleFileUpload}
                            />
                        </div>
                    </div>

                    {/* Прямая ссылка на фото */}
                    <div className="form-group">
                        <input
                            value={selected.img}
                            onChange={e => update(['img'], e.target.value)}
                            placeholder="Или вставьте прямую ссылку на фото"
                            className="input-full"
                        />
                        <p className="hint">Ссылка будет работать, пока фото доступно в интернете</p>
                    </div>

                    {/* Цена */}
                    <div className="form-group">
                        <input
                            type="number"
                            value={selected.price || ''}
                            onChange={e => update(['price'], e.target.value)}
                            placeholder="Цена"
                            className="input-full"
                        />
                        <p className="hint">Установите цену</p>
                    </div>

                    {/* Переменные */}
                    <div className="section">
                        <h3 className="section-title">Переменные (размеры и параметры)</h3>
                        {selected.variables?.map((v, idx) => (
                            <div key={idx} className="variable-row">
                                <input
                                    value={v.name}
                                    onChange={e => update(['variables', idx, 'name'], e.target.value)}
                                    placeholder="Имя (shirina)"
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
                                <button onClick={() => removeVariable(idx)} className="btn btn-remove">
                                    Удалить
                                </button>
                            </div>
                        ))}
                        <button onClick={addVariable} className="btn btn-secondary">
                            + Добавить переменную
                        </button>
                    </div>

                    {/* Условия */}
                    <div className="section">
                        <h3 className="section-title">Условия (флаги и проверки)</h3>
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
                                <select
                                    value={c.type}
                                    onChange={e => update(['conditions', idx, 'type'], e.target.value)}
                                    className="input-small"
                                >
                                    <option value="flag">Флаг</option>
                                    <option value="range">Диапазон</option>
                                </select>
                                <button onClick={() => removeCondition(idx)} className="btn btn-remove">
                                    Удалить
                                </button>
                            </div>
                        ))}
                        <button onClick={addCondition} className="btn btn-secondary">
                            + Добавить условие
                        </button>
                    </div>

                    {/* Детали */}
                    <div className="section">
                        <h3 className="section-title">Детали (формулы)</h3>
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
                                        placeholder="Название"
                                        className="input-medium"
                                    />
                                    <button onClick={() => removeDetail(idx)} className="btn btn-remove">
                                        Удалить
                                    </button>
                                </div>

                                <div className="detail-formulas">
                                    <input
                                        value={d.formula_width}
                                        onChange={e => update(['details', idx, 'formula_width'], e.target.value)}
                                        placeholder="Формула ширины"
                                    />
                                    <input
                                        value={d.formula_height}
                                        onChange={e => update(['details', idx, 'formula_height'], e.target.value)}
                                        placeholder="Формула высоты"
                                    />
                                    <input
                                        value={d.count_formula}
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
                        <button onClick={addDetail} className="btn btn-primary">
                            + Добавить деталь
                        </button>
                    </div>

                    {/* Кнопки действий */}
                    <div className="editor-actions">
                        <button onClick={save} className="btn btn-success large">
                            СОХРАНИТЬ ИЗМЕНЕНИЯ
                        </button>
                        <button onClick={() => setSelected(null)} className="btn btn-danger large">
                            Отмена
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default FurnitureEditor;