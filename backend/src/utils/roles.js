const ROLES = {
    user: {
        label: 'Сотрудник',
        description: 'Личный кабинет и просмотр заказов. Заказы, мебель и сотрудников не меняет.',
    },
    manager: {
        label: 'Менеджер',
        description: 'Прежняя роль сотрудника: кабинет и просмотр заказов, без правки мебели и заказов.',
    },
    scanner: {
        label: 'Сканер',
        description: 'Отмечает приход и уход по бейджу. Панели управления нет.',
    },
    accountant: {
        label: 'Бухгалтер',
        description: 'Смотрит заказы и кто во сколько пришёл и ушёл. Может скачать эти отметки. Заказы и мебель не меняет.',
    },
    master: {
        label: 'Мастер',
        description: 'Оформляет и редактирует заказы, правит мебель в каталоге. Панели администратора нет.',
    },
    hr: {
        label: 'Отдел кадров',
        description: 'Создаёт и редактирует объявления. Сотрудников не добавляет, заказы не оформляет и не меняет.',
    },
    admin: {
        label: 'Администратор',
        description: 'Полный доступ: сотрудники, смены, заказы, мебель, объявления и журнал сервера.',
    },
    it: {
        label: 'IT-специалист',
        description: 'Полный доступ, как у администратора, и отдельная страница журнала: ошибки и события сервера.',
    },
};

const CAPS = {
    cabinet: ['user', 'manager', 'scanner', 'accountant', 'master', 'hr', 'admin', 'it'],
    viewOrders: ['user', 'manager', 'scanner', 'accountant', 'master', 'hr', 'admin', 'it'],
    editOrders: ['master', 'admin', 'it'],
    editFurniture: ['master', 'admin', 'it'],
    adminPanel: ['admin', 'it'],
    announcements: ['hr', 'admin', 'it'],
    attendance: ['accountant', 'admin', 'it'],
    logs: ['admin', 'it'],
    scan: ['scanner', 'admin', 'it'],
};

const WRITE_CAP = {
    product: 'editFurniture',
    order: 'editOrders',
    announcements: 'announcements',
    users: 'adminPanel',
};

const normalizeRole = (role) => String(role || '').trim().toLowerCase();

const isKnownRole = (role) => Object.prototype.hasOwnProperty.call(ROLES, normalizeRole(role));

const can = (role, cap) => {
    const list = CAPS[cap];
    return Array.isArray(list) && list.includes(normalizeRole(role));
};

const canWriteCollection = (role, collection) => {
    if (collection === 'workSessions') return isKnownRole(role);
    const cap = WRITE_CAP[collection];
    return cap ? can(role, cap) : false;
};

const homeFor = (role) => {
    const name = normalizeRole(role);
    if (name === 'scanner') return '/scan';
    if (name === 'admin') return '/edit_mebel';
    if (name === 'it') return '/logs';
    if (name === 'master') return '/view_orders';
    if (name === 'accountant') return '/attendance';
    if (name === 'hr') return '/announcements';
    return '/cabinet';
};

const staffNav = (role) => {
    const name = normalizeRole(role);
    if (!name) return [];
    const link = (to, label) => ({ to, label });
    if (name === 'admin' || name === 'it') {
        return [
            link('/admin', 'Панель администратора'),
            link('/edit_mebel', 'Редактор мебели'),
            link('/placing_an_order', 'Оформление заказа'),
            link('/view_orders', 'Просмотр заказов'),
            link('/attendance', 'Приход и уход'),
            link('/announcements', 'Объявления'),
            link('/cabinet', 'Личный кабинет'),
            link('/logs', 'Журнал сервера'),
        ];
    }
    if (name === 'master') {
        return [
            link('/view_orders', 'Просмотр заказов'),
            link('/placing_an_order', 'Оформление заказа'),
            link('/edit_mebel', 'Редактор мебели'),
            link('/cabinet', 'Личный кабинет'),
        ];
    }
    if (name === 'accountant') {
        return [
            link('/view_orders', 'Просмотр заказов'),
            link('/attendance', 'Приход и уход'),
            link('/cabinet', 'Личный кабинет'),
        ];
    }
    if (name === 'hr') {
        return [
            link('/announcements', 'Объявления'),
            link('/view_orders', 'Просмотр заказов'),
            link('/cabinet', 'Личный кабинет'),
        ];
    }
    return [
        link('/cabinet', 'Личный кабинет'),
        link('/view_orders', 'Просмотр заказов'),
    ];
};

const bottomNav = (role) => {
    const name = normalizeRole(role);
    const link = (to, label) => ({ to, label });
    if (!name) return [link('/', 'Каталог'), link('/zayavka', 'Заявка')];
    if (name === 'scanner') return [];
    if (name === 'admin' || name === 'it' || name === 'master') {
        return [link('/view_orders', 'Заказы'), link('/placing_an_order', 'Новый'), link('/', 'Каталог')];
    }
    if (name === 'accountant') {
        return [link('/view_orders', 'Заказы'), link('/attendance', 'Время'), link('/cabinet', 'Кабинет')];
    }
    if (name === 'hr') {
        return [link('/announcements', 'Объявления'), link('/cabinet', 'Кабинет'), link('/', 'Каталог')];
    }
    return [link('/cabinet', 'Кабинет'), link('/view_orders', 'Заказы')];
};

const shouldRecord = (method, path, status) => {
    const verb = String(method || '').toUpperCase();
    const clean = String(path || '').split('?')[0];
    if (verb === 'OPTIONS' || verb === 'HEAD') return false;
    if (clean === '/sync' || clean.startsWith('/server-logs') || clean.startsWith('/utilse')) return false;
    const code = Number(status) || 0;
    if (code >= 400) return true;
    return verb === 'POST' || verb === 'PUT' || verb === 'PATCH' || verb === 'DELETE';
};

const logText = (method, path, status) => {
    const verb = String(method || '').toUpperCase();
    const clean = String(path || '').split('?')[0];
    const code = Number(status) || 0;
    if (code >= 500) return `Ошибка сервера ${code}: ${verb} ${clean}`;
    if (code >= 400) return `Ошибка ${code}: ${verb} ${clean}`;
    const action = { POST: 'Создание', PUT: 'Изменение', PATCH: 'Изменение', DELETE: 'Удаление' }[verb] || verb;
    return `${action}: ${verb} ${clean}`;
};

module.exports = {
    ROLES,
    normalizeRole,
    isKnownRole,
    can,
    canWriteCollection,
    homeFor,
    staffNav,
    bottomNav,
    shouldRecord,
    logText,
};
