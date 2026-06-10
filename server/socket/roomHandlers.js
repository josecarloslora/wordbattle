const { query } = require('../db');

async function leaveRoom(io, socket, activeRooms, roomCode) {
  const room = activeRooms.get(roomCode);
  if (!room) return;

  room.players.delete(socket.user.id);
  socket.leave(roomCode);
  await query('DELETE FROM room_members WHERE room_id = (SELECT id FROM rooms WHERE code=$1) AND user_id=$2', [roomCode, socket.user.id]);

  if (room.players.size === 0) {
    activeRooms.delete(roomCode);
    await query('DELETE FROM rooms WHERE code=$1', [roomCode]);
    return;
  }

  const hostStillIn = Array.from(room.players.values()).some(p => p.isHost);
  if (!hostStillIn) {
    const [newHostId, newHost] = room.players.entries().next().value;
    newHost.isHost = true;
    await query('UPDATE rooms SET host_id=$1 WHERE code=$2', [newHostId, roomCode]);
  }

  io.to(roomCode).emit('player-left', { userId: socket.user.id, username: socket.user.username });
}

function register(io, socket, activeRooms) {
  socket.on('join-room', async ({ roomCode }) => {
    try {
      const { rows } = await query('SELECT * FROM rooms WHERE code=$1', [roomCode]);
      if (!rows.length) return socket.emit('error', { message: 'Room not found' });
      const room = rows[0];
      if (room.game_type === 'domino') return socket.emit('error', { message: 'Esta es una sala de dominó' });

      // Always join the socket.io room (needed for game events after reconnect)
      socket.join(roomCode);

      if (!activeRooms.has(roomCode)) {
        activeRooms.set(roomCode, { players: new Map(), status: 'waiting', gameId: null, word: null, language: room.language, readyCount: 0, startTime: null });
      }
      const activeRoom = activeRooms.get(roomCode);

      // Reconnect path: player already in the in-memory room
      if (activeRoom.players.has(socket.user.id)) {
        const player = activeRoom.players.get(socket.user.id);
        player.socketId = socket.id;
        const playersArr = Array.from(activeRoom.players.entries()).map(([id, p]) => ({ id, ...p }));
        socket.emit('room-state', { players: playersArr, status: activeRoom.status, language: activeRoom.language });
        console.log(`[${new Date().toISOString()}] ${socket.user.username} reconnected to room ${roomCode} (status=${activeRoom.status})`);
        return;
      }

      // New player path: only allow joining if room is waiting
      if (room.status !== 'waiting') return socket.emit('error', { message: 'Game already started' });

      const memberCount = await query('SELECT COUNT(*) FROM room_members WHERE room_id=$1', [room.id]);
      if (parseInt(memberCount.rows[0].count) >= room.max_players) return socket.emit('error', { message: 'Room is full' });

      await query('INSERT INTO room_members (room_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [room.id, socket.user.id]);

      activeRoom.players.set(socket.user.id, { socketId: socket.id, username: socket.user.username, avatarColor: '#6366f1', isReady: false, isHost: room.host_id === socket.user.id });

      const playersArr = Array.from(activeRoom.players.entries()).map(([id, p]) => ({ id, ...p }));
      socket.emit('room-state', { players: playersArr, status: activeRoom.status, language: activeRoom.language });
      socket.to(roomCode).emit('player-joined', { userId: socket.user.id, username: socket.user.username });

      console.log(`[${new Date().toISOString()}] ${socket.user.username} joined room ${roomCode}`);
    } catch (err) {
      console.error('[join-room]', err);
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  socket.on('leave-room', ({ roomCode }) => {
    leaveRoom(io, socket, activeRooms, roomCode);
  });
}

module.exports = { register, leaveRoom };
