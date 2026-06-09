import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import useAuthStore from '../store/authStore';
import useDominoStore from '../store/dominoStore';
import PlayerSeat from '../components/domino/PlayerSeat';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

export default function DominoRoom() {
  const { code } = useParams();
  const nav = useNavigate();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.accessToken);
  const initRound = useDominoStore((s) => s.initRound);

  const [players, setPlayers] = useState([]);
  const [readyCount, setReadyCount] = useState(0);
  const [myReady, setMyReady] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const socketRef = useRef(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  useEffect(() => {
    if (!token) return;
    const socket = io(SOCKET_URL, { auth: { token } });
    socketRef.current = socket;

    socket.emit('domino:join-room', { roomCode: code });

    socket.on('domino:room-state', ({ players: pl }) => setPlayers(pl || []));
    socket.on('domino:player-joined', ({ players: pl }) => {
      setPlayers(pl || []);
      const p = pl.find(x => x.id !== user?.id);
      if (p) showToast(`${p.username} se unió`);
    });
    socket.on('domino:player-ready', ({ readyCount: rc, players: pl }) => {
      setReadyCount(rc);
      setPlayers(pl || []);
    });
    socket.on('domino:player-left', ({ players: pl }) => setPlayers(pl || []));
    socket.on('domino:round-start', (data) => {
      initRound(data);
      nav(`/domino/game/${code}`);
    });
    socket.on('domino:error', ({ message }) => setError(message));

    return () => socket.disconnect();
  }, [code, token]);

  const handleReady = () => {
    if (myReady || !socketRef.current) return;
    socketRef.current.emit('domino:ready', { roomCode: code });
    setMyReady(true);
  };

  const handleLeave = () => {
    socketRef.current?.emit('domino:leave-room', { roomCode: code });
    nav('/domino');
  };

  const myPlayer = players.find((p) => p.id === user?.id);
  const team1 = players.filter((p) => p.team === 1);
  const team2 = players.filter((p) => p.team === 2);
  const allSeats = [0, 1, 2, 3];

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <button onClick={handleLeave} className="text-gray-400 hover:text-white transition-colors text-sm">
          ← Salir
        </button>
        <div className="text-center">
          <div className="font-black text-lg">
            <span className="text-white">Bros</span>
            <span className="text-indigo-400">Games</span>
          </div>
          <div className="text-xs text-yellow-400 font-mono tracking-widest">{code}</div>
        </div>
        <div className="text-gray-500 text-sm">{players.length}/4</div>
      </div>

      {toast && (
        <div className="mx-4 mt-3 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-center text-gray-300">
          {toast}
        </div>
      )}

      {error && (
        <div className="mx-4 mt-3 bg-red-900/40 border border-red-700 text-red-300 rounded-lg px-4 py-2 text-sm text-center">
          {error}
        </div>
      )}

      <div className="flex-1 p-6 max-w-lg mx-auto w-full space-y-6">
        {/* My team banner */}
        {myPlayer && (
          <div className={`rounded-xl p-4 text-center font-bold text-lg ${myPlayer.team === 1 ? 'bg-blue-900/50 border border-blue-600 text-blue-300' : 'bg-red-900/50 border border-red-600 text-red-300'}`}>
            Eres del Equipo {myPlayer.team} {myPlayer.team === 1 ? '(Azul)' : '(Rojo)'}
          </div>
        )}

        {/* Team 1 */}
        <div>
          <h3 className="text-blue-400 font-semibold text-sm mb-3 flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            Equipo 1 (Azul) — Asientos 1 & 3
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {[0, 2].map((seat) => {
              const p = players.find((pl) => pl.seat === seat);
              return <PlayerSeat key={seat} player={p} isCurrentPlayer={false} isMe={p?.id === user?.id} />;
            })}
          </div>
        </div>

        {/* Team 2 */}
        <div>
          <h3 className="text-red-400 font-semibold text-sm mb-3 flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            Equipo 2 (Rojo) — Asientos 2 & 4
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {[1, 3].map((seat) => {
              const p = players.find((pl) => pl.seat === seat);
              return <PlayerSeat key={seat} player={p} isCurrentPlayer={false} isMe={p?.id === user?.id} />;
            })}
          </div>
        </div>

        {/* Rules */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-xs text-gray-500 space-y-1">
          <p className="text-gray-400 font-semibold mb-2">Reglas del Dominó Dominicano:</p>
          <p>• 4 jugadores, 2 equipos (asientos 1&3 vs 2&4)</p>
          <p>• 28 fichas repartidas, 7 por jugador</p>
          <p>• Ronda 1: quien tenga el 6-6 comienza</p>
          <p>• Gana la ronda quien quede sin fichas o en tranque</p>
          <p>• Primer equipo en llegar a 200 puntos gana</p>
        </div>

        {/* Ready section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Listos:</span>
            <span className="font-bold text-white">{readyCount}/4</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-2">
            <div
              className="bg-yellow-500 h-2 rounded-full transition-all"
              style={{ width: `${(readyCount / 4) * 100}%` }}
            />
          </div>

          {players.length < 4 ? (
            <p className="text-center text-gray-500 text-sm">
              Esperando jugadores... ({4 - players.length} más)
            </p>
          ) : myReady ? (
            <div className="text-center text-yellow-400 font-semibold py-3">
              ¡Estás listo! Esperando a los demás...
            </div>
          ) : (
            <button
              onClick={handleReady}
              className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-4 rounded-xl text-lg transition-colors"
            >
              ¡Estoy listo!
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
