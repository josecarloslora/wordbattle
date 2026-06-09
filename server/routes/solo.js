const express = require('express');
const { query } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { getRandomWord, isValidWord } = require('../services/wordService');
const { checkGuess } = require('../services/gameService');
const { updateStats } = require('../services/statsService');

const router = express.Router();
router.use(requireAuth);

router.post('/start', async (req, res) => {
  try {
    const { language = 'es' } = req.body;
    if (!['es', 'en'].includes(language)) {
      return res.status(400).json({ success: false, error: 'Invalid language' });
    }

    const word = getRandomWord(language);
    if (!word) return res.status(500).json({ success: false, error: 'No words available' });

    const { rows } = await query(
      `INSERT INTO games (word, language, mode) VALUES ($1, $2, 'solo') RETURNING id`,
      [word, language]
    );
    const gameId = rows[0].id;

    await query(
      'INSERT INTO game_participants (game_id, user_id) VALUES ($1, $2)',
      [gameId, req.user.id]
    );

    res.json({ success: true, data: { gameId, language } });
  } catch (err) {
    console.error('[solo/start]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/guess', async (req, res) => {
  try {
    const { gameId, guess } = req.body;
    if (!gameId || !guess) {
      return res.status(400).json({ success: false, error: 'gameId and guess required' });
    }

    const normalizedGuess = guess.toUpperCase().trim();
    if (normalizedGuess.length !== 5) {
      return res.status(400).json({ success: false, error: 'Guess must be 5 letters' });
    }

    const { rows: gameRows } = await query(
      `SELECT g.word, g.language, g.ended_at,
              gp.id AS participant_id, gp.attempts, gp.solved
       FROM games g
       JOIN game_participants gp ON gp.game_id = g.id AND gp.user_id = $1
       WHERE g.id = $2 AND g.mode = 'solo'`,
      [req.user.id, gameId]
    );

    if (!gameRows.length) return res.status(404).json({ success: false, error: 'Game not found' });
    const game = gameRows[0];

    if (game.ended_at) return res.status(400).json({ success: false, error: 'Game already ended' });
    if (game.solved) return res.status(400).json({ success: false, error: 'Already solved' });

    const attempts = Array.isArray(game.attempts)
      ? game.attempts
      : (typeof game.attempts === 'string' ? JSON.parse(game.attempts) : []);

    if (attempts.length >= 6) return res.status(400).json({ success: false, error: 'No attempts remaining' });

    if (!isValidWord(normalizedGuess, game.language)) {
      return res.json({ success: true, data: { valid: false } });
    }

    const result = checkGuess(normalizedGuess, game.word);
    const newAttempts = [...attempts, { guess: normalizedGuess, result }];
    const solved = result.every(r => r.status === 'correct');
    const gameOver = solved || newAttempts.length >= 6;

    await query(
      'UPDATE game_participants SET attempts=$1, attempts_count=$2, solved=$3 WHERE id=$4',
      [JSON.stringify(newAttempts), newAttempts.length, solved, game.participant_id]
    );

    if (gameOver) {
      await query('UPDATE games SET ended_at=NOW(), winner_id=$1 WHERE id=$2', [
        solved ? req.user.id : null,
        gameId,
      ]);
      await updateStats(req.user.id, { solved, attemptsCount: newAttempts.length, solveTimeSeconds: 0 });
    }

    res.json({
      success: true,
      data: {
        valid: true,
        result,
        solved,
        gameOver,
        attemptsLeft: 6 - newAttempts.length,
        word: gameOver ? game.word : undefined,
      },
    });
  } catch (err) {
    console.error('[solo/guess]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
