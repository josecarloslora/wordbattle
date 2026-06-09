import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import api from '../services/api';
import GameBoard from '../components/GameBoard';
import Keyboard from '../components/Keyboard';
import GameOverModal from '../components/GameOverModal';
import Toast from '../components/Toast';
import { useToast } from '../hooks/useToast';

export default function Solo() {
  const nav = useNavigate();
  const { user } = useAuthStore();
  const { toasts, addToast } = useToast();

  const [phase, setPhase] = useState('select');
  const [language, setLanguage] = useState('es');
  const [gameId, setGameId] = useState(null);
  const [guesses, setGuesses] = useState([]);
  const [currentGuess, setCurrentGuess] = useState('');
  const [keyStatuses, setKeyStatuses] = useState({});
  const [shakeRow, setShakeRow] = useState(false);
  const [solved, setSolved] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [revealedWord, setRevealedWord] = useState(null);
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(0);
  const [startTime, setStartTime] = useState(null);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (phase !== 'playing' || gameOver) return;
    if (!startTime) return;
    const id = setInterval(() => setTimer(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => clearInterval(id);
  }, [phase, gameOver, startTime]);

  async function startGame() {
    setLoading(true);
    try {
      const data = await api.post('/api/solo/start', { language });
      setGameId(data.gameId);
      setGuesses([]);
      setCurrentGuess('');
      setKeyStatuses({});
      setSolved(false);
      setGameOver(false);
      setRevealedWord(null);
      setTimer(0);
      setStartTime(Date.now());
      setPhase('playing');
    } catch {
      addToast('Error al iniciar la partida', 'error');
    } finally {
      setLoading(false);
    }
  }

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

  const handleKey = useCallback(async (key) => {
    if (gameOver || solved) return;

    if (key === '⌫') {
      setCurrentGuess(g => g.slice(0, -1));
      return;
    }

    if (key === 'ENTER') {
      if (currentGuess.length !== 5) {
        addToast('La palabra debe tener 5 letras', 'error', 1200);
        return;
      }
      if (submittingRef.current) return;
      submittingRef.current = true;
      try {
        const data = await api.post('/api/solo/guess', { gameId, guess: currentGuess });
        if (!data.valid) {
          addToast('Palabra no válida', 'error', 1500);
          setShakeRow(true);
          setTimeout(() => setShakeRow(false), 600);
          return;
        }
        setGuesses(prev => [...prev, data.result]);
        updateKeyStatuses(data.result);
        setCurrentGuess('');
        if (data.solved) {
          setSolved(true);
          setGameOver(true);
          setRevealedWord(data.word);
          setPhase('ended');
        } else if (data.gameOver) {
          setGameOver(true);
          setRevealedWord(data.word);
          setPhase('ended');
        }
      } catch {
        addToast('Error al procesar la jugada', 'error');
      } finally {
        submittingRef.current = false;
      }
      return;
    }

    if (/^[A-Z]$/.test(key)) {
      setCurrentGuess(g => g.length < 5 ? g + key : g);
    }
  }, [gameOver, solved, currentGuess, gameId]);

  const fmt = s => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  if (phase === 'select') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-900">
        <Toast toasts={toasts} />
        <button
          onClick={() => nav('/lobby')}
          className="absolute top-4 left-4 text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1"
        >
          ← Lobby
        </button>

        <h1 className="text-4xl font-black mb-2">
          Modo <span className="text-green-400">Solitario</span>
        </h1>
        <p className="text-gray-400 mb-10 text-center max-w-xs">
          Juega solo, practica tu vocabulario y mejora tu racha.
        </p>

        <div className="flex gap-4 mb-10">
          {[
            { id: 'es', label: 'Español', flag: '🇪🇸' },
            { id: 'en', label: 'English', flag: '🇬🇧' },
          ].map(lang => (
            <button
              key={lang.id}
              onClick={() => setLanguage(lang.id)}
              className={`flex flex-col items-center gap-2 px-8 py-5 rounded-2xl border-2 transition-all ${
                language === lang.id
                  ? 'border-indigo-500 bg-indigo-900/30 text-white'
                  : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-500 hover:text-gray-200'
              }`}
            >
              <span className="text-3xl">{lang.flag}</span>
              <span className="font-semibold">{lang.label}</span>
            </button>
          ))}
        </div>

        <button
          onClick={startGame}
          disabled={loading}
          className="px-12 py-4 bg-green-600 hover:bg-green-500 text-white text-lg font-bold rounded-2xl transition-colors disabled:opacity-60"
        >
          {loading ? 'Cargando...' : 'Jugar'}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-900">
      <Toast toasts={toasts} />

      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 shrink-0">
        <button
          onClick={() => nav('/lobby')}
          className="text-sm text-gray-400 hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-gray-800"
        >
          ← Salir
        </button>
        <span className="text-lg font-bold font-mono text-indigo-400">{fmt(timer)}</span>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-2 py-1 rounded ${language === 'es' ? 'bg-yellow-600 text-white' : 'bg-blue-600 text-white'}`}>
            {language.toUpperCase()}
          </span>
          <span className="text-xs text-gray-500">Solo</span>
        </div>
      </div>

      <div className="flex flex-col items-center gap-3 p-4 flex-1">
        <div className="text-xs text-gray-500 font-mono">{guesses.length}/6 intentos</div>
        <GameBoard
          guesses={guesses}
          currentGuess={currentGuess}
          gameOver={gameOver}
          shakeRow={shakeRow}
        />
        <Keyboard onKey={handleKey} keyStatuses={keyStatuses} disabled={gameOver || solved} />
      </div>

      {phase === 'ended' && (
        <GameOverModal
          mode="solo"
          winner={solved ? { id: user?.id, username: user?.username } : null}
          word={revealedWord}
          solved={solved}
          attemptsCount={guesses.length}
          currentUserId={user?.id}
          onPlayAgain={startGame}
          onLobby={() => nav('/lobby')}
        />
      )}
    </div>
  );
}
