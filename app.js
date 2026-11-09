const $ = (id) => document.getElementById(id);
const all = (selector) => [...document.querySelectorAll(selector)];
const money = (number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(number);
const escape = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
  );
const modeNames = {
  classic: 'Classic',
  daily: 'Daily ten',
  rush: 'Rush',
  practice: 'Practice',
};
const modeLabels = {
  classic: 'CLASSIC / ENDLESS STREAK',
  daily: 'DAILY / TEN MATCHUPS',
  rush: 'RUSH / 12 SECONDS TO DECIDE',
  practice: 'PRACTICE / DIRECTOR’S CUT',
};
let runAchievements = [];
const posterUrl = (value) =>
  typeof value === 'string' &&
  /^https:\/\/image\.tmdb\.org\/t\/p\/(w500|w780|original)\/[\w-]+\.(jpg|png|webp)$/.test(
    value,
  )
    ? value
    : null;

function renderCatalogInfo(info) {
  if (!info) return;
  $('catalogStatus').textContent =
    info.status === 'syncing'
      ? `Preparing a larger movie library. ${info.progress?.accepted?.toLocaleString() || 0} movies found so far. Your current run is saved.`
      : `${info.count.toLocaleString()} movies in the library${info.source === 'tmdb' ? ' with posters and reported revenue' : ''}.`;
  $('tmdbCredits').classList.toggle('hidden', !info.configured && info.source !== 'tmdb');
}

function syncPlayView() {
  const playingPage = !$('playPage').classList.contains('hidden');
  document.body.classList.toggle('play-view', playingPage);
  document.body.classList.toggle('playing', playingPage && game?.phase !== 'finished');
}

function renderRewards() {
  if (!me || game?.phase !== 'finished') return;
  const earned = game.score * 25 + (game.endedEarly ? 0 : 50);
  $('runRewards').textContent =
    `+${earned} XP · Level ${me.stats.level}${runAchievements.length ? ` · Unlocked: ${runAchievements.join(', ')}` : ''}`;
}
function readLocal(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}
function saveLocal(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Settings remain available in memory. */
  }
}
const savedSettings = readLocal('bob-settings-v2', {});
let settings = {
  sound: savedSettings?.sound === true,
  reducedMotion: savedSettings?.reducedMotion === true,
};
let me = null,
  game = null,
  busy = false,
  selectedMode = 'classic',
  boardMode = 'classic';
let clockOffset = 0,
  timeoutInFlight = false,
  toastTimer,
  audio;
let ready = false,
  boardRequest = 0,
  installPrompt = null;

