import React, { useState, useEffect } from 'react';

const API_URL = 'http://localhost:8080/product';
const UPLOAD_URL = 'http://localhost:8080/upload';

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
        <div style={{ padding: 24, fontFamily: 'system-ui', maxWidth: 1200, margin: '0 auto' }}>
            <h1 style={{ marginBottom: 32 }}>Редактор мебели</h1>

            {/* Кнопка добавления новой мебели */}
            <button
                onClick={addNewProduct}
                style={{
                    background: '#ff6b6b',
                    color: 'white',
                    border: 'none',
                    padding: '12px 24px',
                    borderRadius: 8,
                    fontSize: 18,
                    marginBottom: 24,
                    cursor: 'pointer'
                }}
            >
                + Добавить новую мебель
            </button>

            {/* Список мебели */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 40 }}>
                {products.map(p => (
                    <div
                        key={p.id}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            background: selected?.id === p.id ? '#0066ff' : '#f0f0f0',
                            color: selected?.id === p.id ? 'white' : '#333',
                            padding: '12px 20px',
                            borderRadius: 8,
                            cursor: 'pointer'
                        }}
                        onClick={() => selectProduct(p)}
                    >
                        <span>{p.title} (ID: {p.id})</span>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                deleteProduct(p.id);
                            }}
                            style={{
                                background: '#dc3545',
                                color: 'white',
                                border: 'none',
                                padding: '4px 8px',
                                borderRadius: 4,
                                fontSize: 12,
                                cursor: 'pointer'
                            }}
                        >
                            ×
                        </button>
                    </div>
                ))}
            </div>

            {selected && (
                <div style={{ background: '#fff', padding: 32, borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
                    {/* Название + Фото */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 32 }}>
                        <input
                            value={selected.title}
                            onChange={e => update(['title'], e.target.value)}
                            placeholder="Название мебели"
                            style={{ fontSize: 28, flex: 1, border: 'none', outline: 'none' }}
                        />

                        {/* Блок фото */}
                        <div style={{
                            width: 200,
                            height: 200,
                            border: '2px dashed #ccc',
                            borderRadius: 8,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden',
                            position: 'relative'
                        }}>
                            {selected.img ? (
                                <>
                                    <img
                                        src={selected.img.startsWith('http') ? selected.img : `http://localhost:8080/${selected.img.replace(/^\//, '')}`}
                                        alt="Фото мебели"
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                    <button
                                        onClick={deletePhoto}
                                        style={{
                                            position: 'absolute',
                                            top: 8,
                                            right: 8,
                                            background: 'rgba(220, 53, 69, 0.8)',
                                            color: 'white',
                                            border: 'none',
                                            padding: '4px 8px',
                                            borderRadius: 4,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        ×
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={() => document.getElementById('fileInput').click()}
                                    style={{
                                        background: '#28a745',
                                        color: 'white',
                                        border: 'none',
                                        padding: '8px 16px',
                                        borderRadius: 6,
                                        cursor: 'pointer'
                                    }}
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

                    {/* Альтернатива — ссылка */}
                    <div style={{ marginBottom: 32 }}>
                        <input
                            value={selected.img}
                            onChange={e => update(['img'], e.target.value)}
                            placeholder="Или вставьте прямую ссылку на фото (альтернатива)"
                            style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 6 }}
                        />
                        <p style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                            Ссылка будет работать, пока фото доступно в интернете
                        </p>
                    </div>
                    {/* установка цен на мебель */}
                    <div style={{ marginBottom: 32 }}>
                        <input
                            value={selected.price}
                            placeholder="цена"
                            onChange={e => update(['price'], e.target.value)}
                            style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 6 }}
                            type="number"
                        />
                        <p style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                            установите цену
                        </p>
                    </div>

                    {/* Переменные */}
                    <h3 style={{ marginBottom: 16 }}>Переменные (размеры и параметры)</h3>
                    {selected.variables?.map((v, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: 16, marginBottom: 12, alignItems: 'center' }}>
                            <input
                                value={v.name}
                                onChange={e => update(['variables', idx, 'name'], e.target.value)}
                                placeholder="Имя (shirina)"
                                style={{ width: 180 }}
                            />
                            <input
                                value={v.label}
                                onChange={e => update(['variables', idx, 'label'], e.target.value)}
                                placeholder="Подпись (Ширина)"
                                style={{ flex: 1 }}
                            />
                            <input
                                type="number"
                                value={v.default}
                                onChange={e => update(['variables', idx, 'default'], +e.target.value)}
                                placeholder="По умолчанию"
                                style={{ width: 120 }}
                            />
                            <button
                                onClick={() => removeVariable(idx)}
                                style={{ background: '#dc3545', color: 'white', border: 'none', padding: '6px 12px', borderRadius: 6 }}
                            >
                                Удалить
                            </button>
                        </div>
                    ))}
                    <button
                        onClick={addVariable}
                        style={{ background: '#28a745', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 6, marginBottom: 24 }}
                    >
                        + Добавить переменную
                    </button>

                    {/* Условия */}
                    <h3 style={{ marginBottom: 16 }}>Условия (флаги и проверки)</h3>
                    {selected.conditions?.map((c, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: 16, marginBottom: 12, alignItems: 'center' }}>
                            <input
                                value={c.name}
                                onChange={e => update(['conditions', idx, 'name'], e.target.value)}
                                placeholder="Имя (stoleshka)"
                                style={{ width: 180 }}
                            />
                            <input
                                value={c.label}
                                onChange={e => update(['conditions', idx, 'label'], e.target.value)}
                                placeholder="Подпись (Столешница)"
                                style={{ flex: 1 }}
                            />
                            <select
                                value={c.type}
                                onChange={e => update(['conditions', idx, 'type'], e.target.value)}
                                style={{ width: 160 }}
                            >
                                <option value="flag">Флаг (чекбокс)</option>
                                <option value="range">Диапазон (условие)</option>
                            </select>
                            <button
                                onClick={() => removeCondition(idx)}
                                style={{ background: '#dc3545', color: 'white', border: 'none', padding: '6px 12px', borderRadius: 6 }}
                            >
                                Удалить
                            </button>
                        </div>
                    ))}
                    <button
                        onClick={addCondition}
                        style={{ background: '#17a2b8', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 6, marginBottom: 32 }}
                    >
                        + Добавить условие
                    </button>

                    {/* Детали */}
                    <h3 style={{ marginBottom: 16 }}>Детали (формулы)</h3>
                    {selected.details?.map((d, idx) => (
                        <div key={idx} style={{ marginBottom: 24, padding: 16, background: '#f8f9fa', borderRadius: 8 }}>
                            <div style={{ display: 'flex', gap: 16, marginBottom: 12, alignItems: 'center' }}>
                                <input
                                    value={d.key}
                                    onChange={e => update(['details', idx, 'key'], e.target.value)}
                                    placeholder="Ключ (bok)"
                                    style={{ width: 140 }}
                                />
                                <input
                                    value={d.label}
                                    onChange={e => update(['details', idx, 'label'], e.target.value)}
                                    placeholder="Название (бок)"
                                    style={{ flex: 1 }}
                                />
                                <button
                                    onClick={() => removeDetail(idx)}
                                    style={{ background: '#dc3545', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 6 }}
                                >
                                    Удалить деталь
                                </button>
                            </div>

                            <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                                <input
                                    value={d.formula_width}
                                    onChange={e => update(['details', idx, 'formula_width'], e.target.value)}
                                    placeholder="Ширина: shirina - 32"
                                    style={{ flex: 1 }}
                                />
                                <input
                                    value={d.formula_height}
                                    onChange={e => update(['details', idx, 'formula_height'], e.target.value)}
                                    placeholder="Высота: visota - 16"
                                    style={{ flex: 1 }}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                                <input
                                    value={d.count_formula}
                                    onChange={e => update(['details', idx, 'count_formula'], e.target.value)}
                                    placeholder="Количество: coll * 2"
                                    style={{ flex: 1 }}
                                />
                                <select
                                    value={d.if_condition || ''}
                                    onChange={e => update(['details', idx, 'if_condition'], e.target.value)}
                                    style={{ width: 200 }}
                                >
                                    <option value="">Без условия</option>
                                    {selected.conditions?.map(c => (
                                        <option key={c.name} value={c.name}>{c.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    ))}


                    <button
                        onClick={addDetail}
                        style={{ background: '#0066cc', color: 'white', border: 'none', padding: '12px 24px', borderRadius: 6, marginTop: 16 }}
                    >
                        + Добавить деталь
                    </button>

                    {/* Кнопки сохранения */}
                    <div style={{ marginTop: 48, textAlign: 'center' }}>
                        <button
                            onClick={save}
                            style={{
                                padding: '16px 48px',
                                fontSize: 20,
                                background: '#28a745',
                                color: 'white',
                                border: 'none',
                                borderRadius: 8,
                                cursor: 'pointer'
                            }}
                        >
                            СОХРАНИТЬ ИЗМЕНЕНИЯ
                        </button>
                        <button
                            onClick={() => setSelected(null)}
                            style={{
                                marginLeft: 24,
                                padding: '16px 40px',
                                background: '#dc3545',
                                color: 'white',
                                border: 'none',
                                borderRadius: 8
                            }}
                        >
                            Отмена
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default FurnitureEditor;