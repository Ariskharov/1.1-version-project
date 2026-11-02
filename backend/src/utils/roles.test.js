const test = require('node:test');
const assert = require('node:assert/strict');
const {
    can,
    canWriteCollection,
    homeFor,
    isKnownRole,
    shouldRecord,
    logText,
    staffNav,
} = require('./roles');

test('бухгалтер смотрит заказы и время, но не меняет их', () => {
    assert.equal(can('accountant', 'viewOrders'), true);
    assert.equal(can('accountant', 'attendance'), true);
    assert.equal(can('accountant', 'editOrders'), false);
    assert.equal(can('accountant', 'adminPanel'), false);
    assert.equal(can('accountant', 'announcements'), false);
    assert.equal(canWriteCollection('accountant', 'order'), false);
    assert.equal(canWriteCollection('accountant', 'users'), false);
    assert.equal(homeFor('accountant'), '/attendance');
});

test('мастер оформляет заказы и мебель без панели администратора', () => {
    assert.equal(can('master', 'editOrders'), true);
    assert.equal(can('master', 'editFurniture'), true);
    assert.equal(can('master', 'adminPanel'), false);
    assert.equal(canWriteCollection('master', 'product'), true);
    assert.equal(canWriteCollection('master', 'order'), true);
    assert.equal(canWriteCollection('master', 'users'), false);
    assert.equal(canWriteCollection('master', 'announcements'), false);
});

test('кадры создают и правят объявления, заказы и сотрудников не трогают', () => {
    assert.equal(can('hr', 'announcements'), true);
    assert.equal(can('hr', 'editOrders'), false);
    assert.equal(can('hr', 'adminPanel'), false);
    assert.equal(canWriteCollection('hr', 'announcements'), true);
    assert.equal(canWriteCollection('hr', 'order'), false);
    assert.equal(canWriteCollection('hr', 'users'), false);
    assert.equal(homeFor('hr'), '/announcements');
});

test('IT имеет полный доступ и журнал, неизвестная роль ничего не пишет', () => {
    assert.equal(can('it', 'adminPanel'), true);
    assert.equal(can('it', 'logs'), true);
    assert.equal(can('it', 'editOrders'), true);
    assert.equal(can('it', 'scan'), true);
    assert.equal(canWriteCollection('it', 'users'), true);
    assert.equal(isKnownRole('it'), true);
    assert.equal(isKnownRole('boss'), false);
    assert.equal(canWriteCollection('boss', 'workSessions'), false);
    assert.equal(homeFor('it'), '/logs');
    assert.ok(staffNav('it').some((item) => item.to === '/logs'));
    assert.ok(staffNav('it').some((item) => item.to === '/attendance'));
    assert.ok(staffNav('accountant').some((item) => item.to === '/attendance'));
    assert.equal(staffNav('accountant').some((item) => item.to === '/admin'), false);
    assert.equal(staffNav('hr').some((item) => item.to === '/placing_an_order'), false);
    assert.equal(staffNav('master').some((item) => item.to === '/admin'), false);
});

test('в журнал попадают ошибки и изменения, но не опрос синхронизации', () => {
    assert.equal(shouldRecord('GET', '/sync', 200), false);
    assert.equal(shouldRecord('GET', '/server-logs', 200), false);
    assert.equal(shouldRecord('GET', '/product', 200), false);
    assert.equal(shouldRecord('POST', '/order', 201), true);
    assert.equal(shouldRecord('GET', '/order', 500), true);
    assert.equal(shouldRecord('POST', '/login', 401), true);
    assert.match(logText('POST', '/order', 201), /Создание/);
    assert.match(logText('GET', '/order', 500), /Ошибка сервера 500/);
});
