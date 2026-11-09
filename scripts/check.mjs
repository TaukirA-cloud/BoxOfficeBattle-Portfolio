import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const files = ['app.js', 'sw.js'];
for (const directory of ['server', 'scripts'])
  for (const file of await readdir(directory))
    if (/\.(js|mjs)$/.test(file)) files.push(`${directory}/${file}`);
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], {
    stdio: 'inherit',
  });
  if (result.status !== 0) process.exit(1);
}
const movies = JSON.parse(await readFile('data/movies.json', 'utf8'));
assert(movies.length >= 60);
assert.equal(new Set(movies.map((m) => m.id)).size, movies.length);
assert.equal(new Set(movies.map((m) => m.title)).size, movies.length);
for (const movie of movies) {
  assert(Number.isSafeInteger(movie.gross) && movie.gross > 0);
  assert(Number.isInteger(movie.year) && movie.year >= 1900);
  assert(/^#[a-f0-9]{6}$/i.test(movie.a) && /^#[a-f0-9]{6}$/i.test(movie.b));
}
const html = await readFile('index.html', 'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
assert.equal(new Set(ids).size, ids.length, 'HTML IDs must be unique');
for (const file of ['package.json', 'manifest.webmanifest'])
  JSON.parse(await readFile(file, 'utf8'));
console.log(
  `Checked ${files.length} JavaScript files, ${movies.length} movie records, manifest, and unique HTML IDs.`,
);
