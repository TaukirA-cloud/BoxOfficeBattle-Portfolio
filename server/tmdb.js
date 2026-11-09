import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

const genreNames = { 'Science Fiction': 'Sci-fi' };
const palette = [
  ['#356d87', '#122b45'],
  ['#7c4f7d', '#17243f'],
  ['#9b664a', '#1a2e45'],
  ['#6e8b5b', '#1c332c'],
];

export function normalizeMovie(data, observedAt = Date.now()) {
  if (
    !Number.isSafeInteger(data.id) ||
    data.id <= 0 ||
    data.adult !== false ||
    typeof data.title !== 'string' ||
    !data.title.trim() ||
    !Number.isSafeInteger(data.revenue) ||
    data.revenue <= 0 ||
    data.revenue > 1e12 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(data.release_date || '') ||
    !Number.isFinite(Date.parse(data.release_date)) ||
    Date.parse(data.release_date) > observedAt ||
    !/^\/[\w-]+\.(jpg|png|webp)$/.test(data.poster_path || '')
  )
    return null;
  if (new Date(data.release_date).toISOString().slice(0, 10) !== data.release_date)
    return null;
  const year = Number(data.release_date.slice(0, 4));
  if (year < 1888) return null;
  const [a, b] = palette[data.id % palette.length];
  return {
    id: `tmdb:${data.id}`,
    tmdbId: data.id,
    title: data.title.trim(),
    year,
    releaseDate: data.release_date,
    gross: data.revenue,
    genre:
      (Array.isArray(data.genres) ? data.genres : [])
        .filter((g) => g && typeof g.name === 'string')
        .map((g) => genreNames[g.name] || g.name)
        .join(' · ') || 'Other',
    a,
    b,
    posterUrl: `https://image.tmdb.org/t/p/w780${data.poster_path}`,
    source: 'tmdb',
    sourceUrl: `https://www.themoviedb.org/movie/${data.id}`,
    observedAt: new Date(observedAt).toISOString(),
  };
}

export function createTmdbClient({
  token,
  fetchImpl = fetch,
  intervalMs = 150,
  wait = delay,
  signal,
} = {}) {
  if (!token)
    throw new Error('Set TMDB_READ_ACCESS_TOKEN in .env to enable the movie API.');
  let nextSlot = 0;
  async function get(path, params = {}) {
    for (let attempt = 0; attempt < 4; attempt++) {
      signal?.throwIfAborted();
      const slot = Math.max(Date.now(), nextSlot);
      nextSlot = slot + intervalMs;
      if (slot > Date.now()) await wait(slot - Date.now(), undefined, { signal });
      const url = new URL(`https://api.themoviedb.org/3/${path}`);
      for (const [key, value] of Object.entries(params))
        url.searchParams.set(key, String(value));
      let response;
      try {
        response = await fetchImpl(url, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
          signal: signal
            ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
            : AbortSignal.timeout(15000),
        });
      } catch {
        signal?.throwIfAborted();
        if (attempt === 3)
          throw new Error(
            'TMDB could not be reached. The previous catalog is still available.',
          );
        await wait(1000 * (attempt + 1), undefined, { signal });
        continue;
      }
      if (response.status === 401 || response.status === 403)
        throw new Error(
          'TMDB rejected the read access token. Check TMDB_READ_ACCESS_TOKEN.',
        );
      if (response.status === 404) return null;
      if (response.status === 429 || response.status >= 500) {
        if (attempt === 3)
          throw new Error('TMDB is busy or unavailable. Retry the import later.');
        const retry = Number(response.headers.get('retry-after'));
        await wait(
          Number.isFinite(retry) && retry > 0
            ? Math.min(retry * 1000, 30000)
            : 1000 * (attempt + 1),
          undefined,
          { signal },
        );
        continue;
      }
      if (!response.ok)
        throw new Error(
          `TMDB returned HTTP ${response.status}. The previous catalog is still available.`,
        );
      return response.json();
    }
  }
  return {
    discover: (page, cutoff) =>
      get('discover/movie', {
        page,
        sort_by: 'revenue.desc',
        include_adult: false,
        include_video: false,
        'vote_count.gte': 25,
        'primary_release_date.lte': cutoff,
        language: 'en-US',
      }),
    details: (id) => get(`movie/${id}`, { language: 'en-US' }),
  };
}

