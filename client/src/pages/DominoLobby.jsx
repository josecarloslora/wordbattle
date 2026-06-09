import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import api from '../services/api';

export default function DominoLobby() {
  const nav = useNavigate();
  const user = useAuthStore((s) => s.user);

  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');

  const fetchRooms = async () => {
    try {
      const data = await api.get('/rooms?gameType=domino');
      setRooms(data.rooms || []);
    } catch {
      setError('Error cargando salas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!roomName.trim()) return;
    setCreating(true);
    setError('');
    try {
      const data = await api.post('/rooms', {
        name: roomName.trim(),
        gameType: 'domino',
        maxPlayers: 4,
        isPublic: true,
      });
      nav(`/domino/room/${data.room.code}`);
    } catch (err) {
      setError(err.message || 'Error creando sala');
    } finally {
      setCreating(false);
    }
  };

  const handleJoinByCode = async (e) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    nav(`/domino/room/${joinCode.trim().toUpperCase()}`);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <button
          onClick={() => nav('/select')}
          className="text-gray-400 hover:text-white transition-colors flex items-center gap-2"
        >
          ← Juegos
        </button>
        <div className="text-center">
          <div className="font-black text-lg">
            <span className="text-white">Bros</span>
            <span className="text-indigo-400">Games</span>
          </div>
          <div className="text-xs text-yellow-400 font-semibold">DOMINÓ</div>
        </div>
        <button
          onClick={() => nav(`/profile/${user?.id}`)}
          className="text-gray-400 hover:text-white text-sm transition-colors"
        >
          Perfil
        </button>
      </div>

      <div className="max-w-2xl mx-auto p-6 space-y-6">
        {error && (
          <div className="bg-red-900/40 border border-red-700 text-red-300 rounded-lg p-3 text-sm">
            {error}
          </div>
        )}

        {/* Join by code */}
        <form onSubmit={handleJoinByCode} className="flex gap-3">
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="Código de sala"
            maxLength={6}
            className="flex-1 bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm tracking-widest uppercase placeholder:normal-case placeholder:tracking-normal focus:outline-none focus:border-yellow-500"
          />
          <button
            type="submit"
            className="bg-yellow-600 hover:bg-yellow-500 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors"
          >
            Unirse
          </button>
        </form>

        {/* Create room */}
        {!showCreate ? (
          <button
            onClick={() => setShowCreate(true)}
            className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl py-4 text-sm font-semibold transition-colors flex items-center justify-center gap-2"
          >
            <span className="text-xl">+</span> Crear nueva sala
          </button>
        ) : (
          <form onSubmit={handleCreate} className="bg-gray-900 border border-gray-700 rounded-xl p-5 space-y-4">
            <h3 className="font-semibold text-white">Nueva sala de Dominó</h3>
            <input
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="Nombre de la sala"
              maxLength={40}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-yellow-500"
              autoFocus
            />
            <p className="text-gray-500 text-xs">Se necesitan 4 jugadores para comenzar.</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 py-2.5 rounded-lg text-sm transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={creating || !roomName.trim()}
                className="flex-1 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors"
              >
                {creating ? 'Creando...' : 'Crear sala'}
              </button>
            </div>
          </form>
        )}

        {/* Room list */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-300 text-sm uppercase tracking-wide">
              Salas disponibles
            </h2>
            <button onClick={fetchRooms} className="text-gray-500 hover:text-gray-300 text-xs transition-colors">
              Actualizar
            </button>
          </div>

          {loading ? (
            <div className="text-center text-gray-600 py-8">Cargando salas...</div>
          ) : rooms.length === 0 ? (
            <div className="text-center text-gray-600 py-10">
              No hay salas activas. ¡Crea una!
            </div>
          ) : (
            <div className="space-y-3">
              {rooms.map((room) => (
                <div
                  key={room.id}
                  onClick={() => nav(`/domino/room/${room.code}`)}
                  className="bg-gray-900 border border-gray-700 hover:border-yellow-600 rounded-xl p-4 cursor-pointer transition-all hover:bg-gray-800"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-white">{room.name}</div>
                      <div className="text-gray-500 text-xs mt-0.5">
                        Por {room.host_username} · Código: <span className="text-yellow-500 font-mono">{room.code}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-yellow-400 font-bold text-lg">{room.member_count}/4</div>
                      <div className="text-gray-600 text-xs">jugadores</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
