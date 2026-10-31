const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const pool = require('./pg');
const { newPublicToken } = require('../utils/publicToken');

const splitSql = (sql) => sql
    .split(';')
    .map((part) => part.replace(/--.*$/gm, '').trim())
    .filter(Boolean);

const appliedHash = async () => {
    try {
        const res = await pool.query('SELECT sql_hash FROM app_schema_mark WHERE id = 1');
        return res.rows[0]?.sql_hash || '';
    } catch (err) {
        if (err.code === '42P01') return '';
        throw err;
    }
};

const rememberHash = async (hash) => {
    await pool.query(`CREATE TABLE IF NOT EXISTS app_schema_mark (
        id integer PRIMARY KEY,
        sql_hash text NOT NULL
    )`);
    await pool.query(
        `INSERT INTO app_schema_mark (id, sql_hash) VALUES (1, $1)
         ON CONFLICT (id) DO UPDATE SET sql_hash = EXCLUDED.sql_hash`,
        [hash]
    );
};

async function backfillPublicTokens() {
    try {
        for (let batch = 0; batch < 20; batch += 1) {
            const missing = await pool.query(
                `SELECT id FROM "order"
                 WHERE public_token IS NULL OR btrim(public_token) = ''
                 ORDER BY id
                 LIMIT 400`
            );
            if (!missing.rows.length) return;
            const ids = missing.rows.map((row) => row.id);
            const tokens = ids.map(() => newPublicToken());
            await pool.query(
                `UPDATE "order" AS o
                 SET public_token = t.token
                 FROM unnest($1::int[], $2::text[]) AS t(id, token)
                 WHERE o.id = t.id
                   AND (o.public_token IS NULL OR btrim(o.public_token) = '')`,
                [ids, tokens]
            );
        }
    } catch (err) {
        if (err.code === '42703' || err.code === '42P01') return;
        console.error('[schema] public token backfill:', err.message);
    }
}

const REVISION_TABLES = ['product', 'users', 'workSessions', 'order', 'announcements'];

// Один счётчик на таблицу. Клиент сверяет число и качает строки только когда оно выросло.
async function ensureDataRevision() {
    await pool.query(`CREATE TABLE IF NOT EXISTS data_revision (
        name text PRIMARY KEY,
        rev bigint NOT NULL DEFAULT 0
    )`);
    await pool.query(`
        CREATE OR REPLACE FUNCTION bump_data_revision() RETURNS trigger
        LANGUAGE plpgsql
        AS $fn$
        BEGIN
            INSERT INTO data_revision(name, rev)
            VALUES (TG_TABLE_NAME, 1)
            ON CONFLICT (name) DO UPDATE SET rev = data_revision.rev + 1;
            RETURN NULL;
        END;
        $fn$
    `);

    for (const table of REVISION_TABLES) {
        const relName = `"${table}"`;
        try {
            const rel = await pool.query('SELECT to_regclass($1) AS rel', [relName]);
            if (!rel.rows[0]?.rel) continue;
            const trigger = await pool.query(
                `SELECT 1 FROM pg_trigger
                 WHERE tgname = 'data_revision_bump' AND tgrelid = $1::regclass`,
                [relName]
            );
            if (!trigger.rows.length) {
                await pool.query(
                    `CREATE TRIGGER data_revision_bump
                     AFTER INSERT OR UPDATE OR DELETE ON ${relName}
                     FOR EACH STATEMENT
                     EXECUTE PROCEDURE bump_data_revision()`
                );
            }
            await pool.query(
                `INSERT INTO data_revision(name, rev) VALUES ($1, 0)
                 ON CONFLICT (name) DO NOTHING`,
                [table]
            );
        } catch (err) {
            console.error('[schema] revision trigger', table, err.message);
        }
    }
}

async function ensureAppSchema() {
    try {
        await ensureDataRevision();
    } catch (err) {
        console.error('[schema] data revision:', err.message);
    }
    const sqlPath = path.join(__dirname, '../../migrations/004_app_columns.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    const hash = crypto.createHash('sha256').update(sql).digest('hex');

    if (await appliedHash() === hash) {
        await backfillPublicTokens();
        return;
    }

    // Один простой запрос: иначе 31 команда идёт отдельными кругами до удалённой базы.
    let applied = false;
    try {
        await pool.query(sql);
        applied = true;
    } catch (err) {
        console.error('[schema] batch failed, running statements:', err.message);
    }

    if (applied) {
        await rememberHash(hash);
        await backfillPublicTokens();
        return;
    }

    const statements = splitSql(sql);
    const errors = [];

    for (const statement of statements) {
        try {
            await pool.query(statement);
        } catch (err) {
            errors.push(err.message);
            console.error('[schema] statement failed:', err.message);
        }
    }

    if (errors.length) {
        throw new Error(errors[0]);
    }
    await rememberHash(hash);
    await backfillPublicTokens();
}

module.exports = { ensureAppSchema };
