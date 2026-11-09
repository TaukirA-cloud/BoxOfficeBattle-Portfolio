import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTmdbClient,
  normalizeMovie,
  importTmdbCatalog,
  movieLimit,
} from '../server/tmdb.js';
import { createCatalogStore } from '../server/catalog.js';
import { openDatabase } from '../server/db.js';
import { createApplication } from '../server/index.js';
import { createGame, viewGame, answerGame, pair } from '../server/game.js';

const now = Date.parse('2026-11-04T12:00:00Z');
const detail = (id) => ({
  id,
  title: `Test Film ${id}`,
  adult: false,
  revenue: 1000000 + id * 100,
  release_date: '2020-01-01',
  genres: [{ name: 'Science Fiction' }, { name: 'Action' }],
  poster_path: `/poster_${id}.jpg`,
});

test('TMDB records require positive revenue, usable posters, non-adult content, and valid release dates', () => {
  const movie = normalizeMovie(detail(123), now);
  assert.equal(movie.id, 'tmdb:123');
  assert.equal(movie.genre, 'Sci-fi · Action');
  assert.equal(movie.posterUrl, 'https://image.tmdb.org/t/p/w780/poster_123.jpg');
  for (const change of [
    { revenue: 0 },
    { revenue: null },
    { revenue: -1 },
    { revenue: '100000' },
    { adult: true },
    { poster_path: null },
    { poster_path: '/../../evil.jpg' },
    { release_date: '2020-02-31' },
    { release_date: '2030-01-01' },
    { id: -1 },
  ])
    assert.equal(normalizeMovie({ ...detail(123), ...change }, now), null);
  assert.throws(() => movieLimit(100000));
  assert.equal(movieLimit('5000'), 5000);
});

test('the server-only TMDB client retries throttling without leaking the credential', async () => {
  let calls = 0;
  const waits = [];
  const client = createTmdbClient({
    token: 'private-test-token',
    intervalMs: 0,
    wait: async (ms) => waits.push(ms),
    fetchImpl: async (url, options) => {
      assert.equal(options.headers.Authorization, 'Bearer private-test-token');
      assert.equal(url.hostname, 'api.themoviedb.org');
      assert(!url.href.includes('private-test-token'));
      if (++calls === 1)
        return new Response('{}', { status: 429, headers: { 'Retry-After': '2' } });
      return Response.json(detail(123));
    },
  });
  assert.equal((await client.details(123)).id, 123);
  assert.equal(calls, 2);
  assert.deepEqual(waits, [2000]);
  const denied = createTmdbClient({
    token: 'private-test-token',
    intervalMs: 0,
    fetchImpl: async () => new Response('{}', { status: 401 }),
  });
  await assert.rejects(
    denied.details(1),
    (error) =>
      !error.message.includes('private-test-token') && error.message.includes('token'),
  );
});

test('imports paginate, skip unknown revenues, reuse cached details, and retain the last good catalog on failure', async (t) => {
  const db = openDatabase(':memory:');
  t.after(() => db.close());
  const store = createCatalogStore(db);
  let details = 0,
    pages = 0;
  const client = {
    discover: async (page) => {
      pages++;
      return {
        total_pages: 2,
        results: Array.from({ length: 20 }, (_, i) => ({
          id: (page - 1) * 20 + i + 1,
          adult: false,
        })),
      };
    },
    details: async (id) => {
      details++;
      return { ...detail(id), revenue: id <= 4 ? 0 : detail(id).revenue };
    },
  };
  const imported = await importTmdbCatalog({ db, store, client, limit: 20, now });
  assert.equal(imported.count, 20);
  assert.equal(pages, 2);
  assert.equal(details, 24);
  assert(store.current().movies.every((m) => m.gross > 0));
  details = 0;
  await importTmdbCatalog({ db, store, client, limit: 20, now });
  assert.equal(details, 0);
  const version = store.current().version;
  await assert.rejects(
    importTmdbCatalog({
      db,
      store,
      client: {
        discover: async () => {
          throw new Error('offline');
        },
      },
      limit: 20,
      now,
    }),
    /offline/,
  );
  assert.equal(store.current().version, version);
  db.prepare('INSERT INTO catalog_sync_lock VALUES (1, ?, ?)').run(
    'other-import',
    Date.now() + 60000,
  );
  assert.deepEqual(await importTmdbCatalog({ db, store, client, limit: 20, now }), {
    busy: true,
  });
});

test('saved game figures and UTC daily lineups stay immutable when the catalog changes', (t) => {
  const db = openDatabase(':memory:');
  t.after(() => db.close());
  const store = createCatalogStore(db);
  const daily = createGame('daily', undefined, now, store.forNewGame('daily', now));
  const first = store.publish(
    [normalizeMovie(detail(1), now), normalizeMovie(detail(2), now)],
    now,
  );
  const game = createGame('classic', undefined, now, first);
  const before = pair(game, first)[1].gross;
  const changed = first.movies.map((m) => ({ ...m, gross: m.gross + 9000000 }));
  store.publish(changed, now + 1);
  const old = store.byVersion(game.version);
  assert.equal(pair(game, old)[1].gross, before);
  assert.equal(store.forNewGame('daily', now).version, daily.version);
  answerGame(
    game,
    pair(game, old)[1].gross > pair(game, old)[0].gross ? 'higher' : 'lower',
    1,
    now,
    old,
  );
  assert.equal(viewGame(game, now, old).score, 1);
});

test('API supports thousands of movies with bounded pages, searchable genres and stable favorites', async (t) => {
  const { server, catalog } = createApplication({ database: ':memory:', quiet: true });
  catalog.publish(
    Array.from({ length: 2500 }, (_, i) => normalizeMovie(detail(i + 1), now)),
    now,
  );
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => {
    server.closeAllConnections();
    return new Promise((resolve) => server.close(resolve));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const first = await fetch(base + '/api/me');
  const profile = await first.json();
  const cookie = first.headers.get('set-cookie').split(';')[0];
  assert.equal(profile.catalog.count, 2500);
  assert(!JSON.stringify(profile).includes('ACCESS_TOKEN'));
  const response = await fetch(base + '/api/collection?genre=Sci-fi&page=2', {
    headers: { Cookie: cookie },
  });
  const data = await response.json();
  assert.equal(data.movies.length, 24);
  assert.equal(data.total, 2500);
  assert.equal(data.page, 2);
  assert.equal(data.movies[0].gross, undefined);
  assert(data.movies[0].posterUrl);
  const favorites = await fetch(base + '/api/collection?favorites=tmdb%3A123', {
    headers: { Cookie: cookie },
  });
  assert.equal((await favorites.json()).movies[0].id, 'tmdb:123');
  const gameResponse = await fetch(base + '/api/games', {
    method: 'POST',
    headers: {
      Cookie: cookie,
      Origin: base,
      'X-Requested-With': 'BoxOfficeBattle',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ mode: 'classic' }),
  });
  const game = await gameResponse.json();
  assert.equal(game.totalRounds, 2499);
  assert.equal(game.right.gross, undefined);
  assert(game.right.posterUrl);
  const missing = await fetch(base + '/api/collection?q=never-matches', {
    headers: { Cookie: cookie },
  });
  assert.equal((await missing.json()).total, 0);
});
