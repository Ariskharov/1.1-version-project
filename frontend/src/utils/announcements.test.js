jest.mock('../config/api', () => ({
    API_BASE: 'http://localhost:8080',
    authHeaders: () => ({}),
}));

import {
    announcementNotificationText,
    announcementSignature,
    announcementsToNotify,
    filterActiveAnnouncements,
    isAnnouncementActive,
} from './announcements';

test('активное объявление без срока видно, выключенное и просроченное нет', () => {
    const now = new Date('2026-10-31T12:00:00Z');
    expect(isAnnouncementActive({ isActive: true, message: 'Живое' }, now)).toBe(true);
    expect(isAnnouncementActive({ isActive: false, message: 'Выкл' }, now)).toBe(false);
    expect(isAnnouncementActive({
        isActive: true,
        expiresAt: '2026-10-31T11:00:00Z',
        message: 'Старое',
    }, now)).toBe(false);
});

test('уведомление нужно для нового и для правки, но не для уже виденного id', () => {
    const urgent = { id: 4, type: 'urgent', title: 'Смена', message: 'Закрыть цех' };
    const persistent = { id: 5, type: 'persistent', title: '', message: 'График' };
    expect(announcementNotificationText(urgent).title).toBe('Срочно: Смена');
    expect(announcementNotificationText(urgent).tag).toBe('announcement-4');
    expect(announcementNotificationText(persistent).title).toBe('Актуально — объявление');

    const seen = new Set(['4']);
    const sigs = { 4: announcementSignature(urgent) };
    expect(announcementsToNotify([urgent, persistent], seen, sigs).map((item) => item.id)).toEqual([5]);
    expect(announcementsToNotify(
        [{ ...urgent, message: 'Открыть цех' }],
        seen,
        sigs
    ).map((item) => item.id)).toEqual([4]);
    expect(announcementsToNotify([urgent], seen, {}).map((item) => item.id)).toEqual([]);
});

test('фильтр оставляет только нужный тип и ставит новые выше', () => {
    const list = filterActiveAnnouncements([
        { id: 1, type: 'urgent', isActive: true, message: 'А', createdAt: '2026-10-01T00:00:00Z' },
        { id: 2, type: 'persistent', isActive: true, message: 'Б', createdAt: '2026-10-02T00:00:00Z' },
        { id: 3, type: 'urgent', isActive: true, message: 'В', createdAt: '2026-10-03T00:00:00Z' },
    ], 'urgent');
    expect(list.map((item) => item.id)).toEqual([3, 1]);
});
