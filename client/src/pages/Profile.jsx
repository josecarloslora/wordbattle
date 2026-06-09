import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import api from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Profile() {
  const { id } = useParams();
  const { user } = useAuthStore();
  const nav = useNavigate();
  const [profile, setProfile] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const resolvedId = id === 'me' ? user?.id : id;

  useEffect(() => {
    Promise.all([
      api.get(`/api/users/${resolvedId}/profile`),
      api.get(`/api/users/${resolvedId}/history`),
    ]).then(([p, h]) => {
      setProfile(p);
      setHistory(h.games);
    }).catch(() => nav('/lobby')).finally(() => setLoading(false));
  }, [resolvedId]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><LoadingSpinner size="lg" /></div>;
  if (!profile) return null;

  const { user: u, stats: s } = profile;
  const dist = s?.guess_distribution
    ? (typeof s.guess_distribution === 'string' ? JSON.parse(s.guess_distribution) : s.guess_distribution)
    : {};
  const maxDist = Math.max(...Object.values(dist).map(Number), 1);
  const winPct = s?.total_games ? Math.round((s.wins / s.total_games) * 100) : 0;

  return (
    <div className="min-h-screen p-4 max-w-2xl mx-auto">
      <button onClick={() => nav('/lobby')} className="text-gray-400 hover:text-white mb-6 flex items-center gap-1 text-sm">
        ← Volver al Lobby
      </button>

      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-black text-white bg-indigo-600 shrink-0">
          {u.username?.[0]?.toUpperCase()}
        </div>
        <div>
          <div className="text-2xl font-bold">{u.username}</div>
          <div className="text-sm text-gray-400">Miembro desde {new Date(u.created_at).toLocaleDateString()}</div>
        </div>
      </div>

      {s && (
        <>
          <div className="grid grid-cols-4 gap-3 mb-6">
            {[
              ['Jugadas', s.total_games],
              ['Victorias', winPct + '%'],
              ['Racha', s.current_streak],
              ['Récord', s.best_streak],
            ].map(([label, val]) => (
              <div key={label} className="bg-gray-800 rounded-xl p-3 text-center border border-gray-700">
                <div className="text-2xl font-bold">{val}</div>
                <div className="text-xs text-gray-400 mt-0.5">{label}</div>
              </div>
            ))}
          </div>

          <div className="bg-gray-800 rounded-2xl p-5 border border-gray-700 mb-6">
            <h3 className="font-semibold mb-3 text-sm text-gray-400 uppercase tracking-wider">Distribución de intentos</h3>
            {[1, 2, 3, 4, 5, 6].map(n => (
              <div key={n} className="flex items-center gap-2 mb-1.5">
                <span className="text-xs text-gray-400 w-3">{n}</span>
                <div className="flex-1 bg-gray-700 rounded h-6 overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 rounded flex items-center justify-end pr-2 text-xs text-white transition-all"
                    style={{ width: `${((dist[n] || 0) / maxDist) * 100}%`, minWidth: dist[n] ? '24px' : '0' }}
                  >
                    {dist[n] || 0}
                  </div>
                </div>
              </div>
            ))}
            {s.avg_time_seconds > 0 && (
              <p className="text-sm text-gray-400 mt-3">
                Tiempo medio: <span className="text-white font-medium">{s.avg_time_seconds}s</span>
              </p>
            )}
          </div>
        </>
      )}

      <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-700 text-sm font-semibold text-gray-400 uppercase tracking-wider">
          Historial de partidas
        </div>
        {history.length === 0 ? (
          <p className="text-center text-gray-500 py-8">Sin partidas aún</p>
        ) : (
          <div className="divide-y divide-gray-700">
            {history.map(g => (
              <div key={g.id} className="flex items-center gap-3 px-4 py-3 text-sm flex-wrap">
                <div className="text-gray-500 text-xs w-20 shrink-0">
                  {new Date(g.started_at).toLocaleDateString()}
                </div>

                <span className={`text-xs font-bold px-2 py-0.5 rounded shrink-0 ${
                  g.mode === 'solo' ? 'bg-purple-900 text-purple-300' : 'bg-indigo-900 text-indigo-300'
                }`}>
                  {g.mode === 'solo' ? 'Solo' : 'Multi'}
                </span>

                <span className={`text-xs font-bold px-1.5 py-0.5 rounded shrink-0 ${
                  g.language === 'es' ? 'bg-yellow-800 text-yellow-300' : 'bg-blue-900 text-blue-300'
                }`}>
                  {g.language?.toUpperCase()}
                </span>

                <span className="font-mono font-bold text-white flex-1 min-w-0 truncate">
                  {g.word}
                </span>

                <span className="text-gray-400 shrink-0">{g.attempts_count}/6</span>

                {g.solve_time_seconds > 0 && (
                  <span className="text-gray-500 shrink-0 text-xs">{g.solve_time_seconds}s</span>
                )}

                <span className={`px-2 py-0.5 rounded text-xs font-bold shrink-0 ${
                  g.solved ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
                }`}>
                  {g.solved ? 'W' : 'L'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
