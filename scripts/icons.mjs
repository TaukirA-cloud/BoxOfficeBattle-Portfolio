import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const browser = await chromium.launch({
  ...(process.platform === 'win32' ? { channel: 'msedge' } : {}),
});
try {
  const page = await browser.newPage();
  const svg = await readFile(new URL('../icon.svg', import.meta.url), 'utf8');
  for (const size of [192, 512]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<style>body{margin:0;background:#0b0e14}svg{display:block;width:100vw;height:100vh}</style>${svg}`,
    );
    await page.screenshot({
      path: new URL(`../icon-${size}.png`, import.meta.url).pathname.replace(
        /^\/(?=[A-Za-z]:)/,
        '',
      ),
    });
  }
} finally {
  await browser.close();
}
