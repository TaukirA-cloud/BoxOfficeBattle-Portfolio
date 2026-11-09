import { readFileSync } from 'node:fs';
import { randomInt, createHash } from 'node:crypto';

export const DATA_VERSION = 'curated-v1';
export const movies = JSON.parse(
  readFileSync(new URL('../data/movies.json', import.meta.url)),
);
export const modes = ['classic', 'daily', 'rush', 'practice'];
export const genres = [
  'All movies',
  'Action',
  'Animation',
  'Sci-fi',
  'Fantasy',
  'Drama',
  'Comedy',
];
export const dayKey = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);
export const publicMovie = ({
  id,
  title,
  year,
  genre,
  a,
  b,
  posterUrl = null,
  source = 'curated',
}) => ({
  id,
  title,
  year,
  genre,
  a,
  b,
  posterUrl,
  source,
});

function shuffle(list, seed) {
  const result = [...list];
  let counter = 0;
  for (let i = result.length - 1; i > 0; i--) {
    const j = seed
      ? createHash('sha256').update(`${seed}:${counter++}`).digest().readUInt32BE() %
        (i + 1)
      : randomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function createGame(
  mode,
  genre = 'All movies',
  now = Date.now(),
  catalog = { movies, version: DATA_VERSION },
) {
  if (!modes.includes(mode)) throw new Error('Choose a valid game mode.');
  if (!genres.includes(genre)) throw new Error('Choose a valid genre.');
  const selectedGenre = mode === 'daily' ? 'All movies' : genre;
  const pool = catalog.movies.filter(
    (m) => selectedGenre === 'All movies' || m.genre.includes(selectedGenre),
  );
  if (pool.length < (mode === 'daily' ? 11 : 2))
    throw new Error(
      'Choose another genre. There are not enough movies with reported revenue in this genre yet.',
    );
  const deck = shuffle(
    pool,
    mode === 'daily' ? `${catalog.version}:${dayKey(now)}` : null,
  );
  return {
    mode,
    genre: selectedGenre,
    day: dayKey(now),
    deck: deck.map((m) => m.id),
    index: 0,
    score: 0,
    answers: [],
    phase: 'guess',
    started: now,
    deadline: mode === 'rush' ? now + 12000 : null,
    version: catalog.version,
  };
}

export function pair(game, catalog = { movies }) {
  return [
    catalog.movies.find((m) => m.id === game.deck[game.index]),
    catalog.movies.find((m) => m.id === game.deck[game.index + 1]),
  ];
}

export function viewGame(game, now = Date.now(), catalog = { movies }) {
  const [left, right] = pair(game, catalog);
  return {
    mode: game.mode,
    genre: game.genre,
    day: game.day,
    score: game.score,
    round: game.index + 1,
    totalRounds: game.mode === 'daily' ? 10 : game.deck.length - 1,
    phase: game.phase,
    endedEarly: Boolean(game.abandoned),
    deadline: game.deadline,
    serverTime: now,
    left: { ...publicMovie(left), gross: left.gross },
    right: {
      ...publicMovie(right),
      ...(game.phase !== 'guess' ? { gross: right.gross } : {}),
    },
    answers: game.answers,
    lastAnswer: game.answers.at(-1) ?? null,
    version: game.version,
  };
}

export function answerGame(
  game,
  direction,
  round,
  now = Date.now(),
  catalog = { movies },
) {
  if (game.phase !== 'guess' || round !== game.index + 1)
    throw new Error('This round has already changed. Refresh the game.');
  if (!['higher', 'lower', 'timeout'].includes(direction))
    throw new Error('Choose higher or lower.');
  const [left, right] = pair(game, catalog);
  const expired = game.deadline !== null && now >= game.deadline;
  if (direction === 'timeout' && !expired) throw new Error('The timer is still running.');
  const correct =
    !expired &&
    (direction === 'higher' ? right.gross > left.gross : right.gross < left.gross);
  const entry = {
    correct,
    direction: expired ? 'timeout' : direction,
    left: left.title,
    right: right.title,
    gross: right.gross,
    difference: right.gross - left.gross,
  };
  game.answers.push(entry);
  if (correct) game.score++;
  const finalRound = game.index >= (game.mode === 'daily' ? 9 : game.deck.length - 2);
  game.phase =
    finalRound || (!correct && ['classic', 'rush'].includes(game.mode))
      ? 'finished'
      : 'revealed';
  return game;
}

export function nextRound(game, now = Date.now()) {
  if (game.phase !== 'revealed') throw new Error('Reveal the current round first.');
  game.index++;
  game.phase = 'guess';
  game.deadline = game.mode === 'rush' ? now + 12000 : null;
  return game;
}

export const achievementRules = [
  {
    id: 'debut',
    name: 'Opening night',
    description: 'Make your first correct guess.',
    icon: '01',
    target: 1,
    field: 'correct',
  },
  {
    id: 'five',
    name: 'On a roll',
    description: 'Reach a streak of 5.',
    icon: '05',
    target: 5,
    field: 'best',
  },
  {
    id: 'ten',
    name: 'Box office royalty',
    description: 'Reach a streak of 10.',
    icon: '10',
    target: 10,
    field: 'best',
  },
  {
    id: 'critic',
    name: 'Film critic',
    description: 'Make 100 correct guesses.',
    icon: '100',
    target: 100,
    field: 'correct',
  },
  {
    id: 'daily',
    name: 'Daily regular',
    description: 'Complete 7 daily challenges.',
    icon: '07',
    target: 7,
    field: 'dailies',
  },
  {
    id: 'perfect',
    name: 'Perfect picture',
    description: 'Score 10/10 in a daily challenge.',
    icon: '★',
    target: 1,
    field: 'perfect',
  },
];
