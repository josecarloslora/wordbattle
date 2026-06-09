import { useNavigate } from 'react-router-dom';

export default function StatsModal({ stats, gameResult, word, onClose }) {
  const nav = useNavigate();
  if (!gameResult) return null;

  const { winner, allResults } = gameResult;
  const dist = stats?.guess_distribution ? (typeof stats.guess_distribution === 'string' ? JSON.parse(stats.guess_distribution) : stats.guess_distribution) : {};
  const maxDist = Math.max(...Object.values(dist).map(Number), 1);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-sm border border-gray-700 shadow-2xl">
        <div className={`text-center text-2xl font-bold mb-1 ${winner ? 'text-green-400' : 'text-red-400'}`}>
          {winner ? '🏆 ' + winner.username + ' wins!' : 'Game Over'}
        </div>
        {word && <div className="text-center text-gray-300 mb-4">The word was <span className="font-bold text-white">{word}</span></div>}

        {stats && (
          <>
            <div className="grid grid-cols-3 gap-3 mb-5">
              {[['Played', stats.total_games], ['Win%', stats.total_games ? Math.round((stats.wins / stats.total_games) * 100) : 0], ['Streak', stats.current_streak]].map(([label, val]) => (
                <div key={label} className="text-center">
                  <div className="text-2xl font-bold">{val}</div>
                  <div className="text-xs text-gray-400">{label}</div>
                </div>
              ))}
            </div>
            <div className="mb-5">
              <div className="text-xs font-semibold text-gray-400 uppercase mb-2">Guess Distribution</div>
              {[1,2,3,4,5,6].map(n => (
                <div key={n} className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-gray-400 w-3">{n}</span>
                  <div className="flex-1 bg-gray-700 rounded-sm h-5 overflow-hidden">
                    <div className="h-full bg-indigo-600 rounded-sm flex items-center justify-end pr-1 text-xs text-white transition-all"
                      style={{ width: `${((dist[n] || 0) / maxDist) * 100}%`, minWidth: dist[n] ? '20px' : '0' }}>
                      {dist[n] || 0}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <button onClick={() => { onClose(); nav('/lobby'); }}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors">
          Back to Lobby
        </button>
      </div>
    </div>
  );
}
