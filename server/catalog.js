import { createHash } from 'node:crypto';
import { DATA_VERSION, movies, dayKey } from './game.js';

export function createCatalogStore(db) {
  db.prepare('INSERT OR IGNORE INTO movie_catalogs VALUES (?, ?, ?, ?, ?)').run(
    DATA_VERSION,
    Date.now(),
    'curated',
    movies.length,
    JSON.stringify(movies),
  );
  const cache = new Map();
  const setting = (key) =>
    db.prepare('SELECT value FROM catalog_settings WHERE key=?').get(key)?.value;
  function byVersion(version = DATA_VERSION) {
    if (!cache.has(version)) {
      const row = db.prepare('SELECT * FROM movie_catalogs WHERE version=?').get(version);
      if (!row) throw new Error('The saved movie catalog could not be found.');
      if (cache.size >= 4) cache.delete(cache.keys().next().value);
      cache.set(version, {
        version,
        source: row.source,
        created: row.created,
        movies: JSON.parse(row.payload),
      });
    }
    return cache.get(version);
  }
  const current = () => byVersion(setting('current') || DATA_VERSION);
  let posterVersion, posters;
  const titleKey = (movie) =>
    `${movie.year}:${movie.title
      .toLowerCase()
      .replace(/[’']/g, '')
      .replace('sorcerers', 'philosophers')
      .replace(/[^\p{L}\p{N}]/gu, '')}`;
  function posterFor(movie) {
    const latest = current();
    if (posterVersion !== latest.version) {
      posterVersion = latest.version;
      posters = new Map(
        latest.movies.filter((m) => m.posterUrl).map((m) => [titleKey(m), m.posterUrl]),
      );
    }
    return posters.get(titleKey(movie)) || null;
  }
  function forNewGame(mode, now = Date.now()) {
    if (mode !== 'daily') return current();
    const day = dayKey(now);
    let row = db.prepare('SELECT version FROM daily_catalogs WHERE day=?').get(day);
    if (!row) {
      // Preserve the challenge already dealt before this schema was introduced.
      const existing = db
        .prepare("SELECT state FROM games WHERE mode='daily' AND day=? LIMIT 1")
        .get(day);
      const version = existing ? JSON.parse(existing.state).version : current().version;
      db.prepare('INSERT OR IGNORE INTO daily_catalogs VALUES (?, ?)').run(day, version);
      row = db.prepare('SELECT version FROM daily_catalogs WHERE day=?').get(day);
    }
    return byVersion(row.version);
  }
  function publish(records, now = Date.now()) {
    if (records.length < 2 || new Set(records.map((m) => m.id)).size !== records.length)
      throw new Error('The catalog needs at least two unique playable movies.');
    const payload = JSON.stringify(records);
    const version = `tmdb-${createHash('sha256').update(payload).digest('hex').slice(0, 16)}`;
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('INSERT OR IGNORE INTO movie_catalogs VALUES (?, ?, ?, ?, ?)').run(
        version,
        now,
        'tmdb',
        records.length,
        payload,
      );
      db.prepare(
        "INSERT INTO catalog_settings VALUES ('current', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      ).run(version);
      db.prepare(
        "INSERT INTO catalog_settings VALUES ('lastSync', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      ).run(String(now));
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    return byVersion(version);
  }
  return {
    current,
    byVersion,
    forNewGame,
    publish,
    posterFor,
    lastSync: () => Number(setting('lastSync') || 0),
  };
}
