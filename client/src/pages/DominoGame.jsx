import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import useAuthStore from '../store/authStore';
import useDominoStore from '../store/dominoStore';
import DominoTile from '../components/domino/DominoTile';
import DominoBoard from '../components/domino/DominoBoard';
import PlayerSeat from '../components/domino/PlayerSeat';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

function canPlayTile(tile, leftEnd, rightEnd, boardEmpty) {
  if (boardEmpty) return true;
  return tile.high === leftEnd || tile.low === leftEnd || tile.high === rightEnd || tile.low === rightEnd;
}

export default function DominoGame() {
  const { code } = useParams();
  const nav = useNavigate();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.accessToken);
  const {
    myHand, board, leftEnd, rightEnd, currentPlayer, players, scores, roundNumber, myTeam, forcedFirstTile,
    phase, initRound, updateBoard, setCurrentPlayer, setPlayers, setScores, removeFromHand, setPhase, reset,
  } = useDominoStore();

  const [selectedTile, setSelectedTile] = useState(null);
  const [roundResult, setRoundResult] = useState(null);
  const [gameResult, setGameResult] = useState(null);
  const [toast, setToast] = useState('');
  const [toastType, setToastType] = useState('info');
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const socketRef = useRef(null);
  const boardRef = useRef(null);

  const showToast = (msg, type = 'info') => {
    setToast(msg);
    setToastType(type);
    setTimeout(() => setToast(''), 3500);
  };

  useEffect(() => {
    if (!token) return;
    const socket = io(SOCKET_URL, { auth: { token } });
    socketRef.current = socket;

    socket.emit('domino:join-room', { roomCode: code });

    socket.on('domino:game-state', (data) => {
      initRound(data);
    });

    socket.on('domino:round-start', (data) => {
      initRound(data);
      setSelectedTile(null);
      setRoundResult(null);
      setCountdown(null);
      showToast(`Ronda ${data.roundNumber} comenzando`, 'info');
    });

    socket.on('domino:tile-played', ({ playerId, tileId, board: b, leftEnd: le, rightEnd: re, players: pl }) => {
      updateBoard(b, le, re);
      setPlayers(pl);
      if (playerId === user?.id) {
        removeFromHand(tileId);
        setSelectedTile(null);
      }
      setTimeout(() => boardRef.current?.scrollTo({ left: boardRef.current.scrollWidth, behavior: 'smooth' }), 100);
    });

    socket.on('domino:turn-change', ({ currentPlayer: cp }) => {
      setCurrentPlayer(cp);
    });

    socket.on('domino:player-passed', ({ username, passCount }) => {
      showToast(`${username} pasó turno (${passCount}/4)`, 'warning');
    });

    socket.on('domino:round-over', (result) => {
      setRoundResult(result);
      setScores(result.scores);
      setPhase('round-over');
      let secs = 5;
      setCountdown(secs);
      const interval = setInterval(() => {
        secs--;
        setCountdown(secs);
        if (secs <= 0) clearInterval(interval);
      }, 1000);
    });

    socket.on('domino:game-over', (result) => {
      setGameResult(result);
      setScores(result.scores);
      setPhase('game-over');
    });

    socket.on('domino:player-left', ({ players: pl }) => {
      setPlayers(pl);
      showToast('Un jugador abandonó la partida', 'warning');
    });

    socket.on('domino:error', ({ message }) => showToast(message, 'error'));

    return () => {
      socket.disconnect();
      reset();
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
    const fits = canPlayTile(tile, leftEnd, rightEnd, false);
    if (!fits) return 'disabled';
    return selectedTile?.id === tile.id ? 'selected' : 'playable';
  };

  const hasAnyValidMove = isMyTurn && myHand.some((t) => {
    if (boardEmpty) return !forcedFirstTile || t.id === forcedFirstTile;
    return canPlayTile(t, leftEnd, rightEnd, false);
  });

  const getPlayButtons = () => {
    if (!isMyTurn || !selectedTile) return [];
    if (boardEmpty) {
      if (forcedFirstTile && selectedTile.id !== forcedFirstTile) return [];
      return [{ side: 'right', label: 'Jugar primera ficha' }];
    }
    const buttons = [];
    if (selectedTile.high === leftEnd || selectedTile.low === leftEnd) {
      buttons.push({ side: 'left', label: `← [${leftEnd}]` });
    }
    if (selectedTile.high === rightEnd || selectedTile.low === rightEnd) {
      buttons.push({ side: 'right', label: `[${rightEnd}] →` });
    }
    return buttons;
  };

  const handleSelectTile = (tile) => {
    if (!isMyTurn) return;
    setSelectedTile((prev) => (prev?.id === tile.id ? null : tile));
  };

  const handlePlay = (side) => {
    if (!selectedTile || !socketRef.current) return;
    socketRef.current.emit('domino:play-tile', { roomCode: code, tileId: selectedTile.id, side });
  };

  const handlePass = () => {
    if (!socketRef.current) return;
    socketRef.current.emit('domino:pass', { roomCode: code });
  };

  const handleLeave = () => {
    socketRef.current?.emit('domino:leave-room', { roomCode: code });
    reset();
    nav('/domino');
  };

  const currentPlayerObj = players.find((p) => p.id === currentPlayer);
  const myPlayerObj = players.find((p) => p.id === user?.id);
  const partnerObj = players.find((p) => p.team === myTeam && p.id !== user?.id);
  const opponents = players.filter((p) => p.team !== myTeam);

  const playButtons = getPlayButtons();

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 flex-shrink-0">
        <button
          onClick={() => setShowLeaveConfirm(true)}
          className="text-gray-500 hover:text-red-400 text-sm transition-colors"
        >
          ← Salir
        </button>
        <div className="flex items-center gap-4">
          <div className="text-center">
            <div className="text-xs text-gray-500">RONDA</div>
            <div className="font-bold text-white">{roundNumber}</div>
          </div>
          <div className="flex gap-3">
            <div className="text-center px-3 py-1 bg-blue-900/50 rounded-lg border border-blue-800">
              <div className="text-xs text-blue-400">Equipo 1</div>
              <div className="font-bold text-blue-300 text-lg">{scores.team1}</div>
            </div>
            <div className="text-center px-3 py-1 bg-red-900/50 rounded-lg border border-red-800">
              <div className="text-xs text-red-400">Equipo 2</div>
              <div className="font-bold text-red-300 text-lg">{scores.team2}</div>
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500">META</div>
            <div className="text-gray-400 text-sm font-semibold">200</div>
          </div>
        </div>
        <div className="text-xs text-gray-600 font-mono">{code}</div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`mx-4 mt-2 rounded-lg px-4 py-2 text-sm text-center flex-shrink-0 ${
          toastType === 'error' ? 'bg-red-900/60 border border-red-700 text-red-300' :
          toastType === 'warning' ? 'bg-yellow-900/60 border border-yellow-700 text-yellow-300' :
          'bg-gray-800 border border-gray-700 text-gray-300'
        }`}>
          {toast}
        </div>
      )}

      {/* Players bar */}
      <div className="grid grid-cols-4 gap-1.5 px-3 py-2 border-b border-gray-800 flex-shrink-0">
        {players.sort((a, b) => a.seat - b.seat).map((p) => (
          <PlayerSeat
            key={p.id}
            player={p}
            isCurrentPlayer={p.id === currentPlayer}
            isMe={p.id === user?.id}
            compact
          />
        ))}
        {Array.from({ length: Math.max(0, 4 - players.length) }).map((_, i) => (
          <PlayerSeat key={`empty-${i}`} player={null} compact />
        ))}
      </div>

      {/* Turn status */}
      <div className={`px-4 py-2 text-center text-sm flex-shrink-0 ${isMyTurn ? 'bg-yellow-900/30 border-b border-yellow-800' : 'bg-gray-900/30 border-b border-gray-800'}`}>
        {isMyTurn ? (
          <span className="text-yellow-400 font-bold animate-pulse">¡ES TU TURNO!</span>
        ) : (
          <span className="text-gray-400">
            Turno de <span className="text-white font-semibold">{currentPlayerObj?.username || '...'}</span>
          </span>
        )}
      </div>

      {/* Board */}
      <div className="flex-1 overflow-hidden flex flex-col" style={{ minHeight: 0 }}>
        <div
          ref={boardRef}
          className="overflow-x-auto flex-1 p-4 flex items-center bg-gray-900/20"
          style={{ minHeight: 120 }}
        >
          <DominoBoard board={board} leftEnd={leftEnd} rightEnd={rightEnd} />
        </div>
      </div>

      {/* Hand section */}
      <div className="border-t border-gray-800 bg-gray-950 flex-shrink-0">
        {/* My hand label */}
        <div className="px-4 pt-3 pb-1 flex items-center justify-between">
          <span className="text-xs text-gray-500 uppercase tracking-wide">Tu mano ({myHand.length} fichas)</span>
          {myPlayerObj && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${myTeam === 1 ? 'bg-blue-900 text-blue-300' : 'bg-red-900 text-red-300'}`}>
              Equipo {myTeam}
            </span>
          )}
        </div>

        {/* Tiles */}
        <div className="flex gap-2.5 overflow-x-auto px-4 py-2 justify-center flex-wrap sm:flex-nowrap">
          {myHand.map((tile) => (
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
          {myHand.length === 0 && phase === 'playing' && (
            <div className="text-gray-600 text-sm py-4">Sin fichas</div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 px-4 pb-4 pt-1 justify-center flex-wrap">
          {isMyTurn && (
            <>
              {playButtons.map(({ side, label }) => (
                <button
                  key={side}
                  onClick={() => handlePlay(side)}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                >
                  {label}
                </button>
              ))}
              {isMyTurn && !hasAnyValidMove && (
                <button
                  onClick={handlePass}
                  className="bg-gray-700 hover:bg-gray-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                >
                  Pasar turno
                </button>
              )}
              {isMyTurn && hasAnyValidMove && playButtons.length === 0 && (
                <p className="text-gray-500 text-xs self-center">Selecciona una ficha</p>
              )}
            </>
          )}
          {!isMyTurn && (
            <p className="text-gray-600 text-xs self-center py-2">Espera tu turno...</p>
          )}
        </div>
      </div>

      {/* Round Over overlay */}
      {phase === 'round-over' && roundResult && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-sm w-full text-center space-y-4">
            <div className="text-4xl">{roundResult.isTranque ? '🔒' : '🏆'}</div>
            {roundResult.winnerTeam ? (
              <>
                <h2 className="text-xl font-bold text-white">
                  Equipo {roundResult.winnerTeam} ganó la ronda
                </h2>
                {roundResult.isTranque && (
                  <p className="text-yellow-400 text-sm">¡Tranque! Nadie puede jugar</p>
                )}
                <p className="text-gray-400">+{roundResult.points} puntos</p>
              </>
            ) : (
              <h2 className="text-xl font-bold text-white">¡Tranque! Empate — sin puntos</h2>
            )}
            <div className="bg-gray-800 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-blue-400 font-semibold">Equipo 1</span>
                <span className="text-white font-bold text-lg">{roundResult.scores.team1}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-red-400 font-semibold">Equipo 2</span>
                <span className="text-white font-bold text-lg">{roundResult.scores.team2}</span>
              </div>
            </div>
            {countdown !== null && countdown > 0 && (
              <p className="text-gray-500 text-sm">Próxima ronda en {countdown}s...</p>
            )}
          </div>
        </div>
      )}

      {/* Game Over overlay */}
      {phase === 'game-over' && gameResult && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-8 max-w-sm w-full text-center space-y-5">
            <div className="text-5xl">🎉</div>
            <h2 className="text-2xl font-black text-white">
              ¡Equipo {gameResult.gameWinnerTeam} Gana!
            </h2>
            {myTeam === gameResult.gameWinnerTeam ? (
              <p className="text-yellow-400 font-bold text-lg">¡VICTORIA!</p>
            ) : (
              <p className="text-gray-400">Buen intento, suerte la próxima</p>
            )}
            <div className="bg-gray-800 rounded-xl p-4 space-y-3">
              <div className={`flex justify-between text-sm p-2 rounded-lg ${gameResult.gameWinnerTeam === 1 ? 'bg-blue-900/50' : ''}`}>
                <span className="text-blue-400 font-semibold">Equipo 1 {gameResult.gameWinnerTeam === 1 ? '🏆' : ''}</span>
                <span className="text-white font-bold text-xl">{gameResult.scores.team1}</span>
              </div>
              <div className={`flex justify-between text-sm p-2 rounded-lg ${gameResult.gameWinnerTeam === 2 ? 'bg-red-900/50' : ''}`}>
                <span className="text-red-400 font-semibold">Equipo 2 {gameResult.gameWinnerTeam === 2 ? '🏆' : ''}</span>
                <span className="text-white font-bold text-xl">{gameResult.scores.team2}</span>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { reset(); nav('/domino'); }}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-xl font-semibold transition-colors"
              >
                Lobby
              </button>
              <button
                onClick={() => { reset(); nav(`/domino/room/${code}`); }}
                className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-black py-3 rounded-xl font-bold transition-colors"
              >
                Jugar de nuevo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leave confirmation */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-xs w-full text-center space-y-4">
            <p className="text-white font-semibold">¿Abandonar la partida?</p>
            <p className="text-gray-400 text-sm">Tu equipo quedará en desventaja.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLeaveConfirm(false)}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-2.5 rounded-lg text-sm transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleLeave}
                className="flex-1 bg-red-700 hover:bg-red-600 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors"
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
