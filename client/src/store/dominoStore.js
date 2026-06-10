import { create } from 'zustand';

const useDominoStore = create((set) => ({
  myHand: [],
  board: [],
  leftEnd: null,
  rightEnd: null,
  currentPlayer: null,
  players: [],
  scores: { team1: 0, team2: 0 },
  roundNumber: 1,
  myTeam: null,
  forcedFirstTile: null,
  phase: 'loading',

  initRound: (data) => set({
    myHand: data.hand || [],
    board: data.board || [],
    leftEnd: data.leftEnd ?? null,
    rightEnd: data.rightEnd ?? null,
    currentPlayer: data.currentPlayer,
    players: data.players || [],
    scores: data.scores || { team1: 0, team2: 0 },
    roundNumber: data.roundNumber || 1,
    myTeam: data.myTeam ?? null,
    forcedFirstTile: data.forcedFirstTile || null,
    phase: 'playing',
  }),

  // Called when a new round starts (rounds 2+): common data without hand
  newRound: (data) => set((s) => ({
    board: [],
    leftEnd: null,
    rightEnd: null,
    currentPlayer: data.currentPlayer,
    players: data.players || s.players,
    scores: data.scores || s.scores,
    roundNumber: data.roundNumber || s.roundNumber,
    forcedFirstTile: data.forcedFirstTile || null,
    phase: 'playing',
  })),

  setHand: (hand) => set({ myHand: hand }),
  updateBoard: (board, leftEnd, rightEnd) => set({ board, leftEnd, rightEnd }),
  setCurrentPlayer: (p) => set({ currentPlayer: p }),
  setPlayers: (players) => set({ players }),
  setScores: (scores) => set({ scores }),
  removeFromHand: (tileId) => set((s) => ({ myHand: s.myHand.filter((t) => t.id !== tileId) })),
  setPhase: (phase) => set({ phase }),

  reset: () => set({
    myHand: [], board: [], leftEnd: null, rightEnd: null,
    currentPlayer: null, players: [], scores: { team1: 0, team2: 0 },
    roundNumber: 1, myTeam: null, forcedFirstTile: null, phase: 'loading',
  }),
}));

export default useDominoStore;
