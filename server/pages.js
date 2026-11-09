// Public reading pages are rendered on the server, independently of the game API.
const publisher = 'ca-pub-5233222257140990';
export const contactEmail = 'topporules@gmail.com';
const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[c],
  );

export const publicPages = new Map([
  [
    '/guides',
    {
      title: 'The box office field guide',
      description:
        'Learn the rules, understand movie revenue, and make better comparisons in BoxOffice Battle.',
      category: 'THE READING ROOM',
      body: `<p class="lead">A famous movie is not always the biggest movie. BoxOffice Battle turns that gap between reputation and ticket sales into a guessing game. These guides explain the numbers behind your decisions, without treating revenue as a measure of artistic quality.</p>
      <div class="guide-grid">
        <a class="guide-card" href="/how-to-play"><span>01 / START HERE</span><h2>How to play</h2><p>Learn the four modes, the reveal, keyboard controls, and what makes a guess count.</p></a>
        <a class="guide-card" href="/box-office-explained"><span>02 / THE NUMBERS</span><h2>What box office actually measures</h2><p>Worldwide versus domestic grosses, rereleases, inflation, and why a billion-dollar gross is not a billion-dollar profit.</p></a>
        <a class="guide-card" href="/guides/comparing-movies"><span>03 / BUILD YOUR INSTINCTS</span><h2>How to compare two movies</h2><p>A repeatable way to weigh release era, audience reach, franchise familiarity, and misleading personal favorites.</p></a>
        <a class="guide-card" href="/guides/blockbuster-matchups"><span>04 / WORKED EXAMPLES</span><h2>Three blockbuster matchups</h2><p>Use Titanic, Avatar, Jurassic Park, and other familiar films to separate good reasoning from hindsight.</p></a>
        <a class="guide-card" href="/methodology"><span>05 / BEHIND THE GAME</span><h2>Sources and methodology</h2><p>Understand eligibility, frozen game data, missing figures, and the limits of our movie library.</p></a>
      </div>
      <h2>Read, then test a prediction</h2><p>Choose one idea from a guide and apply it to your next matchup. After the reveal, ask whether your reasoning was useful rather than inventing an explanation for the winner. Practice mode is a good place to try this because a wrong answer does not end the run.</p>`,
    },
  ],
  [
    '/how-to-play',
    {
      title: 'How to play BoxOffice Battle',
      description:
        'A complete guide to higher-or-lower movie guesses, Classic, Daily, Rush, Practice, scoring, and keyboard controls.',
      category: 'GAME GUIDE',
      body: `<p class="lead">Two films. One visible total. Decide whether the film on the right earned more or less at the worldwide box office than the film on the left.</p>
      <h2>Your first round</h2><ol><li>Open the game. A Classic run starts automatically when the connection is ready; no account is required.</li><li>Read the left film's title, release year, and displayed box office. Use the year to distinguish different adaptations or remakes.</li><li>Select <strong>Higher</strong> if you think the right film earned more, or <strong>Lower</strong> if you think it earned less.</li><li>The right film's total is revealed. Each correct answer adds one point. When the mode allows another round, choose Next.</li></ol>
      <p>For example, if the left film shows $400 million and you expect the right film to have earned $650 million, choose Higher. This is an illustrative example, not a claim about particular films. The comparison uses the stored full totals, so rounded screen labels are not the scoring authority. An exact tie does not count as either higher or lower.</p>
      <h2>Choose a mode after your run</h2><dl><dt>Classic</dt><dd>Build a streak until your first incorrect guess. Reaching the end of the available deck also finishes the run.</dd><dt>Daily</dt><dd>Answer ten matchups. An incorrect answer costs the point, but you continue through the challenge. The daily lineup is shared and resets at midnight UTC. You get one daily attempt per player, and an unfinished attempt can be resumed.</dd><dt>Rush</dt><dd>You have 12 seconds to answer each matchup. The timer resets when the next round begins. A wrong answer or an expired timer ends the run; backgrounding the tab does not pause the server's clock.</dd><dt>Practice</dt><dd>Keep learning after a miss and optionally filter by genre. Practice is unranked. A small genre pool can run out of matchups sooner than the full collection.</dd></dl>
      <h2>Choose your movies</h2><p>After a run ends, choose Classic, Rush, or Practice, then use Movies in your next run to select Action, Comedy, Animation, Sci-fi, Fantasy, Drama, or All movies. Start the next run to apply the choice. Both films in every matchup come from the selected genre. Films can belong to several genres, so the same title may appear in more than one category. Genre runs save progress but are excluded from the all-movies leaderboards. Daily always uses the shared all-movies lineup.</p><h2>Level up and personalize your studio</h2><p>Correct guesses earn 25 XP. Completing a run earns another 50 XP; ending a run early does not earn that completion bonus. Levels and achievements unlock player titles and interface color themes. Open My studio to see every reward, its requirement, and an Equip button for rewards you have earned. Existing progress counts automatically. Your choices stay with your player and carry over when a guest registers. These rewards are cosmetic: they never give extra time, points, or easier matchups.</p><h2>Controls and progress</h2><p>Use the on-screen buttons, or press the up arrow for Higher, down arrow for Lower, and Enter for Next when that action is available. Escape closes a dialog. Sound can be disabled, and reduced-motion preferences are respected.</p><p>End run takes you to the results and mode selector. Reloading can resume a saved game; switching devices requires a registered account. Guest play works without registration, while registered completed runs can appear on public leaderboards. Accounts use a recovery code rather than email recovery, so keep that code somewhere private.</p>
      <h2>What the score means</h2><p>A point records a correct comparison against the game's saved dataset, not a judgment of film quality. A favorite film can lose a matchup and still be a favorite. Our <a href="/methodology">methodology</a> explains why published totals can differ between sources.</p>`,
    },
  ],
  [
    '/box-office-explained',
    {
      title: 'What box office actually measures',
      description:
        'Understand worldwide movie grosses, production budgets, inflation, rereleases, and the limits of comparing theatrical revenue.',
      category: 'BOX OFFICE BASICS',
      adEligible: true,
      body: `<p class="lead">Box office measures theatrical ticket revenue. It is a useful way to compare the commercial reach of movies, but it answers a narrower question than “Which movie was most successful?” Understanding that difference makes the game more interesting.</p>
      <h2>Worldwide is not the same as domestic</h2><p>A domestic figure covers a particular home market; for many US box office reports that means the United States and Canada. Worldwide revenue combines domestic and international theatrical grosses. A film with a larger domestic audience can still finish below another film worldwide.</p><p>In BoxOffice Battle, compare the reported worldwide figure stored for each movie. Do not substitute an opening-weekend headline, a streaming audience estimate, or a domestic-only total. Before using an outside source to check a reveal, make sure both sources measure the same thing.</p>
      <h2>Gross revenue is not studio profit</h2><p>The ticket price is not paid entirely to the film's producer. Theaters retain a share, and the amount returned to distributors varies by market and agreement. Production budgets also leave out some costs, including marketing and distribution. Public budget estimates can themselves be incomplete.</p><p>Consider a hypothetical $100 million production with $200 million in ticket sales. Subtracting one from the other does not establish a $100 million profit. The studio did not receive every ticket dollar, and production was not its only expense. A simple “twice the budget” rule can be a rough conversation starter, but it cannot establish a film's actual break-even point.</p>
      <h2>Release era changes the comparison</h2><p>Nominal revenue uses the dollars reported for the release, without adjusting all films to the same purchasing power. Ticket prices, exchange rates, available screens, and the size of international markets change over time. An older film can sell a remarkable number of tickets and still trail a newer film in nominal dollars.</p><p>This game uses nominal reported totals. That makes the rule understandable, but it does not settle which film attracted more viewers. A true admissions comparison needs reliable ticket counts; an inflation comparison needs a stated method and consistent markets. Dividing a worldwide total by today's US ticket price would mix incompatible assumptions.</p>
      <h2>Rereleases and changing totals</h2><p>A movie can return to theaters long after its original release. Depending on how a provider maintains its record, a lifetime figure may include later runs. Totals can also change when a provider corrects historical information. The release year shown in the game identifies the movie, not a promise that its gross comes only from that year's screenings.</p>
      <h2>Use the number for the question it answers</h2><p>When guessing, think about worldwide theatrical revenue. When discussing a film's legacy, leave room for other measures: audience enthusiasm, critical reception, influence, and longevity. The scoreboard is a comparison tool, not a verdict on what people should enjoy.</p><p>For details on our particular dataset, read <a href="/methodology">sources and methodology</a>. For the provider's field definition, see the <a href="https://developer.themoviedb.org/reference/movie-details">TMDB movie-details reference</a>.</p>`,
    },
  ],
  [
    '/guides/comparing-movies',
    {
      title: 'How to compare two movies before you guess',
      description:
        'A practical framework for higher-or-lower movie guesses: release era, worldwide reach, franchise history, and uncertainty.',
      category: 'PLAYING WITH CONTEXT',
      adEligible: true,
      body: `<p class="lead">Recognition is useful, but it can mislead you. You may have watched one film ten times and never seen the other. The box office reflects the ticket-buying audience, not the number of times a title appears in your own life.</p>
      <h2>1. Establish the scale of the visible film</h2><p>Start with the number you can see. Is the challenger trying to clear a modest theatrical total, a major hit, or an unusually large blockbuster? Comparing against an actual threshold is easier than trying to recall a precise total from memory.</p><p>For a hypothetical $80 million reference, a broad international hit has a plausible path to Higher. Against a hypothetical $1.5 billion reference, “I remember it being popular” is much weaker evidence. Both examples use invented thresholds so you can practice the reasoning without memorizing an answer.</p>
      <h2>2. Check the film and year</h2><p>Distinguish the original from a remake, a sequel, or a similarly named film. Then consider the release era. A newer movie may benefit from higher ticket prices and a larger international market, but recency does not guarantee a higher total. A limited release can still sit far below an older global event.</p>
      <h2>3. Think beyond your home market</h2><p>Ask how readily the film could reach audiences across countries. Action spectacle, animation, familiar characters, and a widely distributed franchise can provide useful clues. These are hypotheses rather than rules: local popularity is not proof of worldwide reach, and a franchise name does not guarantee that every installment performed equally well.</p><p>A helpful habit is to state the uncertainty: “I know this was a big hit where I live, but I am unsure about its international run.” That is a better foundation than treating a domestic opening-weekend story as a worldwide lifetime total.</p>
      <h2>4. Separate reputation from the original theatrical run</h2><p>A film can become beloved through television, discs, streaming, or word of mouth after theaters. Those later audiences can explain why it feels enormous today without increasing its original theatrical gross. Conversely, a movie you rarely hear discussed may have drawn a very large audience at release.</p>
      <h2>5. Review the decision after the reveal</h2><p>Ask which clue mattered. Did you confuse domestic and worldwide? Overweight the franchise? Forget a rerelease? Keep the lesson narrow enough to be useful next time. One upset does not establish that all animated films, sequels, or older movies behave alike.</p><p>Try Practice and focus on one category for a run. If close comparisons keep surprising you, treat them as uncertain instead of inventing a story of certainty after every answer. In Classic, a streak also depends on which matchups appear; a short run is not a complete measure of movie knowledge.</p>
      <h2>A compact pre-guess checklist</h2><ul><li>Am I comparing the correct title and release year?</li><li>How high is the visible threshold?</li><li>Am I remembering worldwide ticket sales or a different measure?</li><li>Does my reasoning depend mostly on my own familiarity?</li></ul><p>See the framework in action in <a href="/guides/blockbuster-matchups">three blockbuster matchups</a>.</p>`,
    },
  ],
  [
    '/guides/blockbuster-matchups',
    {
      title: 'Three blockbuster matchups, and how to think about them',
      description:
        'Worked comparisons of Avatar and Titanic, Jurassic Park and The Avengers, and Frozen and Toy Story 3, with data caveats.',
      category: 'THE MATCHUP NOTEBOOK',
      adEligible: true,
      body: `<p class="lead">A useful comparison explains which evidence matters before the answer is known. These examples use familiar films to show how release era, worldwide audience, and franchise recognition can point in different directions.</p>
      <p>These are qualitative comparisons, not a live revenue feed. Follow the linked source records for provider totals; rereleases and corrections can change figures. The saved total in your own run remains the scoring reference.</p>
      <h2>Avatar (2009) versus Titanic (1997)</h2><p>Both films are associated with James Cameron and unusually broad global audiences. That shared identity is not enough to separate them. Titanic's cultural presence can make it feel like the automatic winner, while Avatar's later release and premium-format appeal are reasons to consider the other side.</p><p>In reported nominal worldwide totals, Avatar is the larger of the two. The lesson is not “newer always wins.” It is that cultural memory, ticket prices, release conditions, and lifetime revenue are different things. This comparison cannot tell you which film sold more tickets without an admissions dataset, nor which has the greater artistic legacy.</p><p>Source records: <a href="https://www.themoviedb.org/movie/19995-avatar">Avatar</a> and <a href="https://www.themoviedb.org/movie/597-titanic">Titanic</a>.</p>
      <h2>Jurassic Park (1993) versus The Avengers (2012)</h2><p>Jurassic Park is a landmark blockbuster with a long life beyond its initial run. The Avengers brings a later release and a crossover built from several established characters. A player who grew up with Jurassic Park may overestimate how strongly personal familiarity predicts nominal worldwide revenue.</p><p>The Avengers has the higher reported worldwide gross. Jurassic Park's later theatrical rereleases make this an especially useful reminder to check whether a source is reporting the first run or a lifetime total. Neither film's production budget alone predicts the answer.</p><p>Source records: <a href="https://www.themoviedb.org/movie/329-jurassic-park">Jurassic Park</a> and <a href="https://www.themoviedb.org/movie/24428-the-avengers">The Avengers</a>.</p>
      <h2>Frozen (2013) versus Toy Story 3 (2010)</h2><p>This comparison puts a newer story against an established sequel. A franchise gives Toy Story 3 a strong recognition advantage, but “sequel” is a clue, not a scoring rule. Frozen's audience reach demonstrates why an original installment can outgross a familiar series entry.</p><p>Frozen has the higher reported worldwide total. Its music and characters are plausible context for its broad appeal, but the revenue total alone cannot prove how much any one factor caused the result. Distinguishing an explanation from a measured cause keeps box office discussion honest.</p><p>Source records: <a href="https://www.themoviedb.org/movie/109445-frozen">Frozen</a> and <a href="https://www.themoviedb.org/movie/10193-toy-story-3">Toy Story 3</a>.</p>
      <h2>Take the pattern, not just the answer</h2><p>Each pair exposes a different shortcut: treating cultural status as a revenue rank, treating an older favorite as unbeatable, or assuming an established franchise must lead an original story. Use those lessons on an unfamiliar matchup, then check your reasoning after the reveal. Read <a href="/box-office-explained">what box office measures</a> before comparing these nominal totals across decades.</p>`,
    },
  ],
  [
    '/methodology',
    {
      title: 'Sources, scoring, and data limitations',
      description:
        'How BoxOffice Battle selects films, stores reported revenue, handles updates, and keeps a run consistent.',
      category: 'OUR METHODOLOGY',
      body: `<p class="lead">The game compares reported worldwide theatrical revenue in nominal US dollars. It does not estimate studio profit, ticket admissions, streaming revenue, or inflation-adjusted popularity.</p>
      <h2>Where the library comes from</h2><p>The application includes a small bundled movie collection and can expand it using The Movie Database (TMDB). The active library depends on whether a successful import is available. The game does not promise a fixed number of films or complete coverage of film history.</p><p>Imported records must have a positive reported revenue, usable poster information, a valid release date, and non-adult classification. The importer avoids releases from the last 90 days to reduce the use of unfinished theatrical runs. Those checks make a record eligible for play; they are not independent verification of its revenue.</p>
      <h2>Missing is not zero</h2><p>A provider can omit a figure or report zero when reliable revenue is unavailable. We exclude those records rather than treating missing information as a film earning no money. This creates a selection bias toward films with available data. Absence from the collection says nothing about a movie's quality or whether it played in theaters.</p>
      <h2>A stable answer for each run</h2><p>Successful imports create catalog versions. A game retains its catalog so an update cannot silently change its answer halfway through a run. The daily challenge pins a lineup for the UTC day. A later correction may appear in a future game while the existing game continues to use its saved values.</p><p>The full stored totals determine whether a guess is correct; a shortened on-screen number is for readability. Higher means strictly greater and Lower means strictly smaller. Equal underlying totals make neither choice correct. This is a limitation of the current two-choice rule.</p>
      <h2>What has not been independently verified</h2><p>Provider figures and the bundled collection are game data, not audited financial statements. Historical reports may differ over territories, exchange rates, rerelease inclusion, and update dates. We do not claim each imported entry has received individual editorial fact-checking. Editorial guides explain the concepts separately from the automatically imported collection.</p>
      <h2>Corrections</h2><p>If a result looks wrong, email <a href="mailto:${contactEmail}">${contactEmail}</a> with the film title, release year, game mode, date, displayed figure, and a link to the source you are comparing. Do not send a password or recovery code. We can investigate the record and its source; a submitted report is not a guarantee of an immediate correction.</p>
      <h2>Attribution</h2><p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p><a href="https://www.themoviedb.org"><img class="tmdb-logo" src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_short-8e7b30f73a4020692ccca9c88bafe5dcb6f8a62a4c6bc55cd9ba82bb2cd95f6c.svg" alt="The Movie Database" width="140" height="32" /></a><p>Read the <a href="https://developer.themoviedb.org/reference/movie-details">movie-details documentation</a> and <a href="https://developer.themoviedb.org/docs/faq">TMDB usage and licensing FAQ</a>. Posters remain the property of their respective rights holders; attribution does not itself establish commercial usage rights.</p>`,
    },
  ],
  [
    '/about',
    {
      title: 'About BoxOffice Battle',
      description:
        'An independent movie guessing game about the gap between film recognition and worldwide ticket sales. Contact and editorial information.',
      category: 'ABOUT & CONTACT',
      body: `<p class="lead">BoxOffice Battle is an independent higher-or-lower movie game. Its central question is simple: does recognizing a film help you predict its worldwide theatrical revenue?</p><h2>What you can do here</h2><p>Play a quick Classic run, try the ten-matchup Daily challenge, test your decisions under a Rush timer, or explore a genre in Practice. The <a href="/guides">reading room</a> explains how to interpret the figures instead of treating every reveal as a ranking of movie quality.</p><h2>How we approach the subject</h2><p>We distinguish reported gross from profit, nominal dollars from admissions, and a plausible explanation from a proven cause. The movie library can be imported from a third-party provider; the site's guides provide additional context and explain the limitations of the game. We do not represent film studios, and a movie's appearance does not imply endorsement.</p><h2>Contact and corrections</h2><p>Email <a href="mailto:${contactEmail}">${contactEmail}</a> for feedback, accessibility problems, rights questions, or a disputed figure. For a gameplay issue, include your browser, device, and steps that led to the problem. For data corrections, follow the details on our <a href="/methodology">methodology page</a>. Never send your password, session cookie, API token, or recovery code.</p><h2>Accounts are optional</h2><p>You can play as a guest. Registration adds cross-device progress and eligibility for public leaderboards. It does not require an email address. Your <a href="/privacy">privacy and data controls</a> explain what is stored and how to export or delete an account.</p>`,
    },
  ],
  [
    '/privacy',
    {
      title: 'Privacy and your data',
      description:
        'Session cookies, game records, local storage, third-party posters, advertising choices, and account deletion in BoxOffice Battle.',
      category: 'PRIVACY',
      body: `<p class="lead">You can play without giving us an email address. The game still needs some storage to remember a player and save progress. This page describes that storage and the controls available to you.</p><h2>Essential storage</h2><p>An HTTP-only session cookie connects your browser to a guest or registered player for up to 30 days. Settings are stored on your device. These features support gameplay rather than advertising. Clearing browser storage may remove access to guest progress and device preferences.</p><h2>What the application saves</h2><p>The server stores session identifiers, game history, and your equipped reward choices. Registered accounts also have a player name, hashed password, and hashed recovery code. Public leaderboards display registered names and scores. No email address is required for registration, and the application does not provide email-based account recovery.</p><h2>Logs and retention</h2><p>Application logs include request IDs, methods, endpoints, response status, and timing. Passwords and recovery codes are not intentionally logged. The hosting provider may process network information to operate its service. Guest records with no live sessions become eligible for cleanup after 30 days; registered accounts remain until deleted. Eligibility is not a promise of deletion at an exact time.</p><h2>Posters and external links</h2><p>When TMDB images are used, your browser contacts TMDB servers, which receive normal network request information such as your IP address. Following a source or other external link takes you to a service with its own privacy practices. Our <a href="/methodology">methodology page</a> describes the movie-data source.</p><h2>Advertising</h2><p>The game, account screens, and this privacy page do not load Google ad code. Advertising is disabled by default in this release. If enabled by the operator, Google ads are limited in the application to selected editorial articles. Google and its partners may then process cookies, device information, and browsing activity for ad delivery and measurement. See <a href="https://policies.google.com/technologies/ads">Google's advertising information</a> and <a href="https://myadcenter.google.com/">My Ad Center</a>. These links do not replace any consent message required for the site.</p><h2>Your controls and contact</h2><p>Open My studio in the game to export game data or delete a registered account. Signing out or closing a tab does not delete saved records. Contact <a href="mailto:${contactEmail}">${contactEmail}</a> for privacy questions. Do not email passwords or recovery codes. Deleting an account from the running application does not immediately erase independent historical backups.</p>`,
    },
  ],
]);

