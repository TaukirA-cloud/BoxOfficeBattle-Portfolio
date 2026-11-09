import { test, expect } from '@playwright/test';
import { publicPages } from '../server/pages.js';

test('public articles work without JavaScript and do not request ads or a player session', async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  const requests = [];
  page.on('request', (request) => requests.push(request.url()));
  try {
    for (const [path, article] of publicPages) {
      await page.goto(`http://127.0.0.1:3100${path}`);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(article.title);
      await expect(
        page.getByRole('navigation', { name: 'Main navigation' }),
      ).toBeVisible();
      await expect(
        page.getByRole('link', { name: 'Privacy', exact: true }),
      ).toBeVisible();
    }
    expect(
      requests.some((url) => /googlesyndication|doubleclick|\/api\//.test(url)),
    ).toBe(false);
    expect(await context.cookies()).toHaveLength(0);
    await page.goto('http://127.0.0.1:3100/');
    await expect(
      page.getByRole('link', { name: 'All movie guides', exact: true }),
    ).toBeVisible();
    await page.getByRole('link', { name: 'All movie guides', exact: true }).click();
    await expect(page).toHaveURL(/\/guides$/);
  } finally {
    await context.close();
  }
});

test('guides are accessible from the full-screen game and fit a mobile viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const adRequests = [];
  page.on('request', (request) => {
    if (/googlesyndication|doubleclick/.test(request.url()))
      adRequests.push(request.url());
  });
  await page.goto('/');
  await expect(page.locator('#higherBtn')).toBeVisible();
  const guideLink = page.getByRole('link', { name: 'Movie guides', exact: true }).first();
  await expect(guideLink).toBeInViewport();
  await guideLink.click();
  await expect(page).toHaveURL(/\/guides$/);
  await page.getByRole('link', { name: /02 \/ THE NUMBERS/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'What box office actually measures',
  );
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await expect(page.getByRole('link', { name: 'Play the game' })).toBeVisible();
  expect(adRequests).toHaveLength(0);
});
