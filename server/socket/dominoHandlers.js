const { query } = require('../db');

const activeDominoRooms = new Map();

const BOT_NAMES = ['Bot Cruz', 'Bot Ramón', 'Bot María', 'Bot Nico'];
const BOT_COLORS = ['#6b7280', '#6b7280', '#6b7280', '#6b7280'];

function generateAllTiles() {
  const tiles = [];
  for (let high = 6; high >= 0; high--) {
    for (let low = 0; low <= high; low++) {
      tiles.push({ id: `${high}-${low}`, high, low });
    }
  }
  return tiles;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function sumPips(hand) {
  return hand.reduce((s, t) => s + t.high + t.low, 0);
}

function playerHasValidMove(hand, leftEnd, rightEnd, boardEmpty) {
  if (boardEmpty) return true;
  return hand.some(t => t.high === leftEnd || t.low === leftEnd || t.high === rightEnd || t.low === rightEnd);
}

function getPlayersInfo(room) {
  return Array.from(room.players.entries()).map(([id, p]) => ({
    id,
    username: p.username,
    avatarColor: p.avatarColor,
    team: p.team,
    seat: p.seat,
    tileCount: p.hand.length,
    isHost: p.isHost,
    isReady: p.isReady,
    isBot: p.isBot || false,
  }));
}

function getSeatOrder(room) {
  return Array.from(room.players.entries())
    .sort((a, b) => a[1].seat - b[1].seat)
    .map(([id]) => id);
}

function createBot(seat) {
  return {
    socketId: `bot-${seat}`,
    username: BOT_NAMES[seat] || `Bot-${seat + 1}`,
    avatarColor: BOT_COLORS[seat],
    team: [1, 2, 1, 2][seat],
    seat,
    hand: [],
    isReady: true,
    isHost: false,
    isBot: true,
  };
}

function placeTileOnBoard(room, tile, side) {
  const isEmpty = room.board.length === 0;
  let boardTile;

  if (isEmpty) {
    boardTile = { tile, left: tile.low, right: tile.high, isDouble: tile.high === tile.low };
    room.board.push(boardTile);
    room.leftEnd = tile.low;
    room.rightEnd = tile.high;
    room.forcedFirstTile = null;
  } else if (side === 'left') {
    const left = tile.high === room.leftEnd ? tile.low : tile.high;
    const right = tile.high === room.leftEnd ? tile.high : tile.low;
    boardTile = { tile, left, right, isDouble: tile.high === tile.low };
    room.board.unshift(boardTile);
    room.leftEnd = left;
  } else {
    const right = tile.low === room.rightEnd ? tile.high : tile.low;
    const left = tile.low === room.rightEnd ? tile.low : tile.high;
    boardTile = { tile, left, right, isDouble: tile.high === tile.low };
    room.board.push(boardTile);
    room.rightEnd = right;
  }

  return boardTile;
}

function scheduleBotMove(io, roomCode, room) {
  const botId = room.currentPlayer;
  const bot = room.players.get(botId);
  if (!bot || !bot.isBot) return;

  const delay = 1200 + Math.random() * 800;
  setTimeout(() => {
    if (room.status !== 'playing' || room.currentPlayer !== botId) return;
    doBotMove(io, roomCode, room);
  }, delay);
}

function doBotMove(io, roomCode, room) {
  const botId = room.currentPlayer;
  const bot = room.players.get(botId);
  if (!bot || !bot.isBot || room.status !== 'playing') return;

  const isEmpty = room.board.length === 0;

  const validTiles = bot.hand.filter(t => {
    if (isEmpty) return !room.forcedFirstTile || t.id === room.forcedFirstTile;
    return t.high === room.leftEnd || t.low === room.leftEnd || t.high === room.rightEnd || t.low === room.rightEnd;
  });

  if (validTiles.length === 0) {
    room.passCount++;
    io.to(roomCode).emit('domino:player-passed', {
      playerId: botId,
      username: bot.username,
      passCount: room.passCount,
    });
    if (room.passCount >= 4) {
      endRound(io, roomCode, room, null, true);
    } else {
      advanceTurn(io, roomCode, room);
    }
    return;
  }

  const tile = validTiles[Math.floor(Math.random() * validTiles.length)];

  let side;
  if (isEmpty) {
    side = 'right';
  } else {
    const canLeft = tile.high === room.leftEnd || tile.low === room.leftEnd;
    const canRight = tile.high === room.rightEnd || tile.low === room.rightEnd;
    if (canLeft && canRight) side = Math.random() < 0.5 ? 'left' : 'right';
    else side = canLeft ? 'left' : 'right';
  }

  const tileIdx = bot.hand.findIndex(t => t.id === tile.id);
  bot.hand.splice(tileIdx, 1);
  room.passCount = 0;

  placeTileOnBoard(room, tile, side);

  io.to(roomCode).emit('domino:tile-played', {
    playerId: botId,
    tileId: tile.id,
    side,
    board: room.board,
    leftEnd: room.leftEnd,
    rightEnd: room.rightEnd,
    players: getPlayersInfo(room),
  });

  if (bot.hand.length === 0) {
    endRound(io, roomCode, room, botId, false);
    return;
  }

  advanceTurn(io, roomCode, room);
}

function advanceTurn(io, roomCode, room) {
  const seats = getSeatOrder(room);
  const idx = seats.indexOf(room.currentPlayer);
  room.currentPlayer = seats[(idx + 1) % seats.length];
  io.to(roomCode).emit('domino:turn-change', { currentPlayer: room.currentPlayer });
  scheduleBotMove(io, roomCode, room);
}

async function startNewRound(io, roomCode, room, isFirstRound) {
  const tiles = shuffle(generateAllTiles());
  const seats = getSeatOrder(room);

  for (let i = 0; i < seats.length; i++) {
    const player = room.players.get(seats[i]);
    player.hand = tiles.slice(i * 7, (i + 1) * 7);
    player.isReady = false;
  }

  room.board = [];
  room.leftEnd = null;
  room.rightEnd = null;
  room.passCount = 0;
  room.status = 'playing';
  room.readyCount = 0;

  let starterId = room.lastWinner;
  if (isFirstRound || !starterId) {
    for (const [uid, p] of room.players) {
      if (p.hand.some(t => t.id === '6-6')) { starterId = uid; break; }
    }
  }
  room.currentPlayer = starterId;
  room.forcedFirstTile = isFirstRound ? '6-6' : null;

  if (isFirstRound && !room.gameId) {
    try {
      const { rows } = await query(
        `INSERT INTO domino_games (room_id) SELECT id FROM rooms WHERE code=$1 RETURNING id`,
        [roomCode]
      );
      if (rows.length) room.gameId = rows[0].id;
    } catch (err) {
      console.error('[domino] insert game err:', err.message);
    }
  }

  // Emit to human players only
  for (const [uid, player] of room.players) {
    if (player.isBot) continue;
    io.to(player.socketId).emit('domino:round-start', {
      hand: player.hand,
      currentPlayer: starterId,
      board: [],
      leftEnd: null,
      rightEnd: null,
      roundNumber: room.roundNumber,
      scores: { ...room.scores },
      players: getPlayersInfo(room),
      forcedFirstTile: room.forcedFirstTile,
      myTeam: player.team,
    });
  }

  console.log(`[domino] Round ${room.roundNumber} started in ${roomCode}, starter: ${room.players.get(starterId)?.username}`);

  // If starter is a bot, schedule their first move with a bit more delay
  if (room.players.get(starterId)?.isBot) {
    const botId = starterId;
    setTimeout(() => {
      if (room.status !== 'playing' || room.currentPlayer !== botId) return;
      doBotMove(io, roomCode, room);
    }, 2000);
  }
}

async function endRound(io, roomCode, room, winnerId, isTranque) {
  let winnerTeam = null;
  let totalPoints = 0;

  if (isTranque) {
    const t1 = Array.from(room.players.values()).filter(p => p.team === 1).reduce((s, p) => s + sumPips(p.hand), 0);
    const t2 = Array.from(room.players.values()).filter(p => p.team === 2).reduce((s, p) => s + sumPips(p.hand), 0);
    if (t1 < t2) { winnerTeam = 1; totalPoints = t1 + t2; }
    else if (t2 < t1) { winnerTeam = 2; totalPoints = t1 + t2; }
    else { winnerTeam = null; totalPoints = 0; }
    room.lastWinner = null;
  } else {
    const winner = room.players.get(winnerId);
    winnerTeam = winner.team;
    room.lastWinner = winnerId;
    totalPoints = Array.from(room.players.values()).reduce((s, p) => s + sumPips(p.hand), 0);
  }

  if (winnerTeam !== null) {
    room.scores[`team${winnerTeam}`] += totalPoints;
  }

  try {
    if (room.gameId) {
      await query(
        `INSERT INTO domino_rounds (game_id, round_number, winner_team, points, is_tranque) VALUES ($1,$2,$3,$4,$5)`,
        [room.gameId, room.roundNumber, winnerTeam, totalPoints, isTranque]
      );
      await query('UPDATE domino_games SET team1_score=$1, team2_score=$2 WHERE id=$3',
        [room.scores.team1, room.scores.team2, room.gameId]);
    }
  } catch (err) {
    console.error('[domino] endRound DB err:', err.message);
  }

  const gameOver = room.scores.team1 >= room.targetScore || room.scores.team2 >= room.targetScore;
  const roundResult = {
    winnerTeam,
    points: totalPoints,
    isTranque,
    scores: { ...room.scores },
    players: getPlayersInfo(room),
  };

  if (gameOver) {
    room.status = 'game_over';
    const gameWinnerTeam = room.scores.team1 >= room.targetScore ? 1 : 2;
    try {
      if (room.gameId) {
        await query('UPDATE domino_games SET ended_at=NOW(), winner_team=$1 WHERE id=$2', [gameWinnerTeam, room.gameId]);
      }
      await query("UPDATE rooms SET status='waiting' WHERE code=$1", [roomCode]);
    } catch (err) {
      console.error('[domino] game over DB err:', err.message);
    }
    io.to(roomCode).emit('domino:game-over', { ...roundResult, gameWinnerTeam });
  } else {
    room.roundNumber++;
    io.to(roomCode).emit('domino:round-over', roundResult);
    setTimeout(() => startNewRound(io, roomCode, room, false), 5000);
  }
}

function register(io, socket, activeDominoRooms) {
  socket.on('domino:join-room', async ({ roomCode }) => {
    try {
      const { rows } = await query('SELECT * FROM rooms WHERE code=$1', [roomCode]);
      if (!rows.length) return socket.emit('domino:error', { message: 'Sala no encontrada' });
      const roomRow = rows[0];
      if (roomRow.game_type !== 'domino') return socket.emit('domino:error', { message: 'Esta no es una sala de dominó' });

      socket.join(roomCode);

      if (!activeDominoRooms.has(roomCode)) {
        activeDominoRooms.set(roomCode, {
          players: new Map(),
          board: [], leftEnd: null, rightEnd: null,
          currentPlayer: null, passCount: 0,
          roundNumber: 1,
          scores: { team1: 0, team2: 0 },
          status: 'waiting', readyCount: 0,
          lastWinner: null, gameId: null,
          targetScore: 200, forcedFirstTile: null,
        });
      }

      const dr = activeDominoRooms.get(roomCode);

      if (dr.players.has(socket.user.id)) {
        const player = dr.players.get(socket.user.id);
        player.socketId = socket.id;

        if (dr.status === 'playing') {
          socket.emit('domino:game-state', {
            hand: player.hand,
            board: dr.board,
            leftEnd: dr.leftEnd,
            rightEnd: dr.rightEnd,
            currentPlayer: dr.currentPlayer,
            players: getPlayersInfo(dr),
            scores: { ...dr.scores },
            roundNumber: dr.roundNumber,
            myTeam: player.team,
            forcedFirstTile: dr.forcedFirstTile,
          });
        } else {
          socket.emit('domino:room-state', {
            players: getPlayersInfo(dr),
            status: dr.status,
            scores: { ...dr.scores },
            roundNumber: dr.roundNumber,
          });
        }
        return;
      }

      if (dr.status !== 'waiting') return socket.emit('domino:error', { message: 'Partida en curso' });

      const humanCount = Array.from(dr.players.values()).filter(p => !p.isBot).length;
      if (humanCount >= 4) return socket.emit('domino:error', { message: 'Sala llena (máx 4 jugadores)' });

      // Find first available seat (skip bot-reserved seats)
      const takenSeats = new Set(Array.from(dr.players.values()).map(p => p.seat));
      let seatIndex = 0;
      while (takenSeats.has(seatIndex)) seatIndex++;

      await query('INSERT INTO room_members (room_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [roomRow.id, socket.user.id]);

      const team = [1, 2, 1, 2][seatIndex];
      dr.players.set(socket.user.id, {
        socketId: socket.id,
        username: socket.user.username,
        avatarColor: '#6366f1',
        team,
        seat: seatIndex,
        hand: [],
        isReady: false,
        isHost: roomRow.host_id === socket.user.id,
        isBot: false,
      });

      socket.emit('domino:room-state', {
        players: getPlayersInfo(dr),
        status: dr.status,
        scores: { ...dr.scores },
        roundNumber: dr.roundNumber,
      });
      socket.to(roomCode).emit('domino:player-joined', {
        userId: socket.user.id,
        username: socket.user.username,
        players: getPlayersInfo(dr),
      });

      console.log(`[domino] ${socket.user.username} joined room ${roomCode} (seat ${seatIndex}, team ${team})`);
    } catch (err) {
      console.error('[domino:join-room]', err);
      socket.emit('domino:error', { message: 'Error al unirse a la sala' });
    }
  });

  socket.on('domino:ready', async ({ roomCode }) => {
    const dr = activeDominoRooms.get(roomCode);
    if (!dr || dr.status !== 'waiting') return;
    const player = dr.players.get(socket.user.id);
    if (!player || player.isReady) return;

    player.isReady = true;
    dr.readyCount++;

    io.to(roomCode).emit('domino:player-ready', {
      userId: socket.user.id,
      readyCount: dr.readyCount,
      total: dr.players.size,
      players: getPlayersInfo(dr),
    });

    const humanPlayers = Array.from(dr.players.values()).filter(p => !p.isBot);
    const humanReady = humanPlayers.every(p => p.isReady);

    if (humanReady && dr.players.size === 4) {
      await startNewRound(io, roomCode, dr, true);
    }
  });

  socket.on('domino:start-with-bots', async ({ roomCode }) => {
    const dr = activeDominoRooms.get(roomCode);
    if (!dr || dr.status !== 'waiting') return;
    if (!dr.players.has(socket.user.id)) return;

    const humanPlayers = Array.from(dr.players.values()).filter(p => !p.isBot);
    if (humanPlayers.length === 0) return;

    // Mark all humans as ready
    for (const [, p] of dr.players) p.isReady = true;

    // Fill remaining seats with bots
    const takenSeats = new Set(Array.from(dr.players.values()).map(p => p.seat));
    for (let seat = 0; seat < 4; seat++) {
      if (!takenSeats.has(seat)) {
        dr.players.set(`bot-${seat}`, createBot(seat));
      }
    }

    io.to(roomCode).emit('domino:bots-added', { players: getPlayersInfo(dr) });
    console.log(`[domino] Starting room ${roomCode} with bots (${humanPlayers.length} humans)`);
    await startNewRound(io, roomCode, dr, true);
  });

  socket.on('domino:play-tile', async ({ roomCode, tileId, side }) => {
    const dr = activeDominoRooms.get(roomCode);
    if (!dr || dr.status !== 'playing') return;
    if (dr.currentPlayer !== socket.user.id) {
      return socket.emit('domino:error', { message: 'No es tu turno' });
    }

    const player = dr.players.get(socket.user.id);
    if (!player) return;

    const tileIdx = player.hand.findIndex(t => t.id === tileId);
    if (tileIdx === -1) return socket.emit('domino:error', { message: 'Ficha no encontrada' });
    const tile = player.hand[tileIdx];

    const isEmpty = dr.board.length === 0;

    if (isEmpty && dr.forcedFirstTile && tile.id !== dr.forcedFirstTile) {
      return socket.emit('domino:error', { message: `Debes comenzar con la ficha ${dr.forcedFirstTile.replace('-', '|')}` });
    }

    if (!isEmpty) {
      const targetEnd = side === 'left' ? dr.leftEnd : dr.rightEnd;
      if (tile.high !== targetEnd && tile.low !== targetEnd) {
        return socket.emit('domino:error', { message: 'Esa ficha no encaja en ese lado' });
      }
    }

    player.hand.splice(tileIdx, 1);
    dr.passCount = 0;

    placeTileOnBoard(dr, tile, side);

    io.to(roomCode).emit('domino:tile-played', {
      playerId: socket.user.id,
      tileId,
      side,
      board: dr.board,
      leftEnd: dr.leftEnd,
      rightEnd: dr.rightEnd,
      players: getPlayersInfo(dr),
    });

    if (player.hand.length === 0) {
      await endRound(io, roomCode, dr, socket.user.id, false);
      return;
    }

    advanceTurn(io, roomCode, dr);
  });

  socket.on('domino:pass', async ({ roomCode }) => {
    const dr = activeDominoRooms.get(roomCode);
    if (!dr || dr.status !== 'playing') return;
    if (dr.currentPlayer !== socket.user.id) return;

    const player = dr.players.get(socket.user.id);
    if (!player) return;

    if (playerHasValidMove(player.hand, dr.leftEnd, dr.rightEnd, dr.board.length === 0)) {
      return socket.emit('domino:error', { message: 'Tienes fichas válidas, no puedes pasar' });
    }

    dr.passCount++;
    io.to(roomCode).emit('domino:player-passed', {
      playerId: socket.user.id,
      username: player.username,
      passCount: dr.passCount,
    });

    if (dr.passCount >= 4) {
      await endRound(io, roomCode, dr, null, true);
      return;
    }

    advanceTurn(io, roomCode, dr);
  });

  socket.on('domino:leave-room', async ({ roomCode }) => {
    const dr = activeDominoRooms.get(roomCode);
    if (!dr) return;
    dr.players.delete(socket.user.id);
    socket.leave(roomCode);
    try {
      await query('DELETE FROM room_members WHERE room_id=(SELECT id FROM rooms WHERE code=$1) AND user_id=$2', [roomCode, socket.user.id]);
      const humanPlayers = Array.from(dr.players.values()).filter(p => !p.isBot);
      if (humanPlayers.length === 0) {
        activeDominoRooms.delete(roomCode);
        await query('DELETE FROM rooms WHERE code=$1', [roomCode]);
      } else {
        io.to(roomCode).emit('domino:player-left', { userId: socket.user.id, players: getPlayersInfo(dr) });
      }
    } catch (err) {
      console.error('[domino:leave-room]', err.message);
    }
  });
}

module.exports = { register, activeDominoRooms };
