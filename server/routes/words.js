const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { isValidWord } = require('../services/wordService');

const router = express.Router();
router.use(requireAuth);

router.post('/validate', (req, res) => {
  const { word, language } = req.body;
  if (!word || !language) return res.status(400).json({ success: false, error: 'word and language required' });
  res.json({ success: true, data: { valid: isValidWord(word, language) } });
});

module.exports = router;
