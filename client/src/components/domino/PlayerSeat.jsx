const TEAM_STYLES = {
  1: { border: '#3b82f6', bg: 'rgba(30,58,138,0.5)', badge: 'rgba(37,99,235,0.8)', text: '#93c5fd' },
  2: { border: '#ef4444', bg: 'rgba(127,29,29,0.5)', badge: 'rgba(185,28,28,0.8)', text: '#fca5a5' },
};

export default function PlayerSeat({ player, isCurrentPlayer, isMe, compact = false }) {
  const ts = TEAM_STYLES[player?.team] || TEAM_STYLES[1];

  if (!player) {
    return (
      <div
        style={{ border: '1.5px dashed rgba(255,255,255,0.1)', borderRadius: 8 }}
        className={`flex items-center justify-center text-gray-600 text-xs ${compact ? 'p-2 h-14' : 'p-4 h-28'}`}
      >
        {compact ? '···' : 'Esperando...'}
      </div>
    );
  }

  if (compact) {
    return (
      <div
        style={{
          border: `1.5px solid ${isCurrentPlayer ? '#fbbf24' : ts.border}`,
          background: isCurrentPlayer ? 'rgba(251,191,36,0.08)' : ts.bg,
          borderRadius: 8,
          boxShadow: isCurrentPlayer ? '0 0 8px rgba(251,191,36,0.3)' : 'none',
          transition: 'all 0.25s ease',
          position: 'relative',
          padding: '6px 8px',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          minWidth: 0,
        }}
      >
        {isCurrentPlayer && (
          <span
            style={{
              position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
              fontSize: 9, fontWeight: 800, letterSpacing: '0.06em',
              backgroundColor: '#fbbf24', color: '#000', padding: '1px 5px', borderRadius: 3,
              whiteSpace: 'nowrap',
            }}
          >
            TURNO
          </span>
        )}

        <div
          style={{
            width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
            backgroundColor: player.isBot ? '#374151' : (player.avatarColor || '#6366f1'),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, color: '#fff',
            border: `2px solid ${ts.border}`,
          }}
        >
          {player.isBot ? '🤖' : player.username[0].toUpperCase()}
        </div>

        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {isMe ? 'Tú' : player.username}
          </div>
          <div style={{ fontSize: 10, color: ts.text }}>
            {player.tileCount} {player.tileCount === 1 ? 'ficha' : 'fichas'}
          </div>
        </div>
      </div>
    );
  }

  // Full mode (lobby/room)
  return (
    <div
      style={{
        border: `2px solid ${ts.border}`,
        background: ts.bg,
        borderRadius: 12,
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        position: 'relative',
      }}
    >
      {isCurrentPlayer && (
        <span
          style={{
            position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
            fontSize: 10, fontWeight: 800,
            backgroundColor: '#fbbf24', color: '#000', padding: '2px 8px', borderRadius: 4,
            whiteSpace: 'nowrap',
          }}
        >
          ES SU TURNO
        </span>
      )}
      <div
        style={{
          width: 40, height: 40, borderRadius: '50%',
          backgroundColor: player.isBot ? '#374151' : (player.avatarColor || '#6366f1'),
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 15, fontWeight: 700, color: '#fff',
          border: `2px solid ${ts.border}`,
        }}
      >
        {player.isBot ? '🤖' : player.username[0].toUpperCase()}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9', textAlign: 'center', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {isMe ? `Tú (${player.username})` : player.username}
      </div>
      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, backgroundColor: ts.badge, color: '#fff', fontWeight: 600 }}>
        Equipo {player.team}
      </span>
      {player.tileCount !== undefined && (
        <div style={{ display: 'flex', gap: 2, marginTop: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
          {Array.from({ length: Math.min(player.tileCount, 7) }).map((_, i) => (
            <div
              key={i}
              style={{ width: 11, height: 18, backgroundColor: '#374151', borderRadius: 2, border: '1px solid #4b5563' }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
