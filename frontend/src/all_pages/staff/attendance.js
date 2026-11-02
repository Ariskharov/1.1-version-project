import React, { useContext, useMemo, useState } from 'react';
import { CustomContext } from '../../Context';
import { useCatalogTheme } from '../../context/CatalogThemeContext';
import { LoadingPage } from '../../components/ui/LoadingSpinner';
import {
    attendanceCsv,
    bishkekDay,
    sessionInRange,
    toAttendanceRow,
} from '../../utils/attendance';
import './staff.scss';

const RANGES = [
    { key: 'today', label: 'Сегодня' },
    { key: 'week', label: '7 дней' },
    { key: 'month', label: 'Этот месяц' },
];

const Attendance = () => {
    const { resolvedTheme } = useCatalogTheme();
    const { currentUser, users, workSessions, dataLoaded, showToast } = useContext(CustomContext);
    const [range, setRange] = useState('today');
    const today = bishkekDay();

    const rows = useMemo(() => {
        const names = new Map((users || []).map((user) => [
            String(user.id),
            user.fullName || user.login || `Сотрудник ${user.id}`,
        ]));
        return (workSessions || [])
            .filter((session) => sessionInRange(session.date, range, today))
            .map((session) => toAttendanceRow(
                session,
                names.get(String(session.userId)) || `Сотрудник ${session.userId}`
            ))
            .sort((a, b) => b.date.localeCompare(a.date) || b.start.localeCompare(a.start));
    }, [users, workSessions, range, today]);

    const download = () => {
        if (!rows.length) {
            showToast('info', 'За этот период отметок нет');
            return;
        }
        const blob = new Blob([`\uFEFF${attendanceCsv(rows)}`], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `prihod_uhod_${range}_${today}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        showToast('success', 'Файл скачан. Отметки не изменились.');
    };

    if (!currentUser || !dataLoaded) {
        return <LoadingPage message="Загрузка прихода и ухода..." />;
    }

    return (
        <section className={`staff staff--theme-${resolvedTheme}`}>
            <header className="staff__hero">
                <p className="staff__badge">Бухгалтерия</p>
                <h1>Приход и уход</h1>
                <p className="staff__note">
                    Здесь видно, кто во сколько пришёл и ушёл. Скачивание только сохраняет файл и отметки не меняет.
                </p>
            </header>

            <div className="staff__toolbar">
                <div className="staff__filters" role="group" aria-label="Период">
                    {RANGES.map((item) => (
                        <button
                            key={item.key}
                            type="button"
                            className={`staff__btn${range === item.key ? ' is-on' : ''}`}
                            aria-pressed={range === item.key}
                            onClick={() => setRange(item.key)}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
                <button type="button" className="staff__btn staff__btn--primary" onClick={download} disabled={!rows.length}>
                    Скачать CSV
                </button>
            </div>

            <div className="staff__table-wrap">
                {rows.length === 0 ? (
                    <p className="staff__empty">За выбранный период отметок нет.</p>
                ) : (
                    <table className="staff__table">
                        <caption className="visually-hidden">Приход и уход сотрудников</caption>
                        <thead>
                            <tr>
                                <th>Сотрудник</th>
                                <th>Дата</th>
                                <th>Приход</th>
                                <th>Уход</th>
                                <th>Минуты</th>
                                <th>Статус</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, index) => (
                                <tr key={`${row.name}-${row.date}-${row.start}-${index}`}>
                                    <td>{row.name}</td>
                                    <td>{row.date.split('-').reverse().join('.')}</td>
                                    <td>{row.start || '—'}</td>
                                    <td>{row.end || '—'}</td>
                                    <td>{row.minutes || '—'}</td>
                                    <td>{row.status}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </section>
    );
};

export default Attendance;
