import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import api from '../services/api';
import socketSvc from '../services/socket';
import RoomCard from '../components/RoomCard';
import LanguageToggle from '../components/LanguageToggle';
import LoadingSpinner from '../components/LoadingSpinner';
import Toast from '../components/Toast';
import { useToast } from '../hooks/useToast';

export default function Lobby() {
  const { user, accessToken, logout } = useAuthStore();
  const nav = useNavigate();
  const { toasts, addToast } = useToast();

  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [langFilter, setLangFilter] = useState('all');
  const [joinCode, setJoinCode] = useState('');
  const [createForm, setCreateForm] = useState({ name: '', language: 'es', maxPlayers: 4, isPublic: true });
  const [creating, setCreating] = useState(false);

  const fetchRooms = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get(`/api/rooms${langFilter !== 'all' ? `?lang=${langFilter}` : ''}`);
      setRooms(data.rooms);
    } catch { } finally { setLoading(false); }
  }, [langFilter]);

  useEffect(() => { fetchRooms(); }, [fetchRooms]);

  useEffect(() => {
    const socket = socketSvc.connect(accessToken);
    socket.on('room-updated', fetchRooms);
    return () => { socket.off('room-updated', fetchRooms); };
  }, [accessToken, fetchRooms]);

  async function handleJoin(code) {
    if (!code) return;
    nav(`/room/${code.toUpperCase()}`);
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!createForm.name.trim()) return;
    setCreating(true);
    try {
      const data = await api.post('/api/rooms', createForm);
      nav(`/room/${data.room.code}`);
    } catch (err) {
      addToast(err.message, 'error');
    } finally { setCreating(false); }
  }

  function handleLogout() {
    api.post('/api/auth/logout').catch(() => {});
    socketSvc.disconnect();
    logout();
    nav('/');
  }

  return (
    <div className="min-h-screen p-4 max-w-5xl mx-auto">
      <Toast toasts={toasts} />
      <header className="flex items-center justify-between mb-6 py-2">
        <div className="flex items-center gap-2">
          <button onClick={() => nav('/select')} className="text-gray-500 hover:text-gray-300 text-sm mr-2 transition-colors">← Juegos</button>
          <h1 className="text-2xl font-black"><span className="text-white">Bros</span><span className="text-indigo-400">Games</span> <span className="text-green-400 text-lg">Wordle</span></h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => nav(`/profile/${user?.id}`)}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white bg-indigo-600">
              {user?.username?.[0]?.toUpperCase()}
            </div>
            <span className="text-sm text-gray-300 hidden sm:block">{user?.username}</span>
          </div>
          <button onClick={handleLogout} className="text-sm text-gray-400 hover:text-white px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors">
            Salir
          </button>
        </div>
      </header>

      {/* Solo mode banner */}
      <div
        onClick={() => nav('/solo')}
        className="mb-6 bg-gradient-to-r from-purple-900 to-indigo-900 border border-purple-700 rounded-2xl px-5 py-4 flex items-center justify-between cursor-pointer hover:from-purple-800 hover:to-indigo-800 transition-all"
      >
        <div>
          <div className="font-bold text-white text-lg">Modo Solitario</div>
          <div className="text-purple-300 text-sm mt-0.5">Juega solo y mejora tu vocabulario</div>
        </div>
        <span className="text-2xl">🎯</span>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">Salas públicas</h2>
            <div className="flex items-center gap-2">
              <select value={langFilter} onChange={e => setLangFilter(e.target.value)}
                className="bg-gray-800 border border-gray-600 rounded-lg px-2 py-1 text-sm text-white">
                <option value="all">Todas</option>
                <option value="es">ES</option>
                <option value="en">EN</option>
              </select>
              <button onClick={fetchRooms} className="text-sm px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 transition-colors">
                Actualizar
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-2 min-h-32">
            {loading ? <div className="flex justify-center py-8"><LoadingSpinner /></div>
              : rooms.length === 0 ? <p className="text-gray-500 text-center py-8">No hay salas disponibles</p>
              : rooms.map(r => <RoomCard key={r.id} room={r} onJoin={handleJoin} />)}
          </div>
        </div>

        <div>
          <div className="mb-6">
            <h2 className="text-lg font-bold mb-3">Unirse por código</h2>
            <div className="flex gap-2">
              <input
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                maxLength={6}
                placeholder="XXXXXX"
                className="flex-1 bg-gray-800 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 font-mono text-center text-lg tracking-widest"
              />
              <button onClick={() => handleJoin(joinCode)} className="px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors">
                Unirse
              </button>
            </div>
          </div>

          <h2 className="text-lg font-bold mb-3">Crear sala</h2>
          <form onSubmit={handleCreate} className="bg-gray-800 rounded-2xl p-4 border border-gray-700 flex flex-col gap-3">
            <input
              value={createForm.name}
              onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Nombre de la sala"
              maxLength={50}
              className="bg-gray-900 border border-gray-600 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            />
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Idioma</span>
              <LanguageToggle value={createForm.language} onChange={lang => setCreateForm(f => ({ ...f, language: lang }))} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Jugadores máx.</span>
              <select
                value={createForm.maxPlayers}
                onChange={e => setCreateForm(f => ({ ...f, maxPlayers: parseInt(e.target.value) }))}
                className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-1.5 text-white text-sm"
              >
                {[2, 3, 4, 5, 6].map(n => <option key={n}>{n}</option>)}
              </select>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Sala pública</span>
              <button
                type="button"
                onClick={() => setCreateForm(f => ({ ...f, isPublic: !f.isPublic }))}
                className={`w-10 h-6 rounded-full transition-colors relative ${createForm.isPublic ? 'bg-indigo-600' : 'bg-gray-600'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${createForm.isPublic ? 'translate-x-5' : 'translate-x-1'}`} />
              </button>
            </div>
            <button
              type="submit"
              disabled={creating}
              className="py-2.5 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {creating ? <LoadingSpinner size="sm" /> : 'Crear sala'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
