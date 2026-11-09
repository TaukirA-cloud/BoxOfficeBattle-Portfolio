# Publish a clean resume repository

The current source files can be shared after review. **Do not make the existing deployment repository (`BoxOfficeBattle`, formerly `BOBATTLE`) public yet:** older reachable commits contain `var/battle.sqlite`, its WAL/SHM files, `node_modules`, and test artifacts. The databases may contain historical player/session data. Removing files from the latest commit or adding ignore rules does not remove old versions.

The automated credential-pattern scan found no matches in the examined source history. It does not inspect database contents, remote-only refs, GitHub artifacts, releases, or every possible credential format. It is not proof that the existing history is safe to publish. Keep the existing repository private.

## Recommended: a separate public repository

This preserves Render's current private repository connection and avoids force-pushing or rewriting history. The clean repository will begin with an honest new source snapshot; it will not include historical commits. Keep the private project for development history and describe your work accurately on your resume.

1. Commit the public-source preparation changes in the existing private checkout, including the new scripts and this document. `.env`, databases, dependencies, backups, and generated files must remain ignored.
2. Run `npm run audit:public`. This checks current tracked files and their staged contents without printing matching credentials. Investigate any finding before continuing.
3. Run `npm run export:public`. It creates a new timestamped folder inside ignored `artifacts/`, containing the working copies of tracked source files only. It does not copy Git history. Run it from a clean working tree so the snapshot matches your committed source.
4. Open that generated folder in a separate VS Code window. Review the exported files. No `.git`, `.env`, `node_modules`, `var`, or backups should be present. `.env.example`, `package-lock.json`, source, tests, icons, CI, and documentation should be present.
5. On GitHub, create a **new empty public repository**, for example `BoxOfficeBattle-Portfolio`. Leave README, license, and `.gitignore` initialization unchecked because the export supplies its own files. Do not change the visibility of the old repository.
6. In the exported folder's terminal, run the commands below, replacing the remote URL if you chose a different repository name:

   ```powershell
   git init -b main
   git add .
   git commit -m "Publish BoxOffice Battle source"
   npm ci
   npm run audit:public
   npm run audit:history
   npm run check
   npm test
   git remote add origin https://github.com/TaukirA-cloud/BoxOfficeBattle-Portfolio.git
   git push -u origin main
   ```

7. In GitHub repository settings, enable secret scanning/push protection where available. Check the Actions run, set the About description, and add `https://boxofficebattle-1.onrender.com/` as the website. Suggested topics: `javascript`, `nodejs`, `sqlite`, `playwright`, `movie-game`.
8. Review the public repository while signed out. Both the README and source should be readable without an invitation. Link the new repository and live website on your resume.

The old Render deployment can stay connected to the private repository. A separate public snapshot will not automatically receive later changes: export future source from the private checkout, review it, and commit updates in the public checkout without replacing its `.git` directory. Alternatively, deliberately reconnect Render to the new repository once you choose to develop there.

## If you must publish the existing repository

That requires a separate history-cleanup operation and an audit of GitHub branches, tags, pull-request refs, releases, and artifacts. It changes commit IDs and may disrupt collaborators and deployment links. Do not run a force push based only on this document. First back up the private repository, rotate any exposed credentials, decide which refs to retain, then perform and verify a coordinated cleanup. The preparation scripts intentionally do not rewrite history or change repository visibility.

## What is safe and what stays private

- Commit application source, tests, scripts, curated prototype data, `package.json`, `package-lock.json`, CI, assets, and documentation.
- Commit `.env.example` with blank tokens and example configuration. Never copy values from `.env` into it.
- Never commit production databases, database sidecars, backups, session cookies, API tokens, private keys, or user exports. Dependencies are restored with `npm ci`.
- The AdSense publisher ID and `ads.txt` are intentionally public identifiers. The contact email was intentionally published on the site. Neither is an authentication credential.
- `"private": true` in `package.json` prevents accidental npm publication; it does not control GitHub visibility and should remain set.
- A public repository is not automatically open source. No redistribution license is added by this preparation. Choose a license separately if you want to grant reuse rights. Film-data and image rights remain separate from rights in your code.
- The TMDB token previously pasted into chat should be replaced through TMDB and updated privately in Render and your local `.env`. Do not post the replacement token in chat or GitHub.

## Resume claims

Use the actual deployed URL, technologies, and verified features. Automated test counts change over time; use the current test output if you mention them. Do not claim millions of users, a particular traffic level, commercial movie-data rights, or AdSense approval without evidence.

Suggested description: **A deployed full-stack movie guessing game with server-validated scoring, SQLite persistence, account recovery, TMDB integration, genre filters, progression rewards, and automated API/browser tests.**
