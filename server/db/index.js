const { Pool } = require('pg');

const url = process.env.DATABASE_URL || '';
const ssl = url.includes('railway.internal') || url.includes('sslmode=disable')
  ? false
  : process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false;

const pool = new Pool({ connectionString: url, ssl });

const query = (text, params) => pool.query(text, params);

module.exports = { pool, query };
