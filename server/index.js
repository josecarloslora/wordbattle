require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const migrate = require('./db/migrate');
const wordService = require('./services/wordService');
const setupSocket = require('./socket');
const { query } = require('./db');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());

const activeRooms = new Map();
app.set('activeRooms', activeRooms);

app.use('/api/auth', require('./routes/auth'));
app.use('/api/rooms', require('./routes/rooms'));
app.use('/api/users', require('./routes/users'));
app.use('/api/words', require('./routes/words'));
app.use('/api/solo', require('./routes/solo'));

let dbReady = false;
app.get('/health', (req, res) => res.json({ status: 'ok', dbReady, timestamp: new Date() }));

const io = new Server(server, { cors: { origin: CLIENT_URL, credentials: true } });
setupSocket(io, activeRooms);

async function autoSeed() {
  const path = require('path');
  const fs = require('fs');
  const esWords = JSON.parse(fs.readFileSync(path.join(__dirname, 'db/seeds/words_es.json'), 'utf8'));
  const enWords = JSON.parse(fs.readFileSync(path.join(__dirname, 'db/seeds/words_en.json'), 'utf8'));
  const expected = esWords.length + enWords.length;

  const { rows } = await query('SELECT COUNT(*) FROM words');
  const current = parseInt(rows[0].count);

  if (current < expected * 0.9) {
    console.log(`[seed] Word count ${current} < expected ${expected}, reseeding...`);
    await query('DELETE FROM words');
    for (const w of esWords) await query('INSERT INTO words (word, language) VALUES ($1,$2) ON CONFLICT DO NOTHING', [w, 'es']);
    for (const w of enWords) await query('INSERT INTO words (word, language) VALUES ($1,$2) ON CONFLICT DO NOTHING', [w, 'en']);
    console.log(`[seed] Seeded ${esWords.length} ES + ${enWords.length} EN words`);
  } else {
    console.log(`[seed] Dictionary up to date (${current} words)`);
  }
}

async function initDatabase() {
  let retries = 0;
  while (retries < 20) {
    try {
      await migrate();
      await autoSeed();
      await wordService.loadWords();
      dbReady = true;
      console.log(`[${new Date().toISOString()}] Database ready`);
      return;
    } catch (err) {
      retries++;
      console.log(`[${new Date().toISOString()}] DB not ready (attempt ${retries}/20): ${err.message}`);
      await new Promise(r => setTimeout(r, 5000));
    }
  }
  console.error('[db] Could not connect after 20 attempts');
}

server.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] Server running on port ${PORT}`);
  initDatabase();
});
