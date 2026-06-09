import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import api from '../services/api';
import socketSvc from '../services/socket';
import LanguageToggle from '../components/LanguageToggle';
import LoadingSpinner from '../components/LoadingSpinner';
import Toast from '../components/Toast';
import { useToast } from '../hooks/useToast';

export default function Room() {
  const { code } = useParams();
  const nav = useNavigate();
  const { user, accessToken } = useAuthStore();
  const { toasts, addToast } = useToast();

  const [room, setRoom] = useState(null);
  const [players, setPlayers] = useState([]);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/api/rooms/${code}`).then(data => {
      setRoom(data.room);
      setPlayers(data.members.map(m => ({ ...m, isReady: false })));
      setLoading(false);
    }).catch(() => nav('/lobby'));

    const socket = socketSvc.connect(accessToken);
    socket.emit('join-room', { roomCode: code });

    socket.on('room-state', ({ players: ps }) => {
      setPlayers(ps.map(p => ({ id: p.id, username: p.username, avatarColor: p.avatarColor || '#6366f1', isReady: p.isReady, isHost: p.isHost })));
    });
    socket.on('player-joined', ({ userId, username }) => {
      setPlayers(prev => prev.find(p => p.id === userId) ? prev : [...prev, { id: userId, username, avatarColor: '#6366f1', isReady: false }]);
    });
    socket.on('player-left', ({ userId }) => setPlayers(prev => prev.filter(p => p.id !== userId)));
    socket.on('player-ready-update', ({ userId, readyCount }) => {
      setPlayers(prev => prev.map(p => p.id === userId ? { ...p, isReady: true } : p));
    });
    socket.on('game-start', () => nav(`/game/${code}`));
    socket.on('error', ({ message }) => addToast(message, 'error'));

    return () => {
      socket.off('room-state');
      socket.off('player-joined');
      socket.off('player-left');
      socket.off('player-ready-update');
      socket.off('game-start');
      socket.off('error');
    };
  }, [code, accessToken]);

  function handleReady() {
    setReady(true);
    socketSvc.emit('player-ready', { roomCode: code });
  }

  function handleForceStart() {
    socketSvc.emit('force-start', { roomCode: code });
  }

  async function handleLeave() {
    socketSvc.emit('leave-room', { roomCode: code });
    nav('/lobby');
  }

  async function copyCode() {
    await navigator.clipboard.writeText(code);
    addToast('Code copied!', 'success', 1500);
  }

  const isHost = room?.host_id === user?.id;

  if (loading) return <div className="min-h-screen flex items-center justify-center"><LoadingSpinner size="lg" /></div>;

  return (
    <div className="min-h-screen p-4 max-w-2xl mx-auto">
      <Toast toasts={toasts} />
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{room?.name}</h1>
        <button onClick={handleLeave} className="text-sm px-3 py-1.5 bg-red-900 hover:bg-red-800 text-red-200 rounded-lg transition-colors">
          Leave
        </button>
      </div>

      <div className="bg-gray-800 rounded-2xl p-5 border border-gray-700 mb-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-gray-400 text-sm">Room code:</span>
            <code className="text-xl font-mono font-bold text-indigo-400">{code}</code>
            <button onClick={copyCode} className="text-gray-500 hover:text-white text-sm">📋</button>
          </div>
          <span className={`text-xs font-bold px-2 py-1 rounded ${room?.language === 'es' ? 'bg-yellow-600 text-white' : 'bg-blue-600 text-white'}`}>
            {room?.language?.toUpperCase()}
          </span>
        </div>
        {isHost && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">Language:</span>
            <LanguageToggle value={room?.language || 'es'} onChange={() => {}} />
          </div>
        )}
      </div>

      <div className="bg-gray-800 rounded-2xl p-5 border border-gray-700 mb-5">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Players ({players.length}/{room?.max_players})
        </h2>
        <div className="flex flex-col gap-2">
          {players.map(p => (
            <div key={p.id} className="flex items-center justify-between bg-gray-900 rounded-xl px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
                  style={{ backgroundColor: p.avatarColor || '#6366f1' }}>
                  {p.username?.[0]?.toUpperCase()}
                </div>
                <span className="font-medium">{p.username}</span>
                {p.isHost && <span className="text-xs bg-indigo-900 text-indigo-300 px-2 py-0.5 rounded">Host</span>}
                {p.id === user?.id && <span className="text-xs text-gray-500">(you)</span>}
              </div>
              {p.isReady ? <span className="text-green-400 font-bold text-sm">✓ Ready</span> : <span className="text-gray-600 text-sm">Waiting...</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        {!ready && (
          <button onClick={handleReady} className="flex-1 py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl transition-colors">
            I'm Ready
          </button>
        )}
        {ready && <div className="flex-1 py-3 bg-gray-700 text-gray-400 font-bold rounded-xl text-center">Waiting for others...</div>}
        {isHost && players.filter(p => p.isReady).length >= 2 && (
          <button onClick={handleForceStart} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-colors">
            Force Start
          </button>
        )}
      </div>
    </div>
  );
}
