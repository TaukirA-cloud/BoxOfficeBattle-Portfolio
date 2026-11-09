# TMDB posters and expanded movie library

TMDB is the integrated provider for poster images and reported movie revenue. Its developer API is free for **non-commercial** use with attribution. A project intended to generate revenue needs a commercial agreement with TMDB; free developer access is not a blanket commercial license. See [TMDB's FAQ](https://developer.themoviedb.org/docs/faq).

Revenue values are provider-reported historical figures, not an audited, guaranteed complete, or real-time worldwide theatrical feed. Missing/zero/negative revenue, adult titles, invalid dates, and movies without a usable poster are excluded from the imported playable pool. Discover requests exclude releases from the last 90 days to avoid the most actively changing totals. This does not guarantee accuracy for older films. Do not substitute budget for revenue or treat unknown revenue as zero.

## Enable the integration

1. Create a free account at https://www.themoviedb.org.
2. Open https://www.themoviedb.org/settings/api and apply for developer API access for your application. Describe the project honestly and accept the applicable terms.
3. Copy the **API Read Access Token**. This is the long bearer token, not your TMDB password or the shorter v3 API key.
4. In the project root, create `.env` from `.env.example` if you do not already have one. Preserve any existing production settings.
5. Set:

   ```dotenv
   TMDB_READ_ACCESS_TOKEN=your_read_access_token_here
   TMDB_MAX_MOVIES=5000
   ```

6. Stop the existing application with Ctrl+C, then run:

   ```powershell
   npm run movies:sync
   npm start
   ```

   The first import can take several minutes or longer because each movie needs a detail request and API calls are deliberately paced. Progress appears in the terminal. The target is configurable from 20 to 10,000; the actual imported count depends on how many qualifying movies TMDB returns. No movie count is fabricated when a token is absent or a request fails.

7. Open http://127.0.0.1:3000 and start a new run. Both panels display each film's poster beneath a readability overlay. Existing starter games also receive posters when an exact title/year match is present in the imported library, while keeping their original revenue values.
8. The post-game screen shows the current library count and TMDB attribution. `/api/catalog` reports import status and count without exposing credentials.

`npm start` and `npm run dev` load `.env` automatically. Normal environment variables take precedence over values in the file. The browser never receives the bearer token and never calls the authenticated TMDB API directly. Image URLs come from the server and use TMDB's public image CDN. Do not commit `.env`, the SQLite database, or private backups; `.gitignore` covers them. If they were committed previously, ignoring them does not remove them from Git history.

## On Render or another host

Add `TMDB_READ_ACCESS_TOKEN` and optional `TMDB_MAX_MOVIES` through the host's secret/environment settings, then redeploy. Keep `DATABASE_PATH` on the persistent disk. Do not add the token to a frontend script, public manifest, image URL, GitHub workflow file, or Git repository.

The running service starts an import in the background when the token is configured and the last successful import is more than seven days old. It checks again every six hours. Existing games remain playable during import. Run `npm run movies:sync` from the running service's shell to refresh explicitly; do not use a separate Render cron service that cannot access the web service's persistent disk. A database lease prevents overlapping CLI/server imports.

Successful catalogs and normalized detail responses are stored in the existing SQLite database, so ordinary backups include them. Thirty-day detail caching avoids repeat requests for unchanged imports. Requests are paced and transient errors/429 responses receive bounded retries. An interrupted import resumes efficiently from cached details when retried. If authentication fails or an import cannot produce enough valid records, the previous catalog remains active; the original 69-film library remains the initial fallback.

## Game consistency and images

Each successful import publishes an immutable catalog version. Games retain their version for the whole run, and old versions remain available after server restarts. A UTC daily challenge pins its catalog on its first creation, so importing more movies cannot change that day's shared lineup. The next UTC day can use the newer library. Existing curated IDs stay distinct from namespaced TMDB IDs such as `tmdb:19995`.

Poster requests go directly to `image.tmdb.org`; the approved TMDB logo is loaded from `www.themoviedb.org`. These services receive ordinary image-request information. Images are decorative, have empty alt text because adjacent text identifies the films, use responsive cover positioning, and retain the gradient fallback if a request fails. Collection posters load lazily. Source attribution appears in the post-game credits section, including TMDB's required notice and linked logo. The game CSP allows only these specific extra image hosts and does not expose API credentials.

The public Film collection tab has been removed. The underlying catalog still supplies movie pairs, posters, and genre-filtered runs. The authenticated collection API remains available for compatibility and continues to hide revenue figures and future game decks; the game no longer renders a movie browser or saves favorites.

The public `/methodology` page also explains data limitations and provides attribution. The game and non-monetized reading pages restrict external resources to the image providers. Only explicitly enabled editorial ad pages receive the Google-compatible script policy; see [advertising setup](ADSENSE.md). Confirm commercial usage rights before enabling monetization.

## Verification limits

Automated tests use simulated TMDB responses, a 2,500-film catalog, and intercepted image responses. They cover imports, rejected records, throttling retries, cached details, failed-refresh fallback, immutable game data, daily pinning, pagination, favorites, poster loading, and missing-image fallbacks. They do not claim a live import succeeded without a real developer token. A real token, external API availability, and applicable usage rights must be supplied by the operator.

References: [image URLs](https://developer.themoviedb.org/docs/image-basics), [movie discovery](https://developer.themoviedb.org/reference/discover-movie), [movie details](https://developer.themoviedb.org/reference/movie-details), [rate limits](https://developer.themoviedb.org/docs/rate-limiting).