function setConnection(online) {
  $('connection').className = `connection ${online ? 'online' : 'offline'}`;
  $('connection').innerHTML = `<i></i> ${online ? 'Connected' : 'Reconnecting'}`;
}
async function api(path, data) {
  let response;
  try {
    response = await fetch(`/api/${path}`, {
      method: data === undefined ? 'GET' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'BoxOfficeBattle',
      },
      credentials: 'same-origin',
      cache: 'no-store',
      ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    setConnection(false);
    throw new Error(
      'Connection interrupted. Your run is saved. Reconnect and try again.',
    );
  }
  setConnection(true);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Could not complete that action.');
  return result;
}
function toast(message, error = false) {
  clearTimeout(toastTimer);
  $('toast').textContent = message;
  $('toast').className = `toast${error ? ' error' : ''}`;
  toastTimer = setTimeout(() => $('toast').classList.add('hidden'), error ? 7000 : 4500);
}
function setBusy(value) {
  busy = value;
  all(
    '.mode-card, #higherBtn, #lowerBtn, #nextBtn, #restartBtn, #playAgainBtn, #genreSelect, #dailyBtn, #sidebarDaily, #endRunBtn',
  ).forEach((button) => (button.disabled = value || !ready));
  $('gameArea').setAttribute('aria-busy', String(value));
}
function updateSettings() {
  document.documentElement.classList.toggle('reduced-motion', settings.reducedMotion);
  $('soundBtn').setAttribute('aria-pressed', String(settings.sound));
  $('soundBtn').setAttribute(
    'aria-label',
    settings.sound ? 'Disable sound' : 'Enable sound',
  );
  $('soundLabel').textContent = settings.sound ? 'Sound on' : 'Sound off';
  saveLocal('bob-settings-v2', settings);
}
function beep(correct) {
  if (!settings.sound) return;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    audio.resume();
    const osc = audio.createOscillator(),
      gain = audio.createGain();
    osc.frequency.setValueAtTime(correct ? 660 : 220, audio.currentTime);
    osc.frequency.exponentialRampToValueAtTime(
      correct ? 880 : 160,
      audio.currentTime + 0.12,
    );
    gain.gain.setValueAtTime(0.04, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + 0.2);
  } catch {
    /* Audio feedback is optional. */
  }
}
function modal(title, html) {
  $('modalTitle').textContent = title;
  $('modalBody').innerHTML = html;
  if (!$('modal').open) $('modal').showModal();
}
function closeModal() {
  $('modal').close();
}
function confirmAction(title, description, action, label = 'Continue') {
  modal(
    title,
    `<p class="modal-copy">${escape(description)}</p><div class="summary-actions"><button id="confirmAction" class="primary">${escape(label)}</button><button id="cancelAction" class="secondary">Keep playing</button></div>`,
  );
  $('cancelAction').onclick = closeModal;
  $('confirmAction').onclick = () => {
    closeModal();
    action();
  };
}
function updateProfile(profile) {
  const oldRewards = new Set(
    me?.rewards?.filter((r) => r.unlocked).map((r) => r.id) || [],
  );
  const previousLevel = me?.stats?.level;
  const previous = new Set(
    me?.stats?.achievements.filter((a) => a.unlocked).map((a) => a.id) || [],
  );
  const existed = Boolean(me);
  me = { ...me, ...profile };
  if (existed) {
    for (const unlocked of me.stats.achievements.filter(
      (a) => a.unlocked && !previous.has(a.id),
    ))
      if (!runAchievements.includes(unlocked.name)) runAchievements.push(unlocked.name);
    for (const reward of (me.rewards || []).filter(
      (r) => r.unlocked && !oldRewards.has(r.id),
    )) {
      const label = `${reward.kind === 'title' ? 'Title' : 'Theme'}: ${reward.name}`;
      if (!runAchievements.includes(label)) runAchievements.push(label);
    }
    if (previousLevel && me.stats.level > previousLevel) {
      const label = `Level ${me.stats.level} reached`;
      if (!runAchievements.includes(label)) runAchievements.push(label);
    }
  }
  const stats = me.stats;
  $('headerName').textContent = me.username || 'Guest player';
  $('headerAvatar').textContent = (me.username || 'G')[0].toUpperCase();
  $('accountBtn').title = me.equipped?.title?.name || 'Your studio';
  $('headerTitle').textContent = me.equipped?.title?.name || 'Movie newcomer';
  document.documentElement.style.setProperty(
    '--gold',
    me.equipped?.theme?.color || '#eac77a',
  );
  $('best').textContent = stats.best;
  $('accuracy').textContent = stats.total ? `${stats.accuracy}%` : '—';
  $('rankLabel').textContent =
    selectedMode !== 'daily' && $('genreSelect').value !== 'All movies'
      ? 'GENRE RUN / UNRANKED'
      : selectedMode === 'practice'
        ? 'UNRANKED'
        : me.registered
          ? 'RANKED PLAYER'
          : 'GUEST RUN';
  $('levelLabel').textContent = `LEVEL ${String(stats.level).padStart(2, '0')}`;
  $('xpLabel').textContent = `${stats.xp.toLocaleString()} XP`;
  const floor = (stats.level - 1) ** 2 * 100,
    ceiling = stats.level ** 2 * 100;
  $('xpBar').style.width = `${((stats.xp - floor) / (ceiling - floor)) * 100}%`;
  $('nextLevelLabel').textContent =
    `${ceiling - stats.xp} XP TO LEVEL ${stats.level + 1}`;
  const next = stats.achievements.find((a) => !a.unlocked);
  $('progressTitle').textContent = next
    ? `Next up: ${next.name}.`
    : 'A collection of standing ovations.';
  $('progressText').textContent = next
    ? `${next.description} ${next.progress}/${next.target} so far.`
    : 'Every trophy unlocked. Keep chasing your personal best.';
  const nextReward = me.rewards?.find((r) => !r.unlocked && r.level);
  $('nextReward').textContent = nextReward
    ? `Next level reward: ${nextReward.name} (${nextReward.kind}) at level ${nextReward.level}.`
    : 'All level rewards unlocked. Explore milestone rewards in My studio.';
  $('dailyStatus').textContent = me.daily?.finished
    ? `Today’s challenge: ${me.daily.score}/10. Come back at midnight UTC.`
    : me.daily
      ? 'Your daily challenge is waiting. Pick up where you left off.'
      : 'One challenge. A new lineup every midnight UTC.';
  renderProfile();
  renderRewards();
  renderCatalogInfo(me.catalog);
}
function selectMode(mode) {
  selectedMode = mode;
  all('[data-mode]').forEach((button) => {
    const active = button.dataset.mode === mode;
    button.classList.toggle('selected', active);
    button.setAttribute('aria-pressed', String(active));
  });
  $('modeLabel').textContent = modeLabels[mode];
  $('genreWrap').classList.toggle('hidden', mode === 'daily');
  $('scoreLabel').textContent = ['daily', 'practice'].includes(mode)
    ? 'CORRECT GUESSES'
    : 'CURRENT STREAK';
  $('rankLabel').textContent =
    mode !== 'daily' && $('genreSelect').value !== 'All movies'
      ? 'GENRE RUN / UNRANKED'
      : mode === 'practice'
        ? 'UNRANKED'
        : me?.registered
          ? 'RANKED PLAYER'
          : 'GUEST RUN';
  $('timerLabel').textContent = mode === 'rush' ? 'SECONDS LEFT' : 'YOUR LEVEL';
  $('restartBtn').textContent = `Start ${modeNames[mode]} →`;
  $('playAgainBtn').textContent =
    mode === 'daily' && me?.daily?.finished
      ? 'View today’s result'
      : `Play ${modeNames[mode]} →`;
}
function poster(side, movie) {
  const panel = $(side + 'Poster');
  panel.style.setProperty('--poster-a', movie.a);
  panel.style.setProperty('--poster-b', movie.b);
  const url = posterUrl(movie.posterUrl);
  let image = panel.querySelector('.poster-image');
  if (image?.dataset.source !== url) {
    image?.remove();
    panel.classList.remove('has-poster');
    if (url) {
      image = new Image();
      image.className = 'poster-image';
      image.alt = '';
      image.setAttribute('aria-hidden', 'true');
      image.decoding = 'async';
      image.referrerPolicy = 'no-referrer';
      image.dataset.source = url;
      image.onload = () => {
        if (panel.querySelector('.poster-image') === image)
          panel.classList.add('has-poster');
      };
      image.onerror = () => {
        if (panel.querySelector('.poster-image') === image) {
          image.remove();
          panel.classList.remove('has-poster');
        }
      };
      panel.prepend(image);
      image.src = url;
    }
  }
  $(side + 'PosterTitle').textContent = movie.title;
  $(side + 'PosterYear').textContent = movie.year;
  $(side + 'Meta').textContent = `${movie.year} · ${movie.genre}`;
  $(side + 'Title').textContent = movie.title;
  if (side === 'left')
    $('leftCard').querySelector('.movie-label').textContent =
      movie.source === 'tmdb' ? 'REPORTED BOX OFFICE (USD)' : 'WORLDWIDE BOX OFFICE';
}
function renderGame(data) {
  if (game?.id !== data.id) runAchievements = [];
  game = data;
  clockOffset = game.serverTime - Date.now();
  if (game.genre) $('genreSelect').value = game.genre;
  selectMode(game.phase === 'finished' && game.mode === 'daily' ? 'classic' : game.mode);
  $('gameLoading').classList.add('hidden');
  $('gameArea').classList.remove('hidden');
  $('score').textContent = game.score;
  $('round').textContent = game.mode === 'daily' ? `${game.round}/10` : game.round;
  poster('left', game.left);
  poster('right', game.right);
  const revealed = game.phase !== 'guess',
    finished = game.phase === 'finished';
  $('leftMoney').textContent = money(game.left.gross);
  $('rightMoney').textContent = revealed ? money(game.right.gross) : '$ — — —';
  $('rightMoney').classList.toggle('mystery', !revealed);
  $('rightQuestion').textContent = revealed
    ? game.right.source === 'tmdb'
      ? 'REPORTED BOX OFFICE (USD)'
      : 'WORLDWIDE BOX OFFICE'
    : 'DID IT MAKE HIGHER OR LOWER?';
  $('guessControls').classList.toggle('hidden', revealed);
  $('result').classList.toggle('hidden', !revealed);
  $('nextBtn').classList.toggle('hidden', !revealed || finished);
  $('summary').classList.toggle('hidden', !finished);
  $('postGame').classList.toggle('hidden', !finished);
  $('timer').parentElement.classList.toggle('rush-timer', game.mode === 'rush');
  syncPlayView();
  $('rightCard').className =
    `movie-card challenger${revealed && game.lastAnswer ? (game.lastAnswer.correct ? ' correct' : ' incorrect') : ''}`;
  if (revealed && game.lastAnswer) {
    const answer = game.lastAnswer;
    const difference = Math.abs(answer.difference);
    $('result').className = `result ${answer.correct ? 'good' : 'bad'}`;
    $('result').textContent =
      `${answer.correct ? '✓ You called it.' : answer.direction === 'timeout' ? '◷ Time’s up.' : '× Not this time.'} ${difference === 0 ? 'A box office tie.' : `${money(difference)} ${answer.difference > 0 ? 'more' : 'less'} than ${game.left.title}.`}`;
  }
  $('roundHint').textContent =
    game.mode === 'daily'
      ? `${game.day} / EVERYONE GETS THE SAME TEN. RESETS AT 00:00 UTC.`
      : game.mode === 'practice'
        ? 'NO WRONG TURNS. KEEP GOING AND LEARN THE NUMBERS.'
        : 'FOLLOW THE MONEY. TRUST YOUR INSTINCTS.';
  if (finished) {
    $('finalScore').textContent = game.mode === 'daily' ? `${game.score}/10` : game.score;
    $('finalReveal').textContent = game.lastAnswer
      ? `${game.lastAnswer.direction === 'timeout' ? 'Time’s up. ' : ''}${game.left.title}: ${money(game.left.gross)} · ${game.right.title}: ${money(game.right.gross)}`
      : 'Run ended before the first guess.';
    $('summaryTitle').textContent =
      game.mode === 'daily'
        ? game.score === 10
          ? 'A perfect picture.'
          : 'Your daily is in the can.'
        : game.score >= 10
          ? 'Certified blockbuster.'
          : game.score >= 5
            ? 'A run worth watching.'
            : 'Every legend starts somewhere.';
    $('summaryText').textContent =
      `${game.score} correct out of ${game.answers.length} matchup${game.answers.length === 1 ? '' : 's'}. ${game.mode === 'daily' ? 'Come back tomorrow for a fresh ten.' : 'A new lineup is waiting for your next run.'}${!me?.registered ? ' Create an account to keep your progress across devices.' : ''}`;
    $('answerGrid').innerHTML = game.answers
      .map(
        (a, i) =>
          `<span class="${a.correct ? '' : 'miss'}" title="${escape(`Round ${i + 1}: ${a.right} — ${money(a.gross)}. ${a.correct ? 'Correct' : 'Incorrect'}`)}" aria-label="Round ${i + 1}: ${a.correct ? 'correct' : 'incorrect'}">${a.correct ? '✓' : '×'}</span>`,
      )
      .join('');
    renderRewards();
  }
  tick();
}
async function endRun() {
  if (busy || !game || game.phase === 'finished') return;
  setBusy(true);
  try {
    const data = await api('games/end', { id: game.id });
    const profile = data.profile;
    delete data.profile;
    renderGame(data);
    updateProfile(profile);
    $('summary').focus({ preventScroll: true });
  } catch (error) {
    toast(error.message, true);
  } finally {
    setBusy(false);
  }
}
async function startGame(mode = selectedMode, genre = $('genreSelect').value) {
  if (busy || !ready) return;
  setBusy(true);
  try {
    const data = await api('games', { mode, genre });
    renderGame(data);
    $('main').focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
    updateProfile(await api('me'));
  } catch (error) {
    toast(error.message, true);
  } finally {
    setBusy(false);
  }
}
function requestGame(mode, genre) {
  if (!ready || busy) return;
  const active =
    game && game.phase !== 'finished' && game.answers.length > 0 && game.mode !== 'daily';
  if (active)
    confirmAction(
      'Start a fresh run?',
      'Your current run will end. All earned guesses remain in your stats.',
      () => startGame(mode, genre),
      'Start new run',
    );
  else startGame(mode, genre);
}
async function submitGuess(direction) {
  if (busy || !game || game.phase !== 'guess') return;
  setBusy(true);
  const id = game.id;
  try {
    const data = await api('games/answer', {
      id,
      direction,
      round: game.round,
    });
    const profile = data.profile;
    delete data.profile;
    renderGame(data);
    updateProfile(profile);
    beep(data.lastAnswer.correct);
    (game.phase === 'finished' ? $('shareBtn') : $('nextBtn')).focus({
      preventScroll: true,
    });
  } catch (error) {
    toast(error.message, true);
    // A response can be lost after the server accepted the guess. Read; never replay a mutation.
    try {
      const state = await api(`game?id=${encodeURIComponent(id)}`);
      if (state.game) renderGame(state.game);
      updateProfile(await api('me'));
    } catch {
      /* The retry controls remain available when the network returns. */
    }
  } finally {
    setBusy(false);
  }
}
async function advance() {
  if (busy || game?.phase !== 'revealed') return;
  setBusy(true);
  try {
    const data = await api('games/next', { id: game.id });
    delete data.profile;
    renderGame(data);
    $('higherBtn').focus({ preventScroll: true });
  } catch (error) {
    toast(error.message, true);
    try {
      const state = await api(`game?id=${encodeURIComponent(game.id)}`);
      if (state.game) renderGame(state.game);
    } catch {
      /* Keep last known state. */
    }
  } finally {
    setBusy(false);
  }
}
function tick() {
  if (!me) return;
  const rush = game?.mode === 'rush';
  const seconds =
    rush && game.phase === 'guess'
      ? Math.max(0, Math.ceil((game.deadline - (Date.now() + clockOffset)) / 1000))
      : 0;
  $('timer').textContent = rush
    ? `${String(seconds).padStart(2, '0')}s`
    : String(me.stats.level).padStart(2, '0');
  $('timer').parentElement.classList.toggle(
    'urgent',
    rush && seconds <= 3 && game.phase === 'guess',
  );
  if (
    rush &&
    seconds === 0 &&
    game.phase === 'guess' &&
    !busy &&
    !timeoutInFlight &&
    navigator.onLine
  ) {
    timeoutInFlight = true;
    submitGuess('timeout').finally(() => {
      setTimeout(() => {
        timeoutInFlight = false;
      }, 3000);
    });
  }
}
function renderProfile() {
  if (!me) return;
  const stats = me.stats;
  $('equippedTitle').textContent = me.equipped?.title?.name || 'Movie newcomer';
  $('rewardCollection').innerHTML = (me.rewards || [])
    .map((r) => {
      const equipped = me.equipped?.[r.kind]?.id === r.id;
      return `<article class="reward-card${r.unlocked ? ' unlocked' : ''}"><span class="tag">${escape(r.kind)}</span>${r.color ? `<span class="reward-swatch" style="background:${escape(r.color)}" aria-hidden="true"></span>` : ''}<h3>${escape(r.name)}</h3><p>${escape(r.requirement)}</p><p class="muted">${r.unlocked ? 'Unlocked' : `${r.progress} / ${r.target}`}</p><button class="secondary" data-equip="${escape(r.id)}" data-kind="${escape(r.kind)}" ${!r.unlocked || equipped ? 'disabled' : ''} aria-label="${equipped ? 'Equipped' : r.unlocked ? 'Equip' : 'Locked'}: ${escape(r.name)}">${equipped ? 'Equipped' : r.unlocked ? 'Equip' : 'Locked'}</button></article>`;
    })
    .join('');
  all('[data-equip]').forEach(
    (button) =>
      (button.onclick = async () => {
        button.disabled = true;
        try {
          updateProfile(
            await api('rewards/equip', {
              kind: button.dataset.kind,
              id: button.dataset.equip,
            }),
          );
          $('rewardStatus').textContent =
            'Reward equipped. Your choice is saved with this player.';
        } catch (error) {
          $('rewardStatus').textContent = error.message;
          button.disabled = false;
        }
      }),
  );
  $('profileSubtitle').textContent = me.registered
    ? `${me.username} · Level ${stats.level} · ${stats.xp.toLocaleString()} XP. Your studio, on every device.`
    : 'Playing as a guest. Create an account to save across devices and join the leaderboard.';
  $('profileAccountBtn').classList.toggle('hidden', me.registered);
  $('logoutBtn').classList.toggle('hidden', !me.registered);
  $('deleteBtn').textContent = me.registered
    ? 'Delete account & data'
    : 'Reset guest progress';
  $('profileStats').innerHTML = [
    ['PERSONAL BEST', stats.best],
    ['LIFETIME ACCURACY', `${stats.accuracy}%`],
    ['CORRECT GUESSES', stats.correct],
    ['DAILIES COMPLETED', stats.dailies],
  ]
    .map(
      ([label, value]) =>
        `<div class="stat-card"><small>${label}</small><strong>${value}</strong></div>`,
    )
    .join('');
  $('achievementCount').textContent =
    `${stats.achievements.filter((a) => a.unlocked).length} / ${stats.achievements.length} UNLOCKED`;
  $('achievements').innerHTML = stats.achievements
    .map(
      (a) =>
        `<article class="achievement${a.unlocked ? ' unlocked' : ''}"><div class="achievement-icon" aria-hidden="true">${escape(a.icon)}</div><h3>${escape(a.name)}</h3><p>${escape(a.description)}</p><div class="progress-track"><div style="width:${(a.progress / a.target) * 100}%"></div></div><div class="progress-caption"><span>${a.unlocked ? '✓ UNLOCKED' : 'IN PROGRESS'}</span><span>${a.progress} / ${a.target}</span></div></article>`,
    )
    .join('');
  $('history').innerHTML = stats.history.length
    ? `<table><caption class="sr-only">Your recent games</caption><thead><tr><th>MODE</th><th>DATE / UTC</th><th>RESULT</th></tr></thead><tbody>${stats.history.map((row) => `<tr><td>${modeNames[row.mode]}</td><td>${escape(row.day)}</td><td>${row.score} / ${row.total} <span class="muted">${row.finished ? 'ended' : 'in progress'}</span></td></tr>`).join('')}</tbody></table>`
    : '<div class="empty-state"><strong>Your opening credits are waiting.</strong><p>Play your first run to start your story.</p><a class="primary" href="#play">Let’s play ↗</a></div>';
}
async function loadBoard() {
  const request = ++boardRequest;
  $('boardContent').innerHTML = '<div class="empty-state">Loading the credits…</div>';
  $('boardTitle').textContent = `${modeNames[boardMode]} leaderboard`;
  all('[data-board]').forEach((button) => {
    const active = button.dataset.board === boardMode;
    button.classList.toggle('selected', active);
    button.setAttribute('aria-pressed', String(active));
  });
  try {
    const data = await api(`leaderboard?mode=${boardMode}`);
    if (request !== boardRequest) return;
    $('boardNote').textContent =
      boardMode === 'daily'
        ? `Today’s ten · ${data.day} · One attempt per account. Resets at midnight UTC.`
        : 'Each player’s best completed run. Equal scores are ordered by earliest recorded result.';
    $('boardContent').innerHTML = data.rows.length
      ? `<table><caption class="sr-only">${escape(modeNames[boardMode])} top players</caption><thead><tr><th>RANK</th><th>PLAYER</th><th>${boardMode === 'daily' ? 'CORRECT / 10' : 'BEST STREAK'}</th></tr></thead><tbody>${data.rows.map((row) => `<tr class="${row.you ? 'you' : ''}"><td class="rank">${String(row.rank).padStart(2, '0')}</td><td><span class="player-cell"><span class="avatar">${escape(row.username[0].toUpperCase())}</span>${escape(row.username)} ${row.you ? '<span class="tag">YOU</span>' : ''}</span></td><td><strong>${row.score}${boardMode === 'daily' ? '/10' : ''}</strong></td></tr>`).join('')}</tbody></table>`
      : '<div class="empty-state"><strong>The top spot is wide open.</strong><p>No completed registered-player runs here yet. Create an account, finish a run, and make an entrance.</p><button id="boardJoin" class="primary">Get in the game ↗</button></div>';
    if ($('boardJoin'))
      $('boardJoin').onclick = () =>
        me?.registered ? (location.hash = 'play') : showAuth();
  } catch (error) {
    if (request !== boardRequest) return;
    $('boardContent').innerHTML =
      `<div class="empty-state"><strong>Couldn’t load the leaderboard.</strong><p>${escape(error.message)}</p><button id="retryBoard" class="secondary">Try again</button></div>`;
    $('retryBoard').onclick = loadBoard;
  }
}
function route() {
  const page = ['play', 'leaderboard', 'profile'].includes(location.hash.slice(1))
    ? location.hash.slice(1)
    : 'play';
  all('.page').forEach((element) =>
    element.classList.toggle('hidden', element.id !== `${page}Page`),
  );
  syncPlayView();
  all('[data-page]').forEach((link) => {
    const active = link.dataset.page === page;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  $('pageLabel').textContent = {
    play: 'PLAY',
    leaderboard: 'LEADERBOARD',
    profile: 'MY STUDIO',
  }[page];
  document.title = `${page === 'play' ? 'Play' : { leaderboard: 'Leaderboard', profile: 'My studio' }[page]} — BoxOffice Battle`;
  if (ready && page === 'leaderboard') loadBoard();
  if (ready && page === 'profile')
    api('me')
      .then(updateProfile)
      .catch((error) => toast(error.message, true));
}
function showAuth(tab = 'register') {
  if (me?.registered) {
    location.hash = 'profile';
    return;
  }
  const recovery = tab === 'recover',
    register = tab === 'register';
  modal(
    recovery
      ? 'Back in the director’s chair.'
      : register
        ? 'Your name in the credits.'
        : 'Welcome back.',
    `<div class="auth-tabs"><button class="chip ${register ? 'selected' : ''}" id="registerTab">Create account</button><button class="chip ${tab === 'login' ? 'selected' : ''}" id="loginTab">Sign in</button></div><p class="form-note">${recovery ? 'Use the recovery code saved when you created your account. A new code replaces it after recovery.' : register ? 'Keep this guest’s progress, play across devices, and earn your place on the leaderboard. No email needed.' : 'Sign in to your existing studio. Guest progress stays with the guest session and is not merged.'}</p><form id="authForm" class="auth-form"><label>Player name<input name="username" autocomplete="username" required pattern="[A-Za-z0-9_]{3,20}" minlength="3" maxlength="20" spellcheck="false" placeholder="Your screen name" /></label>${recovery ? '<label>Recovery code<input name="code" autocomplete="off" required minlength="64" maxlength="64" spellcheck="false" /></label>' : ''}<label>${recovery ? 'New password' : 'Password'}<input type="password" name="password" autocomplete="${tab === 'login' ? 'current-password' : 'new-password'}" required minlength="12" maxlength="128" placeholder="At least 12 characters" /></label><div id="authError" class="form-error" role="alert"></div><button class="primary" type="submit">${recovery ? 'Recover account' : register ? 'Create my studio ↗' : 'Sign in ↗'}</button></form><button id="recoverTab" class="text-button">${recovery ? 'Back to sign in' : 'Lost your password? Use a recovery code.'}</button><p class="form-note">Player names and ranked scores are public. Passwords are hashed. We use an essential session cookie. You can export or delete your account in My studio.</p>`,
  );
  $('registerTab').onclick = () => showAuth('register');
  $('loginTab').onclick = () => showAuth('login');
  $('recoverTab').onclick = () => showAuth(recovery ? 'login' : 'recover');
  $('authForm').onsubmit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget,
      button = form.querySelector('button');
    button.disabled = true;
    $('authError').textContent = '';
    try {
      const result = await api(`auth/${tab}`, Object.fromEntries(new FormData(form)));
      const { recoveryCode, ...profile } = result;
      game = null;
      updateProfile(profile);
      if (recoveryCode) showRecovery(recoveryCode);
      else {
        closeModal();
        toast(`Welcome back, ${result.username}.`);
      }
      // Display the one-time code before any follow-up network request can fail.
      try {
        await refreshAfterIdentity();
      } catch (error) {
        toast(error.message, true);
      }
    } catch (error) {
      if ($('authError')) $('authError').textContent = error.message;
    } finally {
      button.disabled = false;
    }
  };
}
function download(filename, content, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function showRecovery(code) {
  modal(
    'Save your backstage pass.',
    `<p class="modal-copy">This is your <strong>only password recovery method</strong>. Save it privately before continuing. Anyone with it can take over your account. It is shown only now.</p><code class="recovery-code">${escape(code)}</code><div class="summary-actions"><button id="saveRecovery" class="primary">Download recovery code ↓</button><button id="doneRecovery" class="secondary">I’ve saved it. Let’s play.</button></div>`,
  );
  $('saveRecovery').onclick = () =>
    download(
      'boxoffice-battle-recovery.txt',
      `BoxOffice Battle\nPlayer: ${me.username}\nRecovery code: ${code}\nKeep this code private. A successful recovery replaces it.\n`,
      'text/plain',
    );
  $('doneRecovery').onclick = closeModal;
}
async function refreshAfterIdentity() {
  const profile = await api('me');
  updateProfile(profile);
  const state = await api('game');
  if (state.game) renderGame(state.game);
  else await startGame('classic');
  route();
}
async function signOut() {
  if (busy) return;
  try {
    await api('auth/logout', {});
    me = null;
    game = null;
    await refreshAfterIdentity();
    toast('Signed out. A fresh guest studio is ready.');
  } catch (error) {
    toast(error.message, true);
  }
}
function deleteAccount() {
  modal(
    me?.registered ? 'Leave no credits behind.' : 'Reset your guest studio?',
    `<p class="modal-copy">Permanently delete ${me?.registered ? 'your account, sessions, scores, and game history' : 'this guest’s server-saved game history'}. This cannot be undone. Device settings remain.</p><form id="deleteForm" class="auth-form">${me?.registered ? '<label>Current password<input name="password" type="password" autocomplete="current-password" required maxlength="128" /></label>' : ''}<label><span><input type="checkbox" required /> I understand this is permanent.</span></label><div class="form-error" id="deleteError" role="alert"></div><button class="secondary danger">Permanently delete</button></form>`,
  );
  $('deleteForm').onsubmit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget,
      button = form.querySelector('button');
    button.disabled = true;
    try {
      await api('account/delete', Object.fromEntries(new FormData(form)));
      closeModal();
      me = null;
      game = null;
      await refreshAfterIdentity();
      toast('Your data has been deleted.');
    } catch (error) {
      if ($('deleteError')) $('deleteError').textContent = error.message;
      else toast(error.message, true);
    } finally {
      button.disabled = false;
    }
  };
}
function showPrivacy() {
  modal(
    'Your data. Your call.',
    '<div class="modal-copy"><p><strong>Essential storage.</strong> An HTTP-only session cookie keeps your guest or signed-in studio connected for up to 30 days. Settings are stored on this device.</p><p><strong>What the server saves.</strong> Player name, hashed password and recovery code if registered, session identifiers, and game history. Public leaderboards show registered player names and scores. No email or third-party fonts are used.</p><p><strong>Advertising.</strong> The game and account screens do not load advertising code. Advertising is disabled by default and can be enabled only on selected editorial articles. Read the <a href="/privacy">full privacy policy</a> for third-party advertising information and data controls.</p><p><strong>What we log.</strong> Request IDs, method, endpoint, response status, and timing for service reliability. Passwords and recovery codes are not logged.</p><p><strong>Your controls.</strong> Export your game data or delete your account from My studio. Closing a browser does not delete its guest history. Guest accounts with no live sessions become eligible for cleanup after 30 days; registered accounts stay until deleted.</p><p><strong>Movie data and posters.</strong> When enabled, TMDB provides posters and reported movie revenue. These figures are historical snapshots, may be incomplete, and are not audited live financial data. Movies without positive reported revenue are excluded from the imported library. Posters and the TMDB logo load from TMDB servers, which receive normal image-request information. Your API credential stays on this application’s server. Gradient artwork remains available when a poster cannot load.</p></div>',
  );
}
function showSettings() {
  modal(
    'Make it your screening.',
    `<label class="settings-row"><span>Sound effects<small>A little applause for your instincts.</small></span><input type="checkbox" id="settingSound" ${settings.sound ? 'checked' : ''} /></label><label class="settings-row"><span>Reduce motion<small>Your system’s motion preference is also respected.</small></span><input type="checkbox" id="settingMotion" ${settings.reducedMotion ? 'checked' : ''} /></label><div class="settings-row"><span>Keyboard shortcuts<small>↑ Higher · ↓ Lower · Enter Next · Escape Close</small></span></div><div class="settings-row"><button id="settingsHow" class="text-button">How to play ↗</button><button id="settingsPrivacy" class="text-button">Data & privacy ↗</button></div><div class="settings-row"><span>Install the game<small>${installPrompt ? 'Keep a shortcut in your app library.' : 'Use your browser’s Install app or Add to Home Screen menu.'}</small></span>${installPrompt ? '<button class="secondary" id="installBtn">Install</button>' : ''}</div>`,
  );
  $('settingSound').onchange = (event) => {
    settings.sound = event.target.checked;
    updateSettings();
    beep(true);
  };
  $('settingMotion').onchange = (event) => {
    settings.reducedMotion = event.target.checked;
    updateSettings();
  };
  $('settingsHow').onclick = showHow;
  $('settingsPrivacy').onclick = showPrivacy;
  if ($('installBtn'))
    $('installBtn').onclick = async () => {
      await installPrompt.prompt();
      installPrompt = null;
      showSettings();
    };
}
function showHow() {
  modal(
    'The box office never lies.',
    '<div class="modal-copy"><ol><li>Look at the left film’s worldwide theatrical gross. It’s your benchmark.</li><li>Guess whether the right film earned <strong>higher</strong> or <strong>lower</strong>. Ties count as incorrect.</li><li>In <strong>Classic</strong>, one miss ends the run. Clear the full collection for a perfect run.</li><li>The <strong>Daily ten</strong> gives everyone the same 10 matchups. Finish all ten, even after a miss. One attempt per player per UTC day; you can resume it later.</li><li>In <strong>Rush</strong>, you have 12 seconds per guess. The timer keeps running when you leave or close the page. One miss or timeout ends the run.</li><li><strong>Practice</strong> lets you explore a genre without losing on a wrong guess. It doesn’t enter the leaderboard.</li></ol><p>Correct guesses earn <strong>25 XP</strong>. Completing a run earns <strong>50 XP</strong>. Unlock milestones in My studio. Create an account to save across devices and appear in the public top 50.</p><p><a href="/how-to-play">Read the full game guide</a> or explore <a href="/guides">the box office reading room</a>.</p><p>Use <strong>↑ / ↓</strong> to guess and <strong>Enter</strong> for the next matchup. Sound is optional. For an untimed experience, use Classic, Daily, or Practice.</p></div>',
  );
}
async function shareResult() {
  if (!game || game.phase !== 'finished') return;
  const text = `BOXOFFICE BATTLE\n${modeNames[game.mode]}${game.mode === 'daily' ? ` · ${game.day}` : ''}\n${game.score}${game.mode === 'daily' ? '/10' : ' correct'}\n${game.answers.map((a) => (a.correct ? '🟩' : '⬛')).join('')}\nCan you beat my box office instincts?`;
  try {
    if (navigator.share)
      await navigator.share({
        title: 'BoxOffice Battle',
        text,
        url: location.origin,
      });
    else if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(`${text}\n${location.origin}`);
      toast('Result copied. Share your movie instincts.');
    } else throw new Error('Clipboard unavailable');
  } catch (error) {
    if (error.name === 'AbortError') return;
    modal(
      'Share your result.',
      `<p class="modal-copy">Copy your spoiler-free result:</p><pre class="recovery-code">${escape(`${text}\n${location.origin}`)}</pre>`,
    );
  }
}
async function boot() {
  if (busy) return;
  setBusy(true);
  $('retryBtn').classList.add('hidden');
  try {
    const profile = await api('me');
    updateProfile(profile);
    $('genreSelect').innerHTML = profile.genres
      .map((genre) => `<option>${escape(genre)}</option>`)
      .join('');
    const state = await api('game');
    ready = true;
    if (state.game) renderGame(state.game);
    else {
      const data = await api('games', { mode: 'classic' });
      renderGame(data);
    }
    route();
  } catch (error) {
    $('gameLoading').classList.remove('hidden');
    $('gameLoading').querySelector('h2').textContent = 'The screening is on hold.';
    $('gameLoading').querySelector('p').textContent =
      `${error.message} Check your connection and try again.`;
    $('retryBtn').classList.remove('hidden');
  } finally {
    setBusy(false);
  }
}

