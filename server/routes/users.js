const express = require('express');
const { query } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/:id/profile', async (req, res) => {
  const id = req.params.id === 'me' ? req.user.id : req.params.id;
  const { rows: u } = await query('SELECT id, username, email, avatar_color, created_at FROM users WHERE id = $1', [id]);
  if (!u.length) return res.status(404).json({ success: false, error: 'User not found' });
  const { rows: s } = await query('SELECT * FROM user_stats WHERE user_id = $1', [id]);
  res.json({ success: true, data: { user: u[0], stats: s[0] || null } });
});

router.get('/:id/history', async (req, res) => {
  const id = req.params.id === 'me' ? req.user.id : req.params.id;
  const { rows } = await query(
    `SELECT gp.*, g.word, g.language, g.mode, g.started_at, g.ended_at, g.winner_id, r.name AS room_name
     FROM game_participants gp
     JOIN games g ON g.id = gp.game_id
     LEFT JOIN rooms r ON r.id = g.room_id
     WHERE gp.user_id = $1
     ORDER BY g.started_at DESC LIMIT 30`,
    [id]
  );
  res.json({ success: true, data: { games: rows } });
});

module.exports = router;
