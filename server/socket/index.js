const { socketAuth } = require('../middleware/auth');
const roomHandlers = require('./roomHandlers');
const gameHandlers = require('./gameHandlers');

function handleDisconnect(io, socket, activeRooms) {
  console.log(`[${new Date().toISOString()}] Socket disconnected: ${socket.id}`);
  for (const [code, room] of activeRooms.entries()) {
    if (room.players.has(socket.user.id)) {
      roomHandlers.leaveRoom(io, socket, activeRooms, code);
    }
  }
}

function setupSocket(io, activeRooms) {
  io.use(socketAuth);
  io.on('connection', (socket) => {
    console.log(`[${new Date().toISOString()}] Socket connected: ${socket.id} user: ${socket.user.username}`);
    roomHandlers.register(io, socket, activeRooms);
    gameHandlers.register(io, socket, activeRooms);
    socket.on('disconnect', () => handleDisconnect(io, socket, activeRooms));
  });
}

module.exports = setupSocket;
