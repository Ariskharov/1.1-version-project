import {
    ROLE_ORDER,
    ROLES,
    bottomNav,
    can,
    canOpen,
    canWriteCollection,
    homeFor,
    isKnownRole,
    staffNav,
} from './roles';

test('у каждой роли есть короткое описание', () => {
    ROLE_ORDER.forEach((key) => {
        expect(ROLES[key].label.length).toBeGreaterThan(1);
        expect(ROLES[key].description.length).toBeGreaterThan(20);
    });
    expect(isKnownRole('boss')).toBe(false);
});

test('бухгалтер смотрит заказы и время, мастер правит заказы и мебель', () => {
    expect(can('accountant', 'attendance')).toBe(true);
    expect(can('accountant', 'viewOrders')).toBe(true);
    expect(can('accountant', 'editOrders')).toBe(false);
    expect(canWriteCollection('accountant', 'order')).toBe(false);
    expect(homeFor('accountant')).toBe('/attendance');

    expect(can('master', 'editOrders')).toBe(true);
    expect(can('master', 'editFurniture')).toBe(true);
    expect(can('master', 'adminPanel')).toBe(false);
    expect(staffNav('master').some((item) => item.to === '/admin')).toBe(false);
    expect(homeFor('master')).toBe('/view_orders');
});

test('кадры правят объявления, IT открывает журнал', () => {
    expect(can('hr', 'announcements')).toBe(true);
    expect(can('hr', 'adminPanel')).toBe(false);
    expect(canWriteCollection('hr', 'users')).toBe(false);
    expect(canWriteCollection('hr', 'order')).toBe(false);
    expect(homeFor('hr')).toBe('/announcements');
    expect(bottomNav('hr').map((item) => item.to)).toEqual(['/announcements', '/cabinet', '/']);

    expect(can('it', 'logs')).toBe(true);
    expect(can('it', 'adminPanel')).toBe(true);
    expect(can('it', 'scan')).toBe(true);
    expect(homeFor('it')).toBe('/logs');
    expect(staffNav('it').map((item) => item.to)).toEqual([
        '/admin',
        '/edit_mebel',
        '/placing_an_order',
        '/view_orders',
        '/attendance',
        '/announcements',
        '/cabinet',
        '/logs',
    ]);
    expect(staffNav('accountant').map((item) => item.to)).toEqual([
        '/view_orders',
        '/attendance',
        '/cabinet',
    ]);
    expect(staffNav('hr').some((item) => item.to === '/placing_an_order')).toBe(false);
    expect(bottomNav('scanner')).toEqual([]);
    expect(canOpen('accountant', '/attendance')).toBe(true);
    expect(canOpen('accountant', '/edit_mebel')).toBe(false);
    expect(canOpen('master', '/order_editor/4')).toBe(true);
    expect(canOpen('hr', '/announcements')).toBe(true);
    expect(canOpen('hr', '/admin')).toBe(false);
    expect(bottomNav(null).map((item) => item.label)).toEqual(['Каталог', 'Заявка']);
});
