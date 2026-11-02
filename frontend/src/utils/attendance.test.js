import {
    attendanceCsv,
    filterShifts,
    formatShiftTotal,
    periodRange,
    sessionInRange,
    shiftDay,
    toAttendanceRow,
} from './attendance';

test('неделя и месяц считаются по календарным дням, скачивание только читает строки', () => {
    expect(shiftDay('2026-11-02', -6)).toBe('2026-10-27');
    expect(sessionInRange('2026-10-27', 'week', '2026-11-02')).toBe(true);
    expect(sessionInRange('2026-10-26', 'week', '2026-11-02')).toBe(false);
    expect(sessionInRange('2026-11-01', 'month', '2026-11-02')).toBe(true);
    expect(sessionInRange('2026-10-31', 'month', '2026-11-02')).toBe(false);
    expect(sessionInRange('2026-11-02', 'today', '2026-11-02')).toBe(true);

    const row = toAttendanceRow(
        { date: '2026-11-02', startTime: '09:05:00', endTime: '', durationMinutes: null, userId: 4 },
        'Айгуль Нур'
    );
    expect(row).toEqual({
        name: 'Айгуль Нур',
        date: '2026-11-02',
        start: '09:05',
        end: '',
        minutes: '',
        status: 'на смене',
    });
    const csv = attendanceCsv([row]);
    expect(csv.startsWith('"Имя";"Дата";"Приход";"Уход";"Минуты";"Статус"')).toBe(true);
    expect(csv).toContain('"Айгуль Нур"');
    expect(csv).toContain('"на смене"');
});

test('фильтр смен совпадает с периодом, статусом и фокусом на сотруднике', () => {
    const today = '2026-11-02';
    expect(periodRange('today', today)).toEqual({ from: today, to: today });
    expect(periodRange('week', today)).toEqual({ from: '2026-10-27', to: today });
    expect(periodRange('month', today)).toEqual({ from: '2026-11-01', to: today });
    expect(periodRange('last_month', today)).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(periodRange('custom', today, '2026-01-02', '2026-01-05')).toEqual({
        from: '2026-01-02',
        to: '2026-01-05',
    });
    expect(periodRange('custom', today, '', '')).toEqual({ from: '', to: '' });
    expect(periodRange('custom', today, '2026-01-05', '2026-01-02')).toEqual({
        from: '2026-01-02',
        to: '2026-01-05',
    });
    expect(formatShiftTotal({ hours: 0, minutes: 40 })).toBe('40 мин');
    expect(formatShiftTotal({ hours: 2, minutes: 5 })).toBe('2 ч 5 мин');

    const sessions = [
        { id: 1, userId: 4, date: '2026-10-30', endDate: '2026-10-30', startTime: '09:00', endTime: '18:00', durationMinutes: 540 },
        { id: 2, userId: 4, date: '2026-11-01', endDate: '2026-11-02', startTime: '22:00', endTime: '06:00', durationMinutes: 480 },
        { id: 3, userId: 7, date: '2026-10-28', startTime: '08:00', endTime: '', durationMinutes: null },
        { id: 4, userId: 7, date: '2026-11-02', startTime: '09:00', endTime: '12:00', durationMinutes: 180 },
    ];

    expect(filterShifts(sessions, { preset: 'today', today }).map((item) => item.id)).toEqual([2, 4, 3]);
    expect(filterShifts(sessions, { preset: 'today', today, status: 'closed' }).map((item) => item.id)).toEqual([2, 4]);
    expect(filterShifts(sessions, { preset: 'last_month', today }).map((item) => item.id)).toEqual([1, 3]);
    expect(filterShifts(sessions, { preset: 'all', today, employeeId: 4 }).every((item) => item.userId === 4)).toBe(true);
    expect(filterShifts(sessions, { preset: 'all', today, sort: 'duration_desc' })[0].id).toBe(3);
    expect(filterShifts(sessions, { preset: 'custom', today, customFrom: '', customTo: '' })).toEqual([]);
});
