export default function RoomCard({ room, onJoin }) {
  const full = parseInt(room.member_count) >= room.max_players;
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="font-semibold text-white truncate">{room.name}</div>
        <div className="text-sm text-gray-400 mt-0.5">Host: {room.host_username}</div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className={`text-xs font-bold px-2 py-1 rounded ${room.language === 'es' ? 'bg-yellow-600 text-white' : 'bg-blue-600 text-white'}`}>
          {room.language.toUpperCase()}
        </span>
        <span className="text-sm text-gray-300">{room.member_count}/{room.max_players}</span>
        <button onClick={() => onJoin(room.code)} disabled={full}
          className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${full ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}>
          {full ? 'Full' : 'Join'}
        </button>
      </div>
    </div>
  );
}
