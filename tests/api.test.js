import test from 'node:test';
import assert from 'node:assert/strict';
import { createApplication } from '../server/index.js';
import { movies } from '../server/game.js';
import { publicPages } from '../server/pages.js';

async function setup(t, options = {}) {
  const app = createApplication({
    database: ':memory:',
    quiet: true,
    adsenseEnabled: false,
    ...options,
  });
  await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => app.server.close(resolve)));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  function client() {
    let cookie = '';
    return async (path, data, headers = {}) => {
      const response = await fetch(base + path, {
        method: data === undefined ? 'GET' : 'POST',
        headers: {
          Cookie: cookie,
          Origin: base,
          'Content-Type': 'application/json',
          'X-Requested-With': 'BoxOfficeBattle',
          ...headers,
        },
        ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
      });
      if (response.headers.get('set-cookie'))
        cookie = response.headers.get('set-cookie').split(';')[0];
      return {
        status: response.status,
        headers: response.headers,
        body: response.headers.get('content-type')?.includes('json')
          ? await response.json()
          : await response.text(),
      };
    };
  }
  return { ...app, client, base };
}
const password = 'A long movie password 2026';

test('rewards are earned on the server, can be equipped, and survive registration', async (t) => {
  const { client, db } = await setup(t);
  const request = client();
  const initial = (await request('/api/me')).body;
  assert.equal(initial.equipped.theme.id, 'gold');
  assert.equal(
    (await request('/api/rewards/equip', { kind: 'theme', id: 'mint' })).status,
    403,
  );
  assert.equal(
    (await request('/api/rewards/equip', { kind: 'title', id: 'mint' })).status,
    403,
  );
  const game = (await request('/api/games', { mode: 'classic' })).body;
  const answer = await request('/api/games/answer', {
    id: game.id,
    round: 1,
    direction: direction(game),
  });
  assert.equal(
    answer.body.profile.rewards.find((r) => r.id === 'debut-title').unlocked,
    true,
  );
  const equipped = await request('/api/rewards/equip', {
    kind: 'title',
    id: 'debut-title',
  });
  assert.equal(equipped.status, 200);
  assert.equal(equipped.body.equipped.title.name, 'Opening night star');
  assert.equal((await request('/api/me')).body.equipped.title.id, 'debut-title');
  const account = await request('/api/auth/register', {
    username: 'RewardFan',
    password,
  });
  assert.equal(account.body.equipped.title.id, 'debut-title');
  assert.equal((await client()('/api/me')).body.equipped.title.id, 'newcomer');
  await request('/api/account/delete', { password });
  // Cascading foreign keys keep account reset/deletion from leaving cosmetics behind.
  assert.equal(db.prepare('SELECT count(*) AS n FROM player_cosmetics').get().n, 0);
});

test('genre runs persist their filter and do not enter the all-movies leaderboard', async (t) => {
  const { client } = await setup(t);
  const request = client();
  await request('/api/me');
  await request('/api/auth/register', { username: 'GenreFan', password });
  for (const mode of ['classic', 'rush']) {
    const created = await request('/api/games', { mode, genre: 'Comedy' });
    assert.equal(created.status, 201);
    const game = created.body;
    assert.equal(game.genre, 'Comedy');
    assert.ok(game.left.genre.includes('Comedy'));
    assert.ok(game.right.genre.includes('Comedy'));
    assert.equal((await request('/api/game')).body.game.genre, 'Comedy');
    await request('/api/games/answer', {
      id: game.id,
      round: 1,
      direction: direction(game),
    });
    await request('/api/games/end', { id: game.id });
    assert.deepEqual((await request(`/api/leaderboard?mode=${mode}`)).body.rows, []);
  }
});

