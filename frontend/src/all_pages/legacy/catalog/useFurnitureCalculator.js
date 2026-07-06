import { useState, useEffect, useCallback } from 'react';
import { evaluate } from 'mathjs';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8080';

export function useFurnitureCalculator() {
    const [products, setProducts] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [inputs, setInputs] = useState({});
    const [result, setResult] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [validationErrors, setValidationErrors] = useState({});

    // Загрузка продуктов
    useEffect(() => {
        const fetchProducts = async () => {
            try {
                setIsLoading(true);
                setError(null);

                const res = await fetch(`${API_BASE}/product`);
                
                if (!res.ok) {
                    throw new Error(`Ошибка загрузки: ${res.status}`);
                }

                const data = await res.json();
                const productsArray = Array.isArray(data) ? data : [data];
                
                setProducts(productsArray);
                // Убрали автоматическое открытие модалки первого товара при загрузке страницы
            } catch (err) {
                console.error('Ошибка загрузки продуктов:', err);
                setError('Не удалось загрузить каталог мебели. Попробуйте обновить страницу.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchProducts();
    }, []);

    // Инициализация inputs для выбранного продукта
    const initializeInputs = useCallback((product) => {
        const newInputs = {};

        (product.variables || []).forEach(v => {
            newInputs[v.name] = v.default;
        });

        (product.conditions || []).forEach(c => {
            if (c.type === 'flag') {
                newInputs[c.name] = c.default ?? false;
            }
        });

        return newInputs;
    }, []);

    // Выбор продукта
    const selectProduct = useCallback((product) => {
        if (!product) {
            // Закрытие модалки
            setSelectedProduct(null);
            setResult({});
            setValidationErrors({});
            setInputs({});
            return;
        }

        setSelectedProduct(product);
        setResult({});
        setValidationErrors({});
        const newInputs = initializeInputs(product);
        setInputs(newInputs);
    }, [initializeInputs]);

    // Обработка изменения числового поля
    const handleInputChange = useCallback((key, value) => {
        setInputs(prev => ({ ...prev, [key]: value }));
        setResult({});
        // Очищаем ошибку по этому полю при изменении
        setValidationErrors(prev => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
    }, []);

    // Обработка чекбоксов
    const handleCheckboxChange = useCallback((key) => {
        setInputs(prev => ({ ...prev, [key]: !prev[key] }));
        setResult({});
        setValidationErrors(prev => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
    }, []);

    // Валидация полей
    const validateInputs = useCallback(() => {
        const errors = {};

        if (!selectedProduct) return errors;

        (selectedProduct.variables || []).forEach(v => {
            const isRequired = v.required ?? ['shirina', 'glubina', 'visota'].includes(v.name);
            const value = inputs[v.name];

            if (isRequired && (value === '' || value === null || value === undefined)) {
                errors[v.name] = `${v.label} обязательно для заполнения`;
            }
        });

        return errors;
    }, [selectedProduct, inputs]);

    // Чистая функция расчёта (без побочных эффектов) — легко тестировать
    const performCalculation = useCallback((product, currentInputs) => {
        const nums = {};

        (product.variables || []).forEach(v => {
            const userVal = Number(currentInputs[v.name]);
            nums[v.name] = isNaN(userVal) || currentInputs[v.name] === '' ? v.default : userVal;
        });

        (product.conditions || []).forEach(c => {
            if (c.type === 'flag') {
                nums[c.name] = currentInputs[c.name] ?? c.default ?? false;
            }
        });

        const resultObj = {};

        (product.details || []).forEach(detail => {
            if (detail.if_condition && !nums[detail.if_condition]) return;

            try {
                const width = evaluate(detail.formula_width || '0', nums);
                const height = detail.formula_height ? evaluate(detail.formula_height, nums) : null;
                const count = evaluate(detail.count_formula || '1', nums);

                const sizeStr = height 
                    ? `${Math.round(width)} × ${Math.round(height)}` 
                    : Math.round(width);

                resultObj[detail.key] = `${detail.label} — ${sizeStr} мм (${Math.round(count)} шт)`;
            } catch (err) {
                console.error('Ошибка вычисления формулы для детали:', detail.key, err);
                resultObj[detail.key] = `${detail.label} — ошибка в формуле (проверьте данные)`;
            }
        });

        return resultObj;
    }, []);

    // Основная функция расчёта
    const calculate = useCallback(() => {
        if (!selectedProduct) return;

        const errors = validateInputs();
        setValidationErrors(errors);

        if (Object.keys(errors).length > 0) {
            setResult({});
            return;
        }

        const calculatedResult = performCalculation(selectedProduct, inputs);
        setResult(calculatedResult);
    }, [selectedProduct, inputs, validateInputs, performCalculation]);

    // Сброс результата при изменении входных данных (уже делается в handleInputChange/handleCheckboxChange)

    const resultsArray = Object.entries(result);

    return {
        // Данные
        products,
        selectedProduct,
        inputs,
        result,
        resultsArray,

        // Состояния
        isLoading,
        error,
        validationErrors,

        // Действия
        selectProduct,
        handleInputChange,
        handleCheckboxChange,
        calculate,
    };
}