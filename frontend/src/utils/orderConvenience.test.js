jest.mock('./formulaEval', () => ({
    evaluateFormula: () => 0,
    evaluateReady: Promise.resolve(),
}));

import { normalizeProduct } from './orderConvenience';

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
