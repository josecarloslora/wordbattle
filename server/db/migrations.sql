CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(30) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  avatar_color VARCHAR(7) NOT NULL DEFAULT '#6366f1',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_stats (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  best_streak INTEGER DEFAULT 0,
  total_games INTEGER DEFAULT 0,
  avg_attempts DECIMAL(4,2) DEFAULT 0,
  avg_time_seconds INTEGER DEFAULT 0,
  guess_distribution JSONB DEFAULT '{"1":0,"2":0,"3":0,"4":0,"5":0,"6":0}'
);

CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(6) UNIQUE NOT NULL,
  name VARCHAR(50) NOT NULL,
  host_id UUID REFERENCES users(id) ON DELETE SET NULL,
  language VARCHAR(2) NOT NULL DEFAULT 'es',
  max_players INTEGER DEFAULT 4,
  is_public BOOLEAN DEFAULT TRUE,
  status VARCHAR(20) DEFAULT 'waiting',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS room_members (
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (room_id, user_id)
);

CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  word VARCHAR(10) NOT NULL,
  language VARCHAR(2) NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  winner_id UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS game_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  attempts JSONB DEFAULT '[]',
  solved BOOLEAN DEFAULT FALSE,
  solve_time_seconds INTEGER,
  attempts_count INTEGER DEFAULT 0,
  joined_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS words (
  id SERIAL PRIMARY KEY,
  word VARCHAR(10) NOT NULL,
  language VARCHAR(2) NOT NULL,
  UNIQUE(word, language)
);

CREATE INDEX IF NOT EXISTS idx_words_language ON words(language);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
CREATE INDEX IF NOT EXISTS idx_rooms_public ON rooms(is_public);
CREATE INDEX IF NOT EXISTS idx_game_participants_game ON game_participants(game_id);

ALTER TABLE games ADD COLUMN IF NOT EXISTS mode VARCHAR(15) NOT NULL DEFAULT 'multiplayer';
