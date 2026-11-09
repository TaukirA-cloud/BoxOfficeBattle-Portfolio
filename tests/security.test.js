import test from 'node:test';
import assert from 'node:assert/strict';
import { createApplication } from '../server/index.js';
import { createLimiter } from '../server/security.js';
import { mkdtempSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync, backup } from 'node:sqlite';

test('rate limiter rejects excess attempts and keeps separate clients independent', () => {
  const limit = createLimiter(2, 60000);
  assert(limit('a'));
  assert(limit('a'));
  assert(!limit('a'));
  assert(limit('b'));
});

test('concurrent registration cannot overwrite an account created by another tab', async (t) => {
  const { server, db } = createApplication({ database: ':memory:', quiet: true });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => {
    server.closeAllConnections();
    return new Promise((resolve) => server.close(resolve));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const first = await fetch(base + '/api/me');
  await first.json();
  const cookie = first.headers.get('set-cookie').split(';')[0];
  const register = async (username) => {
    const response = await fetch(base + '/api/auth/register', {
      method: 'POST',
      headers: {
        Cookie: cookie,
        Origin: base,
        'Content-Type': 'application/json',
        'X-Requested-With': 'BoxOfficeBattle',
      },
      body: JSON.stringify({ username, password: 'A long race test password' }),
    });
    return { status: response.status, body: await response.json() };
  };
  const results = await Promise.all([
    register('FirstDirector'),
    register('SecondDirector'),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  assert.equal(
    db.prepare('SELECT username FROM users WHERE password IS NOT NULL').get().username,
    results.find((r) => r.status === 201).body.username,
  );
});

test('disk persistence and an online backup preserve account/session/game records', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'bob-persistence-'));
  const database = join(directory, 'battle.sqlite'),
    snapshot = join(directory, 'snapshot.sqlite');
  let app;
  const stop = async () => {
    if (app) {
      app.server.closeAllConnections();
      await new Promise((resolve) => app.server.close(resolve));
      app = null;
    }
  };
  try {
    app = createApplication({ database, quiet: true });
    await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${app.server.address().port}`;
    const guest = await fetch(base + '/api/me');
    await guest.json();
    const cookie = guest.headers.get('set-cookie').split(';')[0];
    const response = await fetch(base + '/api/games', {
      method: 'POST',
      headers: {
        Cookie: cookie,
        Origin: base,
        'Content-Type': 'application/json',
        'X-Requested-With': 'BoxOfficeBattle',
      },
      body: JSON.stringify({ mode: 'daily' }),
    });
    const game = await response.json();
    await backup(app.db, snapshot);
    const restored = new DatabaseSync(snapshot, { readOnly: true });
    assert.equal(restored.prepare('SELECT COUNT(*) AS n FROM games').get().n, 1);
    assert.equal(restored.prepare('SELECT COUNT(*) AS n FROM sessions').get().n, 1);
    restored.close();
    await stop();
    app = createApplication({ database, quiet: true });
    await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve));
    const resumed = await fetch(
      `http://127.0.0.1:${app.server.address().port}/api/game`,
      { headers: { Cookie: cookie } },
    );
    assert.equal((await resumed.json()).game.id, game.id);
  } finally {
    await stop();
    for (const filename of [
      'battle.sqlite',
      'battle.sqlite-wal',
      'battle.sqlite-shm',
      'snapshot.sqlite',
      'snapshot.sqlite-wal',
      'snapshot.sqlite-shm',
    ])
      rmSync(join(directory, filename), { force: true });
    rmdirSync(directory);
  }
});

test('production requires HTTPS origin and metrics are private', async (t) => {
  assert.throws(() =>
    createApplication({
      production: true,
      origin: 'http://example.test',
      database: ':memory:',
    }),
  );
  const { server } = createApplication({
    database: ':memory:',
    production: true,
    origin: 'https://example.test',
    quiet: true,
    metricsToken: 'test-only-metrics-token',
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => {
    server.closeAllConnections();
    return new Promise((resolve) => server.close(resolve));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const response = await fetch(base + '/api/me');
  await response.json();
  assert.match(response.headers.get('set-cookie'), /__Host-bob=.*Secure/);
  assert.match(response.headers.get('strict-transport-security'), /max-age/);
  const denied = await fetch(base + '/internal/metrics');
  await denied.json();
  assert.equal(denied.status, 404);
  const allowed = await fetch(base + '/internal/metrics', {
    headers: { Authorization: 'Bearer test-only-metrics-token' },
  });
  assert.equal(allowed.status, 200);
  assert.equal((await allowed.json()).players, 0);
});
