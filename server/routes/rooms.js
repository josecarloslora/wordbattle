const express = require('express');
const { query } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

function generateCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

router.get('/', async (req, res) => {
  const { lang, gameType = 'wordle' } = req.query;
  let q = `SELECT r.*, u.username AS host_username,
    (SELECT COUNT(*) FROM room_members rm WHERE rm.room_id = r.id) AS member_count
    FROM rooms r LEFT JOIN users u ON r.host_id = u.id
    WHERE r.is_public = true AND r.status = 'waiting' AND r.game_type = $1`;
  const params = [gameType];
  if (lang) { q += ` AND r.language = $2`; params.push(lang); }
  q += ' ORDER BY r.created_at DESC LIMIT 50';
  const { rows } = await query(q, params);
  res.json({ success: true, data: { rooms: rows } });
});

router.post('/', async (req, res) => {
  const { name, language = 'es', maxPlayers = 4, isPublic = true, gameType = 'wordle' } = req.body;
  if (!name) return res.status(400).json({ success: false, error: 'Name required' });

  const resolvedMax = gameType === 'domino' ? 4 : maxPlayers;

  let code, tries = 0;
  while (tries < 10) {
    code = generateCode();
    const { rows } = await query('SELECT id FROM rooms WHERE code = $1', [code]);
    if (!rows.length) break;
    tries++;
  }

  const { rows } = await query(
    'INSERT INTO rooms (code, name, host_id, language, max_players, is_public, game_type) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
    [code, name, req.user.id, language, resolvedMax, isPublic, gameType]
  );
  const room = rows[0];
  await query('INSERT INTO room_members (room_id, user_id) VALUES ($1,$2)', [room.id, req.user.id]);

  if (gameType === 'wordle') {
    const activeRooms = req.app.get('activeRooms');
    activeRooms.set(code, {
      players: new Map([[req.user.id, { socketId: null, username: req.user.username, avatarColor: '#6366f1', isReady: false, isHost: true }]]),
      status: 'waiting', gameId: null, word: null, language, readyCount: 0, startTime: null,
    });
  }

  res.status(201).json({ success: true, data: { room } });
});

router.get('/:code', async (req, res) => {
  const { rows: roomRows } = await query('SELECT * FROM rooms WHERE code = $1', [req.params.code]);
  if (!roomRows.length) return res.status(404).json({ success: false, error: 'Room not found' });
  const room = roomRows[0];
  const { rows: members } = await query(
    'SELECT u.id, u.username, u.avatar_color FROM users u JOIN room_members rm ON rm.user_id = u.id WHERE rm.room_id = $1',
    [room.id]
  );
  res.json({ success: true, data: { room, members } });
});

router.delete('/:code', async (req, res) => {
  const { rows } = await query('SELECT * FROM rooms WHERE code = $1', [req.params.code]);
  if (!rows.length) return res.status(404).json({ success: false, error: 'Room not found' });
  if (rows[0].host_id !== req.user.id) return res.status(403).json({ success: false, error: 'Not host' });
  await query('DELETE FROM rooms WHERE code = $1', [req.params.code]);
  req.app.get('activeRooms').delete(req.params.code);
  res.json({ success: true });
});

module.exports = router;
