export default function PlayerPanel({ players, currentUserId }) {
  return (
    <div className="flex flex-col gap-3 w-52">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Jugadores</h3>
      {players.map(p => {
        const isMe = p.id === currentUserId;
        const attempts = p.attempts || [];
        return (
          <div key={p.id} className={`bg-gray-800 rounded-xl p-3 border ${isMe ? 'border-indigo-500' : 'border-gray-700'}`}>
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                style={{ backgroundColor: p.avatarColor || '#6366f1' }}
              >
                {p.username?.[0]?.toUpperCase()}
              </div>
              <span className="text-sm font-medium truncate">
                {p.username} {isMe && <span className="text-indigo-400 text-xs">(tú)</span>}
              </span>
            </div>
            {p.solved ? (
              <div className="text-xs text-green-400 font-semibold">
                RESUELTO ✓ {p.solveTime ? `${p.solveTime}s` : ''}
              </div>
            ) : (
              <div className="flex flex-col gap-0.5">
                {Array(6).fill(null).map((_, row) => (
                  <div key={row} className="flex gap-0.5">
                    {Array(5).fill(null).map((_, col) => {
                      const attempt = attempts[row];
                      const tile = attempt ? attempt.result[col] : null;
                      const color =
                        tile?.status === 'correct' ? 'bg-green-600' :
                        tile?.status === 'present' ? 'bg-yellow-500' :
                        tile ? 'bg-gray-600' : 'bg-gray-700';
                      return <div key={col} className={`w-3 h-3 rounded-sm ${color}`} />;
                    })}
                  </div>
                ))}
                <div className="text-xs text-gray-500 mt-1">{attempts.length}/6</div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