export function renderPublicPage(path, { nonce, origin, adsenseSlot = '' }) {
  const page = publicPages.get(path);
  if (!page) return null;
  const ad = page.adEligible && /^\d{10}$/.test(adsenseSlot);
  const canonical = origin
    ? `<link rel="canonical" href="${escapeHtml(origin + path)}" />`
    : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><meta name="theme-color" content="#0b0e14" /><meta name="description" content="${escapeHtml(page.description)}" /><meta name="google-adsense-account" content="${publisher}" /><title>${escapeHtml(page.title)} | BoxOffice Battle</title>${canonical}<link rel="icon" href="/icon.svg" type="image/svg+xml" /><link rel="stylesheet" href="/reading.css" />${ad ? `<script nonce="${nonce}" async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${publisher}" crossorigin="anonymous"></script>` : ''}</head>
  <body><a class="skip" href="#content">Skip to content</a><header class="site-header"><a class="brand" href="/">BOXOFFICE<span>BATTLE</span></a><nav aria-label="Main navigation"><a href="/guides" ${path === '/guides' ? 'aria-current="page"' : ''}>Guides</a><a href="/methodology">Our data</a><a href="/about">About</a><a class="play-link" href="/#play">Play the game ↗</a></nav></header>
  <main id="content"><article><p class="eyebrow">${page.category}</p><h1>${escapeHtml(page.title)}</h1>${page.body}${ad ? `<aside class="advertisement" aria-label="Advertisement"><p>Advertisement</p><ins class="adsbygoogle" style="display:block" data-ad-client="${publisher}" data-ad-slot="${adsenseSlot}" data-ad-format="auto" data-full-width-responsive="true"></ins></aside><script nonce="${nonce}">(window.adsbygoogle = window.adsbygoogle || []).push({});</script>` : ''}<div class="article-next"><p>Put your movie instincts to the test.</p><a class="play-link" href="/#play">Play BoxOffice Battle ↗</a><a href="/guides">Explore the guides</a></div></article></main>
  <footer><span>© 2026 BoxOffice Battle</span><nav aria-label="Footer"><a href="/how-to-play">How to play</a><a href="/methodology">Sources & corrections</a><a href="/about">About & contact</a><a href="/privacy">Privacy</a></nav></footer></body></html>`;
}