all('[data-mode]').forEach(
  (button) => (button.onclick = () => selectMode(button.dataset.mode)),
);
all('[data-board]').forEach(
  (button) =>
    (button.onclick = () => {
      boardMode = button.dataset.board;
      loadBoard();
    }),
);
$('higherBtn').onclick = () => submitGuess('higher');
$('lowerBtn').onclick = () => submitGuess('lower');
$('nextBtn').onclick = advance;
$('restartBtn').onclick = () => requestGame(selectedMode);
$('playAgainBtn').onclick = () => startGame(selectedMode);
$('genreSelect').onchange = () => selectMode(selectedMode);
$('playSettingsBtn').onclick = showSettings;
$('endRunBtn').onclick = () =>
  confirmAction(
    'End this run?',
    'Your earned guesses are saved. Return to your results to choose another mode.',
    endRun,
    'End run',
  );
for (const id of ['sidebarDaily', 'dailyBtn'])
  $(id).onclick = () => {
    location.hash = 'play';
    requestGame('daily');
  };
$('refreshBoard').onclick = loadBoard;
$('soundBtn').onclick = () => {
  settings.sound = !settings.sound;
  updateSettings();
  beep(true);
};
$('howBtn').onclick = showHow;
$('settingsBtn').onclick = showSettings;
$('privacyBtn').onclick = showPrivacy;
$('footerSettings').onclick = showSettings;
$('accountBtn').onclick = () =>
  ready
    ? me?.registered
      ? (location.hash = 'profile')
      : showAuth()
    : toast('Connect to the game server first.', true);
