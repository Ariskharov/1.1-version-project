import React, { useContext, useMemo, useState } from 'react';
import { CustomContext } from '../../Context';
import { useCatalogTheme } from '../../context/CatalogThemeContext';
import { LoadingPage } from '../../components/ui/LoadingSpinner';
import { ROLES } from '../../utils/roles';
import {
    PERIOD_PRESETS,
    attendanceCsv,
    bishkekDay,
    filterShifts,
    formatShiftTotal,
    periodRange,
    shiftStats,
    toAttendanceRow,
} from '../../utils/attendance';
import './staff.scss';

const formatDay = (value) => {
    const day = String(value || '');
    return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day.split('-').reverse().join('.') : '—';
};

const formatPeriod = (session) => {
    if (!session?.endDate || session.endDate === session.date) return formatDay(session?.date);
    return `${formatDay(session.date)} → ${formatDay(session.endDate)}`;
};

const formatClock = (value) => (value ? String(value).slice(0, 5) : '—');

const formatWorked = (session) => {
    if (session?.durationMinutes == null || session.durationMinutes === '') {
        return session?.endTime ? '—' : 'На смене';
    }
    const total = Number(session.durationMinutes) || 0;
    const hours = Math.floor(total / 60);
    const minutes = total % 60;
    return `${hours} ч ${minutes} мин`;
};

const personName = (user) => user?.fullName || user?.login || (user ? `Сотрудник ${user.id}` : 'Без имени');

