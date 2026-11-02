import React, { useContext, useEffect, useState } from 'react';
import { CustomContext } from '../../Context';
import { useCatalogTheme } from '../../context/CatalogThemeContext';
import { LoadingPage } from '../../components/ui/LoadingSpinner';
import { API_BASE, authHeaders } from '../../config/api';
import './staff.scss';

const FILTERS = [
    { key: '', label: 'Все' },
    { key: 'problem', label: 'Ошибки' },
    { key: 'event', label: 'События' },
];

const LEVEL_LABEL = {
    error: 'Ошибка',
    warn: 'Предупреждение',
    event: 'Событие',
};

const formatWhen = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString('ru-RU', {
        timeZone: 'Asia/Bishkek',
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
};

const ServerLogs = () => {
    const { resolvedTheme } = useCatalogTheme();
    const { currentUser } = useContext(CustomContext);
    const [level, setLevel] = useState('');
    const [rows, setRows] = useState([]);
    const [error, setError] = useState('');
    const [ready, setReady] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            if (document.hidden) return;
            try {
                const query = level ? `?level=${encodeURIComponent(level)}` : '';
                const res = await fetch(`${API_BASE}/server-logs${query}`, {
                    headers: authHeaders(),
                    cache: 'no-store',
                });
                const data = await res.json().catch(() => null);
                if (cancelled) return;
                if (!res.ok) {
                    setError(res.status === 404
                        ? 'Журнал сервера ещё не отвечает. Он появится после запуска этой версии сервера.'
                        : (data?.error || 'Не удалось прочитать журнал'));
                    setReady(true);
                    return;
                }
                setError('');
                setRows(Array.isArray(data) ? data : []);
                setReady(true);
            } catch {
                if (!cancelled) {
                    setError('Не удалось прочитать журнал');
                    setReady(true);
                }
            }
        };
        load();
        const timer = window.setInterval(load, 5000);
        const onVisible = () => {
            if (!document.hidden) load();
        };
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            cancelled = true;
            window.clearInterval(timer);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [level]);

    if (!currentUser) {
        return <LoadingPage message="Загрузка журнала..." />;
    }

    return (
        <section className={`staff staff--theme-${resolvedTheme}`}>
            <header className="staff__hero">
                <p className="staff__badge">Сервер</p>
                <h1>Журнал</h1>
                <p className="staff__note">
                    Ошибки и изменения на сервере. Пароли и содержимое форм сюда не записываются. Список обновляется сам, пока страница открыта.
                </p>
            </header>

            <div className="staff__toolbar">
                <div className="staff__filters" role="group" aria-label="Что показать">
                    {FILTERS.map((item) => (
                        <button
                            key={item.key || 'all'}
                            type="button"
                            className={`staff__btn${level === item.key ? ' is-on' : ''}`}
                            aria-pressed={level === item.key}
                            onClick={() => setLevel(item.key)}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
            </div>

            {error && <p className="staff__error">{error}</p>}

            <div className="staff__list" aria-live="polite">
                {!ready && !error && <p className="staff__empty">Читаем журнал…</p>}
                {ready && !error && rows.length === 0 && <p className="staff__empty">Записей пока нет.</p>}
                {rows.map((row) => (
                    <article key={row.id} className="staff__item">
                        <div className="staff__meta">
                            <span className={`staff__chip staff__chip--${row.level === 'event' ? 'event' : row.level}`}>
                                {LEVEL_LABEL[row.level] || row.level}
                            </span>
                            <span>{formatWhen(row.created_at)}</span>
                            {row.actor ? <span>{row.actor}</span> : null}
                        </div>
                        <strong>{row.message}</strong>
                        {(row.method || row.path) && (
                            <p className="staff__log-path">
                                {[row.method, row.path, row.status].filter((part) => part != null && part !== '').join(' ')}
                            </p>
                        )}
                    </article>
                ))}
            </div>
        </section>
    );
};

export default ServerLogs;
