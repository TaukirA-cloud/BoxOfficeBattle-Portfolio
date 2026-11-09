# Deployment and operations

This is a working single-instance Node application. It is not yet a proven million-user service. Start with a small deployment, observe real traffic, and scale measured bottlenecks.

## Run

Use Node 24.15 or newer within the 24.x line. There are no runtime npm dependencies. The SQLite API is built into Node and may emit an experimental warning in some versions.

```sh
npm ci
npm run check
npm test
npm start
```

Open http://127.0.0.1:3000. `npm run dev` restarts the server when its code changes. `npm start` and `npm run dev` load an optional `.env` file automatically; copy `.env.example` when creating one and preserve any existing values. For posters and a larger revenue catalog, follow [TMDB setup](TMDB.md). Opening index.html directly or using a static-only host does not provide the API.

## First hosted release

1. Create a Git repository and a private remote. CI runs checks, server tests, and browser tests. Review those results before deployment.
2. Provision one persistent Node service with a writable data volume. Mount `var/`; never put the database in an ephemeral container layer. Allow at least 1 GB RAM: account hashing is intentionally memory intensive and permits four concurrent authentication operations.
3. Set `NODE_ENV=production`, `APP_ORIGIN=https://your-domain`, and `DATABASE_PATH` on the persistent volume. Terminate HTTPS at your reverse proxy. Production startup rejects a missing HTTPS origin. Secure session cookies only work over HTTPS.
4. Forward all routes to this service; do not expose the repository as a file directory. Only allowlisted frontend assets are served. Disable CDN caching for `/api/*`, `/internal/*`, and `/healthz`. The application already sends no-store on JSON responses. Static files revalidate to avoid stale app/API contracts.
5. Configure a domain and certificates at the chosen host. No domain, provider account, DNS changes, or paid resources have been created by this repository.
6. Run the browser tests against a staging environment, test backup restoration, then release to a small audience. Use a versioned container image and retain the previous image for rollback.

Container example (replace the domain):

```sh
docker build -t boxoffice-battle:2 .
docker run -d --name boxoffice-battle -p 127.0.0.1:3000:3000 \
  -v battle-data:/app/var \
  -e APP_ORIGIN=https://your-domain.example boxoffice-battle:2
```

On PowerShell, put the `docker run` arguments on one line or use PowerShell continuation syntax.

## Proxy and abuse protection

The app rate-limits API requests, session creation, game creation, and authentication. Rate limits are in memory, so they reset on restart and are not coordinated between instances. The default uses the socket IP and ignores forwarded headers. Behind a reverse proxy, all visitors otherwise share that proxy's quota. Set `TRUST_PROXY=1` only when the application cannot be reached directly and the proxy **replaces** `X-Forwarded-For` with the actual client IP. Never trust an arbitrary client-supplied header. Add shared edge rate limits, bot detection, and account abuse controls before a large public launch.

Scores are calculated server-side. The API ignores client-supplied scores, hides future pairs, enforces round order and ownership, and enforces Rush deadlines. These controls prevent simple score injection and replay. Box-office information is public: bots, lookups, multiple accounts, and collaboration remain possible. Do not run prize competitions without stronger fraud detection and rules.

Accounts use 12–128 character passwords, salted scrypt hashes (N=131072, r=8, p=1), opaque hashed session tokens, HTTP-only SameSite cookies, origin checks, and a required custom request header. Recovery codes are random, hashed at rest, rotate after use, and revoke old sessions. There is no email recovery. The user must save their code. Add managed identity, email verification/recovery, moderation, and optional MFA before broad adoption. An account security review is still required; this implementation is not a security certification.

## Backups and restoration

Run `npm run backup` on the host. It uses SQLite's online backup API for a consistent snapshot even when WAL is active. `DATABASE_PATH` and `BACKUP_DIRECTORY` override the paths. Encrypt backups, move them off-host, restrict access, and set retention to match your deletion policy. Backups contain hashed credentials and private history.

Restore in staging first: stop the application, preserve the current database and its `-wal`/`-shm` sidecars together, place the selected backup in a fresh data directory, point `DATABASE_PATH` at it, and start. Check `/healthz`, sign-in, stats, and the leaderboard. Do not copy a live database file alone and assume it includes all WAL writes. Schema version is currently 1; future releases need explicit, tested migrations and rollback handling.

## Monitoring

`GET /healthz` checks database availability. Configure an external uptime check. Structured stdout logs record request ID, method, path (without query), status, and latency. Error logs contain request IDs for correlation. They omit request bodies, passwords, cookies, and recovery codes. Forward logs to your monitoring provider with a documented retention period.

Set `METRICS_TOKEN` to enable `GET /internal/metrics`, requiring `Authorization: Bearer <token>`. It reports process request/error counts, uptime, memory, registered-player count, and game count. Restrict access at the proxy too. Alert on error rate, high p95 latency, memory, disk space, failed backups, and uptime failures. No third-party analytics or error-reporting service is configured; add an appropriate consent and privacy flow before introducing nonessential tracking.

`npm run loadtest` exercises `/healthz` with a bounded concurrency smoke test. Override `LOADTEST_URL`, `CONCURRENCY`, and `ROUNDS` only for a service you own. It is not a full workload benchmark. Before a large launch, load-test authenticated mixed gameplay, board reads, cold starts, backup I/O, and recovery using a dedicated staging dataset, then set an explicit concurrent-user target and cost budget.

## Growth path

Cache fingerprinted static assets at the CDN; add a build pipeline to generate their hashes. Cache leaderboard aggregates briefly while keeping player-specific responses private. Replace profile aggregation over all game JSON with incremental counters and paginated history. Move synchronous SQLite access to a suitable persistence service or worker model after measuring latency. A multi-instance release needs shared database storage, shared rate limits, atomic per-game updates, and background cleanup jobs; copying this SQLite file to independent replicas will lose consistency. Daily uniqueness and game transitions must stay transactional.

Expand the licensed/versioned catalog, add regional and language support, test with assistive technology, run user studies, and improve retention using real cohorts. Revisit privacy documents, content moderation, account abuse, backup retention, and incident response with the actual business and hosting jurisdiction before a broad launch.

## Known limits

- No deployment or external service credentials are configured.
- TMDB posters and reported revenues require your own API Read Access Token. Its developer access is free for non-commercial use with attribution; commercial terms must be arranged separately. The 69-film starter dataset remains an unverified fallback. Imported figures are historical snapshots, not an audited live feed.
- No email identity, MFA, moderation console, or account name changes.
- Registered players can create multiple accounts; daily uniqueness is per stored player, not per human.
- Progress is persisted per answer. Concurrent tabs are rejected when they submit stale rounds; the most recent accepted state wins.
- Rush timers continue in other tabs, offline, and after closing the browser. Reveal screens are untimed.
- A Classic run draws without repeats from its pinned catalog, so its maximum is the catalog size minus one. The starter library has 69 films; importing a TMDB library expands that pool. A perfect run ends with a summary.
- Legacy browser-only v1 scores are not imported into ranked server records, because they cannot be verified. Existing localStorage keys are left untouched.
- The installable shell offers an offline intermission page; competitive gameplay requires a connection. The manifest includes 192px and 512px PNG icons and an SVG icon; store submission and native packaging are not configured.
