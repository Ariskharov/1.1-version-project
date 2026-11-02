const test = require('node:test');
const assert = require('node:assert/strict');
const { poolConnectionString, poolOptions } = require('./poolConfig');

test('сессионный пул Supabase переводится на транзакционный порт', () => {
    const raw = 'postgresql://app:secret@aws-0-eu.pooler.supabase.com:5432/postgres';
    const next = poolConnectionString(raw);
    assert.match(next, /:6543\//);
    assert.equal(next.includes(':5432'), false);
    assert.equal(next.includes('secret'), true);
    assert.equal(poolConnectionString('postgresql://app:secret@aws-0-eu.pooler.supabase.com:6543/postgres').includes(':6543'), true);
    assert.equal(poolConnectionString('postgresql://app:secret@localhost:5432/app'), 'postgresql://app:secret@localhost:5432/app');
    const tricky = poolConnectionString('postgresql://app:x:5432/y@aws-0-eu.pooler.supabase.com:5432/postgres?sslmode=require');
    assert.match(tricky, /x:5432\/y@aws-0-eu\.pooler\.supabase\.com:6543\/postgres/);
    assert.match(poolConnectionString('postgresql://app:secret@aws-0-eu.pooler.supabase.com:5432?sslmode=require'), /:6543\?/);
});

test('один процесс не занимает пачку соединений', () => {
    const hosted = poolOptions('postgresql://app:secret@aws-0-eu.pooler.supabase.com:5432/postgres', { VERCEL: '1' });
    const local = poolOptions('postgresql://app:secret@aws-0-eu.pooler.supabase.com:5432/postgres', {});
    assert.equal(hosted.max, 1);
    assert.equal(local.max, 2);
    assert.match(hosted.connectionString, /:6543\//);
    assert.equal(local.idleTimeoutMillis, 5000);
    assert.equal(local.allowExitOnIdle, true);
});
