import { create } from 'zustand';

const useGameStore = create((set) => ({
  roomCode: null,
  gameActive: false,
  word: null,
  language: 'es',
  guesses: [],
  currentGuess: '',
  gameOver: false,
  winner: null,
  players: [],
  myStats: null,
  startTime: null,

  setRoom: (code, lang) => set({ roomCode: code, language: lang || 'es' }),
  setLanguage: (lang) => set({ language: lang }),
  setPlayers: (players) => set({ players }),
  setStartTime: (t) => set({ startTime: t }),
  addGuess: (result) => set(s => ({ guesses: [...s.guesses, result] })),
  setLetter: (letter) => set(s => ({ currentGuess: s.currentGuess.length < 5 ? s.currentGuess + letter : s.currentGuess })),
  deleteLetter: () => set(s => ({ currentGuess: s.currentGuess.slice(0, -1) })),
  clearCurrentGuess: () => set({ currentGuess: '' }),
  startGame: () => set({ gameActive: true, guesses: [], currentGuess: '', gameOver: false, winner: null, word: null }),
  endGame: (winner, word) => set({ gameOver: true, gameActive: false, winner, word }),
  reset: () => set({ roomCode: null, gameActive: false, word: null, guesses: [], currentGuess: '', gameOver: false, winner: null, players: [], myStats: null, startTime: null }),
}));

export default useGameStore;