test('game pages retain ownership verification without loading ads', async (t) => {
  const { client } = await setup(t);
  const request = client();
  const first = await request('/');
  const second = await request('/index.html');
  const nonces = [];
  for (const response of [first, second]) {
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const policy = response.headers.get('content-security-policy');
    const nonce = policy.match(/'nonce-([^']+)'/)[1];
    nonces.push(nonce);
    assert.ok(policy.includes("'strict-dynamic'"));
    assert.equal(response.body.includes('__CSP_NONCE__'), false);
    const scripts = [...response.body.matchAll(/<script\b[^>]*>/g)];
    assert.equal(scripts.length, 1);
    for (const [script] of scripts) assert.ok(script.includes(`nonce="${nonce}"`));
    assert.ok(response.body.includes('name="google-adsense-account"'));
    assert.ok(response.body.includes('ca-pub-5233222257140990'));
    assert.equal(response.body.includes('adsbygoogle'), false);
  }
  assert.notEqual(nonces[0], nonces[1]);
});

test('public reading pages are server-rendered, linked, and ad-free by default', async (t) => {
  const { client } = await setup(t, { origin: 'https://example.com' });
  const request = client();
  for (const [path, page] of publicPages) {
    const response = await request(path);
    assert.equal(response.status, 200, path);
    assert.ok(response.body.includes(`<h1>${page.title}</h1>`), path);
    assert.ok(response.body.includes(`https://example.com${path}`));
    assert.ok(response.body.includes('href="/guides"'));
    assert.equal(response.body.includes('adsbygoogle'), false);
    assert.equal(response.headers.has('set-cookie'), false);
    for (const [, href] of response.body.matchAll(/href="(\/[^"#]*)"/g)) {
      const target = href.split('#')[0];
      assert.ok(
        ['/', '/icon.svg', '/reading.css'].includes(target) || publicPages.has(target),
        `${path}: ${target}`,
      );
    }
  }
  assert.match(
    (await request('/ads.txt')).body,
    /^google.com, pub-5233222257140990, DIRECT, f08c47fec0942fa0/,
  );
  const sitemap = await request('/sitemap.xml');
  assert.equal(sitemap.status, 200);
  assert.ok(sitemap.headers.get('content-type').includes('application/xml'));
  for (const path of publicPages.keys())
    assert.ok(sitemap.body.includes(`<loc>https://example.com${path}</loc>`));
  assert.ok(
    (await request('/robots.txt')).body.includes(
      'Sitemap: https://example.com/sitemap.xml',
    ),
  );
});

test('manual ads require an explicit valid slot and only appear on editorial articles', async (t) => {
  const { client } = await setup(t, { adsenseEnabled: true, adsenseSlot: '1234567890' });
  const request = client();
  for (const [path, page] of publicPages) {
    const response = await request(path);
    assert.equal(
      response.body.includes('pagead2.googlesyndication.com'),
      Boolean(page.adEligible),
      path,
    );
    if (page.adEligible) {
      assert.ok(response.body.includes('data-ad-slot="1234567890"'));
      const nonce = response.headers
        .get('content-security-policy')
        .match(/'nonce-([^']+)'/)[1];
      for (const [script] of response.body.matchAll(/<script\b[^>]*>/g))
        assert.ok(script.includes(`nonce="${nonce}"`));
    }
  }
  for (const path of ['/', '/index.html', '/offline.html', '/missing']) {
    assert.equal(
      JSON.stringify((await request(path)).body).includes('adsbygoogle'),
      false,
      path,
    );
  }
  const invalid = await setup(t, { adsenseEnabled: true, adsenseSlot: '"><script>' });
  assert.equal(
    (await invalid.client()('/box-office-explained')).body.includes('adsbygoogle'),
    false,
  );
});

test('ending a run saves guesses without awarding completion XP and survives reload', async (t) => {
  const { client } = await setup(t);
  const request = client(),
    other = client();
  await request('/api/me');
  await other('/api/me');
  const game = (await request('/api/games', { mode: 'practice' })).body;
  await request('/api/games/answer', {
    id: game.id,
    round: 1,
    direction: direction(game),
  });
  assert.equal((await other('/api/games/end', { id: game.id })).status, 404);
  const ended = await request('/api/games/end', { id: game.id });
  assert.equal(ended.status, 200);
  assert.equal(ended.body.phase, 'finished');
  assert.equal(ended.body.profile.stats.xp, 25);
  assert.equal(ended.body.endedEarly, true);
  assert.equal((await request('/api/game')).body.game.id, game.id);
  assert.equal(
    (await request('/api/games/end', { id: game.id })).body.profile.stats.xp,
    25,
  );
});
const direction = (game) =>
  movies.find((m) => m.id === game.right.id).gross > game.left.gross ? 'higher' : 'lower';