export function movieLimit(value = 5000) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 20 || number > 10000)
    throw new Error('TMDB_MAX_MOVIES must be an integer between 20 and 10000.');
  return number;
}

export async function importTmdbCatalog({
  db,
  store,
  client,
  token = process.env.TMDB_READ_ACCESS_TOKEN,
  limit = movieLimit(process.env.TMDB_MAX_MOVIES),
  signal,
  onProgress = () => {},
  minimum = 20,
  now = Date.now(),
}) {
  if (!client && !token)
    throw new Error('Set TMDB_READ_ACCESS_TOKEN in .env before importing movies.');
  const owner = randomUUID();
  const acquired = db
    .prepare(
      'INSERT INTO catalog_sync_lock VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET owner=excluded.owner, expires=excluded.expires WHERE expires<?',
    )
    .run(owner, Date.now() + 300000, Date.now());
  if (!acquired.changes) return { busy: true };
  try {
    client ||= createTmdbClient({ token, signal });
    const cutoff = new Date(now - 90 * 86400000).toISOString().slice(0, 10);
    const accepted = [],
      seen = new Set();
    let maxPages = 500;
    for (let page = 1; page <= maxPages && accepted.length < limit; page++) {
      signal?.throwIfAborted();
      const discovered = await client.discover(page, cutoff);
      if (!Array.isArray(discovered?.results))
        throw new Error('TMDB returned an invalid discovery response.');
      maxPages = Math.min(500, Number(discovered.total_pages) || 1);
      const candidates = discovered.results.filter(
        (m) =>
          Number.isSafeInteger(m.id) && m.id > 0 && m.adult !== true && !seen.has(m.id),
      );
      for (
        let start = 0;
        start < candidates.length && accepted.length < limit;
        start += 4
      ) {
        const batch = candidates.slice(start, start + 4);
        const settled = await Promise.allSettled(
          batch.map(async (candidate) => {
            seen.add(candidate.id);
            const cached = db
              .prepare('SELECT * FROM tmdb_details WHERE id=?')
              .get(candidate.id);
            if (cached && cached.checked > now - 30 * 86400000)
              return JSON.parse(cached.payload);
            const detail = await client.details(candidate.id);
            signal?.throwIfAborted();
            const movie =
              detail && detail.id === candidate.id ? normalizeMovie(detail, now) : null;
            db.prepare(
              'INSERT INTO tmdb_details VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET checked=excluded.checked, payload=excluded.payload',
            ).run(candidate.id, now, JSON.stringify(movie));
            return movie;
          }),
        );
        const failure = settled.find((result) => result.status === 'rejected');
        if (failure) throw failure.reason;
        const records = settled.map((result) => result.value);
        for (const record of records)
          if (
            record &&
            Date.parse(record.releaseDate) <= Date.parse(cutoff) &&
            accepted.length < limit &&
            !accepted.some((m) => m.id === record.id)
          )
            accepted.push(record);
        signal?.throwIfAborted();
        const renewed = db
          .prepare('UPDATE catalog_sync_lock SET expires=? WHERE id=1 AND owner=?')
          .run(Date.now() + 300000, owner);
        if (!renewed.changes)
          throw new Error('The movie import lease expired. Retry the import.');
      }
      onProgress({ page, accepted: accepted.length, checked: seen.size, target: limit });
      if (!discovered.results.length) break;
    }
    if (accepted.length < minimum)
      throw new Error(
        `Only ${accepted.length} eligible movies were found. The previous catalog has been kept.`,
      );
    signal?.throwIfAborted();
    const catalog = store.publish(accepted, now);
    return { version: catalog.version, count: catalog.movies.length, source: 'tmdb' };
  } finally {
    // The application may have closed its database during graceful shutdown.
    try {
      db.prepare('DELETE FROM catalog_sync_lock WHERE id=1 AND owner=?').run(owner);
    } catch {
      /* Database already closed. */
    }
  }
}
