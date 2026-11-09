# BoxOffice Battle

A full-stack movie box-office game with a cinematic responsive interface, persistent player accounts, and server-validated competition.

**[Play the live game](https://boxofficebattle-1.onrender.com/)** · [Architecture & deployment](docs/DEPLOYMENT.md) · [Security reporting](SECURITY.md)

Built with vanilla JavaScript, HTML/CSS, Node.js's HTTP server and SQLite, with Playwright browser tests. The server owns scores and timed runs; browser input is never accepted as the scoring authority. The project uses versioned movie catalogs so updates do not change answers during an existing game.

To prepare a public resume repository, follow [the source-publication checklist](docs/PUBLIC-REPOSITORY.md). The existing private repository's older commits contain runtime databases; use a clean source snapshot rather than changing its visibility.

## Public guides and advertising

Open `/guides` for server-rendered game rules, box office explanations, comparison guides, sources, contact, and privacy pages. These pages work without JavaScript or an available movie import. The full-screen game stays ad-free.

Ads are disabled by default. Ownership verification is available through the AdSense meta tag and `/ads.txt`. Before another review, deploy the changes and follow [the AdSense review checklist](docs/ADSENSE.md), including account settings, consent, and movie-data rights. Approval is determined by Google, not guaranteed by this application.

## Start playing

Install **Node.js 24.15+ (24.x)**, then run:

```sh
npm ci
npm start
```

Open **http://127.0.0.1:3000**. The server creates `var/battle.sqlite` automatically. No API keys or runtime packages are required. Keep that database to retain accounts and scores between restarts. Opening `index.html` directly no longer works because the application needs its API.

## The game

- **Classic:** grow a streak until your first miss; clear the collection for a perfect run.
- **Daily ten:** ten shared matchups, one attempt per player per UTC day, resumable across visits.
- **Rush:** a server-enforced 12-second deadline for each guess. Timers continue while away.
- **Practice:** keep learning after incorrect guesses.
- Choose Action, Comedy, Animation, Sci-fi, Fantasy, or Drama for Classic, Rush, and Practice. Genre runs are unranked; Daily keeps its shared all-movies lineup.
- Movie poster backgrounds with gradient fallbacks and genre-filtered game runs.
- XP, levels, six achievements, lifetime accuracy, and recent game history.
- Server-backed classic, daily, and Rush top-50 leaderboards; no fabricated players.
- Guest play, registration retaining guest progress, cross-device sign-in, one-use recovery codes, sign-out, data export, and permanent deletion.
- Sound, keyboard controls, reduced-motion settings, responsive navigation, native dialogs, and an installable shell with an offline intermission page.
- Persistent SQLite storage, hashed passwords and sessions, security headers, CSRF guards, request limits, structured logs, health checks, optional private metrics, backups, Docker packaging, and CI.

Player names and registered ranked scores are public. Recovery is code-based, not email-based: save the code shown at registration. Losing both your password and recovery code means losing access. Device preferences are local to each browser; signed-in gameplay progress is server-saved.

## Studio rewards

Levels and achievements unlock cosmetic titles and interface colors. Equip them in **My studio → Your studio rewards**. Choices are saved on the server for both guests and accounts, and remain when a guest registers. Existing progress automatically qualifies for rewards; there is no need to start over. The results screen lists new unlocks, and the progress card shows the next level reward. Cosmetics do not alter scoring, timers, or XP.

Level rewards: Cinema regular (2), Mint screening (3), Box office expert (5), Midnight violet (7), and Cinema legend (10). Milestone rewards recognize a first correct guess, a streak of ten, 100 correct guesses, seven completed daily challenges, and a perfect daily challenge.

## Commands

| Command                 | Purpose                                                              |
| ----------------------- | -------------------------------------------------------------------- |
| `npm start`             | Run the app on port 3000                                             |
| `npm run dev`           | Restart on server changes                                            |
| `npm run check`         | Validate JavaScript syntax, dataset, manifest, and HTML IDs          |
| `npm run audit:public`  | Check tracked/staged files for private paths and credential patterns |
| `npm run audit:history` | Also check reachable local Git history before publication            |
| `npm run export:public` | Prepare a source-only export without old Git history                 |
| `npm test`              | Run game and API regression tests                                    |
| `npm run test:browser`  | Run desktop/mobile browser flows                                     |
| `npm run format`        | Format source files                                                  |
| `npm run format:check`  | Check formatting                                                     |
| `npm run backup`        | Create a consistent SQLite backup                                    |
| `npm run loadtest`      | Run a bounded health-endpoint smoke load test                        |

Browser tests use installed Microsoft Edge on Windows. Elsewhere run `npx playwright install chromium` first. Set `BROWSER_CHANNEL=chrome` to use installed Chrome, or `chromium` for Playwright's managed browser. The test server uses an isolated in-memory database on port 3100.

## Project map

```text
app.js / index.html / styles.css   Browser application
server/index.js                    HTTP server, API, sessions, accounts, profiles
server/game.js                     Authoritative game rules and deterministic daily decks
server/db.js                       SQLite schema and indexes
server/security.js                 Password hashing, token helpers, rate limits
data/movies.json                   Original 69-film curated dataset
tests/                            Game and API regression tests
browser/                          Real browser scenarios
scripts/                          Validation, backup, and load smoke tools
docs/DEPLOYMENT.md                 Hosting, security, backups, monitoring, scale limits
.github/workflows/ci.yml           Automated validation and browser tests
```

## Before public launch

The game is deployed on Render at the live link above. Read [the deployment guide](docs/DEPLOYMENT.md) and [the dataset notes](data/README.md) for operating your own instance. This is a single-instance application, not a claim of tested million-user capacity. A custom domain, external monitoring, off-host backups, and commercial data/image permissions require operator configuration; their presence is not established by the source code. The guide describes the shared persistence, transactional updates, caching, identity, and operational work needed for larger deployments.

Figures are approximate historical worldwide theatrical grosses, not live or inflation-adjusted. Their provenance and rights still need review. No official poster assets are included, and the game is independent of film studios. Legacy browser-only v1 scores remain in localStorage but are not imported into verified rankings.
