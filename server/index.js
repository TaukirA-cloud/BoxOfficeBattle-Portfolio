import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { openDatabase } from './db.js';
import {
  token,
  digest,
  hashPassword,
  verifyPassword,
  validateCredentials,
  createLimiter,
} from './security.js';
import {
  createGame as makeGame,
  viewGame as presentGame,
  answerGame as answer,
  nextRound,
  achievementRules,
  genres,
  dayKey,
  publicMovie,
} from './game.js';
import { createCatalogStore } from './catalog.js';
import { importTmdbCatalog, movieLimit } from './tmdb.js';
import { publicPages, renderPublicPage } from './pages.js';
import { playerRewards } from './rewards.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const staticFiles = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/reading.css', ['reading.css', 'text/css; charset=utf-8']],
  ['/ads.txt', ['ads.txt', 'text/plain; charset=utf-8']],
  ['/icon.svg', ['icon.svg', 'image/svg+xml']],
  ['/icon-192.png', ['icon-192.png', 'image/png']],
  ['/icon-512.png', ['icon-512.png', 'image/png']],
  ['/manifest.webmanifest', ['manifest.webmanifest', 'application/manifest+json']],
  ['/sw.js', ['sw.js', 'text/javascript; charset=utf-8']],
  ['/offline.html', ['offline.html', 'text/html; charset=utf-8']],
  ['/robots.txt', ['robots.txt', 'text/plain']],
]);
const fail = (status, message) => {
  const error = new Error(message);
  error.status = status;
  throw error;
};

