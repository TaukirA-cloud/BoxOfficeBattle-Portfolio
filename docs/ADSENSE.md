# AdSense review and deployment

Approval is Google's decision. This release addresses the reported inventory-value issue; it is not a certification of compliance or a promise of approval. Read the editorial pages yourself before requesting review and correct anything that does not reflect your intended publication.

## What this release does

- Adds public HTML pages at `/guides`, `/how-to-play`, `/box-office-explained`, `/guides/comparing-movies`, `/guides/blockbuster-matchups`, `/methodology`, `/about`, and `/privacy`.
- Links the reading room from the game's full-screen header, help dialog, and footer. The public pages need neither JavaScript nor a game API response.
- Retains ownership verification through `google-adsense-account` and `/ads.txt` using publisher `pub-5233222257140990`.
- Removes global ad loading from the single-page game. Gameplay, game-over, account screens, collection, leaderboards, offline/error screens, and utility pages have no ad unit or Google ad script.
- Keeps advertising OFF unless explicitly configured. Only three substantive editorial articles permit one manually configured display unit after their content, separated from navigation. This is an implementation boundary, not a determination that Google will approve those articles.
- Serves a sitemap using `APP_ORIGIN` and advertises it through `robots.txt`. It does not use the request Host header to generate public URLs.

## Required steps in your accounts

1. Commit and push the application changes. Confirm Render deploys the intended commit and reports Live. Keep `.env`, tokens, database files, and backups out of Git.
2. Keep `APP_ORIGIN=https://boxofficebattle-1.onrender.com` (or the exact custom HTTPS origin you actually use). Do not set `ADSENSE_ENABLED` yet.
3. In AdSense, open Ads, edit this site, switch Auto ads OFF, and apply the change. Hash fragments such as `/#profile` cannot be used as page exclusions. The site no longer relies on them for ad isolation.
4. Configure applicable privacy and consent messages under AdSense Privacy & messaging. For traffic from the EEA, UK, and Switzerland, follow Google's current certified-CMP requirements. Do not treat a privacy link or the local environment flag as a consent implementation. Where the Google-managed message is available, configure it for this site and verify it before enabling ads; otherwise integrate a suitable certified CMP first.
5. Review TMDB's commercial usage terms and obtain the appropriate permission for revenue-generating use of its data/images. This repository does not establish usage rights. Attribution alone does not replace permission.
6. Check the published URLs listed below in a private browser window. Read the guides, check the public contact email, and confirm that the pages work on mobile and with JavaScript disabled.
7. In AdSense Sites, select the exact published site. Use the meta-tag or ads.txt verification option and request review once the deployment and account requirements are complete. Ownership verification and site approval are separate steps. A custom domain is optional, not a guarantee of acceptance.

## Published checks before requesting review

- `/guides`: readable guide index and working article links.
- `/how-to-play`: rules match the game.
- `/methodology`: source limitations and correction contact are accurate.
- `/about` and `/privacy`: contact email and data practices match actual operation.
- `/ads.txt`: `google.com, pub-5233222257140990, DIRECT, f08c47fec0942fa0`.
- `/sitemap.xml` and `/robots.txt`: the correct public origin and guide URLs.
- `/`: full-screen game works; no request to `adsbygoogle.js` while playing or using account/results screens.
- A missing URL and `/offline.html`: no ads.

## Enable a manual unit after approval and consent/rights checks

1. In AdSense, create a responsive Display ad unit and copy its numeric `data-ad-slot` value. Keep Auto ads off, including overlay and vignette formats.
2. In Render Environment, set `ADSENSE_ENABLED=1` and `ADSENSE_SLOT` to that ten-digit value. Save and redeploy. Do not substitute your publisher ID for the slot ID.
3. Confirm a Google script and a single labeled ad unit appear only on `/box-office-explained`, `/guides/comparing-movies`, and `/guides/blockbuster-matchups`. Review consent behavior in the relevant regions. Blocked ads should leave the article readable.
4. To stop new ad requests, remove `ADSENSE_ENABLED` or set it to `0` and redeploy. Never click your own ads or manufacture test impressions.

The code cannot change your AdSense settings, grant TMDB rights, deploy to Render, or request Google's review without access to those accounts. Keep ads disabled until those operator steps are complete.

References: [publisher-content policy](https://support.google.com/publisherpolicies/answer/11112688), [verification](https://support.google.com/adsense/answer/12169212), [Auto ads exclusions](https://support.google.com/adsense/answer/9262311), [consent requirements](https://support.google.com/adsense/answer/13554116), [TMDB FAQ](https://developer.themoviedb.org/docs/faq).
