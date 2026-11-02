// Supabase на порту 5432 держит сессию на каждого клиента и пускает только 15.
// Порт 6543 отдаёт соединение после транзакции, поэтому живой сайт и локальный
// запуск больше не выбивают друг другу ошибки 500.
const poolConnectionString = (raw) => {
    if (typeof raw !== 'string' || !raw.includes('pooler.supabase')) return raw;
    // Только порт после @. Кусок пароля вроде :5432/ остаётся как был.
    return raw.replace(/(@[^@/?#]*):5432(?=[/?#]|$)/, '$1:6543');
};

const poolOptions = (raw, env = process.env) => ({
    connectionString: poolConnectionString(raw),
    ssl: { rejectUnauthorized: false },
    max: env.VERCEL ? 1 : 2,
    idleTimeoutMillis: 5000,
    connectionTimeoutMillis: 10000,
    allowExitOnIdle: true,
});

module.exports = { poolConnectionString, poolOptions };
