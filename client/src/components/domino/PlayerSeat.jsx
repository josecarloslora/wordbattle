export default function PlayerSeat({ player, isCurrentPlayer, isMe, compact = false }) {
  if (!player) {
    return (
      <div className={`border-2 border-dashed border-gray-700 rounded-xl flex items-center justify-center text-gray-600 text-sm ${compact ? 'p-2 h-16' : 'p-4 h-28'}`}>
        Esperando...
      </div>
    );
  }

  const teamColor = player.team === 1
    ? 'border-blue-500 bg-blue-950'
    : 'border-red-500 bg-red-950';

  const teamBadge = player.team === 1
    ? 'bg-blue-700 text-blue-100'
    : 'bg-red-700 text-red-100';

  const turnRing = isCurrentPlayer ? 'ring-2 ring-yellow-400 ring-offset-1 ring-offset-gray-900' : '';

  if (compact) {
    return (
      <div className={`border ${teamColor} ${turnRing} rounded-lg p-2 flex items-center gap-2 relative`}>
        {isCurrentPlayer && (
          <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-xs bg-yellow-400 text-black px-1 rounded font-bold">
            TURNO
          </span>
        )}
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
          style={{ backgroundColor: player.avatarColor || '#6366f1' }}
        >
          {player.username[0].toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="text-white text-xs font-semibold truncate max-w-[72px]">
            {isMe ? 'Tú' : player.username}
          </div>
          <div className="text-gray-400 text-xs">{player.tileCount} fichas</div>
        </div>
        <span className={`text-xs px-1 rounded ${teamBadge} flex-shrink-0`}>T{player.team}</span>
      </div>
    );
  }

  return (
    <div className={`border-2 ${teamColor} ${turnRing} rounded-xl p-3 flex flex-col items-center gap-1 relative`}>
      {isCurrentPlayer && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs bg-yellow-400 text-black px-2 py-0.5 rounded-full font-bold whitespace-nowrap">
          ES SU TURNO
        </span>
      )}
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold"
        style={{ backgroundColor: player.avatarColor || '#6366f1' }}
      >
        {player.username[0].toUpperCase()}
      </div>
      <div className="text-white text-sm font-semibold text-center truncate max-w-[90px]">
        {isMe ? `Tú (${player.username})` : player.username}
      </div>
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${teamBadge}`}>
        Equipo {player.team}
      </span>
      <div className="flex gap-1 mt-1 flex-wrap justify-center">
        {Array.from({ length: player.tileCount }).map((_, i) => (
          <div key={i} className="w-3 h-5 bg-gray-600 rounded-sm border border-gray-500" />
        ))}
      </div>
    </div>
  );
}
