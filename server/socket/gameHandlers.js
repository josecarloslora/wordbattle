const { query } = require('../db');
const { checkGuess } = require('../services/gameService');
const { getRandomWord, isValidWord } = require('../services/wordService');
const { updateStats } = require('../services/statsService');

async function startGame(io, roomCode, activeRoom) {
  const word = getRandomWord(activeRoom.language);
  if (!word) return;

  const { rows: gameRows } = await query(
    'INSERT INTO games (room_id, word, language) VALUES ((SELECT id FROM rooms WHERE code=$1), $2, $3) RETURNING id',
    [roomCode, word, activeRoom.language]
  );
  const gameId = gameRows[0].id;

  for (const [userId] of activeRoom.players.entries()) {
    await query('INSERT INTO game_participants (game_id, user_id) VALUES ($1,$2)', [gameId, userId]);
  }

  await query("UPDATE rooms SET status='in_game' WHERE code=$1", [roomCode]);
  activeRoom.status = 'in_game';
  activeRoom.gameId = gameId;
  activeRoom.word = word;
  activeRoom.startTime = Date.now();

  for (const [, player] of activeRoom.players.entries()) {
    player.isReady = false;
    player.solved = false;
    player.attempts = [];
  }
  activeRoom.readyCount = 0;

  io.to(roomCode).emit('game-start', {
    wordLength: 5,
    language: activeRoom.language,
    startTime: activeRoom.startTime,
    playerCount: activeRoom.players.size,
  });
  console.log(`[${new Date().toISOString()}] Game started in room ${roomCode} word: ${word}`);
}

function register(io, socket, activeRooms) {
  socket.on('player-ready', async ({ roomCode }) => {
    const room = activeRooms.get(roomCode);
    if (!room || room.status !== 'waiting') return;
    const player = room.players.get(socket.user.id);
    if (!player || player.isReady) return;

    player.isReady = true;
    room.readyCount++;

    io.to(roomCode).emit('player-ready-update', { userId: socket.user.id, readyCount: room.readyCount, total: room.players.size });
    console.log(`[${new Date().toISOString()}] ${socket.user.username} ready in ${roomCode} (${room.readyCount}/${room.players.size})`);

    if (room.readyCount === room.players.size && room.players.size >= 2) {
      await startGame(io, roomCode, room);
    }
  });

  socket.on('submit-guess', async ({ roomCode, guess }) => {
    const room = activeRooms.get(roomCode);
    if (!room || room.status !== 'in_game') return;
    const player = room.players.get(socket.user.id);
    if (!player || player.solved) return;
    if (!guess || guess.length !== 5) return;
    if (!isValidWord(guess, room.language)) {
      socket.emit('invalid-word', { guess });
      return;
    }
    if ((player.attempts || []).length >= 6) return;

    const result = checkGuess(guess, room.word);
    player.attempts = player.attempts || [];
    player.attempts.push({ guess: guess.toUpperCase(), result });

    await query(
      'UPDATE game_participants SET attempts=$1, attempts_count=$2 WHERE game_id=$3 AND user_id=$4',
      [JSON.stringify(player.attempts), player.attempts.length, room.gameId, socket.user.id]
    );

    io.to(roomCode).emit('guess-result', {
      playerId: socket.user.id,
      username: socket.user.username,
      result,
      attemptNumber: player.attempts.length,
    });
    console.log(`[${new Date().toISOString()}] ${socket.user.username} guessed ${guess} in ${roomCode}`);

    const solved = result.every(r => r.status === 'correct');
    if (solved) {
      player.solved = true;
      const solveTime = Math.round((Date.now() - room.startTime) / 1000);
      player.solveTime = solveTime;

      await query(
        'UPDATE game_participants SET solved=true, solve_time_seconds=$1, attempts_count=$2 WHERE game_id=$3 AND user_id=$4',
        [solveTime, player.attempts.length, room.gameId, socket.user.id]
      );

      const isFirstWinner = !(await query('SELECT winner_id FROM games WHERE id=$1', [room.gameId])).rows[0].winner_id;
      if (isFirstWinner) {
        await query('UPDATE games SET winner_id=$1 WHERE id=$2', [socket.user.id, room.gameId]);
      }

      await updateStats(socket.user.id, { solved: true, attemptsCount: player.attempts.length, solveTimeSeconds: solveTime });

      io.to(roomCode).emit('player-solved', {
        playerId: socket.user.id,
        username: socket.user.username,
        solveTime,
        attemptsCount: player.attempts.length,
      });
    }

    const allSolved = Array.from(room.players.values()).every(p => p.solved || (p.attempts || []).length >= 6);
    if (allSolved) {
      await endGame(io, roomCode, room);
    }
  });

  socket.on('force-start', async ({ roomCode }) => {
    const room = activeRooms.get(roomCode);
    if (!room || room.status !== 'waiting') return;
    const player = room.players.get(socket.user.id);
    if (!player || !player.isHost) return;
    if (room.players.size < 2) return;
    await startGame(io, roomCode, room);
  });
}

async function endGame(io, roomCode, room) {
  const now = new Date();
  await query('UPDATE games SET ended_at=$1 WHERE id=$2', [now, room.gameId]);
  await query("UPDATE rooms SET status='waiting' WHERE code=$1", [roomCode]);

  const { rows: gameRows } = await query('SELECT winner_id FROM games WHERE id=$1', [room.gameId]);
  const winnerId = gameRows[0]?.winner_id;

  for (const [userId, player] of room.players.entries()) {
    if (!player.solved) {
      await updateStats(userId, { solved: false, attemptsCount: (player.attempts || []).length, solveTimeSeconds: null });
    }
  }

  const { rows: allResults } = await query(
    `SELECT gp.user_id, u.username, gp.solved, gp.attempts_count, gp.solve_time_seconds
     FROM game_participants gp JOIN users u ON u.id = gp.user_id WHERE gp.game_id = $1`,
    [room.gameId]
  );

  let winner = null;
  if (winnerId) {
    const w = allResults.find(r => r.user_id === winnerId);
    if (w) winner = { id: winnerId, username: w.username };
  }

  io.to(roomCode).emit('game-over', { winner, word: room.word, allResults });
  console.log(`[${new Date().toISOString()}] Game over in room ${roomCode}, winner: ${winner?.username}`);

  room.status = 'waiting';
  room.gameId = null;
  room.word = null;
  room.startTime = null;
  room.readyCount = 0;
  for (const [, p] of room.players.entries()) {
    p.isReady = false;
    p.solved = false;
    p.attempts = [];
  }
}

module.exports = { register };
