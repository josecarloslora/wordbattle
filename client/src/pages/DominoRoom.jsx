import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import useAuthStore from '../store/authStore';
import useDominoStore from '../store/dominoStore';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

function SeatCard({ player, isMe }) {
  if (!player) {
    return (
      <div className="border-2 border-dashed border-gray-700 rounded-xl p-4 flex flex-col items-center justify-center gap-2 min-h-[100px]">
        <div className="text-gray-600 text-2xl">+</div>
        <div className="text-gray-600 text-xs">Esperando...</div>
      </div>
    );
  }

  const teamColor = player.team === 1
    ? 'border-blue-600 bg-blue-950/40'
    : 'border-red-600 bg-red-950/40';
  const teamBadge = player.team === 1 ? 'bg-blue-800 text-blue-200' : 'bg-red-800 text-red-200';

  return (
    <div className={`border-2 ${teamColor} rounded-xl p-4 flex flex-col items-center gap-2 relative`}>
      {player.isReady && (
        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-xs text-white font-bold">✓</div>
      )}
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
        style={{ backgroundColor: player.isBot ? '#4b5563' : (player.avatarColor || '#6366f1') }}
      >
        {player.isBot ? '🤖' : player.username[0].toUpperCase()}
      </div>
      <div className="text-white text-sm font-semibold text-center truncate max-w-[90px]">
        {isMe ? `${player.username} (Tú)` : player.username}
      </div>
      <span className={`text-xs px-2 py-0.5 rounded-full ${teamBadge}`}>
        Equipo {player.team}
      </span>
      {player.isBot && <span className="text-xs text-gray-500">Bot</span>}
    </div>
  );
}

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
    socket.on('domino:player-joined', ({ players: pl, username }) => {
      setPlayers(pl || []);
      showToast(`${username} se unió`);
    });
    socket.on('domino:player-ready', ({ readyCount: rc, players: pl }) => {
      setReadyCount(rc);
      setPlayers(pl || []);
    });
    socket.on('domino:bots-added', ({ players: pl }) => {
      setPlayers(pl || []);
      showToast('Bots añadidos. ¡Comenzando!');
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

  const handlePlayWithBots = () => {
    if (!socketRef.current) return;
    socketRef.current.emit('domino:start-with-bots', { roomCode: code });
    setMyReady(true);
  };

  const handleLeave = () => {
    socketRef.current?.emit('domino:leave-room', { roomCode: code });
    nav('/domino');
  };

  const myPlayer = players.find((p) => p.id === user?.id);
  const humanPlayers = players.filter((p) => !p.isBot);
  const botsNeeded = 4 - players.filter((p) => !p.isBot).length;
  const allHumansReady = humanPlayers.length > 0 && humanPlayers.every((p) => p.isReady || p.id === user?.id);

  const seatsByTeam = [
    { team: 1, seats: [0, 2], color: 'blue' },
    { team: 2, seats: [1, 3], color: 'red' },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <button onClick={handleLeave} className="text-gray-400 hover:text-white transition-colors text-sm">
          ← Salir
        </button>
        <div className="text-center">
          <div className="font-black text-lg">
            <span className="text-white">Bros</span><span className="text-indigo-400">Games</span>
          </div>
          <div className="text-xs text-yellow-400 font-mono tracking-widest">{code}</div>
        </div>
        <div className="text-gray-500 text-sm">{players.filter(p=>!p.isBot).length}/4</div>
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

      <div className="flex-1 p-5 max-w-lg mx-auto w-full space-y-5">
        {/* My team banner */}
        {myPlayer && (
          <div className={`rounded-xl p-3 text-center font-bold ${myPlayer.team === 1 ? 'bg-blue-900/40 border border-blue-700 text-blue-300' : 'bg-red-900/40 border border-red-700 text-red-300'}`}>
            Eres del Equipo {myPlayer.team} {myPlayer.team === 1 ? '(Azul)' : '(Rojo)'}
          </div>
        )}

        {/* Teams grid */}
        {seatsByTeam.map(({ team, seats, color }) => (
          <div key={team}>
            <h3 className={`font-semibold text-sm mb-2.5 flex items-center gap-2 ${color === 'blue' ? 'text-blue-400' : 'text-red-400'}`}>
              <div className={`w-2.5 h-2.5 rounded-full ${color === 'blue' ? 'bg-blue-500' : 'bg-red-500'}`} />
              Equipo {team} {color === 'blue' ? '(Azul)' : '(Rojo)'}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {seats.map((seat) => {
                const p = players.find((pl) => pl.seat === seat);
                return <SeatCard key={seat} player={p} isMe={p?.id === user?.id} />;
              })}
            </div>
          </div>
        ))}

        {/* Rules */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-xs text-gray-500 space-y-1">
          <p className="text-gray-400 font-semibold mb-1.5">Reglas — Dominó Dominicano</p>
          <p>• 7 fichas por jugador, 28 en total · Primer equipo en 200 pts gana</p>
          <p>• Ronda 1: quien tenga el 6|6 empieza · Rondas siguientes: ganador empieza</p>
          <p>• Si no puedes jugar, pasas · 4 pasos seguidos = tranque</p>
        </div>

        {/* Action section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm text-gray-400">
            <span>Código para invitar:</span>
            <span className="font-mono text-yellow-400 font-bold tracking-widest">{code}</span>
          </div>

          {/* Play with bots button — always available */}
          {!myReady && (
            <button
              onClick={handlePlayWithBots}
              className="w-full bg-gray-700 hover:bg-gray-600 border border-gray-600 text-white font-semibold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <span>🤖</span>
              {botsNeeded > 0
                ? `Jugar con ${botsNeeded} bot${botsNeeded > 1 ? 's' : ''}`
                : 'Empezar ahora'}
            </button>
          )}

          {/* Ready with humans */}
          {humanPlayers.length < 4 && !myReady && (
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-800" />
              </div>
              <div className="relative flex justify-center text-xs text-gray-600 bg-gray-950 px-2 w-fit mx-auto">
                o espera jugadores
              </div>
            </div>
          )}

          {humanPlayers.length === 4 && !myReady && (
            <button
              onClick={handleReady}
              className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-4 rounded-xl text-lg transition-colors"
            >
              ¡Estoy listo!
            </button>
          )}

          {myReady && (
            <div className="text-center text-yellow-400 font-semibold py-3 animate-pulse">
              Comenzando partida...
            </div>
          )}

          {!myReady && humanPlayers.length > 1 && humanPlayers.length < 4 && (
            <button
              onClick={handleReady}
              className="w-full border border-gray-600 hover:border-gray-500 text-gray-300 hover:text-white font-semibold py-3 rounded-xl transition-colors text-sm"
            >
              Estoy listo (esperando {4 - humanPlayers.length} más)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
