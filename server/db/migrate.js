const fs = require('fs');
const path = require('path');
const { pool } = require('./index');

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'migrations.sql'), 'utf8');
  try {
    await pool.query(sql);
    console.log('[migrate] Database schema up to date');
  } catch (err) {
    console.error('[migrate] Migration failed:', err.message);
    throw err;
  }
}

module.exports = migrate;
