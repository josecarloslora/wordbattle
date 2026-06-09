const PIP_MAP = {
  0: [],
  1: [[1, 1]],
  2: [[0, 2], [2, 0]],
  3: [[0, 2], [1, 1], [2, 0]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]],
};

function PipGrid({ count, cellSize, gap, padding }) {
  const positions = PIP_MAP[count] || [];
  const cells = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const active = positions.some(([pr, pc]) => pr === r && pc === c);
      cells.push(
        <div
          key={`${r}${c}`}
          style={{
            width: cellSize,
            height: cellSize,
            borderRadius: '50%',
            backgroundColor: active ? '#0f172a' : 'transparent',
            flexShrink: 0,
          }}
        />
      );
    }
  }
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(3, ${cellSize}px)`,
        gridTemplateRows: `repeat(3, ${cellSize}px)`,
        gap,
        padding,
      }}
    >
      {cells}
    </div>
  );
}

const STATE_STYLES = {
  normal: { border: '#4b5563', shadow: 'none', transform: 'none', opacity: 1 },
  playable: { border: '#22c55e', shadow: '0 0 6px rgba(34,197,94,0.5)', transform: 'none', opacity: 1 },
  selected: { border: '#f59e0b', shadow: '0 0 10px rgba(245,158,11,0.7)', transform: 'translateY(-6px) scale(1.08)', opacity: 1 },
  disabled: { border: '#374151', shadow: 'none', transform: 'none', opacity: 0.35 },
};

export default function DominoTile({ a, b, layout = 'v', state = 'normal', onClick, size = 'md' }) {
  const cfg = {
    sm: { cell: 4, gap: 1, pad: 3 },
    md: { cell: 5, gap: 2, pad: 4 },
    lg: { cell: 6, gap: 2, pad: 5 },
  }[size] || { cell: 5, gap: 2, pad: 4 };

  const halfSize = 3 * cfg.cell + 2 * cfg.gap + 2 * cfg.pad;
  const isVertical = layout === 'v';
  const st = STATE_STYLES[state] || STATE_STYLES.normal;

  const tileStyle = {
    display: 'inline-flex',
    flexDirection: isVertical ? 'column' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: isVertical ? halfSize + 4 : halfSize * 2 + 6,
    height: isVertical ? halfSize * 2 + 6 : halfSize + 4,
    backgroundColor: '#fefce8',
    border: `2px solid ${st.border}`,
    borderRadius: 5,
    cursor: state !== 'disabled' ? 'pointer' : 'default',
    boxShadow: `0 3px 6px rgba(0,0,0,0.4), ${st.shadow}`,
    transform: st.transform,
    transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.1s ease',
    opacity: st.opacity,
    userSelect: 'none',
    flexShrink: 0,
  };

  const divStyle = {
    width: isVertical ? '80%' : 2,
    height: isVertical ? 2 : '80%',
    backgroundColor: '#374151',
    flexShrink: 0,
  };

  return (
    <div style={tileStyle} onClick={state !== 'disabled' ? onClick : undefined}>
      <PipGrid count={a} cellSize={cfg.cell} gap={cfg.gap} padding={cfg.pad} />
      <div style={divStyle} />
      <PipGrid count={b} cellSize={cfg.cell} gap={cfg.gap} padding={cfg.pad} />
    </div>
  );
}
