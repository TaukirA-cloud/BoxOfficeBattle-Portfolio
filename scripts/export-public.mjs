import { mkdir, lstat, writeFile, copyFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { auditWorkingTree } from './audit-public.mjs';

// Export current source, never .git or previous commits. Do not initialize or push a repo.
const { paths, issues } = await auditWorkingTree();
if (issues.length) {
  console.error('Export stopped. Run npm run audit:public to review the findings.');
  process.exit(1);
}
const destination = join(
  'artifacts',
  `public-source-${new Date().toISOString().replace(/[:.]/g, '-')}`,
);
await mkdir(destination, { recursive: true });
for (const path of paths) {
  if (!(await lstat(path)).isFile())
    throw new Error(`Export accepts regular files only: ${path}`);
  const target = join(destination, path);
  await mkdir(join(target, '..'), { recursive: true });
  await copyFile(path, target);
}
const instructions = `# Clean public source export\n\nGenerated from the working copies of ${paths.length} tracked files. No Git history is included.\n\nBefore sharing, review the files and follow docs/PUBLIC-REPOSITORY.md. Initialize Git here and publish to a NEW empty repository, not the private repository's existing remote. Run npm ci, npm run audit:public, npm test, and npm run check. Dependency installation and runtime files are ignored. Commit this export's source before running the history audit.\n\nDo not copy .env, .git, var, backups, or node_modules from the original folder. Public publisher IDs and the intentionally public contact email are not API secrets. Automated scanning cannot certify the absence of all confidential information.\n`;
await writeFile(join(destination, 'PUBLIC-EXPORT.md'), instructions);
// Ensure the documented entry point was included rather than silently exporting partial work.
await access(join(destination, 'docs/PUBLIC-REPOSITORY.md'));
console.log(
  `Source-only export prepared at ${destination}. No remote was changed or pushed.`,
);
