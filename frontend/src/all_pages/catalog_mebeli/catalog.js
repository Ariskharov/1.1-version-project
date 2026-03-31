import React, { useEffect, useState, useMemo } from 'react';
import { evaluate } from 'mathjs';
import './catalog.scss';

const Catalog = () => {
    const [products, setProducts] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [inputs, setInputs] = useState({});
    const [result, setResult] = useState({});

    useEffect(() => {
        fetch('http://localhost:8080/product')
            .then(res => res.json())
            .then(data => {
                setProducts(Array.isArray(data) ? data : [data]);
                if (data.length > 0) {
                    const first = data[0];
                    setSelectedProduct(first);
                    // Инициализируем inputs дефолтными значениями
                    const initialInputs = {};
                    (first.variables || []).forEach(v => {
                        initialInputs[v.name] = v.default;
                    });
                    (first.conditions || []).forEach(c => {
                        if (c.type === 'flag') initialInputs[c.name] = c.default || false;
                    });
                    setInputs(initialInputs);
                }
            })
            .catch(err => console.error('Ошибка загрузки:', err));
    }, []);

    const handleInputChange = (key, value) => {
        setInputs(prev => ({ ...prev, [key]: value }));
        setResult({}); // Очищаем результат при изменении
    };

    const handleCheckboxChange = (key) => {
        setInputs(prev => ({ ...prev, [key]: !prev[key] }));
        setResult({});
    };

    const calculate = () => {
        if (!selectedProduct) return;

        // Собираем все значения
        const nums = {};

        // Переменные (числа)
        (selectedProduct.variables || []).forEach(v => {
            const userVal = Number(inputs[v.name]);
            nums[v.name] = isNaN(userVal) || inputs[v.name] === '' ? v.default : userVal;
        });

        // Условия (флаги)
        (selectedProduct.conditions || []).forEach(c => {
            if (c.type === 'flag') {
                nums[c.name] = inputs[c.name] ?? c.default ?? false;
            }
            // Если потом добавим range — здесь же evaluate(c.condition, nums)
        });

        const resultObj = {};

        // Обрабатываем детали
        (selectedProduct.details || []).forEach(detail => {
            // Проверка условия (если есть)
            if (detail.if_condition && !nums[detail.if_condition]) return;

            try {
                const width = evaluate(detail.formula_width || '0', nums);
                const height = detail.formula_height ? evaluate(detail.formula_height, nums) : null;
                const count = evaluate(detail.count_formula || '1', nums);

                const sizeStr = height ? `${Math.round(width)} × ${Math.round(height)}` : Math.round(width);
                resultObj[detail.key] = `${detail.label} — ${sizeStr} мм (${Math.round(count)} шт)`;
            } catch (err) {
                console.error('Ошибка формулы:', err);
                resultObj[detail.key] = `${detail.label} — ошибка формулы`;
            }
        });

        setResult(resultObj);
    };

    const resultsArray = useMemo(() => Object.entries(result), [result]);

    return (
        <div className="catalog container">
            <h2>Расчёт мебели</h2>

            <div className="products-grid">
                {products.map(product => (
                    <div
                        key={product.id}
                        className={`product-card ${selectedProduct?.id === product.id ? 'active' : ''}`}
                        onClick={() => {
                            setSelectedProduct(product);
                            setResult({});
                            // Обновляем inputs под новую мебель
                            const newInputs = {};
                            (product.variables || []).forEach(v => {
                                newInputs[v.name] = v.default;
                            });
                            (product.conditions || []).forEach(c => {
                                if (c.type === 'flag') newInputs[c.name] = c.default ?? false;
                            });
                            setInputs(newInputs);
                        }}
                    >
                        <img
                            src={product.img.startsWith('http') ? product.img : `http://localhost:8080${product.img.startsWith('/') ? '' : '/'}${product.img}`}
                            alt={product.title}
                        />
                        <p>{product.id}. {product.title}</p>
                    </div>
                ))}
            </div>

            {selectedProduct && (
                <>
                    <h3>{selectedProduct.title}{selectedProduct.price ? " -- " + selectedProduct.price + "сом" : ""}</h3>

                    <form onSubmit={e => { e.preventDefault(); calculate(); }} className="inputs-form">
                        {/* Динамические инпуты из variables */}
                        <div className="input-row">
                            {(selectedProduct.variables || []).map(v => (
                                <div>
                                    <p>{v.label}</p>
                                    <input
                                        key={v.name}
                                        type="number"
                                        placeholder={v.label}
                                        value={inputs[v.name] ?? ''}
                                        onChange={e => handleInputChange(v.name, e.target.value)}
                                        required={['shirina', 'glubina', 'visota'].includes(v.name)}
                                    />
                                </div>

                            ))}
                        </div>

                        {/* Условия (checkbox для flag) */}
                        <div className="checkboxes">
                            {(selectedProduct.conditions || []).map(c => (
                                c.type === 'flag' && (
                                    <label key={c.name}>
                                        <input
                                            type="checkbox"
                                            checked={inputs[c.name] ?? false}
                                            onChange={() => handleCheckboxChange(c.name)}
                                        />
                                        {c.label}
                                    </label>
                                )
                            ))}
                        </div>

                        <button type="submit" className="calculate-btn">Посчитать</button>
                    </form>

                    {resultsArray.length > 0 && (
                        <div className="results">
                            <h3>Результат:</h3>
                            <table className="results-table">
                                <thead>
                                    <tr>
                                        <th>Деталь</th>
                                        <th>Размер и количество</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {resultsArray.map(([key, value]) => (
                                        <tr key={key}>
                                            <td>{value.split(' — ')[0]}</td>
                                            <td>{value.split(' — ')[1]}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                </>
            )}
        </div>
    );
};

export default Catalog;