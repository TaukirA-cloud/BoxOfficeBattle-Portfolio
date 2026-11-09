import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const git = (...args) =>
  execFileSync('git', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
export function privatePath(path) {
  return (
    /(^|\/)(?:node_modules|var|backups|test-results|playwright-report|blob-report|coverage|artifacts|\.git|\.aws|\.ssh|\.codex|\.agents)(?:\/|$)/i.test(
      path,
    ) ||
    (/(^|\/)\.env(?:\.[^/]*)?$/i.test(path) && !/(^|\/)\.env\.example$/.test(path)) ||
    /\.(?:sqlite(?:3)?(?:-wal|-shm)?|db(?:-wal|-shm)?|pem|key|log)$/i.test(path)
  );
}

export function credentialTypes(content) {
  return [
    [
      'JWT-like credential',
      /eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}/,
    ],
    ['GitHub token', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/],
    ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
    ['AWS access key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ]
    .filter(([, pattern]) => pattern.test(content))
    .map(([name]) => name);
}

export async function auditWorkingTree() {
  const paths = git('ls-files', '-z').split('\0').filter(Boolean);
  const issues = [];
  for (const path of paths) {
    if (privatePath(path)) {
      issues.push(`${path}: private/generated path is tracked`);
      continue;
    }
    const content = await readFile(path);
    if (content.includes(0)) continue;
    for (const type of credentialTypes(content.toString('utf8')))
      issues.push(`${path}: ${type}`);
    // Check the staged version too, so a clean working copy cannot hide a staged token.
    const staged = execFileSync('git', ['show', `:${path}`], {
      maxBuffer: 32 * 1024 * 1024,
    });
    if (!staged.includes(0))
      for (const type of credentialTypes(staged.toString('utf8')))
        issues.push(`${path}: ${type} in Git index`);
  }
  return { paths, issues: [...new Set(issues)] };
}

function auditHistory() {
  const issues = [];
  const seen = new Set();
  for (const line of git('rev-list', '--objects', '--all').trim().split('\n')) {
    const split = line.indexOf(' ');
    if (split < 0) continue;
    const oid = line.slice(0, split),
      path = line.slice(split + 1);
    if (privatePath(path)) {
      issues.push(`${path}: private/generated path in history`);
      continue;
    }
    if (seen.has(oid)) continue;
    seen.add(oid);
    const type = git('cat-file', '-t', oid).trim();
    if (type !== 'blob') continue;
    const content = execFileSync('git', ['cat-file', 'blob', oid], {
      maxBuffer: 32 * 1024 * 1024,
    });
    if (content.includes(0)) continue;
    for (const kind of credentialTypes(content.toString('utf8')))
      issues.push(`${path}: ${kind} in history`);
  }
  return [...new Set(issues)];
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { paths, issues } = await auditWorkingTree();
  if (process.argv.includes('--history')) issues.push(...auditHistory());
  if (issues.length) {
    console.error(
      `Public-source audit failed (${issues.length} findings). Values are never printed.`,
    );
    for (const issue of issues) console.error(`- ${issue}`);
    process.exitCode = 1;
  } else {
    console.log(
      `Checked ${paths.length} tracked files${process.argv.includes('--history') ? ' and reachable local Git history' : ''}: no matching private paths or credential patterns. This is a limited automated check, not a guarantee.`,
    );
  }
}
