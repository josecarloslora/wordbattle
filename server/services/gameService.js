const { v4: uuidv4 } = require('uuid');

function checkGuess(guess, target) {
  const g = guess.toUpperCase().split('');
  const t = target.toUpperCase().split('');
  const result = Array(5).fill(null).map((_, i) => ({ letter: g[i], status: 'absent' }));
  const targetCount = {};

  for (let i = 0; i < 5; i++) {
    if (g[i] === t[i]) {
      result[i].status = 'correct';
      targetCount[t[i]] = (targetCount[t[i]] || 0) - 1;
    } else {
      targetCount[t[i]] = (targetCount[t[i]] || 0) + 1;
    }
  }

  for (let i = 0; i < 5; i++) {
    if (result[i].status !== 'correct' && targetCount[g[i]] > 0) {
      result[i].status = 'present';
      targetCount[g[i]]--;
    }
  }

  return result;
}

function generateGameId() {
  return uuidv4();
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

module.exports = { checkGuess, generateGameId, formatTime };
