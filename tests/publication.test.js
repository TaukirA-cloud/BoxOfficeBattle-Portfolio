import test from 'node:test';
import assert from 'node:assert/strict';
import { privatePath, credentialTypes } from '../scripts/audit-public.mjs';

test('public export excludes private runtime paths but keeps reproducible source', () => {
  for (const path of [
    '.env',
    '.env.production',
    'server/.env',
    'var/battle.sqlite',
    'old.sqlite-wal',
    'backup.db',
    'backups/latest.zip',
    'node_modules/package/index.js',
    'test-results/player.png',
    'artifacts/export/.git/config',
    '.aws/credentials',
    'private.key',
  ])
    assert.equal(privatePath(path), true, path);
  for (const path of [
    '.env.example',
    'server/index.js',
    'data/movies.json',
    'package-lock.json',
    '.github/workflows/ci.yml',
    'ads.txt',
    'README.md',
    'icon.svg',
  ])
    assert.equal(privatePath(path), false, path);
});

test('credential checks classify matches without returning credential values', () => {
  const jwt = ['eyJ' + 'a'.repeat(24), 'b'.repeat(24), 'c'.repeat(24)].join('.');
  const github = 'ghp_' + 'd'.repeat(40);
  const aws = 'AKIA' + 'A'.repeat(16);
  assert.deepEqual(credentialTypes(jwt), ['JWT-like credential']);
  assert.deepEqual(credentialTypes(github), ['GitHub token']);
  assert.deepEqual(credentialTypes(aws), ['AWS access key']);
  assert.deepEqual(credentialTypes('ca-pub-5233222257140990'), []);
  assert.deepEqual(credentialTypes('TMDB_READ_ACCESS_TOKEN='), []);
});