test('guest runs persist, answers stay hidden, and the server owns the score', async (t) => {
  const { client } = await setup(t);
  const request = client();
  const me = await request('/api/me');
  assert.equal(me.status, 200);
  assert.equal(me.body.registered, false);
  const start = await request('/api/games', { mode: 'classic', score: 999 });
  assert.equal(start.status, 201);
  assert.equal(start.body.score, 0);
  assert.equal(start.body.right.gross, undefined);
  const answer = await request('/api/games/answer', {
    id: start.body.id,
    direction: direction(start.body),
    round: 1,
    score: 999,
  });
  assert.equal(answer.status, 200);
  assert.equal(answer.body.score, 1);
  assert.equal(answer.body.profile.stats.correct, 1);
  assert.equal((await request('/api/game')).body.game.score, 1);
  assert.equal(
    (
      await request('/api/games/answer', {
        id: start.body.id,
        direction: 'higher',
        round: 1,
      })
    ).status,
    400,
  );
  const other = client();
  await other('/api/me');
  assert.equal((await other(`/api/game?id=${start.body.id}`)).status, 404);
  assert.equal((await other('/api/games/next', { id: start.body.id })).status, 404);
});
test('daily attempts are unique and resume instead of restarting', async (t) => {
  const { client } = await setup(t);
  const request = client();
  await request('/api/me');
  const first = (await request('/api/games', { mode: 'daily' })).body;
  const second = (await request('/api/games', { mode: 'daily' })).body;
  assert.equal(first.id, second.id);
  let game = first;
  for (let round = 1; round <= 10; round++) {
    game = (
      await request('/api/games/answer', {
        id: game.id,
        round,
        direction: direction(game),
      })
    ).body;
    if (round < 10) game = (await request('/api/games/next', { id: game.id })).body;
  }
  assert.equal(game.phase, 'finished');
  assert.equal(game.score, 10);
  const again = await request('/api/games', { mode: 'daily' });
  assert.equal(again.body.id, first.id);
  assert.equal(again.body.phase, 'finished');
  const me = (await request('/api/me')).body;
  assert.equal(me.stats.dailies, 1);
  assert.equal(me.stats.perfect, 1);
});
test('accounts retain guest progress, support cross-device login, and have one-use recovery', async (t) => {
  const { client } = await setup(t);
  const a = client();
  await a('/api/me');
  const run = (await a('/api/games', { mode: 'classic' })).body;
  await a('/api/games/answer', {
    id: run.id,
    direction: direction(run),
    round: 1,
  });
  const created = await a('/api/auth/register', {
    username: 'FilmFan',
    password,
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.stats.correct, 1);
  assert.equal(created.body.recoveryCode.length, 64);
  assert.match(created.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
  const b = client();
  await b('/api/me');
  assert.equal(
    (await b('/api/auth/register', { username: 'filmfan', password })).status,
    409,
  );
  assert.equal(
    (
      await b('/api/auth/login', {
        username: 'FilmFan',
        password: 'wrong password long',
      })
    ).status,
    401,
  );
  const login = await b('/api/auth/login', { username: 'filmfan', password });
  assert.equal(login.status, 200);
  assert.equal(login.body.stats.correct, 1);
  assert.equal((await b('/api/game')).body.game.id, run.id);
  const c = client();
  await c('/api/me');
  const recovery = await c('/api/auth/recover', {
    username: 'FilmFan',
    password: 'Replacement password 2026',
    code: created.body.recoveryCode,
  });
  assert.equal(recovery.status, 200);
  assert.notEqual(recovery.body.recoveryCode, created.body.recoveryCode);
  assert.equal(
    (await a('/api/me')).body.registered,
    false,
    'recovery revokes old sessions',
  );
  assert.equal(
    (
      await b('/api/auth/recover', {
        username: 'FilmFan',
        password,
        code: created.body.recoveryCode,
      })
    ).status,
    401,
  );
});
test('leaderboards include registered completed runs, not guests or practice', async (t) => {
  const { client } = await setup(t);
  const request = client();
  await request('/api/me');
  let game = (await request('/api/games', { mode: 'classic' })).body;
  game = (
    await request('/api/games/answer', {
      id: game.id,
      round: 1,
      direction: direction(game),
    })
  ).body;
  game = (await request('/api/games/next', { id: game.id })).body;
  await request('/api/games/answer', {
    id: game.id,
    round: 2,
    direction: direction(game) === 'higher' ? 'lower' : 'higher',
  });
  assert.equal((await request('/api/leaderboard')).body.rows.length, 0);
  await request('/api/auth/register', { username: 'LeaderboardFan', password });
  const board = await request('/api/leaderboard');
  assert.equal(board.body.rows[0].score, 1);
  assert.equal(board.body.rows[0].you, true);
  assert.equal((await request('/api/leaderboard?mode=practice')).body.mode, 'classic');
});
test('privacy export excludes secrets; account deletion cascades through sessions and games', async (t) => {
  const { client, db } = await setup(t);
  const request = client();
  await request('/api/me');
  const account = await request('/api/auth/register', {
    username: 'PrivateFan',
    password,
  });
  await request('/api/games', { mode: 'classic' });
  const exported = await request('/api/export');
  assert.equal(exported.body.player.username, 'PrivateFan');
  assert(!JSON.stringify(exported.body).includes(account.body.recoveryCode));
  assert(!JSON.stringify(exported.body).includes('password'));
  assert.equal(exported.body.games[0].deck, undefined);
  assert.equal(exported.body.games[0].right.gross, undefined);
  assert.equal(
    (await request('/api/account/delete', { password: 'incorrect' })).status,
    401,
  );
  assert.equal((await request('/api/account/delete', { password })).status, 200);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM games').get().n, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n, 0);
  assert.equal((await request('/api/me')).body.registered, false);
});
test('security headers, origin guards, JSON validation, and private file boundaries', async (t) => {
  const { client } = await setup(t);
  const request = client();
  const html = await request('/');
  assert.equal(html.status, 200);
  assert.match(html.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.equal(html.headers.get('x-content-type-options'), 'nosniff');
  for (const path of [
    '/server/index.js',
    '/data/movies.json',
    '/var/battle.sqlite',
    '/package.json',
  ])
    assert.equal((await request(path)).status, 404);
  assert.equal(
    (await request('/api/games', { mode: 'classic' }, { Origin: 'https://evil.example' }))
      .status,
    403,
  );
  assert.equal(
    (await request('/api/games', { mode: 'classic' }, { 'X-Requested-With': '' })).status,
    403,
  );
  assert.equal(
    (await request('/api/games', { mode: 'classic' }, { 'Content-Type': 'text/plain' }))
      .status,
    415,
  );
  assert.equal((await request('/api/games', { mode: 'invalid' })).status, 400);
  assert.equal(
    (await request('/api/auth/register', { username: '<script>', password })).status,
    400,
  );
  assert.equal(
    (
      await request('/api/games', {
        mode: 'classic',
        padding: 'a'.repeat(10000),
      })
    ).status,
    413,
  );
  const collection = await request('/api/collection');
  assert.equal(collection.body.movies.length, 24);
  assert.equal(collection.body.total, movies.length);
  assert.equal(collection.body.movies[0].gross, undefined);
});
test('abandoning a game cannot farm completion XP', async (t) => {
  const { client } = await setup(t);
  const request = client();
  await request('/api/me');
  await request('/api/games', { mode: 'classic' });
  await request('/api/games', { mode: 'classic' });
  assert.equal((await request('/api/me')).body.stats.xp, 0);
});
