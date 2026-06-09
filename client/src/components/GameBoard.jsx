import { useEffect, useRef } from 'react';

const STATUS_COLORS = {
  correct: 'bg-green-600 border-green-600',
  present: 'bg-yellow-500 border-yellow-500',
  absent: 'bg-gray-600 border-gray-600',
  empty: 'bg-transparent border-gray-600',
  filled: 'bg-transparent border-gray-400',
};

function Tile({ letter, status, flip, flipDelay, bounce }) {
  return (
    <div
      className={`w-14 h-14 border-2 flex items-center justify-center text-2xl font-bold uppercase text-white rounded
        ${STATUS_COLORS[status] || STATUS_COLORS.empty}
        ${flip ? 'tile-flip' : ''} ${bounce ? 'tile-bounce' : ''}`}
      style={{ animationDelay: flip || bounce ? `${flipDelay * 100}ms` : '0ms' }}>
      {letter}
    </div>
  );
}

export default function GameBoard({ guesses, currentGuess, gameOver, solution, shakeRow }) {
  const rows = Array(6).fill(null);

  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((_, rowIdx) => {
        const submitted = rowIdx < guesses.length;
        const isCurrent = rowIdx === guesses.length;
        const guess = submitted ? guesses[rowIdx] : isCurrent ? currentGuess : '';
        const shake = shakeRow && isCurrent;

        return (
          <div key={rowIdx} className={`flex gap-1.5 ${shake ? 'row-shake' : ''}`}>
            {Array(5).fill(null).map((_, colIdx) => {
              if (submitted) {
                const { letter, status } = guesses[rowIdx][colIdx];
                return <Tile key={colIdx} letter={letter} status={status} flip flipDelay={colIdx} bounce={gameOver && rowIdx === guesses.length - 1 && guesses[rowIdx].every(r => r.status === 'correct')} />;
              }
              const letter = guess[colIdx] || '';
              const status = letter ? 'filled' : 'empty';
              return <Tile key={colIdx} letter={letter} status={status} />;
            })}
          </div>
        );
      })}
    </div>
  );
}
