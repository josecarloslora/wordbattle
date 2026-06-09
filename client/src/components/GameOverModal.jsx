export default function GameOverModal({
  mode,
  winner,
  word,
  solved,
  attemptsCount,
  allResults,
  currentUserId,
  onPlayAgain,
  onLobby,
}) {
  const isSolo = mode === 'solo';

  const iWon = isSolo
    ? solved
    : winner?.id === currentUserId;

  const sortedResults = allResults
    ? [...allResults].sort((a, b) => {
        if (a.solved && !b.solved) return -1;
        if (!a.solved && b.solved) return 1;
        if (a.solved && b.solved) return (a.solve_time_seconds || 999) - (b.solve_time_seconds || 999);
        return 0;
      })
    : [];

  let headline;
  if (isSolo) {
    headline = solved ? '¡Ganaste!' : 'Inténtalo de nuevo';
  } else {
    if (!winner) headline = 'Partida terminada';
    else if (iWon) headline = '¡Ganaste!';
    else headline = `${winner.username} ganó`;
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-md border border-gray-700 shadow-2xl">

        <div className="text-center mb-5">
          <div className="text-5xl mb-3">
            {iWon ? '🏆' : (isSolo ? '😔' : winner ? '😔' : '🎯')}
          </div>
          <div className={`text-2xl font-black ${iWon ? 'text-green-400' : 'text-gray-200'}`}>
            {headline}
          </div>
        </div>

        {word && (
          <div className="text-center mb-5">
            <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">La palabra era</p>
            <p className="text-3xl font-black tracking-[0.3em] text-white">{word.toUpperCase()}</p>
          </div>
        )}

        {isSolo && (
          <div className="bg-gray-900 rounded-xl p-4 mb-5 flex justify-center gap-8">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{attemptsCount}</div>
              <div className="text-xs text-gray-400">intentos</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-white">6</div>
              <div className="text-xs text-gray-400">máximo</div>
            </div>
          </div>
        )}

        {!isSolo && sortedResults.length > 0 && (
          <div className="bg-gray-900 rounded-xl overflow-hidden mb-5">
            {sortedResults.map((r, i) => (
              <div
                key={r.user_id}
                className={`flex items-center justify-between px-4 py-3 ${i > 0 ? 'border-t border-gray-800' : ''} ${r.user_id === currentUserId ? 'bg-gray-800' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-bold w-6 ${i === 0 ? 'text-yellow-400' : 'text-gray-500'}`}>
                    #{i + 1}
                  </span>
                  <span className="font-medium text-sm">{r.username}</span>
                  {r.user_id === currentUserId && (
                    <span className="text-xs text-gray-500">(tú)</span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-sm">
                  {r.solved ? (
                    <>
                      <span className="text-gray-400">{r.attempts_count}/6</span>
                      {r.solve_time_seconds > 0 && (
                        <span className="text-gray-400">{r.solve_time_seconds}s</span>
                      )}
                      <span className="text-green-400 font-bold">✓</span>
                    </>
                  ) : (
                    <span className="text-red-400 font-bold">✗</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2">
          {onPlayAgain && (
            <button
              onClick={onPlayAgain}
              className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl transition-colors"
            >
              Jugar de nuevo
            </button>
          )}
          <button
            onClick={onLobby}
            className="w-full py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-xl transition-colors"
          >
            Volver al Lobby
          </button>
        </div>
      </div>
    </div>
  );
}
