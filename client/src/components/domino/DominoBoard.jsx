import { useRef, useEffect } from 'react';
import DominoTile from './DominoTile';

export default function DominoBoard({ board, leftEnd, rightEnd }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current && board?.length > 0) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [board?.length]);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        background: 'radial-gradient(ellipse at 40% 50%, #1e6b3f 0%, #145a31 40%, #0d4022 100%)',
        boxShadow: 'inset 0 4px 20px rgba(0,0,0,0.5), inset 0 -2px 8px rgba(0,0,0,0.3)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Subtle felt texture lines */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.04) 3px, rgba(0,0,0,0.04) 4px)', pointerEvents: 'none' }} />

      {!board || board.length === 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
          <div
            style={{
              border: '2px dashed rgba(255,255,255,0.15)',
              borderRadius: 12,
              padding: '18px 36px',
              color: 'rgba(255,255,255,0.3)',
              fontSize: 13,
              letterSpacing: '0.05em',
              textAlign: 'center',
              background: 'rgba(0,0,0,0.15)',
            }}
          >
            Coloca la primera ficha aquí
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '0 10px' }}>
          {/* Left end chip */}
          <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, marginRight: 6 }}>
            <div
              style={{
                width: 30, height: 30, borderRadius: '50%',
                backgroundColor: '#0a1929',
                border: '2px solid rgba(255,255,255,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#e2e8f0', fontSize: 12, fontWeight: 800,
                boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
              }}
            >
              {leftEnd}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 700 }}>←</div>
          </div>

          {/* Scrollable tile chain */}
          <div
            ref={scrollRef}
            style={{
              flex: 1, overflowX: 'auto', overflowY: 'hidden',
              padding: '14px 4px',
              scrollbarWidth: 'none', msOverflowStyle: 'none',
            }}
          >
            <div
              style={{
                display: 'flex', alignItems: 'center',
                gap: 3, width: 'max-content',
                paddingLeft: 2, paddingRight: 2,
              }}
            >
              {board.map((bt) => (
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
          </div>

          {/* Right end chip */}
          <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, marginLeft: 6 }}>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 700 }}>→</div>
            <div
              style={{
                width: 30, height: 30, borderRadius: '50%',
                backgroundColor: '#0a1929',
                border: '2px solid rgba(255,255,255,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#e2e8f0', fontSize: 12, fontWeight: 800,
                boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
              }}
            >
              {rightEnd}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
