import { io } from 'socket.io-client';

const URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

let socket = null;
let _token = null;

export function connect(token) {
  // Reuse existing socket if token matches and socket is still alive (connected or connecting)
  if (socket && _token === token && !socket.disconnected) return socket;
  // Tear down stale socket
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
  }
  socket = io(URL, { auth: { token }, transports: ['websocket'] });
  _token = token;
  return socket;
}

export function disconnect() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
    _token = null;
  }
}

export function emit(event, data) {
  socket?.emit(event, data);
}

export function on(event, handler) {
  socket?.on(event, handler);
}

export function off(event, handler) {
  socket?.off(event, handler);
}

export function getSocket() {
  return socket;
}

export default { connect, disconnect, emit, on, off, getSocket };
