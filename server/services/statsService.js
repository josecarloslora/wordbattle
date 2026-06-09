const { query } = require('../db');

async function updateStats(userId, { solved, attemptsCount, solveTimeSeconds }) {
  const { rows } = await query('SELECT * FROM user_stats WHERE user_id = $1', [userId]);
  if (!rows.length) return;
  const s = rows[0];

  const totalGames = s.total_games + 1;
  const wins = solved ? s.wins + 1 : s.wins;
  const losses = solved ? s.losses : s.losses + 1;
  const currentStreak = solved ? s.current_streak + 1 : 0;
  const bestStreak = Math.max(s.best_streak, currentStreak);
  const avgAttempts = ((parseFloat(s.avg_attempts) * s.total_games) + attemptsCount) / totalGames;
  const avgTime = Math.round(((s.avg_time_seconds * s.total_games) + (solveTimeSeconds || 0)) / totalGames);

  let dist = typeof s.guess_distribution === 'string' ? JSON.parse(s.guess_distribution) : s.guess_distribution;
  if (solved && attemptsCount >= 1 && attemptsCount <= 6) {
    dist[String(attemptsCount)] = (dist[String(attemptsCount)] || 0) + 1;
  }

  await query(
    `UPDATE user_stats SET wins=$1, losses=$2, current_streak=$3, best_streak=$4,
     total_games=$5, avg_attempts=$6, avg_time_seconds=$7, guess_distribution=$8
     WHERE user_id=$9`,
    [wins, losses, currentStreak, bestStreak, totalGames, avgAttempts.toFixed(2), avgTime, JSON.stringify(dist), userId]
  );
}

module.exports = { updateStats };
