import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';

export default function GameSelect() {
  const nav = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = () => {
    logout();
    nav('/');
  };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-black text-white tracking-tight">Bros</span>
          <span className="text-2xl font-black text-indigo-400 tracking-tight">Games</span>
        </div>
        <div className="flex items-center gap-3">
          {user && (
            <button
              onClick={() => nav(`/profile/${user.id}`)}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm"
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                style={{ backgroundColor: user.avatarColor || '#6366f1' }}
              >
                {user.username[0].toUpperCase()}
              </div>
              <span>{user.username}</span>
            </button>
          )}
          <button onClick={handleLogout} className="text-gray-500 hover:text-red-400 text-sm transition-colors">
            Salir
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-2">Elige tu juego</h1>
          <p className="text-gray-500 text-sm">Juega con tus amigos en tiempo real</p>
        </div>

        <div className="grid grid-cols-1 gap-6 w-full max-w-sm">
          {/* Wordle card */}
          <button
            onClick={() => nav('/lobby')}
            className="group relative bg-gray-900 border-2 border-gray-700 hover:border-green-500 rounded-2xl p-8 text-left transition-all duration-200 hover:scale-105 hover:shadow-xl hover:shadow-green-900/30"
          >
            <div className="text-5xl mb-4">🟩</div>
            <h2 className="text-2xl font-bold text-white mb-1">Wordle</h2>
            <p className="text-gray-400 text-sm mb-4">
              Adivina la palabra de 5 letras en 6 intentos. Multijugador o solitario.
            </p>
            <div className="flex gap-2">
              <span className="text-xs bg-green-900 text-green-300 px-2 py-1 rounded-full">Multijugador</span>
              <span className="text-xs bg-purple-900 text-purple-300 px-2 py-1 rounded-full">Solitario</span>
            </div>
            <div className="absolute top-4 right-4 text-gray-600 group-hover:text-green-400 transition-colors text-xl">→</div>
          </button>
        </div>
      </div>
    </div>
  );
}
