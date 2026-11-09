import { test, expect } from '@playwright/test';
import { movies } from '../server/game.js';
import { readFile } from 'node:fs/promises';

test('TMDB posters fill the game panels without exposing the API credential', async ({
  page,
}) => {
  const image = await readFile(new URL('../icon-512.png', import.meta.url));
  await page.route('https://image.tmdb.org/**', (route) =>
    route.fulfill({ contentType: 'image/png', body: image }),
  );
  await page.route('https://www.themoviedb.org/**', (route) =>
    route.fulfill({ contentType: 'image/png', body: image }),
  );
  await page.goto('http://127.0.0.1:3101');
  await expect(page.locator('.poster.has-poster')).toHaveCount(2);
  expect(
    await page.locator('#leftPoster .poster-image').evaluate((img) => img.naturalWidth),
  ).toBe(512);
  expect(
    await page
      .locator('#leftPoster .poster-image')
      .evaluate((img) => getComputedStyle(img).objectFit),
  ).toBe('cover');
  await page
    .locator((await correctButton(page)) === '#higherBtn' ? '#lowerBtn' : '#higherBtn')
    .click();
  await expect(page.locator('#summary')).toBeVisible();
  await expect(page.locator('#tmdbCredits')).toBeVisible();
});

test('unavailable posters leave readable gradient panels and playable controls', async ({
  page,
}) => {
  await page.route('https://image.tmdb.org/**', (route) => route.abort('failed'));
  await page.goto('http://127.0.0.1:3101');
  await expect(page.locator('#higherBtn')).toBeEnabled();
  await expect(page.locator('.poster-image')).toHaveCount(0);
  await expect(page.locator('#leftTitle')).not.toBeEmpty();
  await expect(page.locator('#leftMoney')).toBeVisible();
  await expect(page.locator('#lowerBtn')).toBeInViewport();
});

async function loaded(page) {
  await page.goto('/');
  await expect(page.locator('#gameArea')).toBeVisible();
  await expect(page.locator('#higherBtn')).toBeEnabled();
}

test('gameplay fills the viewport and defers modes and rewards until game over', async ({
  page,
}) => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
    { width: 320, height: 568 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    await loaded(page);
    await expect(page.locator('.mode-grid')).not.toBeVisible();
    await expect(page.locator('.progress-card')).not.toBeVisible();
    await expect(page.locator('.sidebar')).not.toBeVisible();
    await expect(page.locator('.topbar')).not.toBeVisible();
    const arena = await page.locator('.arena').boundingBox();
    expect(arena.x).toBe(0);
    expect(arena.y).toBe(0);
    expect(arena.width).toBe(viewport.width);
    expect(arena.height).toBe(viewport.height);
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollHeight <= innerHeight &&
          document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(page.locator('#higherBtn')).toBeInViewport();
    await expect(page.locator('#lowerBtn')).toBeInViewport();
  }
  await page.locator(await correctButton(page)).click();
  await expect(page.locator('#toast')).not.toBeVisible();
  await endRun(page);
  await expect(page.locator('.mode-grid')).toBeVisible();
  await expect(page.locator('.progress-card')).toBeVisible();
  await expect(page.locator('#runRewards')).toContainText('+25 XP');
  await page.reload();
  await expect(page.locator('#summary')).toBeVisible();
  await expect(page.locator('.mode-grid')).toBeVisible();
});
async function correctButton(page) {
  const left = await page.locator('#leftTitle').textContent(),
    right = await page.locator('#rightTitle').textContent();
  return movies.find((m) => m.title === right).gross >
    movies.find((m) => m.title === left).gross
    ? '#higherBtn'
    : '#lowerBtn';
}
async function endRun(page) {
  await page.locator('#endRunBtn').click();
  await page.locator('#confirmAction').click();
  await expect(page.locator('#summary')).toBeVisible();
  await expect(page.locator('body')).not.toHaveClass(/playing/);
}

