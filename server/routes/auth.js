const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { query } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const limiter = rateLimit({ windowMs: 60 * 1000, max: 10 });
router.use(limiter);

function signTokens(user) {
  const accessToken = jwt.sign(
    { id: user.id, username: user.username, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );
  const refreshToken = jwt.sign({ id: user.id }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
  return { accessToken, refreshToken };
}

function setRefreshCookie(res, token) {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !/^[a-zA-Z0-9_]{3,30}$/.test(username))
    return res.status(400).json({ success: false, error: 'Invalid username' });
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ success: false, error: 'Invalid email' });
  if (!password || password.length < 6)
    return res.status(400).json({ success: false, error: 'Password min 6 chars' });

  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await query(
      'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email, avatar_color',
      [username, email, hash]
    );
    const user = rows[0];
    await query('INSERT INTO user_stats (user_id) VALUES ($1)', [user.id]);
    const { accessToken, refreshToken } = signTokens(user);
    setRefreshCookie(res, refreshToken);
    res.status(201).json({ success: true, data: { user: { id: user.id, username: user.username, email: user.email, avatarColor: user.avatar_color }, accessToken } });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ success: false, error: 'Username or email already taken' });
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const { rows } = await query('SELECT * FROM users WHERE email = $1', [email]);
    if (!rows.length) return res.status(401).json({ success: false, error: 'Invalid credentials' });
    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ success: false, error: 'Invalid credentials' });
    const { accessToken, refreshToken } = signTokens(user);
    setRefreshCookie(res, refreshToken);
    res.json({ success: true, data: { user: { id: user.id, username: user.username, email: user.email, avatarColor: user.avatar_color }, accessToken } });
  } catch {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

router.post('/refresh', (req, res) => {
  const token = req.cookies?.refreshToken;
  if (!token) return res.status(401).json({ success: false, error: 'No refresh token' });
  try {
    const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const accessToken = jwt.sign({ id: payload.id }, process.env.JWT_SECRET, { expiresIn: '15m' });
    res.json({ success: true, data: { accessToken } });
  } catch {
    res.status(401).json({ success: false, error: 'Invalid refresh token' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('refreshToken');
  res.json({ success: true });
});

router.get('/me', requireAuth, async (req, res) => {
  const { rows } = await query('SELECT id, username, email, avatar_color FROM users WHERE id = $1', [req.user.id]);
  if (!rows.length) return res.status(404).json({ success: false, error: 'Not found' });
  const u = rows[0];
  res.json({ success: true, data: { user: { id: u.id, username: u.username, email: u.email, avatarColor: u.avatar_color } } });
});

module.exports = router;
