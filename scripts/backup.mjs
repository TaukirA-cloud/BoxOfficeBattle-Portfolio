import { DatabaseSync, backup } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const source = resolve(process.env.DATABASE_PATH || 'var/battle.sqlite');
const directory = resolve(process.env.BACKUP_DIRECTORY || 'backups');
mkdirSync(directory, { recursive: true });
const destination = resolve(
  directory,
  `battle-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`,
);
const db = new DatabaseSync(source, { readOnly: true });
try {
  await backup(db, destination);
  console.log(`Consistent backup written to ${destination}`);
} finally {
  db.close();
}
