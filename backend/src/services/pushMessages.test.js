const test = require('node:test');
const assert = require('node:assert/strict');
const {
    shouldNotifyAnnouncement,
    buildAnnouncementPayload,
    buildOrderRequestPayload,
} = require('./pushMessages');

test('новая заявка собирает имя, число позиций и пометку про цену', () => {
    const payload = buildOrderRequestPayload({
        id: 12,
        name_client: 'Алия',
        product_order: [{ price: 0 }, { price: 100 }],
    });
    assert.equal(payload.title, 'Новая заявка');
    assert.equal(payload.url, '/order/12');
    assert.equal(payload.tag, 'order-request-12');
    assert.match(payload.body, /Алия/);
    assert.match(payload.body, /2 позиции/);
    assert.match(payload.body, /Нужна цена/);
});

test('объявление уходит в кабинет и с тем же заголовком, что видит сотрудник', () => {
    const urgent = buildAnnouncementPayload({ id: 4, type: 'urgent', title: 'Смена', message: 'Закрыть цех' });
    assert.equal(urgent.title, 'Срочно: Смена');
    assert.equal(urgent.url, '/cabinet');
    assert.equal(urgent.tag, 'announcement-4');

    const persistent = buildAnnouncementPayload({ id: 5, type: 'persistent', title: '', message: 'График' });
    assert.equal(persistent.title, 'Актуально — объявление');
    assert.equal(persistent.body, 'График');
});

test('выключенное объявление не шлёт push, включение и правка текста шлют', () => {
    assert.equal(shouldNotifyAnnouncement({ isActive: true, message: 'Старое' }, { isActive: false }), false);
    assert.equal(shouldNotifyAnnouncement({ isActive: false, message: 'Старое' }, { isActive: true }), true);
    assert.equal(
        shouldNotifyAnnouncement({ isActive: true, title: 'А', message: 'Раз', type: 'urgent', image: null }, { message: 'Два' }),
        true
    );
    assert.equal(
        shouldNotifyAnnouncement({ isActive: true, title: 'А', message: 'Раз', type: 'urgent', image: null }, { message: 'Раз', image: '' }),
        false
    );
});