$('profileAccountBtn').onclick = () => showAuth();
$('closeModal').onclick = closeModal;
$('modal').onclick = (event) => {
  if (event.target === $('modal')) {
    const rect = $('modal').getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    )
      closeModal();
  }
};
$('logoutBtn').onclick = () =>
  confirmAction(
    'Take an intermission?',
    'You can sign back in on any device with your player name and password. Your saved progress stays in your account.',
    signOut,
    'Sign out',
  );
$('deleteBtn').onclick = deleteAccount;
$('exportBtn').onclick = async () => {
  try {
    download('boxoffice-battle-data.json', JSON.stringify(await api('export'), null, 2));
  } catch (error) {
    toast(error.message, true);
  }
};
$('shareBtn').onclick = shareResult;
$('retryBtn').onclick = boot;
document.addEventListener('keydown', (event) => {
  if (
    $('modal').open ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey ||
    /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName) ||
    event.target.isContentEditable ||
    (location.hash && location.hash !== '#play')
  )
    return;
  if (['ArrowUp', 'ArrowDown'].includes(event.key) && game?.phase === 'guess') {
    event.preventDefault();
    submitGuess(event.key === 'ArrowUp' ? 'higher' : 'lower');
  }
  if (
    event.key === 'Enter' &&
    game?.phase === 'revealed' &&
    !event.target.closest('button, a')
  ) {
    event.preventDefault();
    advance();
  }
});
window.addEventListener('hashchange', () => {
  route();
  $('main').focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: 'instant' });
});
window.addEventListener('online', () => {
  setConnection(true);
  if (!ready) boot();
});
window.addEventListener('offline', () => {
  setConnection(false);
  toast('You’re offline. Your run is saved on the server.', true);
});
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  installPrompt = event;
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') tick();
});
updateSettings();
setBusy(false);
route();
boot();
setInterval(tick, 250);
setInterval(async () => {
  if (!ready || document.hidden || !navigator.onLine || !me?.catalog?.configured) return;
  try {
    const info = await api('catalog');
    me.catalog = info;
    renderCatalogInfo(info);
  } catch {
    /* Keep the playable cached library when refreshing is unavailable. */
  }
}, 30000);
if ('serviceWorker' in navigator)
  navigator.serviceWorker.register('/sw.js').catch(() => {
    /* Core gameplay works without installation. */
  });
