const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'No token provided' });
  }
  try {
    const payload = jwt.verify(auth.slice(7), process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Invalid token' });
  }
}

function socketAuth(socket, next) {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('No token'));
  try {
    socket.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    next(new Error('Invalid token'));
  }
}

module.exports = { requireAuth, socketAuth };
