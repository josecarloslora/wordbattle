const { socketAuth } = require('../middleware/auth');
const roomHandlers = require('./roomHandlers');
const gameHandlers = require('./gameHandlers');
const dominoHandlers = require('./dominoHandlers');

function handleDisconnect(io, socket, activeRooms, activeDominoRooms) {
  console.log(`[${new Date().toISOString()}] Socket disconnected: ${socket.id}`);
  for (const [code, room] of activeRooms.entries()) {
    if (room.players.has(socket.user.id)) {
      roomHandlers.leaveRoom(io, socket, activeRooms, code);
    }
  }
  for (const [code, room] of activeDominoRooms.entries()) {
    if (room.players.has(socket.user.id)) {
      room.players.get(socket.user.id).socketId = null;
    }
  }
}

function setupSocket(io, activeRooms) {
  const { activeDominoRooms } = dominoHandlers;

  io.use(socketAuth);
  io.on('connection', (socket) => {
    console.log(`[${new Date().toISOString()}] Socket connected: ${socket.id} user: ${socket.user.username}`);
    roomHandlers.register(io, socket, activeRooms);
    gameHandlers.register(io, socket, activeRooms);
    dominoHandlers.register(io, socket, activeDominoRooms);
    socket.on('disconnect', () => handleDisconnect(io, socket, activeRooms, activeDominoRooms));
  });
}

module.exports = setupSocket;