test('earned titles can be equipped in My studio and remain after reload', async ({
  page,
}) => {
  await loaded(page);
  await page.locator(await correctButton(page)).click();
  await endRun(page);
  await expect(page.locator('#runRewards')).toContainText('Opening night star');
  await page.locator('[data-page="profile"]').click();
  await expect(page.getByRole('heading', { name: 'Your studio rewards' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Locked: Mint screening', exact: true }),
  ).toBeDisabled();
  await page
    .getByRole('button', { name: 'Equip: Opening night star', exact: true })
    .click();
  await expect(page.locator('#equippedTitle')).toHaveText('Opening night star');
  await page.reload();
  await expect(page.locator('#equippedTitle')).toHaveText('Opening night star');
  await expect(page.locator('#headerTitle')).toHaveText('Opening night star');
});
async function chooseMode(page, mode, genre) {
  await endRun(page);
  await page.locator('[data-mode="' + mode + '"]').click();
  if (genre) await page.locator('#genreSelect').selectOption(genre);
  await page.locator('#playAgainBtn').click();
  await expect(page.locator('body')).toHaveClass(/playing/);
  await expect(page.locator('#higherBtn')).toBeEnabled();
}
test('classic reveals, advances, persists across reload, and finishes with a shareable summary', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await loaded(page);
  expect(await page.locator('#rightMoney').textContent()).toContain('—');
  await page.locator(await correctButton(page)).click();
  await expect(page.locator('#result')).toContainText('You called it');
  await expect(page.locator('#score')).toHaveText('1');
  await page.reload();
  await expect(page.locator('#score')).toHaveText('1');
  await page.locator('#nextBtn').click();
  await expect(page.locator('#round')).toHaveText('2');
  await page
    .locator((await correctButton(page)) === '#higherBtn' ? '#lowerBtn' : '#higherBtn')
    .click();
  await expect(page.locator('#summary')).toBeVisible();
  await expect(page.locator('#summaryText')).toContainText('1 correct out of 2');
  await page.locator('#playAgainBtn').click();
  await expect(page.locator('#score')).toHaveText('0');
  expect(errors).toEqual([]);
});
test('daily continues after a miss, finishes ten rounds, and cannot restart', async ({
  page,
}) => {
  await loaded(page);
  await chooseMode(page, 'daily');
  for (let round = 1; round <= 10; round++) {
    await expect(page.locator('#round')).toHaveText(`${round}/10`);
    await expect(page.locator('#higherBtn')).toBeEnabled();
    await page.locator('#higherBtn').click();
    if (round < 10) await expect(page.locator('#result')).toBeVisible();
    else await expect(page.locator('#finalReveal')).toBeVisible();
    if (round < 10) await page.locator('#nextBtn').click();
  }
  await expect(page.locator('#summary')).toBeVisible();
  await page.locator('[data-mode="daily"]').click();
  await page.locator('#playAgainBtn').click();
  await expect(page.locator('#summary')).toBeVisible();
  await expect(page.locator('#round')).toHaveText('10/10');
  await expect(page.locator('#dailyStatus')).toContainText('Today’s challenge');
});
test('practice filtering keeps both films in the selected genre', async ({ page }) => {
  await loaded(page);
  await expect(page.locator('[data-page="collection"]')).toHaveCount(0);
  await expect(page.locator('#collectionPage')).toHaveCount(0);
  await chooseMode(page, 'practice', 'Animation');
  await expect(page.locator('#leftMeta')).toContainText('Animation');
  await expect(page.locator('#rightMeta')).toContainText('Animation');
  await endRun(page);
});

test('Classic and Rush allow genre choices without switching to Practice', async ({
  page,
}) => {
  await loaded(page);
  await endRun(page);
  for (const [mode, genre] of [
    ['classic', 'Action'],
    ['rush', 'Comedy'],
  ]) {
    await page.locator(`[data-mode="${mode}"]`).click();
    await page.locator('#genreSelect').selectOption(genre);
    await page.locator('#playAgainBtn').click();
    await expect(page.locator('#leftMeta')).toContainText(genre);
    await expect(page.locator('#rightMeta')).toContainText(genre);
    await page.reload();
    await expect(page.locator('#leftMeta')).toContainText(genre);
    await endRun(page);
    await expect(page.locator('#genreSelect')).toHaveValue(genre);
    await expect(page.locator(`[data-mode="${mode}"]`)).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.locator('#rankLabel')).toHaveText('GENRE RUN / UNRANKED');
  }
  await page.locator('[data-mode="daily"]').click();
  await expect(page.locator('#genreWrap')).toBeHidden();
});
test('account registration, recovery display, sign out, login, and deletion', async ({
  page,
}) => {
  await loaded(page);
  if (await page.locator('#endRunBtn').isVisible()) await endRun(page);
  await page.locator('#accountBtn').click();
  await page
    .locator('[name="username"]')
    .fill(`FilmFan_${Date.now().toString().slice(-8)}`);
  const username = await page.locator('[name="username"]').inputValue();
  await page.locator('[name="password"]').fill('My long test password 2026');
  await page.locator('#authForm button').click();
  await expect(page.locator('#modalTitle')).toHaveText('Save your backstage pass.');
  await expect(page.locator('.recovery-code')).toContainText(/^[a-f0-9]{64}$/);
  await page.locator('#doneRecovery').click();
  await expect(page.locator('#headerName')).toHaveText(username);
  await page.locator('[data-page="profile"]').click();
  await page.locator('#logoutBtn').click();
  await page.locator('#confirmAction').click();
  await expect(page.locator('#headerName')).toHaveText('Guest player');
  if (await page.locator('#endRunBtn').isVisible()) await endRun(page);
  await page.locator('#accountBtn').click();
  await page.locator('#loginTab').click();
  await page.locator('[name="username"]').fill(username);
  await page.locator('[name="password"]').fill('My long test password 2026');
  await page.locator('#authForm button').click();
  await expect(page.locator('#modal')).not.toBeVisible();
  await expect(page.locator('#headerName')).toHaveText(username);
  await page.locator('#deleteBtn').click();
  await page.locator('#deleteForm [name="password"]').fill('My long test password 2026');
  await page.locator('#deleteForm input[type="checkbox"]').check();
  await page.locator('#deleteForm button').click();
  await expect(page.locator('#headerName')).toHaveText('Guest player');
});
test('keyboard navigation, rules dialog, settings persistence, and no horizontal overflow on mobile', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loaded(page);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBe(true);
  await page.locator('#main').focus();
  await page.keyboard.press(
    (await correctButton(page)) === '#higherBtn' ? 'ArrowUp' : 'ArrowDown',
  );
  await expect(page.locator('#result')).toContainText('You called it');
  await page.keyboard.press('Enter');
  await expect(page.locator('#round')).toHaveText('2');
  await page.locator('#playSettingsBtn').click();
  await page.locator('#settingsPrivacy').click();
  await expect(page.locator('#modal')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#modal')).not.toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: 'test-results/mobile-play.png',
    fullPage: true,
  });
  await endRun(page);
  for (const name of ['leaderboard', 'profile']) {
    await page.locator(`[data-page="${name}"]`).click();
    await expect(page.locator(`#${name}Page`)).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
});
test('desktop settings and reduced motion persist; the leaderboard has an honest empty state', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await loaded(page);
  await page.locator('#playSettingsBtn').click();
  await page.locator('#settingMotion').check();
  await page.locator('#settingSound').check();
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(page.locator('html')).toHaveClass('reduced-motion');
  await expect(page.locator('#soundLabel')).toHaveText('Sound on');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: 'test-results/desktop-play.png',
    fullPage: true,
  });
  await endRun(page);
  await page.locator('[data-page="leaderboard"]').click();
  await expect(page.locator('#boardContent')).toContainText('The top spot is wide open.');
  await page.locator('[data-board="daily"]').click();
  await expect(page.locator('#boardTitle')).toContainText('Daily ten');
});
test('rush enforces its timer even without an answer', async ({ page }) => {
  await loaded(page);
  await chooseMode(page, 'rush');
  await expect(page.locator('#timerLabel')).toHaveText('SECONDS LEFT');
  await expect(page.locator('#summary')).toBeVisible({ timeout: 18000 });
  await expect(page.locator('#result')).toContainText('Time’s up.');
  await expect(page.locator('#score')).toHaveText('0');
});
test('a lost answer response resynchronizes instead of recording a second answer', async ({
  page,
}) => {
  await loaded(page);
  await page.route(
    '**/api/games/answer',
    async (route) => {
      await route.fetch();
      await route.abort('failed');
    },
    { times: 1 },
  );
  await page.locator(await correctButton(page)).click();
  await expect(page.locator('#score')).toHaveText('1');
  await expect(page.locator('#nextBtn')).toBeVisible();
  await endRun(page);
  await page.locator('[data-page="profile"]').click();
  await expect(page.locator('#profileStats')).toContainText('CORRECT GUESSES1');
});

