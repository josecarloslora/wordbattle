require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const migrate = require('./db/migrate');
const { loadWords } = require('./services/wordService');
const setupSocket = require('./socket');

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

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

const io = new Server(server, { cors: { origin: CLIENT_URL, credentials: true } });
setupSocket(io, activeRooms);

(async () => {
  await migrate();
  await loadWords();
  server.listen(PORT, () => console.log(`[${new Date().toISOString()}] Server running on port ${PORT}`));
})();
