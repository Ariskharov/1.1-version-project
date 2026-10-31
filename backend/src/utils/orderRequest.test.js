const test = require('node:test');
const assert = require('node:assert/strict');
const { buildOrderRequest } = require('./orderRequest');

test('строковые поля изделия из базы остаются в заявке', () => {
    const variables = [{ name: 'shirina', default: 600 }];
    const built = buildOrderRequest({
        name_client: 'Алия',
        phone: '0555123456',
        positions: [{ productId: 1, quantity: 1 }],
    }, [{
        id: 1,
        title: 'Стол',
        price: '1000',
        variables: JSON.stringify(JSON.stringify(variables)),
        conditions: '[]',
        details: variables,
    }]);

    assert.equal(built.error, undefined);
    assert.equal(built.record.product_order.length, 1);
    assert.deepEqual(built.record.product_order[0].variables, variables);
    assert.deepEqual(built.record.product_order[0].conditions, []);
    assert.equal(built.record.product_order[0].price, 1000);
});

test('ошибка в имени не собирает заявку', () => {
    const built = buildOrderRequest({ name_client: 'А', phone: '0555123456', positions: [] }, []);
    assert.equal(built.error, 'Укажите имя');
});
