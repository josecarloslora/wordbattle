import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

let _socket = null;
let _token = null;

// Returns the same socket instance across DominoRoom → DominoGame navigation.
// Creates a new socket only when the token changes or the socket is gone.
export function getDominoSocket(token) {
  if (_socket && _token === token && !_socket.disconnected) {
    return _socket;
  }
  if (_socket) {
    _socket.removeAllListeners();
    _socket.disconnect();
  }
  _socket = io(SOCKET_URL, { auth: { token } });
  _token = token;
  return _socket;
}

// Call when leaving the domino flow entirely (back to main lobby).
export function destroyDominoSocket() {
  if (_socket) {
    _socket.removeAllListeners();
    _socket.disconnect();
    _socket = null;
    _token = null;
  }
}
