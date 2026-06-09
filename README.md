# WordBattle

Multiplayer Wordle — play in real-time with friends.

## Local Setup

1. Clone the repo
2. Install dependencies: `npm install`
3. Create `server/.env` (see server/.env.example)
4. Create `client/.env` (see client/.env.example)
5. Run DB migrations + seed: `npm run seed`
6. Start dev servers: `npm run dev`

Frontend: http://localhost:5173  
Backend:  http://localhost:3001

## Environment Variables

### Server
| Variable | Description |
|---|---|
| DATABASE_URL | PostgreSQL connection string |
| JWT_SECRET | Secret for access tokens |
| JWT_REFRESH_SECRET | Secret for refresh tokens |
| PORT | Server port (default 3001) |
| CLIENT_URL | Frontend URL for CORS |

### Client
| Variable | Description |
|---|---|
| VITE_API_URL | Backend API base URL |
| VITE_SOCKET_URL | Backend Socket.io URL |

## Railway Deploy

1. Create a Railway project
2. Add a PostgreSQL service — copy the DATABASE_URL
3. Set all server env vars in Railway dashboard
4. Connect your GitHub repo
5. Railway auto-deploys on push to main

## Socket Events

### Client → Server
| Event | Payload | Description |
|---|---|---|
| join-room | { roomCode } | Join a room |
| player-ready | { roomCode } | Mark self as ready |
| submit-guess | { roomCode, guess } | Submit a 5-letter guess |
| leave-room | { roomCode } | Leave current room |
| force-start | { roomCode } | Host force-starts game |

### Server → Client
| Event | Payload | Description |
|---|---|---|
| room-state | { players, status, language } | Full room state on join |
| player-joined | { userId, username } | Someone joined |
| player-left | { userId, username } | Someone left |
| player-ready-update | { userId, readyCount, total } | Ready status changed |
| game-start | { wordLength, language, startTime } | Game begins |
| guess-result | { playerId, result, attemptNumber } | A player submitted a guess |
| player-solved | { playerId, username, solveTime, attemptsCount } | A player won |
| game-over | { winner, word, allResults } | Game ended |
