import { attendanceCsv, sessionInRange, shiftDay, toAttendanceRow } from './attendance';

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
