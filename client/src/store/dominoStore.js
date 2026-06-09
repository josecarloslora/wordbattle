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
    leftEnd: data.leftEnd,
    rightEnd: data.rightEnd,
    currentPlayer: data.currentPlayer,
    players: data.players || [],
    scores: data.scores || { team1: 0, team2: 0 },
    roundNumber: data.roundNumber || 1,
    myTeam: data.myTeam,
    forcedFirstTile: data.forcedFirstTile || null,
    phase: 'playing',
  }),

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
