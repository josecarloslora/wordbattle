import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import useGameStore from '../store/gameStore';
import socketSvc from '../services/socket';
import api from '../services/api';
import GameBoard from '../components/GameBoard';
import Keyboard from '../components/Keyboard';
import PlayerPanel from '../components/PlayerPanel';
import StatsModal from '../components/StatsModal';
import Toast from '../components/Toast';
import { useToast } from '../hooks/useToast';

export default function Game() {
  const { code } = useParams();
  const nav = useNavigate();
  const { user, accessToken } = useAuthStore();
  const { guesses, currentGuess, gameOver, word, setLetter, deleteLetter, addGuess, startGame, endGame, reset, setPlayers, players } = useGameStore();
  const { toasts, addToast } = useToast();

  const [keyStatuses, setKeyStatuses] = useState({});
  const [shakeRow, setShakeRow] = useState(false);
  const [gameResult, setGameResult] = useState(null);
  const [myStats, setMyStats] = useState(null);
  const [timer, setTimer] = useState(0);
  const [startTime, setStartTime] = useState(null);
  const [solved, setSolved] = useState(false);

  useEffect(() => {
    startGame();
    const socket = socketSvc.connect(accessToken);

    socket.on('game-start', ({ startTime: st, playerCount }) => {
      setStartTime(st);
    });

    socket.on('room-state', ({ players: ps }) => {
      setPlayers(ps.map(p => ({ id: p.id, username: p.username, avatarColor: p.avatarColor || '#6366f1', attempts: [], solved: false })));
    });

    socket.on('player-joined', ({ userId, username }) => {
      setPlayers([...useGameStore.getState().players, { id: userId, username, avatarColor: '#6366f1', attempts: [], solved: false }]);
    });

    socket.on('guess-result', ({ playerId, result, attemptNumber }) => {
      if (playerId === user.id) {
        addGuess(result);
        updateKeyStatuses(result);
      }
      setPlayers(useGameStore.getState().players.map(p =>
        p.id === playerId ? { ...p, attempts: [...(p.attempts || []), { result }] } : p
      ));
    });

    socket.on('invalid-word', () => {
      addToast('Not a valid word!', 'error', 1500);
      setShakeRow(true);
      setTimeout(() => setShakeRow(false), 500);
    });

    socket.on('player-solved', ({ playerId, solveTime }) => {
      setPlayers(useGameStore.getState().players.map(p =>
        p.id === playerId ? { ...p, solved: true, solveTime } : p
      ));
      if (playerId === user.id) setSolved(true);
    });

    socket.on('game-over', async ({ winner, word: w, allResults }) => {
      endGame(winner, w);
      setGameResult({ winner, allResults });
      try {
        const data = await api.get(`/api/users/${user.id}/profile`);
        setMyStats(data.stats);
      } catch {}
    });

    return () => {
      socket.off('game-start');
      socket.off('room-state');
      socket.off('player-joined');
      socket.off('guess-result');
      socket.off('invalid-word');
      socket.off('player-solved');
      socket.off('game-over');
    };
  }, [code, accessToken]);

  useEffect(() => {
    if (!startTime || gameOver) return;
    const id = setInterval(() => setTimer(Math.floor((Date.now() - startTime) / 1000)), 1000);
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
      if (guess.length !== 5) { addToast('Word must be 5 letters', 'error', 1200); return; }
      socketSvc.emit('submit-guess', { roomCode: code, guess });
      useGameStore.getState().deleteLetter();
      useGameStore.setState({ currentGuess: '' });
      return;
    }
    setLetter(key);
  }, [gameOver, solved, code]);

  const fmt = s => `${Math.floor(s / 60).toString().padStart(2,'0')}:${(s % 60).toString().padStart(2,'0')}`;

  return (
    <div className="min-h-screen flex flex-col">
      <Toast toasts={toasts} />
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-900">
        <span className="text-sm text-gray-400">Room: <span className="font-mono text-white">{code}</span></span>
        <span className="text-lg font-bold font-mono text-indigo-400">{fmt(timer)}</span>
        <span className="text-sm text-gray-400">{guesses.length}/6 guesses</span>
      </div>

      <div className="flex flex-1 gap-4 p-4 justify-center">
        <div className="hidden lg:block">
          <PlayerPanel players={players} currentUserId={user?.id} />
        </div>

        <div className="flex flex-col items-center">
          <GameBoard guesses={guesses} currentGuess={currentGuess} gameOver={gameOver} shakeRow={shakeRow} />
          <Keyboard onKey={handleKey} keyStatuses={keyStatuses} disabled={gameOver || solved} />
        </div>

        <div className="hidden lg:block w-52" />
      </div>

      {gameOver && gameResult && (
        <StatsModal stats={myStats} gameResult={gameResult} word={word} onClose={() => { reset(); nav('/lobby'); }} />
      )}
    </div>
  );
}
