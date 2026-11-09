import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function openDatabase(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode=WAL;
    PRAGMA foreign_keys=ON;
    PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, username TEXT COLLATE NOCASE UNIQUE,
      password TEXT, recovery TEXT, created INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS player_cosmetics (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL DEFAULT 'newcomer',
      theme TEXT NOT NULL DEFAULT 'gold'
    );
    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      mode TEXT NOT NULL, day TEXT NOT NULL, state TEXT NOT NULL,
      score INTEGER NOT NULL DEFAULT 0, finished INTEGER NOT NULL DEFAULT 0,
      created INTEGER NOT NULL, updated INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS games_user ON games(user_id, updated DESC);
    CREATE INDEX IF NOT EXISTS games_board ON games(mode, day, finished, score DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS daily_once ON games(user_id, day) WHERE mode='daily';
    CREATE INDEX IF NOT EXISTS session_expiry ON sessions(expires);
    CREATE TABLE IF NOT EXISTS movie_catalogs (
      version TEXT PRIMARY KEY, created INTEGER NOT NULL, source TEXT NOT NULL,
      movie_count INTEGER NOT NULL, payload TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS catalog_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS daily_catalogs (
      day TEXT PRIMARY KEY, version TEXT NOT NULL REFERENCES movie_catalogs(version)
    );
    CREATE TABLE IF NOT EXISTS tmdb_details (
      id INTEGER PRIMARY KEY, checked INTEGER NOT NULL, payload TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS catalog_sync_lock (id INTEGER PRIMARY KEY CHECK(id=1), owner TEXT NOT NULL, expires INTEGER NOT NULL);
    PRAGMA user_version=2;
  `);
  return db;
}