const Attendance = () => {
    const { resolvedTheme } = useCatalogTheme();
    const { currentUser, users, workSessions, dataLoaded, showToast } = useContext(CustomContext);
    const [preset, setPreset] = useState('today');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');
    const [employeeId, setEmployeeId] = useState('');
    const [status, setStatus] = useState('all');
    const [sort, setSort] = useState('date_desc');
    const [search, setSearch] = useState('');
    const today = bishkekDay();

    const view = useMemo(() => {
        const period = filterShifts(workSessions, {
            preset,
            today,
            customFrom,
            customTo,
            status,
            sort,
        });
        const focused = employeeId !== '' && employeeId != null;
        const visible = focused
            ? period.filter((session) => Number(session.userId) === Number(employeeId))
            : period;
        const list = users || [];
        const chosen = focused
            ? list.filter((user) => Number(user.id) === Number(employeeId))
            : list.filter((user) => visible.some((session) => Number(session.userId) === Number(user.id)));
        const byUser = new Map();
        period.forEach((session) => {
            const key = String(session.userId);
            if (!byUser.has(key)) byUser.set(key, []);
            byUser.get(key).push(session);
        });
        return {
            period,
            visible,
            groups: chosen.map((user) => ({
                user,
                sessions: visible.filter((session) => Number(session.userId) === Number(user.id)),
            })),
            counts: byUser,
            stats: shiftStats(visible),
        };
    }, [workSessions, users, preset, today, customFrom, customTo, status, sort, employeeId]);

    const people = useMemo(() => {
        const query = search.trim().toLowerCase();
        return (users || []).filter((user) => {
            if (!query) return true;
            const role = ROLES[user.role]?.label || '';
            return [user.fullName, user.login, user.position, user.phone, role]
                .join(' ')
                .toLowerCase()
                .includes(query);
        });
    }, [users, search]);

    const range = periodRange(preset, today, customFrom, customTo);
    const periodLabel = preset === 'custom'
        ? (range.from ? `${formatDay(range.from)} — ${formatDay(range.to)}` : 'Укажите обе даты')
        : (PERIOD_PRESETS.find((item) => item.key === preset)?.label || 'Период');

    const focusEmployee = (userId) => {
        setEmployeeId(userId);
        setPreset('all');
        setCustomFrom('');
        setCustomTo('');
    };

    const resetFilters = () => {
        setPreset('today');
        setCustomFrom('');
        setCustomTo('');
        setEmployeeId('');
        setStatus('all');
        setSort('date_desc');
    };

    const download = () => {
        if (!view.visible.length) {
            showToast('info', 'За этот период отметок нет');
            return;
        }
        const names = new Map((users || []).map((user) => [String(user.id), personName(user)]));
        const rows = view.visible.map((session) => toAttendanceRow(
            session,
            names.get(String(session.userId)) || `Сотрудник ${session.userId}`
        ));
        const blob = new Blob([`\uFEFF${attendanceCsv(rows)}`], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `prihod_uhod_${preset}_${today}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        showToast('success', 'Файл скачан. Отметки не изменились.');
    };

    if (!currentUser || !dataLoaded) {
        return <LoadingPage message="Загрузка прихода и ухода..." />;
    }

    return (
        <section className={`staff staff--wide staff--theme-${resolvedTheme}`}>
            <header className="staff__hero">
                <p className="staff__badge">Учёт времени</p>
                <h1>Приход и уход</h1>
                <p className="staff__note">
                    Список сотрудников и смены за выбранный период. «Фокус» показывает все смены одного человека.
                    Скачивание только сохраняет файл и отметки не меняет.
                </p>
            </header>

            <div className="staff__card staff__filters-card">
                <div className="staff__filters-head">
                    <h2>Журнал смен</h2>
                    <span>{periodLabel}</span>
                </div>
                <div className="staff__filters" role="group" aria-label="Период">
                    {PERIOD_PRESETS.map((item) => (
                        <button
                            key={item.key}
                            type="button"
                            className={`staff__btn${preset === item.key ? ' is-on' : ''}`}
                            aria-pressed={preset === item.key}
                            onClick={() => setPreset(item.key)}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
                {preset === 'custom' && (
                    <div className="staff__dates">
                        <label className="staff__field">
                            <span>С</span>
                            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
                        </label>
                        <label className="staff__field">
                            <span>По</span>
                            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
                        </label>
                    </div>
                )}
                <div className="staff__selects">
                    <select
                        aria-label="Фильтр по сотруднику"
                        value={employeeId}
                        onChange={(e) => {
                            const next = e.target.value ? Number(e.target.value) : '';
                            setEmployeeId(next);
                            if (next) {
                                setPreset('all');
                                setCustomFrom('');
                                setCustomTo('');
                            }
                        }}
                    >
                        <option value="">Все сотрудники</option>
                        {(users || []).map((user) => (
                            <option key={user.id} value={user.id}>{personName(user)}</option>
                        ))}
                    </select>
                    <select aria-label="Фильтр по статусу смены" value={status} onChange={(e) => setStatus(e.target.value)}>
                        <option value="all">Все статусы</option>
                        <option value="active">Только на смене</option>
                        <option value="closed">Только завершённые</option>
                    </select>
                    <select aria-label="Сортировка смен" value={sort} onChange={(e) => setSort(e.target.value)}>
                        <option value="date_desc">Сначала новые</option>
                        <option value="date_asc">Сначала старые</option>
                        <option value="duration_desc">По длительности</option>
                    </select>
                    <button type="button" className="staff__btn" onClick={resetFilters}>Сбросить</button>
                    {employeeId !== '' && employeeId != null && (
                        <button type="button" className="staff__btn" onClick={() => setEmployeeId('')}>
                            Сбросить фокус
                        </button>
                    )}
                    <button type="button" className="staff__btn staff__btn--primary" onClick={download} disabled={!view.visible.length}>
                        Скачать CSV
                    </button>
                </div>
                <div className="staff__stats">
                    <span><strong>{view.stats.count}</strong> смен</span>
                    <span><strong>{view.stats.activeCount}</strong> на смене</span>
                    <span><strong>{formatShiftTotal(view.stats)}</strong></span>
                </div>
            </div>

            <div className="staff__layout">
                <aside className="staff__people">
                    <h2 className="staff__section-title">Сотрудники</h2>
                    <label className="staff__search">
                        <span className="visually-hidden">Поиск сотрудника</span>
                        <input
                            type="search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Имя, должность или телефон"
                        />
                    </label>
                    {people.length === 0 ? (
                        <p className="staff__empty">Никого не найдено</p>
                    ) : people.map((user) => {
                        const stats = shiftStats(view.counts.get(String(user.id)) || []);
                        const focused = Number(employeeId) === Number(user.id);
                        return (
                            <article key={user.id} className={`staff__person${focused ? ' is-on' : ''}`}>
                                <strong>{personName(user)}</strong>
                                <small>{ROLES[user.role]?.label || 'Сотрудник'}</small>
                                <small>{user.position || '—'} · {user.phone || '—'}</small>
                                <span className="staff__meta">
                                    {stats.count} смен · {formatShiftTotal(stats)}
                                    {stats.activeCount > 0 ? ' · на смене' : ''}
                                </span>
                                <button
                                    type="button"
                                    className={`staff__btn${focused ? ' is-on' : ''}`}
                                    onClick={() => (focused ? setEmployeeId('') : focusEmployee(user.id))}
                                    aria-pressed={focused}
                                >
                                    {focused ? 'Сбросить фокус' : 'Фокус'}
                                </button>
                            </article>
                        );
                    })}
                </aside>

                <div className="staff__journal">
                    {view.groups.length === 0 ? (
                        <p className="staff__empty">В этом фильтре смен нет.</p>
                    ) : (
                    <>
                    <div className="staff__shift staff__shift--head">
                        <span>Период</span>
                        <span>Приход</span>
                        <span>Уход</span>
                        <span>Отработано</span>
                        <span>Статус</span>
                    </div>
                    {view.groups.map(({ user, sessions }) => (
                        <section key={user.id} className="staff__group">
                            <header className="staff__group-head">
                                <div>
                                    <strong>{personName(user)}</strong>
                                    {user.position ? <span> — {user.position}</span> : null}
                                </div>
                                {Number(employeeId) !== Number(user.id) && (
                                    <button type="button" className="staff__btn" onClick={() => focusEmployee(user.id)}>
                                        Фокус
                                    </button>
                                )}
                            </header>
                            {sessions.length === 0 ? (
                                <p className="staff__empty">Смен в этом фильтре нет.</p>
                            ) : sessions.map((session) => (
                                <div key={session.id} className="staff__shift">
                                    <span data-label="Период">{formatPeriod(session)}</span>
                                    <span data-label="Приход">{formatClock(session.startTime)}</span>
                                    <span data-label="Уход">{formatClock(session.endTime)}</span>
                                    <span data-label="Отработано">{formatWorked(session)}</span>
                                    <span data-label="Статус" className={`staff__status${session.endTime ? '' : ' is-live'}`}>
                                        {session.endTime ? 'Ушёл' : 'На смене'}
                                    </span>
                                </div>
                            ))}
                        </section>
                    ))}
                    </>
                    )}
                </div>
            </div>
        </section>
    );
};

export default Attendance;
