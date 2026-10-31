jest.mock('./formulaEval', () => ({
    evaluateFormula: () => 0,
    evaluateReady: Promise.resolve(),
}));

import { isTodayOrder, normalizeProduct, readProductOrder } from './orderConvenience';

test('строковые поля изделия становятся списками, в том числе при двойной записи', () => {
    const variables = [{ name: 'shirina', default: 600 }];
    const product = normalizeProduct({
        id: 1,
        title: 'Стол',
        variables: JSON.stringify(JSON.stringify(variables)),
        conditions: '[]',
        details: variables,
    });
    expect(product.variables).toEqual(variables);
    expect(product.conditions).toEqual([]);
    expect(product.details).toEqual(variables);
});

test('фильтр «сегодня» считает день по Бишкеку', () => {
    const now = new Date('2026-10-31T20:30:00.000Z');
    expect(isTodayOrder({ createdAt: '2026-11-01T01:00:00+06:00' }, now)).toBe(true);
    expect(isTodayOrder({ createdAt: '2026-10-31T23:00:00+06:00' }, now)).toBe(false);
    expect(isTodayOrder({}, now)).toBe(false);
});

test('пустые и битые позиции заказа не попадают в список', () => {
    const raw = JSON.stringify([null, { title: 'Стол', price: 10 }, 'нет']);
    expect(readProductOrder(raw)).toEqual([{ title: 'Стол', price: 10 }]);
    expect(readProductOrder('не json')).toEqual([]);
});
