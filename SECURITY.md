# Security reporting

Please do not put credentials, player data, session cookies, recovery codes, or database files in public issues or pull requests.

Report suspected vulnerabilities privately to **topporules@gmail.com**, or use GitHub's private vulnerability reporting if enabled on this repository. Include the affected feature, reproduction steps using your own test account, and the expected versus observed behavior. Do not access other players' accounts or run disruptive traffic against the live service.

This is an independently maintained project. There is no guaranteed response time or bug bounty.

## Local development

Use Node.js 24.15 or later in the 24.x line. Install dependencies with `npm ci`. Start without a TMDB credential to use the bundled prototype catalog; if needed, copy `.env.example` to `.env` and fill credentials locally. Never commit `.env`, SQLite databases, backups, or production user exports.

Run `npm run audit:public` before sharing source. Run `npm run audit:history` before changing repository visibility. These are limited checks, not substitutes for reviewing files and historical data. If a secret was exposed, revoke/rotate it; deleting a line or adding an ignore rule does not invalidate an old credential.
