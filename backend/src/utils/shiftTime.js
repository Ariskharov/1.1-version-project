const BISHKEK_TZ = 'Asia/Bishkek';

function bishkekNow(date = new Date()) {
    const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: BISHKEK_TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
    });
    const parts = Object.fromEntries(fmt.formatToParts(date).map((part) => [part.type, part.value]));
    const hour = parts.hour === '24' ? '00' : parts.hour;
    return {
        date: `${parts.year}-${parts.month}-${parts.day}`,
        timeHMS: `${hour}:${parts.minute}:${parts.second}`,
        timeHM: `${hour}:${parts.minute}`,
    };
}

function clockToUtcMs(dateStr, timeStr) {
    const [year, month, day] = String(dateStr || '').split('-').map(Number);
    const [hour = 0, minute = 0, second = 0] = String(timeStr || '')
        .split(':')
        .map((part) => Number(String(part).replace(/[^\d].*$/, '')));

    if (!year || !month || !day || [hour, minute, second].some((n) => Number.isNaN(n))) {
        return NaN;
    }
    return Date.UTC(year, month - 1, day, hour, minute, second);
}

function addCalendarDays(dateStr, days) {
    const [year, month, day] = String(dateStr).split('-').map(Number);
    const next = new Date(Date.UTC(year, month - 1, day + days));
    const y = next.getUTCFullYear();
    const m = String(next.getUTCMonth() + 1).padStart(2, '0');
    const d = String(next.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * Длительность по календарным часам Бишкека, без часового пояса процесса Node.
 * Если конец раньше начала в те же календарные сутки, дата конца сдвигается на день.
 */
function closeShiftClock({ startDate, startTime, endDate, endTime }) {
    const startMs = clockToUtcMs(startDate, startTime);
    let finalEndDate = endDate;
    let endMs = clockToUtcMs(finalEndDate, endTime);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;

    if (endMs < startMs) {
        finalEndDate = addCalendarDays(endDate, 1);
        endMs = clockToUtcMs(finalEndDate, endTime);
    }

    return {
        endDate: finalEndDate,
        durationMinutes: Math.max(0, Math.round((endMs - startMs) / 60000)),
    };
}

module.exports = { bishkekNow, closeShiftClock, clockToUtcMs, addCalendarDays };
