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

export const PERIOD_PRESETS = [
    { key: 'today', label: 'Сегодня' },
    { key: 'week', label: 'Эта неделя' },
    { key: 'month', label: 'Этот месяц' },
    { key: 'last_month', label: 'Прошлый месяц' },
    { key: 'all', label: 'За всё время' },
    { key: 'custom', label: 'Произвольный' },
];

const monthStart = (isoDay) => `${String(isoDay).slice(0, 7)}-01`;

export const periodRange = (preset, today, customFrom = '', customTo = '') => {
    const day = isDay(today) ? today : '';
    if (!day) return { from: '', to: '' };
    if (preset === 'custom') {
        if (!isDay(customFrom) || !isDay(customTo)) return { from: '', to: '' };
        return customFrom <= customTo
            ? { from: customFrom, to: customTo }
            : { from: customTo, to: customFrom };
    }
    if (preset === 'today') return { from: day, to: day };
    if (preset === 'week') return { from: shiftDay(day, -6), to: day };
    if (preset === 'month') return { from: monthStart(day), to: day };
    if (preset === 'last_month') {
        const lastDay = shiftDay(monthStart(day), -1);
        return { from: monthStart(lastDay), to: lastDay };
    }
    return { from: '1970-01-01', to: day };
};

export const sessionMatchesRange = (session, range, today) => {
    const shiftStart = String(session?.date || '');
    const shiftEnd = String(session?.endDate || session?.date || '');
    const from = String(range?.from || '');
    const to = String(range?.to || '');
    if (!isDay(shiftStart) || !isDay(from) || !isDay(to) || !isDay(today)) return false;
    const active = !session?.endTime;
    if (active) {
        if (to >= today) return shiftStart <= to;
        return shiftStart >= from && shiftStart <= to;
    }
    if (!isDay(shiftEnd)) return false;
    return shiftEnd >= from && shiftStart <= to;
};

const compareDateTime = (left, right, direction) => {
    const dateKey = (session) => String(session.endDate || session.date || '');
    const timeKey = (session) => String(session.startTime || '');
    const byDate = dateKey(left).localeCompare(dateKey(right));
    if (byDate !== 0) return direction * byDate;
    return direction * timeKey(left).localeCompare(timeKey(right));
};

export const filterShifts = (sessions, options = {}) => {
    const today = options.today;
    const range = periodRange(options.preset || 'today', today, options.customFrom, options.customTo);
    let result = (sessions || []).filter((session) => sessionMatchesRange(session, range, today));
    if (options.employeeId != null && options.employeeId !== '') {
        const target = Number(options.employeeId);
        result = result.filter((session) => Number(session.userId) === target);
    }
    if (options.status === 'active') result = result.filter((session) => !session.endTime);
    else if (options.status === 'closed') result = result.filter((session) => !!session.endTime);
    const copy = [...result];
    if (options.sort === 'date_asc') copy.sort((left, right) => compareDateTime(left, right, 1));
    else if (options.sort === 'duration_desc') {
        const minutes = (session) => (
            session.durationMinutes != null && session.durationMinutes !== ''
                ? Number(session.durationMinutes)
                : (session.endTime ? 0 : Infinity)
        );
        copy.sort((left, right) => minutes(right) - minutes(left));
    } else copy.sort((left, right) => compareDateTime(left, right, -1));
    return copy;
};

export const shiftStats = (sessions) => {
    const list = sessions || [];
    const totalMinutes = list.reduce((sum, session) => sum + (Number(session.durationMinutes) || 0), 0);
    return {
        count: list.length,
        hours: Math.floor(totalMinutes / 60),
        minutes: totalMinutes % 60,
        activeCount: list.filter((session) => !session.endTime).length,
        totalMinutes,
    };
};

export const formatShiftTotal = (stats) => {
    const hours = Number(stats?.hours) || 0;
    const minutes = Number(stats?.minutes) || 0;
    if (hours && minutes) return `${hours} ч ${minutes} мин`;
    if (hours) return `${hours} ч`;
    if (minutes) return `${minutes} мин`;
    return '0 ч';
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