export function createApplication({
  database = process.env.DATABASE_PATH || join(root, 'var/battle.sqlite'),
  origin = process.env.APP_ORIGIN,
  production = process.env.NODE_ENV === 'production',
  quiet = false,
  metricsToken = process.env.METRICS_TOKEN,
  trustProxy = process.env.TRUST_PROXY === '1',
  tmdbToken = process.env.TMDB_READ_ACCESS_TOKEN,
  autoSync = false,
  tmdbClient,
  adsenseEnabled = process.env.ADSENSE_ENABLED === '1',
  adsenseSlot = process.env.ADSENSE_SLOT || '',
} = {}) {
  if (production && (!origin || !origin.startsWith('https://')))
    throw new Error('Production requires an HTTPS APP_ORIGIN.');
  const db = openDatabase(database);
  const catalog = createCatalogStore(db);
  const createGame = (mode, genre, now = Date.now()) =>
    makeGame(mode, genre, now, catalog.forNewGame(mode, now));
  const viewGame = (game, now = Date.now()) => {
    const result = presentGame(game, now, catalog.byVersion(game.version));
    for (const side of ['left', 'right'])
      result[side].posterUrl ||= catalog.posterFor(result[side]);
    return result;
  };
  const answerGame = (game, direction, round, now = Date.now()) =>
    answer(game, direction, round, now, catalog.byVersion(game.version));
  const importAbort = new AbortController();
  let importing = false,
    importError = false,
    importProgress = null;
  async function syncCatalog({ force = false } = {}) {
    if (
      importing ||
      (!tmdbToken && !tmdbClient) ||
      (!force && catalog.lastSync() > Date.now() - 7 * 86400000)
    )
      return;
    importing = true;
    importError = false;
    try {
      const result = await importTmdbCatalog({
        db,
        store: catalog,
        token: tmdbToken,
        client: tmdbClient,
        limit: movieLimit(process.env.TMDB_MAX_MOVIES),
        signal: importAbort.signal,
        onProgress: (progress) => {
          importProgress = progress;
          if (!quiet)
            console.log(JSON.stringify({ event: 'movie-import-progress', ...progress }));
        },
      });
      if (!quiet)
        console.log(JSON.stringify({ event: 'movie-import-complete', ...result }));
      return result;
    } catch (error) {
      if (!importAbort.signal.aborted) {
        importError = true;
        if (!quiet)
          console.error(
            JSON.stringify({ event: 'movie-import-failed', error: error.message }),
          );
      }
    } finally {
      importing = false;
    }
  }
  function catalogInfo() {
    const current = catalog.current();
    return {
      version: current.version,
      source: current.source,
      count: current.movies.length,
      configured: Boolean(tmdbToken || tmdbClient),
      status: importing
        ? 'syncing'
        : importError
          ? 'error'
          : current.source === 'tmdb'
            ? 'ready'
            : 'fallback',
      lastSync: catalog.lastSync() || null,
      progress: importing ? importProgress : null,
    };
  }
  const apiLimit = createLimiter(240, 60000);
  const authLimit = createLimiter(12, 15 * 60000);
  const gameLimit = createLimiter(30, 60000);
  const sessionLimit = createLimiter(40, 60000);
  const sessionDuration = 30 * 86400000;
  const cookieName = production ? '__Host-bob' : 'bob';
  let requests = 0,
    errors = 0,
    authInFlight = 0;
  const started = Date.now();

  function json(res, status, data) {
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    res.end(JSON.stringify(data));
  }
  function setSession(res, userId) {
    const value = token();
    db.prepare('INSERT INTO sessions VALUES (?, ?, ?)').run(
      digest(value),
      userId,
      Date.now() + sessionDuration,
    );
    res.setHeader(
      'Set-Cookie',
      `${cookieName}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000${production ? '; Secure' : ''}`,
    );
  }
  function getUser(req, res, ip) {
    const value = (req.headers.cookie || '')
      .split(';')
      .map((v) => v.trim())
      .find((v) => v.startsWith(`${cookieName}=`))
      ?.slice(cookieName.length + 1);
    let user =
      value &&
      db
        .prepare(
          'SELECT users.* FROM users JOIN sessions ON sessions.user_id=users.id WHERE sessions.token=? AND sessions.expires>?',
        )
        .get(digest(value), Date.now());
    if (!user) {
      if (!sessionLimit(ip))
        fail(429, 'Too many new sessions. Please try again in a minute.');
      const id = randomUUID();
      db.prepare('INSERT INTO users(id, created) VALUES (?, ?)').run(id, Date.now());
      setSession(res, id);
      user = db.prepare('SELECT * FROM users WHERE id=?').get(id);
    }
    return user;
  }
  function stats(userId) {
    const rows = db
      .prepare('SELECT * FROM games WHERE user_id=? ORDER BY updated DESC')
      .all(userId);
    const states = rows.map((row) => ({ ...row, game: JSON.parse(row.state) }));
    const answers = states.flatMap((row) => row.game.answers);
    const correct = answers.filter((a) => a.correct).length;
    const best = Math.max(
      0,
      ...states.filter((r) => ['classic', 'rush'].includes(r.mode)).map((r) => r.score),
    );
    const daily = states.filter((r) => r.mode === 'daily' && r.finished);
    const fields = {
      correct,
      best,
      dailies: daily.length,
      perfect: daily.some((r) => r.score === 10) ? 1 : 0,
    };
    const xp =
      correct * 25 +
      states.filter((r) => r.finished && !r.game.abandoned && r.game.answers.length)
        .length *
        50;
    return {
      ...fields,
      total: answers.length,
      xp,
      level: Math.floor(Math.sqrt(xp / 100)) + 1,
      accuracy: answers.length ? Math.round((correct / answers.length) * 100) : 0,
      games: rows.length,
      achievements: achievementRules.map((rule) => ({
        ...rule,
        progress: Math.min(fields[rule.field], rule.target),
        unlocked: fields[rule.field] >= rule.target,
      })),
      history: states.slice(0, 12).map((r) => ({
        id: r.id,
        mode: r.mode,
        score: r.score,
        total: r.game.answers.length,
        finished: Boolean(r.finished),
        day: r.day,
      })),
    };
  }
  function profile(user) {
    const playerStats = stats(user.id);
    const cosmetics = db
      .prepare('SELECT title, theme FROM player_cosmetics WHERE user_id=?')
      .get(user.id);
    const daily = db
      .prepare(
        "SELECT id, finished, score FROM games WHERE user_id=? AND mode='daily' AND day=?",
      )
      .get(user.id, dayKey());
    return {
      username: user.username,
      registered: Boolean(user.password),
      stats: playerStats,
      ...playerRewards(playerStats, cosmetics),
      daily: daily || null,
    };
  }
  function gameRow(userId, id) {
    if (typeof id !== 'string') fail(400, 'A game ID is required.');
    const row = db
      .prepare('SELECT * FROM games WHERE id=? AND user_id=?')
      .get(id, userId);
    if (!row) fail(404, 'This game could not be found.');
    return row;
  }
  function saveGame(id, game) {
    db.prepare('UPDATE games SET state=?, score=?, finished=?, updated=? WHERE id=?').run(
      JSON.stringify(game),
      game.score,
      game.phase === 'finished' ? 1 : 0,
      Date.now(),
      id,
    );
  }
  const gameResponse = (row) => ({
    id: row.id,
    ...viewGame(JSON.parse(row.state)),
  });
  async function body(req) {
    if (!req.headers['content-type']?.startsWith('application/json'))
      fail(415, 'Send application/json.');
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 8192) fail(413, 'The request is too large.');
      chunks.push(chunk);
    }
    try {
      const parsed = JSON.parse(Buffer.concat(chunks).toString() || '{}');
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
        fail(400, 'Send a JSON object.');
      return parsed;
    } catch {
      fail(400, 'The request is not valid JSON.');
    }
  }

  const server = createServer(async (req, res) => {
    const requestId = randomUUID();
    const scriptNonce = randomBytes(16).toString('base64');
    const url = new URL(req.url, 'http://localhost');
    const showAds =
      adsenseEnabled &&
      /^\d{10}$/.test(adsenseSlot) &&
      publicPages.get(url.pathname)?.adEligible === true;
    const time = Date.now();
    requests++;
    res.setHeader('X-Request-ID', requestId);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader(
      'Content-Security-Policy',
      // Only explicit editorial ad placements get the Google-compatible policy.
      showAds
        ? `default-src 'self'; script-src 'nonce-${scriptNonce}' 'unsafe-inline' 'unsafe-eval' 'strict-dynamic' https:; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:; frame-src https:; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'; worker-src 'self'`
        : `default-src 'self'; script-src 'nonce-${scriptNonce}' 'strict-dynamic'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://image.tmdb.org https://www.themoviedb.org; connect-src 'self'; frame-src 'none'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'; worker-src 'self'`,
    );
    if (production) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
    // Enable only behind a private reverse proxy that REPLACES this header.
    const ip =
      (trustProxy ? req.headers['x-forwarded-for']?.split(',')[0]?.trim() : null) ||
      req.socket.remoteAddress ||
      'unknown';
    if (!quiet)
      res.on('finish', () =>
        console.log(
          JSON.stringify({
            requestId,
            method: req.method,
            path: url.pathname,
            status: res.statusCode,
            durationMs: Date.now() - time,
          }),
        ),
      );
    try {
      if (url.pathname === '/healthz' && req.method === 'GET') {
        db.prepare('SELECT 1').get();
        return json(res, 200, {
          status: 'ok',
          version: '2.0.0',
          uptimeSeconds: Math.floor((Date.now() - started) / 1000),
        });
      }
      if (url.pathname === '/internal/metrics' && req.method === 'GET') {
        if (!metricsToken || req.headers.authorization !== `Bearer ${metricsToken}`)
          fail(404, 'Page not found.');
        return json(res, 200, {
          requests,
          errors,
          uptimeSeconds: Math.floor((Date.now() - started) / 1000),
          memory: process.memoryUsage(),
          players: db
            .prepare('SELECT COUNT(*) AS n FROM users WHERE username IS NOT NULL')
            .get().n,
          games: db.prepare('SELECT COUNT(*) AS n FROM games').get().n,
        });
      }
      if (!url.pathname.startsWith('/api/')) {
        if (!['GET', 'HEAD'].includes(req.method)) fail(405, 'Method not allowed.');
        const siteOrigin = origin ? new URL(origin).origin : null;
        if (url.pathname === '/sitemap.xml') {
          // Never build public URLs from the untrusted Host request header.
          if (!siteOrigin) fail(503, 'Set APP_ORIGIN to publish the sitemap.');
          const paths = ['/', ...publicPages.keys()];
          const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((path) => `<url><loc>${siteOrigin}${path}</loc></url>`).join('')}</urlset>`;
          res.writeHead(200, { 'Content-Type': 'application/xml; charset=utf-8' });
          return res.end(req.method === 'HEAD' ? undefined : xml);
        }
        if (publicPages.has(url.pathname)) {
          const html = renderPublicPage(url.pathname, {
            nonce: scriptNonce,
            origin: siteOrigin,
            adsenseSlot: showAds ? adsenseSlot : '',
          });
          res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
          });
          return res.end(req.method === 'HEAD' ? undefined : html);
        }
        const entry = staticFiles.get(url.pathname);
        if (!entry) fail(404, 'Page not found.');
        let content = await readFile(join(root, entry[0]));
        const isApplicationPage = entry[0] === 'index.html';
        if (isApplicationPage)
          content = content.toString('utf8').replaceAll('__CSP_NONCE__', scriptNonce);
        if (entry[0] === 'robots.txt' && siteOrigin)
          content = `${content.toString('utf8').trimEnd()}\nSitemap: ${siteOrigin}/sitemap.xml\n`;
        res.writeHead(200, {
          'Content-Type': entry[1],
          'Cache-Control': isApplicationPage
            ? 'no-store'
            : 'public, max-age=0, must-revalidate',
        });
        return res.end(req.method === 'HEAD' ? undefined : content);
      }
      if (!apiLimit(ip)) {
        res.setHeader('Retry-After', '60');
        fail(429, 'Take a short break. Try again in a minute.');
      }
      if (!['GET', 'POST'].includes(req.method)) fail(405, 'Method not allowed.');
      if (req.method === 'POST') {
        const expected = origin || `http://${req.headers.host}`;
        if (
          (req.headers.origin && req.headers.origin !== expected) ||
          req.headers['sec-fetch-site'] === 'cross-site' ||
          req.headers['x-requested-with'] !== 'BoxOfficeBattle'
        )
          fail(403, 'This request must come from the game.');
      }
      const user = getUser(req, res, ip);
      if (req.method === 'GET') {
        if (url.pathname === '/api/me')
          return json(res, 200, {
            ...profile(user),
            genres,
            day: dayKey(),
            dataVersion: catalog.current().version,
            catalog: catalogInfo(),
          });
        if (url.pathname === '/api/catalog') return json(res, 200, catalogInfo());
        if (url.pathname === '/api/collection') {
          const current = catalog.current();
          const query = (url.searchParams.get('q') || '')
            .slice(0, 100)
            .toLowerCase()
            .trim();
          const genre = url.searchParams.get('genre') || 'All movies';
          if (!genres.includes(genre)) fail(400, 'Choose a valid genre.');
          const favorites = url.searchParams.has('favorites')
            ? new Set(url.searchParams.get('favorites').split(',').slice(0, 500))
            : null;
          const filtered = current.movies
            .filter(
              (m) =>
                `${m.title} ${m.year} ${m.genre}`.toLowerCase().includes(query) &&
                (genre === 'All movies' || m.genre.includes(genre)) &&
                (!favorites || favorites.has(String(m.id))),
            )
            .sort((a, b) => a.title.localeCompare(b.title));
          const limit = Math.max(
            1,
            Math.min(60, Number.parseInt(url.searchParams.get('limit'), 10) || 24),
          );
          const totalPages = Math.max(1, Math.ceil(filtered.length / limit));
          const page = Math.max(
            1,
            Math.min(totalPages, Number.parseInt(url.searchParams.get('page'), 10) || 1),
          );
          return json(res, 200, {
            movies: filtered.slice((page - 1) * limit, page * limit).map(publicMovie),
            total: filtered.length,
            page,
            totalPages,
            version: current.version,
            catalog: catalogInfo(),
          });
        }
        if (url.pathname === '/api/game') {
          const row = url.searchParams.has('id')
            ? gameRow(user.id, url.searchParams.get('id'))
            : db
                .prepare(
                  'SELECT * FROM games WHERE user_id=? ORDER BY updated DESC LIMIT 1',
                )
                .get(user.id);
          return json(res, 200, { game: row ? gameResponse(row) : null });
        }
        if (url.pathname === '/api/leaderboard') {
          const mode = ['classic', 'daily', 'rush'].includes(url.searchParams.get('mode'))
            ? url.searchParams.get('mode')
            : 'classic';
          const rows = db
            .prepare(
              `SELECT u.username, MAX(g.score) AS score, MIN(g.updated) AS achieved FROM games g JOIN users u ON u.id=g.user_id WHERE g.mode=? AND g.finished=1 AND u.username IS NOT NULL AND COALESCE(json_extract(g.state, '$.genre'), 'All movies')='All movies' ${mode === 'daily' ? 'AND g.day=?' : ''} GROUP BY u.id ORDER BY score DESC, achieved ASC LIMIT 50`,
            )
            .all(...(mode === 'daily' ? [mode, dayKey()] : [mode]));
          return json(res, 200, {
            mode,
            day: dayKey(),
            rows: rows.map((r, i) => ({
              rank: i + 1,
              username: r.username,
              score: r.score,
              you: r.username === user.username,
            })),
          });
        }
        if (url.pathname === '/api/export') {
          res.setHeader(
            'Content-Disposition',
            'attachment; filename="boxoffice-battle-data.json"',
          );
          return json(res, 200, {
            player: { username: user.username, created: user.created },
            cosmetics: profile(user).equipped,
            stats: stats(user.id),
            games: db
              .prepare('SELECT id, state, created FROM games WHERE user_id=?')
              .all(user.id)
              .map((row) => ({
                id: row.id,
                created: row.created,
                ...viewGame(JSON.parse(row.state)),
              })),
          });
        }
        fail(404, 'Endpoint not found.');
      }
      const input = await body(req);
      if (url.pathname === '/api/rewards/equip') {
        if (!['title', 'theme'].includes(input.kind) || typeof input.id !== 'string')
          fail(400, 'Choose a valid reward.');
        const current = profile(user);
        const reward = current.rewards.find(
          (r) => r.id === input.id && r.kind === input.kind,
        );
        if (!reward?.unlocked) fail(403, 'Earn this reward before equipping it.');
        const title = input.kind === 'title' ? reward.id : current.equipped.title.id;
        const theme = input.kind === 'theme' ? reward.id : current.equipped.theme.id;
        db.prepare(
          'INSERT INTO player_cosmetics (user_id,title,theme) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET title=excluded.title, theme=excluded.theme',
        ).run(user.id, title, theme);
        return json(res, 200, profile(user));
      }
      if (url.pathname.startsWith('/api/auth/')) {
        if (!authLimit(ip))
          fail(429, 'Too many account attempts. Try again in 15 minutes.');
        if (authInFlight >= 4)
          fail(503, 'Account service is busy. Please retry shortly.');
        authInFlight++;
        try {
          if (url.pathname === '/api/auth/register') {
            validateCredentials(input.username, input.password);
            if (user.password) fail(409, 'You are already signed in.');
            if (db.prepare('SELECT id FROM users WHERE username=?').get(input.username))
              fail(409, 'That player name is taken.');
            const password = await hashPassword(input.password);
            const recoveryCode = token();
            // Recheck after hashing: another registration can complete while scrypt runs.
            if (db.prepare('SELECT id FROM users WHERE username=?').get(input.username))
              fail(409, 'That player name is taken.');
            const registration = db
              .prepare(
                'UPDATE users SET username=?, password=?, recovery=? WHERE id=? AND password IS NULL',
              )
              .run(input.username, password, digest(recoveryCode), user.id);
            if (!registration.changes)
              fail(409, 'This guest has already become an account. Sign in to continue.');
            db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);
            setSession(res, user.id);
            return json(res, 201, {
              ...profile(db.prepare('SELECT * FROM users WHERE id=?').get(user.id)),
              recoveryCode,
            });
          }
          if (url.pathname === '/api/auth/login') {
            validateCredentials(input.username, input.password);
            const account = db
              .prepare('SELECT * FROM users WHERE username=?')
              .get(input.username);
            if (!(await verifyPassword(input.password, account?.password)))
              fail(401, 'Player name or password is incorrect.');
            if (
              db.prepare('SELECT password FROM users WHERE id=?').get(account.id)
                ?.password !== account.password
            )
              fail(401, 'Your credentials changed. Please sign in again.');
            // Revoke this browser's previous session without revoking other devices.
            const old = (req.headers.cookie || '')
              .split(';')
              .map((v) => v.trim())
              .find((v) => v.startsWith(`${cookieName}=`))
              ?.slice(cookieName.length + 1);
            if (old) db.prepare('DELETE FROM sessions WHERE token=?').run(digest(old));
            setSession(res, account.id);
            return json(res, 200, profile(account));
          }
          if (url.pathname === '/api/auth/recover') {
            validateCredentials(input.username, input.password);
            if (typeof input.code !== 'string' || input.code.length !== 64)
              fail(400, 'Enter your 64-character recovery code.');
            const account = db
              .prepare('SELECT * FROM users WHERE username=? AND recovery=?')
              .get(input.username, digest(input.code));
            if (!account) fail(401, 'Player name or recovery code is incorrect.');
            const password = await hashPassword(input.password);
            const recoveryCode = token();
            const result = db
              .prepare(
                'UPDATE users SET password=?, recovery=? WHERE id=? AND recovery=?',
              )
              .run(password, digest(recoveryCode), account.id, digest(input.code));
            if (!result.changes) fail(409, 'This recovery code has already been used.');
            db.prepare('DELETE FROM sessions WHERE user_id=?').run(account.id);
            setSession(res, account.id);
            return json(res, 200, { ...profile(account), recoveryCode });
          }
          if (url.pathname === '/api/auth/logout') {
            const old = (req.headers.cookie || '')
              .split(';')
              .map((v) => v.trim())
              .find((v) => v.startsWith(`${cookieName}=`))
              ?.slice(cookieName.length + 1);
            if (old) db.prepare('DELETE FROM sessions WHERE token=?').run(digest(old));
            res.setHeader(
              'Set-Cookie',
              `${cookieName}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${production ? '; Secure' : ''}`,
            );
            return json(res, 200, { ok: true });
          }
        } finally {
          authInFlight--;
        }
      }
      if (url.pathname === '/api/account/delete') {
        if (!authLimit(ip))
          fail(429, 'Too many account attempts. Try again in 15 minutes.');
        if (authInFlight >= 4)
          fail(503, 'Account service is busy. Please retry shortly.');
        authInFlight++;
        try {
          if (
            user.password &&
            (typeof input.password !== 'string' ||
              input.password.length > 128 ||
              !(await verifyPassword(input.password, user.password)))
          )
            fail(401, 'Enter your current password to delete your account.');
          const deleted = db
            .prepare('DELETE FROM users WHERE id=? AND password IS ?')
            .run(user.id, user.password);
          if (!deleted.changes)
            fail(409, 'Your account changed. Please sign in again before deleting it.');
        } finally {
          authInFlight--;
        }
        res.setHeader(
          'Set-Cookie',
          `${cookieName}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${production ? '; Secure' : ''}`,
        );
        return json(res, 200, { ok: true });
      }
      if (url.pathname === '/api/games') {
        if (!gameLimit(user.id)) fail(429, 'Too many new games. Try again in a minute.');
        if (input.mode === 'daily') {
          const existing = db
            .prepare("SELECT * FROM games WHERE user_id=? AND mode='daily' AND day=?")
            .get(user.id, dayKey());
          if (existing) return json(res, 200, gameResponse(existing));
        }
        const game = createGame(input.mode, input.genre);
        // Retire previous non-daily games so there is a single resumable run.
        const active = db
          .prepare("SELECT * FROM games WHERE user_id=? AND finished=0 AND mode!='daily'")
          .all(user.id);
        for (const row of active) {
          const state = JSON.parse(row.state);
          state.phase = 'finished';
          state.abandoned = true;
          saveGame(row.id, state);
        }
        const id = randomUUID();
        db.prepare('INSERT INTO games VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
          id,
          user.id,
          game.mode,
          game.day,
          JSON.stringify(game),
          0,
          0,
          Date.now(),
          Date.now(),
        );
        return json(res, 201, { id, ...viewGame(game) });
      }
      if (
        url.pathname === '/api/games/answer' ||
        url.pathname === '/api/games/next' ||
        url.pathname === '/api/games/end'
      ) {
        const row = gameRow(user.id, input.id);
        const game = JSON.parse(row.state);
        if (url.pathname.endsWith('/answer'))
          answerGame(game, input.direction, input.round);
        else if (url.pathname.endsWith('/end')) {
          if (game.phase !== 'finished') {
            game.phase = 'finished';
            game.abandoned = true;
          }
        } else nextRound(game);
        saveGame(row.id, game);
        return json(res, 200, {
          id: row.id,
          ...viewGame(game),
          profile: profile(user),
        });
      }
      fail(404, 'Endpoint not found.');
    } catch (error) {
      const status =
        error.status || (error.message?.match(/Choose|round|timer|Reveal/) ? 400 : 500);
      if (status >= 500) {
        errors++;
        if (!quiet)
          console.error(
            JSON.stringify({
              requestId,
              error: error.message,
              requests,
              errors,
            }),
          );
      }
      if (!res.headersSent)
        json(res, status, {
          error:
            status >= 500 ? 'Something went wrong. Please try again.' : error.message,
          requestId,
        });
      else res.end();
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.keepAliveTimeout = 5000;
  const cleanup = setInterval(() => {
    db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());
    db.prepare(
      'DELETE FROM users WHERE username IS NULL AND created<? AND id NOT IN (SELECT user_id FROM sessions)',
    ).run(Date.now() - sessionDuration);
  }, 3600000);
  cleanup.unref();
  const refreshMovies =
    autoSync && (tmdbToken || tmdbClient)
      ? setInterval(() => {
          void syncCatalog();
        }, 6 * 3600000)
      : null;
  refreshMovies?.unref();
  if (autoSync)
    server.once('listening', () => {
      void syncCatalog();
    });
  server.on('close', () => {
    importAbort.abort();
    if (refreshMovies) clearInterval(refreshMovies);
    clearInterval(cleanup);
    db.close();
  });
  return { server, db, catalog, syncCatalog };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { server } = createApplication({ autoSync: true });
  const port = Number(process.env.PORT || 3000);
  server.listen(port, process.env.HOST || '127.0.0.1', () =>
    console.log(`BoxOffice Battle: http://${process.env.HOST || '127.0.0.1'}:${port}`),
  );
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.on(signal, () => server.close(() => process.exit(0)));
}
