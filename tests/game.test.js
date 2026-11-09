import test from 'node:test';
import { playerRewards } from '../server/rewards.js';
import assert from 'node:assert/strict';
import {
  createGame,
  answerGame,
  nextRound,
  viewGame,
  movies,
  pair,
  dayKey,
} from '../server/game.js';

const correctDirection = (game) => {
  const [left, right] = pair(game);
  return right.gross > left.gross ? 'higher' : 'lower';
};
test('daily decks are deterministic, unique, versioned, and rotate at midnight UTC', () => {
  const a = createGame('daily', undefined, Date.parse('2026-11-01T00:00:00Z'));
  const b = createGame('daily', undefined, Date.parse('2026-11-01T23:59:59Z'));
  assert.deepEqual(a.deck, b.deck);
  assert.notDeepEqual(
    a.deck,
    createGame('daily', undefined, Date.parse('2026-11-02')).deck,
  );
  assert.equal(new Set(a.deck).size, movies.length);
  assert.equal(dayKey(Date.parse('2026-11-02T00:00:00Z')), '2026-11-02');
});
test('public game state hides the right gross and the future deck', () => {
  const game = createGame('classic');
  const view = viewGame(game);
  assert.equal(view.right.gross, undefined);
  assert.equal(view.deck, undefined);
  assert(view.left.gross > 0);
  answerGame(game, correctDirection(game), 1);
  assert.equal(viewGame(game).right.gross, pair(game)[1].gross);
});
test('answers cannot be replayed, skipped, or supplied for a stale round', () => {
  const game = createGame('classic');
  assert.throws(() => nextRound(game));
  assert.throws(() => answerGame(game, 'higher', 2));
  assert.throws(() => answerGame(game, 'sideways', 1));
  assert.throws(() => answerGame(game, 'timeout', 1));
  answerGame(game, correctDirection(game), 1);
  assert.equal(game.score, 1);
  assert.throws(() => answerGame(game, 'higher', 1));
  nextRound(game);
  assert.throws(() => answerGame(game, 'higher', 1));
  assert.equal(game.answers.length, 1);
});
test('daily always lasts exactly ten guesses, including misses', () => {
  const game = createGame('daily');
  for (let round = 1; round <= 10; round++) {
    const direction = correctDirection(game) === 'higher' ? 'lower' : 'higher';
    answerGame(game, direction, round);
    assert.equal(game.phase, round === 10 ? 'finished' : 'revealed');
    if (round < 10) nextRound(game);
  }
  assert.equal(game.score, 0);
  assert.equal(game.answers.length, 10);
  assert.throws(() => nextRound(game));
});
test('rush is enforced against server time, including suspended clients', () => {
  const game = createGame('rush', undefined, 100000);
  assert.equal(game.deadline, 112000);
  assert.throws(() => answerGame(game, 'timeout', 1, 111999));
  answerGame(game, correctDirection(game), 1, 112000);
  assert.equal(game.score, 0);
  assert.equal(game.phase, 'finished');
  assert.equal(game.answers[0].direction, 'timeout');
});
test('rush timer resets only when advancing to a new round', () => {
  const game = createGame('rush', undefined, 100000);
  answerGame(game, correctDirection(game), 1, 101000);
  nextRound(game, 200000);
  assert.equal(game.deadline, 212000);
});
test('classic ends on a miss, practice continues and filters the deck', () => {
  const game = createGame('classic');
  answerGame(game, correctDirection(game) === 'higher' ? 'lower' : 'higher', 1);
  assert.equal(game.phase, 'finished');
  const practice = createGame('practice', 'Animation');
  assert(
    practice.deck.every((id) =>
      movies.find((m) => m.id === id).genre.includes('Animation'),
    ),
  );
  answerGame(practice, correctDirection(practice) === 'higher' ? 'lower' : 'higher', 1);
  assert.equal(practice.phase, 'revealed');
});
test('a perfect full-collection run finishes without exhausting the deck', () => {
  const game = createGame('classic');
  for (let round = 1; round < movies.length; round++) {
    answerGame(game, correctDirection(game), round);
    if (game.phase === 'revealed') nextRound(game);
  }
  assert.equal(game.phase, 'finished');
  assert.equal(game.score, movies.length - 1);
  assert(viewGame(game).right.title);
});
test('level rewards unlock at their thresholds and locked selections fall back safely', () => {
  const at = (level) =>
    playerRewards({ level, achievements: [] }, { theme: 'violet', title: 'legend' });
  assert.equal(at(2).rewards.find((r) => r.id === 'mint').unlocked, false);
  assert.equal(at(3).rewards.find((r) => r.id === 'mint').unlocked, true);
  assert.equal(at(1).equipped.title.id, 'newcomer');
  assert.equal(at(1).equipped.theme.id, 'gold');
  assert.equal(at(7).equipped.theme.id, 'violet');
  assert.equal(at(10).equipped.title.id, 'legend');
});

test('invalid mode and genre are rejected', () => {
  assert.throws(() => createGame('hacked'));
  assert.throws(() => createGame('practice', 'unknown'));
});

test('Classic, Rush, and Practice respect the selected genre while Daily stays shared', () => {
  for (const mode of ['classic', 'rush', 'practice']) {
    for (const genre of ['Action', 'Comedy', 'Animation']) {
      const game = createGame(mode, genre);
      assert.equal(game.genre, genre);
      assert.ok(game.deck.length >= 2);
      assert.ok(
        game.deck.every((id) => movies.find((m) => m.id === id).genre.includes(genre)),
      );
      assert.equal(viewGame(game).genre, genre);
    }
  }
  const all = createGame('daily', 'All movies', 100000);
  const filtered = createGame('daily', 'Comedy', 100000);
  assert.equal(filtered.genre, 'All movies');
  assert.deepEqual(filtered.deck, all.deck);
});
