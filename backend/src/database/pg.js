const { Pool } = require('pg');
const { poolOptions } = require('./poolConfig');

const pool = new Pool(poolOptions(process.env.DATABASE_URL));

module.exports = pool;
