// Pip positions in a 3x3 grid [row, col]
const PIP_MAP = {
  0: [],
  1: [[1, 1]],
  2: [[0, 2], [2, 0]],
  3: [[0, 2], [1, 1], [2, 0]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]],
};

function PipGrid({ count, cell, gap, pad }) {
  const positions = PIP_MAP[count] || [];
  const cells = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const active = positions.some(([pr, pc]) => pr === r && pc === c);
      cells.push(
        <div
          key={`${r}${c}`}
          style={{
            width: cell,
            height: cell,
            borderRadius: '50%',
            backgroundColor: active ? '#1A1A1A' : 'transparent',
            boxShadow: active ? 'inset 0 1px 2px rgba(0,0,0,0.5), inset 0 -1px 1px rgba(255,255,255,0.1)' : 'none',
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
        gridTemplateColumns: `repeat(3, ${cell}px)`,
        gridTemplateRows: `repeat(3, ${cell}px)`,
        gap,
        padding: pad,
        flexShrink: 0,
      }}
    >
      {cells}
    </div>
  );
}

// cell: pip size (px), gap: CSS gap string, gap_n: numeric gap (for half-size math), pad: padding (px)
const SIZES = {
  sm: { cell: 5, gap: '1px', gap_n: 1, pad: 3 },
  md: { cell: 9, gap: '2px', gap_n: 2, pad: 6 },
  lg: { cell: 11, gap: '3px', gap_n: 3, pad: 7 },
};

const STATE_STYLES = {
  normal:   { border: '#C8B89A', glow: 'none',                                    lift: 'none',                          opacity: 1    },
  playable: { border: '#22c55e', glow: '0 0 10px rgba(34,197,94,0.45)',            lift: 'none',                          opacity: 1    },
  selected: { border: '#f59e0b', glow: '0 0 16px 3px rgba(245,158,11,0.6)',        lift: 'translateY(-10px) scale(1.08)', opacity: 1    },
  disabled: { border: '#8B7355', glow: 'none',                                    lift: 'none',                          opacity: 0.35 },
};

export default function DominoTile({ a, b, layout = 'v', state = 'normal', onClick, size = 'md' }) {
  const cfg = SIZES[size] || SIZES.md;
  const halfSize = 3 * cfg.cell + 2 * cfg.gap_n + 2 * cfg.pad;
  const BORDER = 2;
  const isV = layout === 'v';

  const tileW = isV ? halfSize + BORDER * 2 : halfSize * 2 + BORDER * 2 + 2;
  const tileH = isV ? halfSize * 2 + BORDER * 2 + 2 : halfSize + BORDER * 2;

  const st = STATE_STYLES[state] || STATE_STYLES.normal;

  const tileStyle = {
    display: 'inline-flex',
    flexDirection: isV ? 'column' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: tileW,
    height: tileH,
    backgroundColor: '#F5F0E8',
    border: `${BORDER}px solid ${st.border}`,
    borderRadius: size === 'sm' ? 3 : 6,
    cursor: state !== 'disabled' ? 'pointer' : 'default',
    boxShadow: `2px 3px 8px rgba(0,0,0,0.55), inset 0 1px 3px rgba(255,255,255,0.75), ${st.glow}`,
    transform: st.lift,
    transition: 'transform 0.18s cubic-bezier(0.34,1.3,0.64,1), box-shadow 0.18s ease, border-color 0.12s ease, opacity 0.15s ease',
    opacity: st.opacity,
    userSelect: 'none',
    flexShrink: 0,
    position: 'relative',
  };

  const dividerStyle = {
    width: isV ? '70%' : BORDER,
    height: isV ? BORDER : '70%',
    backgroundColor: '#8B7355',
    flexShrink: 0,
    opacity: 0.6,
  };

  return (
    <div style={tileStyle} onClick={state !== 'disabled' ? onClick : undefined}>
      <PipGrid count={a} cell={cfg.cell} gap={cfg.gap} pad={cfg.pad} />
      <div style={dividerStyle} />
      <PipGrid count={b} cell={cfg.cell} gap={cfg.gap} pad={cfg.pad} />
    </div>
  );
}
