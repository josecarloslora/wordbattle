const { query } = require('../db');

const activeDominoRooms = new Map();

function generateAllTiles() {
  const tiles = [];
  for (let high = 6; high >= 0; high--) {
    for (let low = 0; low <= high; low++) {
      tiles.push({ id: `${high}-${low}`, high, low });
    }
  }
  return tiles; // 28 tiles
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
  }));
}

function getSeatOrder(room) {
  return Array.from(room.players.entries())
    .sort((a, b) => a[1].seat - b[1].seat)
    .map(([id]) => id);
}

function advanceTurn(io, roomCode, room) {
  const seats = getSeatOrder(room);
  const idx = seats.indexOf(room.currentPlayer);
  room.currentPlayer = seats[(idx + 1) % seats.length];
  io.to(roomCode).emit('domino:turn-change', { currentPlayer: room.currentPlayer });
}

async function startNewRound(io, roomCode, room, isFirstRound) {
  const tiles = shuffle(generateAllTiles());
  const seats = getSeatOrder(room);

  for (let i = 0; i < 4; i++) {
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
        `INSERT INTO domino_games (room_id)
         SELECT id FROM rooms WHERE code=$1 RETURNING id`,
        [roomCode]
      );
      if (rows.length) room.gameId = rows[0].id;
    } catch (err) {
      console.error('[domino] insert game err:', err.message);
    }
  }

  for (const [uid, player] of room.players) {
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
      await query(
        'UPDATE domino_games SET team1_score=$1, team2_score=$2 WHERE id=$3',
        [room.scores.team1, room.scores.team2, room.gameId]
      );
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
        // Reconnect: update socketId, send current state
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

      // New player joining
      if (dr.status !== 'waiting') return socket.emit('domino:error', { message: 'Partida en curso' });
      if (dr.players.size >= 4) return socket.emit('domino:error', { message: 'Sala llena (máx 4 jugadores)' });

      await query('INSERT INTO room_members (room_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [roomRow.id, socket.user.id]);

      const seatIndex = dr.players.size;
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

    if (dr.readyCount >= 4 && dr.players.size === 4) {
      await startNewRound(io, roomCode, dr, true);
    }
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

    let boardTile;

    if (isEmpty) {
      boardTile = { tile, left: tile.low, right: tile.high, isDouble: tile.high === tile.low };
      dr.board.push(boardTile);
      dr.leftEnd = tile.low;
      dr.rightEnd = tile.high;
      dr.forcedFirstTile = null;
    } else {
      const targetEnd = side === 'left' ? dr.leftEnd : dr.rightEnd;
      if (tile.high !== targetEnd && tile.low !== targetEnd) {
        return socket.emit('domino:error', { message: 'Esa ficha no encaja en ese lado' });
      }
      if (side === 'left') {
        const left = tile.high === dr.leftEnd ? tile.low : tile.high;
        boardTile = { tile, left, right: tile.high === dr.leftEnd ? tile.high : tile.low, isDouble: tile.high === tile.low };
        dr.board.unshift(boardTile);
        dr.leftEnd = left;
      } else {
        const right = tile.low === dr.rightEnd ? tile.high : tile.low;
        boardTile = { tile, left: tile.low === dr.rightEnd ? tile.low : tile.high, right, isDouble: tile.high === tile.low };
        dr.board.push(boardTile);
        dr.rightEnd = right;
      }
    }

    player.hand.splice(tileIdx, 1);
    dr.passCount = 0;

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
      if (dr.players.size === 0) {
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
