import DominoTile from './DominoTile';

export default function DominoBoard({ board, leftEnd, rightEnd }) {
  if (!board || board.length === 0) {
    return (
      <div className="flex items-center justify-center w-full min-h-[120px]">
        <div className="border-2 border-dashed border-gray-600 rounded-xl px-8 py-6 text-gray-500 text-sm">
          Primera ficha aquí...
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center w-full min-h-[120px] overflow-x-auto">
      {/* Left end indicator */}
      <div className="flex-shrink-0 flex flex-col items-center mr-2">
        <div className="w-7 h-7 rounded-full bg-gray-700 border border-gray-500 flex items-center justify-center text-white text-xs font-bold">
          {leftEnd}
        </div>
        <div className="text-gray-600 text-xs mt-0.5">←</div>
      </div>

      {/* Board tiles */}
      <div className="flex items-center gap-1 flex-nowrap py-4">
        {board.map((bt, i) => (
          <DominoTile
            key={bt.tile.id}
            a={bt.left}
            b={bt.right}
            layout={bt.isDouble ? 'v' : 'h'}
            state="normal"
            size="sm"
          />
        ))}
      </div>

      {/* Right end indicator */}
      <div className="flex-shrink-0 flex flex-col items-center ml-2">
        <div className="text-gray-600 text-xs mb-0.5">→</div>
        <div className="w-7 h-7 rounded-full bg-gray-700 border border-gray-500 flex items-center justify-center text-white text-xs font-bold">
          {rightEnd}
        </div>
      </div>
    </div>
  );
}
