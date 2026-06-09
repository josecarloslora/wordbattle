import { useEffect } from 'react';

const ROWS = [
  ['Q','W','E','R','T','Y','U','I','O','P'],
  ['A','S','D','F','G','H','J','K','L'],
  ['ENTER','Z','X','C','V','B','N','M','⌫'],
];

const STATUS_COLORS = {
  correct: 'bg-green-600 text-white',
  present: 'bg-yellow-500 text-white',
  absent: 'bg-gray-700 text-gray-400',
};

export default function Keyboard({ onKey, keyStatuses, disabled }) {
  useEffect(() => {
    function handleKey(e) {
      if (disabled) return;
      if (e.key === 'Enter') onKey('ENTER');
      else if (e.key === 'Backspace') onKey('⌫');
      else if (/^[a-zA-Z]$/.test(e.key)) onKey(e.key.toUpperCase());
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onKey, disabled]);

  return (
    <div className="flex flex-col gap-1.5 items-center mt-4">
      {ROWS.map((row, i) => (
        <div key={i} className="flex gap-1">
          {row.map(key => {
            const status = keyStatuses?.[key];
            const wide = key === 'ENTER' || key === '⌫';
            return (
              <button key={key} onClick={() => !disabled && onKey(key)}
                className={`${wide ? 'px-3 text-xs' : 'w-9'} h-14 rounded font-bold text-sm transition-colors
                  ${status ? STATUS_COLORS[status] : 'bg-gray-600 text-white hover:bg-gray-500'}
                  ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                {key}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
