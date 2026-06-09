import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import useGameStore from '../store/gameStore';
import socketSvc from '../services/socket';
import GameBoard from '../components/GameBoard';
import Keyboard from '../components/Keyboard';
import PlayerPanel from '../components/PlayerPanel';
import GameOverModal from '../components/GameOverModal';
import Toast from '../components/Toast';
import { useToast } from '../hooks/useToast';

export default function Game() {
  const { code } = useParams();
  const nav = useNavigate();
  const { user, accessToken } = useAuthStore();
  const {
    guesses, currentGuess, gameOver, word, players, language, startTime,
    setLetter, deleteLetter, clearCurrentGuess, addGuess,
    startGame, endGame, reset, setPlayers, setStartTime, setLanguage,
  } = useGameStore();
  const { toasts, addToast } = useToast();

  const [keyStatuses, setKeyStatuses] = useState({});
  const [shakeRow, setShakeRow] = useState(false);
  const [gameResult, setGameResult] = useState(null);
  const [timer, setTimer] = useState(0);
  const [solved, setSolved] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  useEffect(() => {
    startGame();
    setSolved(false);
    setGameResult(null);
    setKeyStatuses({});
    setTimer(0);

    const socket = socketSvc.connect(accessToken);
    socket.emit('join-room', { roomCode: code });

    // Fallback: if startTime wasn't set by Room.jsx (e.g. page refresh), use now
    if (!useGameStore.getState().startTime) {
      setStartTime(Date.now());
    }

    socket.on('game-start', ({ startTime: st, language: lang }) => {
      setStartTime(st);
      if (lang) setLanguage(lang);
    });

    socket.on('room-state', ({ players: ps }) => {
      setPlayers(ps.map(p => ({
        id: p.id,
        username: p.username,
        avatarColor: p.avatarColor || '#6366f1',
        attempts: [],
        solved: false,
      })));
    });

    socket.on('player-joined', ({ userId, username }) => {
      const cur = useGameStore.getState().players;
      if (!cur.find(p => p.id === userId)) {
        setPlayers([...cur, { id: userId, username, avatarColor: '#6366f1', attempts: [], solved: false }]);
      }
    });

    socket.on('guess-result', ({ playerId, result }) => {
      if (playerId === user.id) {
        addGuess(result);
        updateKeyStatuses(result);
      }
      setPlayers(useGameStore.getState().players.map(p =>
        p.id === playerId ? { ...p, attempts: [...(p.attempts || []), { result }] } : p
      ));
    });

    socket.on('invalid-word', () => {
      addToast('Palabra no válida', 'error', 1500);
      setShakeRow(true);
      setTimeout(() => setShakeRow(false), 600);
    });

    socket.on('player-solved', ({ playerId, solveTime }) => {
      setPlayers(useGameStore.getState().players.map(p =>
        p.id === playerId ? { ...p, solved: true, solveTime } : p
      ));
      if (playerId === user.id) setSolved(true);
    });

    socket.on('game-over', ({ winner, word: w, allResults }) => {
      endGame(winner, w);
      setGameResult({ winner, allResults });
    });

    socket.on('error', ({ message }) => addToast(message, 'error'));

    return () => {
      socket.off('game-start');
      socket.off('room-state');
      socket.off('player-joined');
      socket.off('guess-result');
      socket.off('invalid-word');
      socket.off('player-solved');
      socket.off('game-over');
      socket.off('error');
    };
  }, [code, accessToken]);

  // Timer — reads startTime from store, ticks every second
  useEffect(() => {
    if (gameOver) return;
    const base = useGameStore.getState().startTime || Date.now();
    const id = setInterval(() => setTimer(Math.floor((Date.now() - base) / 1000)), 1000);
    return () => clearInterval(id);
  }, [startTime, gameOver]);

  function updateKeyStatuses(result) {
    setKeyStatuses(prev => {
      const next = { ...prev };
      for (const { letter, status } of result) {
        const cur = next[letter];
        if (cur === 'correct') continue;
        if (status === 'correct' || cur !== 'correct') next[letter] = status;
      }
      return next;
    });
  }

  const handleKey = useCallback((key) => {
    if (gameOver || solved) return;
    if (key === '⌫') { deleteLetter(); return; }
    if (key === 'ENTER') {
      const guess = useGameStore.getState().currentGuess;
      if (guess.length !== 5) {
        addToast('La palabra debe tener 5 letras', 'error', 1200);
        return;
      }
      socketSvc.emit('submit-guess', { roomCode: code, guess });
      clearCurrentGuess();
      return;
    }
    setLetter(key);
  }, [gameOver, solved, code]);

  function handleLeave() {
    if (!gameOver && guesses.length > 0) {
      setShowLeaveConfirm(true);
    } else {
      doLeave();
    }
  }

  function doLeave() {
    socketSvc.emit('leave-room', { roomCode: code });
    reset();
    nav('/lobby');
  }

  const fmt = s => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="min-h-screen flex flex-col bg-gray-900">
      <Toast toasts={toasts} />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 shrink-0">
        <button
          onClick={handleLeave}
          className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-gray-800"
        >
          ← Salir
        </button>
        <span className="text-lg font-bold font-mono text-indigo-400">{fmt(timer)}</span>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-2 py-1 rounded ${language === 'es' ? 'bg-yellow-600 text-white' : 'bg-blue-600 text-white'}`}>
            {(language || 'ES').toUpperCase()}
          </span>
          <span className="text-sm text-gray-500 font-mono hidden sm:block">{code}</span>
        </div>
      </div>

      {/* Mobile player bar */}
      {players.length > 0 && (
        <div className="lg:hidden flex gap-2 px-3 py-2 overflow-x-auto border-b border-gray-800 shrink-0">
          {players.map(p => (
            <div
              key={p.id}
              className={`flex items-center gap-1.5 shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap
                ${p.id === user?.id ? 'bg-indigo-900/50 border border-indigo-700' : 'bg-gray-800'}`}
            >
              <div
                className="w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                style={{ backgroundColor: p.avatarColor || '#6366f1' }}
              >
                {p.username?.[0]?.toUpperCase()}
              </div>
              <span>{p.username}</span>
              {p.solved && <span className="text-green-400">✓</span>}
            </div>
          ))}
        </div>
      )}

      {/* Main */}
      <div className="flex flex-1 gap-4 p-4 justify-center overflow-hidden">
        <div className="hidden lg:flex pt-2">
          <PlayerPanel players={players} currentUserId={user?.id} />
        </div>

        <div className="flex flex-col items-center gap-3">
          <div className="text-xs text-gray-500 font-mono">{guesses.length}/6 intentos</div>
          <GameBoard guesses={guesses} currentGuess={currentGuess} gameOver={gameOver} shakeRow={shakeRow} />
          <Keyboard onKey={handleKey} keyStatuses={keyStatuses} disabled={gameOver || solved} />
        </div>

        <div className="hidden lg:block w-52" />
      </div>

      {/* Leave confirm dialog */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-sm border border-gray-700 shadow-2xl">
            <div className="text-lg font-bold mb-2">¿Abandonar partida?</div>
            <p className="text-gray-400 text-sm mb-5">Si sales ahora, contará como derrota.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLeaveConfirm(false)}
                className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 rounded-xl font-semibold transition-colors"
              >
                Seguir jugando
              </button>
              <button
                onClick={doLeave}
                className="flex-1 py-2.5 bg-red-700 hover:bg-red-600 rounded-xl font-semibold transition-colors"
              >
                Salir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Game over modal */}
      {gameOver && gameResult && (
        <GameOverModal
          mode="multiplayer"
          winner={gameResult.winner}
          word={word}
          allResults={gameResult.allResults}
          currentUserId={user?.id}
          onPlayAgain={() => { reset(); nav(`/room/${code}`); }}
          onLobby={() => { reset(); nav('/lobby'); }}
        />
      )}
    </div>
  );
}
