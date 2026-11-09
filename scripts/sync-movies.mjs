import { resolve } from 'node:path';
import { openDatabase } from '../server/db.js';
import { createCatalogStore } from '../server/catalog.js';
import { importTmdbCatalog } from '../server/tmdb.js';

if (!process.env.TMDB_READ_ACCESS_TOKEN) {
  console.error(
    'Add TMDB_READ_ACCESS_TOKEN to .env first. Use your API Read Access Token from https://www.themoviedb.org/settings/api — not your account password.',
  );
  process.exitCode = 1;
} else {
  const db = openDatabase(resolve(process.env.DATABASE_PATH || 'var/battle.sqlite'));
  try {
    const result = await importTmdbCatalog({
      db,
      store: createCatalogStore(db),
      onProgress: (p) =>
        console.log(
          `Page ${p.page}: ${p.accepted}/${p.target} playable movies (${p.checked} checked)`,
        ),
    });
    console.log(
      result.busy
        ? 'Another movie import is already running. Watch its server logs or check /api/catalog.'
        : `Imported ${result.count} movies with posters and positive reported revenue. New runs use ${result.version}.`,
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    db.close();
  }
}
