import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { getDominoSocket, destroyDominoSocket } from '../services/dominoSocket';

const TEAM = {
  1: { border: '#3b82f6', bg: 'rgba(30,58,138,0.35)', badge: '#1d4ed8', label: 'Azul' },
  2: { border: '#ef4444', bg: 'rgba(127,29,29,0.35)', badge: '#b91c1c', label: 'Rojo' },
};

function SeatCard({ player, isMe }) {
  if (!player) {
    return (
      <div
        style={{ border: '1.5px dashed rgba(255,255,255,0.1)', borderRadius: 12, minHeight: 100 }}
        className="flex flex-col items-center justify-center gap-1 p-4"
      >
        <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 22 }}>+</div>
        <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11 }}>Esperando...</div>
      </div>
    );
  }

  const t = TEAM[player.team] || TEAM[1];

  return (
    <div
      style={{
        border: `1.5px solid ${t.border}`,
        background: t.bg,
        borderRadius: 12,
        minHeight: 100,
      }}
      className="flex flex-col items-center justify-center gap-2 p-4 relative"
    >
      {player.isReady && (
        <div
          style={{ position: 'absolute', top: 8, right: 8, width: 18, height: 18, borderRadius: '50%', backgroundColor: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff', fontWeight: 700 }}
        >✓</div>
      )}
      <div
        style={{
          width: 40, height: 40, borderRadius: '50%',
          backgroundColor: player.isBot ? '#374151' : (player.avatarColor || '#6366f1'),
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, color: '#fff', fontWeight: 700,
          border: `2px solid ${t.border}`,
        }}
      >
        {player.isBot ? '🤖' : player.username[0].toUpperCase()}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9', textAlign: 'center', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {isMe ? `${player.username} (Tú)` : player.username}
      </div>
      <span style={{ fontSize: 10, padding: '2px 10px', borderRadius: 20, backgroundColor: t.badge, color: '#fff', fontWeight: 600 }}>
        {player.isBot ? 'Bot' : `Equipo ${player.team}`}
      </span>
    </div>
  );
}

export default function DominoRoom() {
  const { code } = useParams();
  const nav = useNavigate();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.accessToken);

  const [players, setPlayers] = useState([]);
  const [myReady, setMyReady] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const socketRef = useRef(null);
  const navDoneRef = useRef(false); // shared between timeout and socket listener

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const doNav = () => {
    if (navDoneRef.current) return;
    navDoneRef.current = true;
    nav(`/domino/game/${code}`);
  };

  useEffect(() => {
    if (!token) return;
    navDoneRef.current = false;

    // Reuse the singleton socket so DominoGame gets the same connection
    const socket = getDominoSocket(token);
    socketRef.current = socket;

    // Re-join on every reconnect (handles auto-reconnect after brief drop)
    const onConnect = () => socket.emit('domino:join-room', { roomCode: code });
    socket.on('connect', onConnect);
    socket.emit('domino:join-room', { roomCode: code });

    socket.on('domino:room-state', ({ players: pl }) => setPlayers(pl || []));
    socket.on('domino:player-joined', ({ players: pl, username }) => {
      setPlayers(pl || []);
      showToast(`${username} se unió`);
    });
    socket.on('domino:player-ready', ({ players: pl }) => setPlayers(pl || []));
    socket.on('domino:bots-added', ({ players: pl }) => setPlayers(pl || []));
    socket.on('domino:player-left', ({ players: pl }) => setPlayers(pl || []));
    socket.on('domino:round-starting', doNav);
    socket.on('domino:error', ({ message }) => setError(message));

    return () => {
      navDoneRef.current = true;
      // Remove this component's listeners — keep socket alive for DominoGame
      socket.off('connect', onConnect);
      socket.off('domino:room-state');
      socket.off('domino:player-joined');
      socket.off('domino:player-ready');
      socket.off('domino:bots-added');
      socket.off('domino:player-left');
      socket.off('domino:round-starting');
      socket.off('domino:error');
    };
  }, [code, token]);

  const handleReady = () => {
    if (myReady || !socketRef.current) return;
    socketRef.current.emit('domino:ready', { roomCode: code });
    setMyReady(true);
  };

  const handlePlayWithBots = () => {
    if (!socketRef.current) return;
    setMyReady(true);
    socketRef.current.emit('domino:start-with-bots', { roomCode: code });
    // Fallback navigation: if server event never arrives, navigate after 1.5s.
    // DominoGame will request its own state via domino:join-room on connect.
    setTimeout(doNav, 1500);
  };

  const handleLeave = () => {
    socketRef.current?.emit('domino:leave-room', { roomCode: code });
    destroyDominoSocket();
    nav('/domino');
  };

  const myPlayer = players.find((p) => p.id === user?.id);
  const humanPlayers = players.filter((p) => !p.isBot);
  const botsNeeded = 4 - humanPlayers.length;

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <div
        style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
        className="flex items-center justify-between px-5 py-4"
      >
        <button onClick={handleLeave} className="text-gray-400 hover:text-white transition-colors text-sm">
          ← Salir
        </button>
        <div className="text-center">
          <div className="font-black text-lg">
            <span className="text-white">Bros</span><span className="text-indigo-400">Games</span>
          </div>
          <div className="text-xs text-yellow-400 font-mono tracking-widest">{code}</div>
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>{humanPlayers.length}/4</div>
      </div>

      {/* Notifications */}
      {toast && (
        <div
          style={{ margin: '12px 16px 0', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
          className="px-4 py-2 text-sm text-center text-gray-300"
        >
          {toast}
        </div>
      )}
      {error && (
        <div className="mx-4 mt-3 bg-red-900/40 border border-red-700 text-red-300 rounded-lg px-4 py-2 text-sm text-center">
          {error}
        </div>
      )}

      <div className="flex-1 p-5 max-w-lg mx-auto w-full space-y-5">
        {/* My team */}
        {myPlayer && (
          <div
            style={{
              background: TEAM[myPlayer.team]?.bg || '',
              border: `1px solid ${TEAM[myPlayer.team]?.border || '#6366f1'}`,
              borderRadius: 10, padding: '10px 16px', textAlign: 'center',
              color: myPlayer.team === 1 ? '#93c5fd' : '#fca5a5',
              fontWeight: 600, fontSize: 13,
            }}
          >
            Eres del Equipo {myPlayer.team} ({TEAM[myPlayer.team]?.label})
          </div>
        )}

        {/* Teams */}
        {[
          { team: 1, seats: [0, 2] },
          { team: 2, seats: [1, 3] },
        ].map(({ team, seats }) => (
          <div key={team}>
            <h3
              style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, letterSpacing: '0.08em', color: team === 1 ? '#60a5fa' : '#f87171', display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase' }}
            >
              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: team === 1 ? '#3b82f6' : '#ef4444' }} />
              Equipo {team}
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
        <div
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 14, fontSize: 11, color: 'rgba(255,255,255,0.35)', lineHeight: 1.7 }}
        >
          <p style={{ color: 'rgba(255,255,255,0.55)', fontWeight: 600, marginBottom: 6, fontSize: 12 }}>Dominó Dominicano</p>
          <p>• 7 fichas por jugador · Meta: 200 puntos</p>
          <p>• Ronda 1: quien tenga el 6|6 empieza</p>
          <p>• 4 pasos consecutivos = tranque</p>
        </div>

        {/* Invite code */}
        <div className="flex items-center justify-between text-sm">
          <span style={{ color: 'rgba(255,255,255,0.4)' }}>Código para invitar</span>
          <span className="font-mono text-yellow-400 font-bold tracking-widest text-base">{code}</span>
        </div>

        {/* Actions */}
        {myReady ? (
          <div
            style={{ textAlign: 'center', color: '#fbbf24', fontWeight: 600, padding: 12, fontSize: 14 }}
            className="animate-pulse"
          >
            Comenzando partida...
          </div>
        ) : (
          <div className="space-y-3">
            {/* Play with bots (always available) */}
            <button
              onClick={handlePlayWithBots}
              style={{
                width: '100%', background: 'rgba(99,102,241,0.15)', border: '1.5px solid rgba(99,102,241,0.5)',
                borderRadius: 12, padding: '14px 20px', color: '#a5b4fc',
                fontWeight: 700, fontSize: 14, cursor: 'pointer',
                transition: 'all 0.15s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(99,102,241,0.25)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.8)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(99,102,241,0.15)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)'; }}
            >
              <span style={{ fontSize: 18 }}>🤖</span>
              {botsNeeded > 0
                ? `Jugar con ${botsNeeded} bot${botsNeeded > 1 ? 's' : ''}`
                : 'Empezar ahora'}
            </button>

            {/* Ready with humans (4 players) */}
            {humanPlayers.length === 4 && (
              <button
                onClick={handleReady}
                style={{
                  width: '100%', background: '#eab308', border: 'none',
                  borderRadius: 12, padding: '16px 20px', color: '#000',
                  fontWeight: 800, fontSize: 16, cursor: 'pointer',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#ca8a04'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#eab308'; }}
              >
                ¡Estoy listo!
              </button>
            )}

            {/* Separator */}
            {humanPlayers.length < 4 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'rgba(255,255,255,0.2)', fontSize: 11 }}>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
                o espera jugadores
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
