const { can } = require('./roles');

// Совпадает с кабинетом: выключенное и просроченное сотруднику не показываем.
const isAnnouncementActiveRow = (row, now = new Date()) => {
    if (!row) return false;
    if (row.isActive === false || row.isactive === false) return false;
    const expires = row.expiresAt || row.expiresat;
    if (!expires) return true;
    const end = new Date(expires);
    return !Number.isNaN(end.getTime()) && end > now;
};

const canSeeAnnouncement = (row, role, now = new Date()) => (
    can(role, 'announcements') || isAnnouncementActiveRow(row, now)
);

module.exports = { isAnnouncementActiveRow, canSeeAnnouncement };
