require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });

async function seed() {
  const esWords = JSON.parse(fs.readFileSync(path.join(__dirname, 'words_es.json'), 'utf8'));
  const enWords = JSON.parse(fs.readFileSync(path.join(__dirname, 'words_en.json'), 'utf8'));

  let insertedEs = 0, insertedEn = 0;

  for (const word of esWords) {
    const r = await pool.query('INSERT INTO words (word, language) VALUES ($1,$2) ON CONFLICT DO NOTHING', [word.toUpperCase(), 'es']);
    insertedEs += r.rowCount;
  }
  for (const word of enWords) {
    const r = await pool.query('INSERT INTO words (word, language) VALUES ($1,$2) ON CONFLICT DO NOTHING', [word.toUpperCase(), 'en']);
    insertedEn += r.rowCount;
  }

  console.log(`[seed] Inserted ${insertedEs} ES words, ${insertedEn} EN words`);
  await pool.end();
}

seed().catch(err => { console.error('[seed] Error:', err); process.exit(1); });
