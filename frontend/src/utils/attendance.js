export const bishkekDay = (date = new Date()) => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bishkek',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
}).format(date);

export const shiftDay = (isoDay, delta) => {
    const [year, month, day] = String(isoDay || '').split('-').map(Number);
    if (!year || !month || !day) return '';
    const date = new Date(Date.UTC(year, month - 1, day));
    date.setUTCDate(date.getUTCDate() + delta);
    return date.toISOString().slice(0, 10);
};

const isDay = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));

export const sessionInRange = (date, range, today) => {
    const day = String(date || '');
    if (!isDay(day) || !isDay(today)) return false;
    if (range === 'today') return day === today;
    if (range === 'week') return day >= shiftDay(today, -6) && day <= today;
    if (range === 'month') return day >= `${today.slice(0, 7)}-01` && day <= today;
    return false;
};

export const attendanceStatus = (session) => (session?.endTime ? 'ушёл' : 'на смене');

export const toAttendanceRow = (session, name) => ({
    name: name || 'Без имени',
    date: session?.date || '',
    start: session?.startTime ? String(session.startTime).slice(0, 5) : '',
    end: session?.endTime ? String(session.endTime).slice(0, 5) : '',
    minutes: session?.durationMinutes == null || session?.durationMinutes === ''
        ? ''
        : String(session.durationMinutes),
    status: attendanceStatus(session),
});

const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

export const attendanceCsv = (rows) => {
    const header = ['Имя', 'Дата', 'Приход', 'Уход', 'Минуты', 'Статус'];
    const lines = [header.map(csvCell).join(';')];
    (rows || []).forEach((row) => {
        lines.push([row.name, row.date, row.start, row.end, row.minutes, row.status].map(csvCell).join(';'));
    });
    return lines.join('\n');
};