test('installation shell provides an offline intermission without caching player data', async ({
  page,
  context,
}) => {
  await loaded(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect(page.locator('#gameArea')).toBeVisible();
  await context.setOffline(true);
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'A quick intermission.' }),
  ).toBeVisible();
  const cached = await page.evaluate(async () => {
    const keys = await caches.keys();
    return (
      await Promise.all(
        keys.map(async (key) =>
          (await (await caches.open(key)).keys()).map(
            (request) => new URL(request.url).pathname,
          ),
        ),
      )
    ).flat();
  });
  expect(cached.some((path) => path.startsWith('/api/'))).toBe(false);
  await context.setOffline(false);
  await page.getByRole('link', { name: 'Try again' }).click();
  await expect(page.locator('#gameArea')).toBeVisible();
});

test('recovery code remains available when the first post-registration refresh fails', async ({
  page,
}) => {
  await loaded(page);
  if (await page.locator('#endRunBtn').isVisible()) await endRun(page);
  await page.locator('#accountBtn').click();
  await page
    .locator('[name="username"]')
    .fill(`Network_${Date.now().toString().slice(-8)}`);
  await page.locator('[name="password"]').fill('My long network test password');
  await page.route('**/api/me', (route) => route.abort('failed'), { times: 1 });
  await page.locator('#authForm button').click();
  await expect(page.locator('#modalTitle')).toHaveText('Save your backstage pass.');
  await expect(page.locator('.recovery-code')).toContainText(/^[a-f0-9]{64}$/);
  await expect(page.locator('#toast')).toContainText('Connection interrupted');
});
