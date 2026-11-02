export const ROLES = {
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
        description: 'Создаёт, правит и удаляет объявления. Сотрудников не добавляет, заказы не оформляет и не меняет.',
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

export const ROLE_ORDER = ['user', 'master', 'accountant', 'hr', 'admin', 'it', 'manager', 'scanner'];

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

export const normalizeRole = (role) => String(role || '').trim().toLowerCase();

export const isKnownRole = (role) => Object.prototype.hasOwnProperty.call(ROLES, normalizeRole(role));

export const can = (role, cap) => {
    const list = CAPS[cap];
    return Array.isArray(list) && list.includes(normalizeRole(role));
};

export const canWriteCollection = (role, collection) => {
    if (collection === 'workSessions') return isKnownRole(role);
    const cap = WRITE_CAP[collection];
    return cap ? can(role, cap) : false;
};

export const canOpen = (role, path) => {
    const clean = String(path || '').split('?')[0];
    if (clean === '/' || clean === '/catalog' || clean === '/zayavka') return true;
    if (clean === '/cabinet') return can(role, 'cabinet');
    if (clean === '/view_orders' || clean.startsWith('/order/')) return can(role, 'viewOrders');
    if (clean === '/edit_mebel') return can(role, 'editFurniture');
    if (clean === '/admin') return can(role, 'adminPanel');
    if (clean === '/placing_an_order' || clean.startsWith('/order_editor/')) return can(role, 'editOrders');
    if (clean === '/attendance') return can(role, 'attendance');
    if (clean === '/announcements') return can(role, 'announcements');
    if (clean === '/logs') return can(role, 'logs');
    if (clean === '/scan') return can(role, 'scan');
    return false;
};

export const homeFor = (role) => {
    const name = normalizeRole(role);
    if (name === 'scanner') return '/scan';
    if (name === 'admin') return '/edit_mebel';
    if (name === 'it') return '/logs';
    if (name === 'master') return '/view_orders';
    if (name === 'accountant') return '/attendance';
    if (name === 'hr') return '/announcements';
    return '/cabinet';
};

export const staffNav = (role) => {
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

export const bottomNav = (role) => {
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
