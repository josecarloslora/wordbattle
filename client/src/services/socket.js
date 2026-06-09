import { io } from 'socket.io-client';

const URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

let socket = null;

export function connect(token) {
  if (socket?.connected) return socket;
  socket = io(URL, { auth: { token }, transports: ['websocket'] });
  return socket;
}

export function disconnect() {
  socket?.disconnect();
  socket = null;
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
