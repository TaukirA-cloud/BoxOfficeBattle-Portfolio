# Movie dataset

`movies.json` preserves the original project's 69 manually curated historical worldwide theatrical grosses. Its version is `curated-v1`, defined in `server/game.js`. It is a prototype dataset, not a licensed live feed. No source URLs, verified observation dates, or rights documentation were supplied with the original figures; none are invented here.

Each record has a stable numeric `id`, `title`, `year`, integer `gross` in USD, `genre`, and two original artwork colors. Grosses may change with re-releases, and releases from different years are not adjusted for inflation. Ties are incorrect in every mode. The public collection endpoint omits grosses; the game only reveals a challenger after the guess.

The optional TMDB integration imports posters and positive reported movie revenues into immutable catalog snapshots in SQLite. It uses namespaced IDs, records source URLs and observation dates, and pins saved games and daily lineups to their original catalog version. See [TMDB setup](../docs/TMDB.md). Its developer API is free for non-commercial use with attribution; commercial use needs an agreement with TMDB. Revenue is provider-reported and is not guaranteed to be an audited or complete worldwide theatrical figure.

The starter `curated-v1` snapshot stays available for existing games. Do not edit its original revenues in place. The current TMDB catalog can supply matching posters to those games without changing their historical game figures. A positive revenue value and valid poster are required for new TMDB catalog entries; unknown revenue is never converted to a zero-gross opponent.

Poster images are loaded from TMDB's public image CDN when configured; no official poster files are bundled into the repository. Original CSS geometry remains the fallback. The application includes TMDB attribution and an approved linked logo. Image and data use must follow the provider's applicable terms.
