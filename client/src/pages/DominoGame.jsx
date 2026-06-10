import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { getDominoSocket, destroyDominoSocket } from '../services/dominoSocket';
import DominoTile from '../components/domino/DominoTile';
import DominoBoard from '../components/domino/DominoBoard';
import PlayerSeat from '../components/domino/PlayerSeat';

function canPlay(tile, leftEnd, rightEnd) {
  return tile.high === leftEnd || tile.low === leftEnd || tile.high === rightEnd || tile.low === rightEnd;
}

export default function DominoGame() {
  const { code } = useParams();
  const nav = useNavigate();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.accessToken);

  // All game state is local — no Zustand store dependency
  const [hand, setHand] = useState([]);
  const [board, setBoard] = useState([]);
  const [leftEnd, setLeftEnd] = useState(null);
  const [rightEnd, setRightEnd] = useState(null);
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [players, setPlayers] = useState([]);
  const [scores, setScores] = useState({ team1: 0, team2: 0 });
  const [roundNumber, setRoundNumber] = useState(1);
  const [myTeam, setMyTeam] = useState(null);
  const [forcedFirstTile, setForcedFirstTile] = useState(null);
  const [phase, setPhase] = useState('loading');

  const [selectedTile, setSelectedTile] = useState(null);
  const [roundResult, setRoundResult] = useState(null);
  const [gameResult, setGameResult] = useState(null);
  const [toast, setToast] = useState({ msg: '', type: 'info' });
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);

  const socketRef = useRef(null);
  const lastRoundRef = useRef(-1);
  const toastTimer = useRef(null);

  const showToast = (msg, type = 'info') => {
    clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast({ msg: '', type: 'info' }), 3500);
  };

  useEffect(() => {
    if (!token) return;

    // Reuse the singleton socket from DominoRoom — already connected, already in the room.
    // If coming from a fresh URL (e.g., browser refresh), creates a new connection.
    const socket = getDominoSocket(token);
    socketRef.current = socket;

    // Ask server for current game state (triggers domino:game-state if playing)
    socket.emit('domino:join-room', { roomCode: code });

    // Re-join on auto-reconnect
    const onConnect = () => socket.emit('domino:join-room', { roomCode: code });
    socket.on('connect', onConnect);

    // Retry once more in case server was mid-startNewRound on first join
    const retryJoin = setTimeout(() => socket.emit('domino:join-room', { roomCode: code }), 2000);

    socket.on('domino:game-state', (data) => {
      clearTimeout(retryJoin);
      setHand(data.hand || []);
      setBoard(data.board || []);
      setLeftEnd(data.leftEnd ?? null);
      setRightEnd(data.rightEnd ?? null);
      setCurrentPlayer(data.currentPlayer || null);
      setPlayers(data.players || []);
      setScores(data.scores || { team1: 0, team2: 0 });
      setRoundNumber(data.roundNumber || 1);
      setMyTeam(data.myTeam ?? null);
      setForcedFirstTile(data.forcedFirstTile || null);
      setPhase('playing');
      setLoading(false);
      setLoadingTimedOut(false);
    });

    // If we arrive before the game starts (race condition), room-state is sent.
    // Just keep waiting — domino:round-starting will arrive shortly.
    socket.on('domino:room-state', () => {
      // Game hasn't started yet; stay in loading state and wait for round-starting
      console.log('[DominoGame] got room-state while waiting — game starting soon');
    });

    socket.on('domino:hand-update', ({ hand: h }) => {
      setHand(h);
      setLoading(false);
    });

    socket.on('domino:round-starting', (data) => {
      if (!data || data.roundNumber === lastRoundRef.current) return;
      lastRoundRef.current = data.roundNumber;
      setBoard([]);
      setLeftEnd(null);
      setRightEnd(null);
      setCurrentPlayer(data.currentPlayer || null);
      setPlayers(data.players || []);
      setScores(data.scores || { team1: 0, team2: 0 });
      setRoundNumber(data.roundNumber || 1);
      setForcedFirstTile(data.forcedFirstTile || null);
      // Use hand/myTeam from personalized payload if present
      if (data.hand) setHand(data.hand);
      if (data.myTeam != null) setMyTeam(data.myTeam);
      setPhase('playing');
      setSelectedTile(null);
      setRoundResult(null);
      setCountdown(null);
      setLoading(false);
      if (!data.isFirstRound) showToast(`Ronda ${data.roundNumber}`, 'info');
    });

    socket.on('domino:tile-played', ({ playerId, tileId, board: b, leftEnd: le, rightEnd: re, players: pl }) => {
      setBoard(b);
      setLeftEnd(le);
      setRightEnd(re);
      setPlayers(pl);
      if (playerId === user?.id) {
        setHand((prev) => prev.filter((t) => t.id !== tileId));
        setSelectedTile(null);
      }
    });

    socket.on('domino:turn-change', ({ currentPlayer: cp }) => setCurrentPlayer(cp));

    socket.on('domino:player-passed', ({ username, passCount }) => {
      showToast(`${username} pasó (${passCount}/4)`, 'warning');
    });

    socket.on('domino:round-over', (result) => {
      setRoundResult(result);
      setScores(result.scores);
      setPhase('round-over');
      let secs = 5;
      setCountdown(secs);
      const iv = setInterval(() => {
        secs -= 1;
        setCountdown(secs);
        if (secs <= 0) clearInterval(iv);
      }, 1000);
    });

    socket.on('domino:game-over', (result) => {
      setGameResult(result);
      setScores(result.scores);
      setPhase('game-over');
    });

    socket.on('domino:player-left', ({ players: pl }) => {
      setPlayers(pl);
      showToast('Un jugador abandonó', 'warning');
    });

    socket.on('domino:error', ({ message }) => showToast(message, 'error'));

    const fallback = setTimeout(() => {
      setLoading(false);
      setLoadingTimedOut(true);
    }, 8000);

    return () => {
      clearTimeout(retryJoin);
      clearTimeout(fallback);
      clearTimeout(toastTimer.current);
      socket.off('connect', onConnect);
      socket.off('domino:game-state');
      socket.off('domino:room-state');
      socket.off('domino:hand-update');
      socket.off('domino:round-starting');
      socket.off('domino:tile-played');
      socket.off('domino:turn-change');
      socket.off('domino:player-passed');
      socket.off('domino:round-over');
      socket.off('domino:game-over');
      socket.off('domino:player-left');
      socket.off('domino:error');
      // Socket stays alive — destroyDominoSocket() called only on explicit leave
    };
  }, [code, token]);

  const isMyTurn = currentPlayer === user?.id;
  const boardEmpty = board.length === 0;

  const getTileState = (tile) => {
    if (!isMyTurn) return 'normal';
    if (boardEmpty) {
      if (forcedFirstTile && tile.id !== forcedFirstTile) return 'disabled';
      return selectedTile?.id === tile.id ? 'selected' : 'playable';
    }
    if (!canPlay(tile, leftEnd, rightEnd)) return 'disabled';
    return selectedTile?.id === tile.id ? 'selected' : 'playable';
  };

  const hasAnyValidMove = isMyTurn && hand.some((t) => {
    if (boardEmpty) return !forcedFirstTile || t.id === forcedFirstTile;
    return canPlay(t, leftEnd, rightEnd);
  });

  const getPlayButtons = () => {
    if (!isMyTurn || !selectedTile) return [];
    if (boardEmpty) {
      if (forcedFirstTile && selectedTile.id !== forcedFirstTile) return [];
      return [{ side: 'right', label: 'Jugar primera ficha' }];
    }
    const btns = [];
    const canL = selectedTile.high === leftEnd || selectedTile.low === leftEnd;
    const canR = selectedTile.high === rightEnd || selectedTile.low === rightEnd;
    if (canL) btns.push({ side: 'left', label: `← Jugar [${leftEnd}]` });
    if (canR) btns.push({ side: 'right', label: `Jugar [${rightEnd}] →` });
    return btns;
  };

  const handleSelectTile = (tile) => {
    if (!isMyTurn) return;
    setSelectedTile((prev) => (prev?.id === tile.id ? null : tile));
  };

  const handlePlay = (side) => {
    if (!selectedTile || !socketRef.current) return;
    socketRef.current.emit('domino:play-tile', { roomCode: code, tileId: selectedTile.id, side });
  };

  const handlePass = () => socketRef.current?.emit('domino:pass', { roomCode: code });

  const handleLeave = () => {
    socketRef.current?.emit('domino:leave-room', { roomCode: code });
    destroyDominoSocket();
    nav('/domino');
  };

  const handleReconnect = () => {
    setLoading(true);
    setLoadingTimedOut(false);
    socketRef.current?.emit('domino:join-room', { roomCode: code });
    setTimeout(() => { setLoading(false); setLoadingTimedOut(true); }, 5000);
  };

  const currentPlayerObj = players.find((p) => p.id === currentPlayer);
  const playButtons = getPlayButtons();

  const TOAST_STYLE = {
    error: { bg: 'rgba(127,29,29,0.9)', border: '#b91c1c', color: '#fca5a5' },
    warning: { bg: 'rgba(120,53,15,0.9)', border: '#a16207', color: '#fde68a' },
    info: { bg: 'rgba(15,23,42,0.9)', border: '#334155', color: '#cbd5e1' },
  };

  if (loading) {
    return (
      <div
        style={{ minHeight: '100dvh', background: '#0a0a0a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}
      >
        <div
          style={{
            width: 46, height: 88, background: '#F5F0E8', borderRadius: 6,
            border: '2px solid #C8B89A',
            boxShadow: '2px 4px 12px rgba(0,0,0,0.6), inset 0 1px 2px rgba(255,255,255,0.8)',
            animation: 'domino-pulse 1.4s ease-in-out infinite',
          }}
        />
        <style>{`@keyframes domino-pulse { 0%,100%{opacity:.4;transform:scale(0.95)} 50%{opacity:1;transform:scale(1)} }`}</style>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Cargando partida...</p>
      </div>
    );
  }

  if (loadingTimedOut && phase === 'loading') {
    return (
      <div style={{ minHeight: '100dvh', background: '#0a0a0a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 24 }}>
        <div style={{ fontSize: 48 }}>🎲</div>
        <p style={{ color: '#f1f5f9', fontSize: 17, fontWeight: 700, textAlign: 'center' }}>No se pudo cargar la partida</p>
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, textAlign: 'center' }}>El servidor tardó demasiado en responder</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 280 }}>
          <button
            onClick={handleReconnect}
            style={{ background: '#2563eb', border: 'none', borderRadius: 12, padding: 14, color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}
          >
            Reintentar
          </button>
          <button
            onClick={() => { destroyDominoSocket(); nav('/domino'); }}
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 14, color: '#9ca3af', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
          >
            Volver al lobby
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        height: '100dvh', display: 'flex', flexDirection: 'column',
        background: '#0a0a0a', color: '#f1f5f9',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        overflow: 'hidden', userSelect: 'none',
      }}
    >
      {/* ── Header: scores + round ── */}
      <div
        style={{
          flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)',
          background: 'rgba(0,0,0,0.4)',
        }}
      >
        <button
          onClick={() => setShowLeaveConfirm(true)}
          style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', cursor: 'pointer', background: 'none', border: 'none', padding: '4px 0' }}
        >
          ← Salir
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              textAlign: 'center', padding: '5px 14px',
              background: 'rgba(37,99,235,0.15)', border: '1px solid rgba(59,130,246,0.25)',
              borderRadius: 10,
            }}
          >
            <div style={{ fontSize: 9, color: '#60a5fa', letterSpacing: '0.1em', fontWeight: 700 }}>EQUIPO 1</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#93c5fd', lineHeight: 1.1 }}>{scores.team1}</div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.05em' }}>RONDA</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'rgba(255,255,255,0.45)' }}>{roundNumber}</div>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.15)' }}>/ 200</div>
          </div>

          <div
            style={{
              textAlign: 'center', padding: '5px 14px',
              background: 'rgba(185,28,28,0.15)', border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 10,
            }}
          >
            <div style={{ fontSize: 9, color: '#f87171', letterSpacing: '0.1em', fontWeight: 700 }}>EQUIPO 2</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#fca5a5', lineHeight: 1.1 }}>{scores.team2}</div>
          </div>
        </div>

        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.15)', fontFamily: 'monospace', letterSpacing: '0.1em' }}>{code}</div>
      </div>

      {/* ── Toast ── */}
      {toast.msg && (
        <div
          style={{
            flexShrink: 0, margin: '6px 12px 0',
            background: TOAST_STYLE[toast.type]?.bg || TOAST_STYLE.info.bg,
            border: `1px solid ${TOAST_STYLE[toast.type]?.border || TOAST_STYLE.info.border}`,
            borderRadius: 8, padding: '7px 14px',
            fontSize: 12, color: TOAST_STYLE[toast.type]?.color || TOAST_STYLE.info.color,
            textAlign: 'center',
          }}
        >
          {toast.msg}
        </div>
      )}

      {/* ── Players bar ── */}
      <div
        style={{
          flexShrink: 0, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 5, padding: '8px 10px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(0,0,0,0.2)',
        }}
      >
        {[...players].sort((a, b) => a.seat - b.seat).map((p) => (
          <PlayerSeat
            key={p.id}
            player={p}
            isCurrentPlayer={p.id === currentPlayer}
            isMe={p.id === user?.id}
            compact
          />
        ))}
        {Array.from({ length: Math.max(0, 4 - players.length) }).map((_, i) => (
          <PlayerSeat key={`e${i}`} player={null} compact />
        ))}
      </div>

      {/* ── Turn banner ── */}
      <div
        style={{
          flexShrink: 0, padding: '7px 16px', textAlign: 'center',
          fontSize: isMyTurn ? 13 : 11, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase',
          background: isMyTurn
            ? 'linear-gradient(135deg, rgba(234,179,8,0.2) 0%, rgba(234,179,8,0.07) 100%)'
            : 'rgba(255,255,255,0.015)',
          borderBottom: `1px solid ${isMyTurn ? 'rgba(234,179,8,0.3)' : 'rgba(255,255,255,0.05)'}`,
          color: isMyTurn ? '#fbbf24' : 'rgba(255,255,255,0.3)',
          transition: 'all 0.3s ease',
        }}
      >
        {isMyTurn ? '¡Es tu turno!' : `Turno de ${currentPlayerObj?.username || '...'}`}
      </div>

      {/* ── Board (felt) ── */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <DominoBoard board={board} leftEnd={leftEnd} rightEnd={rightEnd} />
      </div>

      {/* ── Hand section ── */}
      <div
        style={{
          flexShrink: 0,
          borderTop: `2px solid ${isMyTurn ? 'rgba(234,179,8,0.3)' : 'rgba(255,255,255,0.07)'}`,
          background: isMyTurn ? 'rgba(234,179,8,0.04)' : 'rgba(0,0,0,0.35)',
          transition: 'all 0.3s ease',
          paddingBottom: 'env(safe-area-inset-bottom, 8px)',
        }}
      >
        {/* Hand label row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px 4px' }}>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>
            Tu mano · {hand.length}
          </span>
          {myTeam && (
            <span style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 700,
              background: myTeam === 1 ? 'rgba(37,99,235,0.25)' : 'rgba(185,28,28,0.25)',
              color: myTeam === 1 ? '#93c5fd' : '#fca5a5',
              border: `1px solid ${myTeam === 1 ? 'rgba(59,130,246,0.3)' : 'rgba(239,68,68,0.3)'}`,
            }}>
              Equipo {myTeam}
            </span>
          )}
        </div>

        {/* Tiles in hand */}
        <div
          style={{
            display: 'flex', gap: 8, overflowX: 'auto', overflowY: 'visible',
            padding: '6px 14px 10px',
            justifyContent: hand.length <= 5 ? 'center' : 'flex-start',
            scrollbarWidth: 'none', alignItems: 'flex-end',
          }}
        >
          {hand.map((tile) => (
            <DominoTile
              key={tile.id}
              a={tile.high}
              b={tile.low}
              layout="v"
              state={getTileState(tile)}
              size="md"
              onClick={() => handleSelectTile(tile)}
            />
          ))}
          {hand.length === 0 && (
            <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12, padding: '20px 0' }}>Sin fichas</div>
          )}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, padding: '0 14px 12px', justifyContent: 'center', flexWrap: 'wrap', minHeight: 48, alignItems: 'center' }}>
          {isMyTurn ? (
            <>
              {playButtons.map(({ side, label }) => (
                <button
                  key={side}
                  onClick={() => handlePlay(side)}
                  style={{
                    background: 'linear-gradient(135deg, #1d4ed8, #2563eb)',
                    border: '1.5px solid rgba(96,165,250,0.4)',
                    borderRadius: 10, padding: '11px 22px',
                    fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(37,99,235,0.45)',
                    transition: 'opacity 0.15s',
                  }}
                >
                  {label}
                </button>
              ))}

              {!hasAnyValidMove && (
                <button
                  onClick={handlePass}
                  style={{
                    background: 'rgba(55,65,81,0.9)',
                    border: '1.5px solid rgba(107,114,128,0.35)',
                    borderRadius: 10, padding: '11px 22px',
                    fontSize: 13, fontWeight: 700, color: '#d1d5db', cursor: 'pointer',
                  }}
                >
                  Pasar turno
                </button>
              )}

              {hasAnyValidMove && playButtons.length === 0 && (
                <p style={{ fontSize: 12, color: 'rgba(234,179,8,0.55)', fontWeight: 600 }}>
                  Selecciona una ficha para jugar
                </p>
              )}
            </>
          ) : (
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.18)' }}>
              Espera tu turno...
            </p>
          )}
        </div>
      </div>

      {/* ── Round Over overlay ── */}
      {phase === 'round-over' && roundResult && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 }}>
          <div style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '28px 24px', maxWidth: 320, width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: 44, marginBottom: 10 }}>{roundResult.isTranque ? '🔒' : '🏆'}</div>
            {roundResult.winnerTeam ? (
              <>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: '#f1f5f9', marginBottom: 4 }}>
                  Equipo {roundResult.winnerTeam} ganó la ronda
                </h2>
                {roundResult.isTranque && (
                  <p style={{ fontSize: 12, color: '#fbbf24', marginBottom: 4 }}>¡Tranque! — Nadie puede jugar</p>
                )}
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 16 }}>
                  +{roundResult.points} puntos
                </p>
              </>
            ) : (
              <h2 style={{ fontSize: 17, fontWeight: 800, color: '#f1f5f9', marginBottom: 16 }}>
                Tranque — empate sin puntos
              </h2>
            )}

            <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: '12px 16px', marginBottom: 14 }}>
              {[1, 2].map((t) => (
                <div
                  key={t}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '6px 4px', borderBottom: t === 1 ? '1px solid rgba(255,255,255,0.07)' : 'none',
                  }}
                >
                  <span style={{ fontSize: 13, color: t === 1 ? '#93c5fd' : '#fca5a5', fontWeight: 600 }}>
                    Equipo {t} {roundResult.winnerTeam === t ? '🏆' : ''}
                  </span>
                  <span style={{ fontSize: 21, fontWeight: 900, color: '#f1f5f9' }}>
                    {roundResult.scores[`team${t}`]}
                  </span>
                </div>
              ))}
            </div>

            {countdown !== null && countdown > 0 && (
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
                Próxima ronda en {countdown}s...
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Game Over overlay ── */}
      {phase === 'game-over' && gameResult && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 }}>
          <div style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 24, padding: '32px 24px', maxWidth: 320, width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: 52, marginBottom: 8 }}>
              {myTeam === gameResult.gameWinnerTeam ? '🎉' : '👏'}
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 900, color: '#f1f5f9', marginBottom: 4 }}>
              Equipo {gameResult.gameWinnerTeam} Gana
            </h2>
            <p style={{ fontSize: 15, marginBottom: 20, fontWeight: 700, color: myTeam === gameResult.gameWinnerTeam ? '#fbbf24' : 'rgba(255,255,255,0.35)' }}>
              {myTeam === gameResult.gameWinnerTeam ? '¡VICTORIA!' : 'Suerte la próxima vez'}
            </p>

            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: '14px 18px', marginBottom: 20 }}>
              {[1, 2].map((t) => (
                <div
                  key={t}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 12px', borderRadius: 8, marginBottom: t === 1 ? 6 : 0,
                    background: gameResult.gameWinnerTeam === t
                      ? (t === 1 ? 'rgba(37,99,235,0.2)' : 'rgba(185,28,28,0.2)')
                      : 'transparent',
                  }}
                >
                  <span style={{ fontSize: 13, color: t === 1 ? '#93c5fd' : '#fca5a5', fontWeight: 600 }}>
                    Equipo {t} {gameResult.gameWinnerTeam === t ? '🏆' : ''}
                  </span>
                  <span style={{ fontSize: 22, fontWeight: 900, color: '#f1f5f9' }}>
                    {gameResult.scores[`team${t}`]}
                  </span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => { destroyDominoSocket(); nav('/domino'); }}
                style={{ flex: 1, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '13px 0', fontSize: 14, fontWeight: 600, color: '#d1d5db', cursor: 'pointer' }}
              >
                Lobby
              </button>
              <button
                onClick={() => nav(`/domino/room/${code}`)}
                style={{ flex: 1, background: '#d97706', border: 'none', borderRadius: 12, padding: '13px 0', fontSize: 14, fontWeight: 800, color: '#000', cursor: 'pointer' }}
              >
                Jugar de nuevo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Leave confirm ── */}
      {showLeaveConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 }}>
          <div style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 18, padding: '24px', maxWidth: 280, width: '100%', textAlign: 'center' }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9', marginBottom: 6 }}>¿Abandonar la partida?</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 20 }}>Tu equipo quedará en desventaja.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setShowLeaveConfirm(false)}
                style={{ flex: 1, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 0', fontSize: 13, fontWeight: 600, color: '#d1d5db', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleLeave}
                style={{ flex: 1, background: 'rgba(185,28,28,0.85)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '10px 0', fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer' }}
              >
                Abandonar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
