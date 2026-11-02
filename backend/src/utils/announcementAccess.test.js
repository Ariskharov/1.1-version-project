const test = require('node:test');
const assert = require('node:assert/strict');
const { canSeeAnnouncement, isAnnouncementActiveRow } = require('./announcementAccess');

const now = new Date('2026-11-02T12:00:00Z');

test('гость видит только живое объявление, кадры видят и выключенное', () => {
    const live = { isActive: true, message: 'Живое' };
    const off = { isActive: false, message: 'Черновик' };
    const expired = { isActive: true, expiresAt: '2026-11-01T00:00:00Z', message: 'Старое' };

    assert.equal(isAnnouncementActiveRow(live, now), true);
    assert.equal(isAnnouncementActiveRow(off, now), false);
    assert.equal(isAnnouncementActiveRow(expired, now), false);
    assert.equal(canSeeAnnouncement(off, null, now), false);
    assert.equal(canSeeAnnouncement(expired, 'user', now), false);
    assert.equal(canSeeAnnouncement(live, null, now), true);
    assert.equal(canSeeAnnouncement(off, 'hr', now), true);
    assert.equal(canSeeAnnouncement(expired, 'admin', now), true);
    assert.equal(canSeeAnnouncement(off, 'it', now), true);
    assert.equal(canSeeAnnouncement(off, 'master', now), false);
});
