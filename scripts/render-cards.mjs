// Render the 4x6 card SVGs to 300-dpi PNGs (1200x1800) using Playwright's Chromium.
import { chromium } from '@playwright/test'; import fs from 'node:fs';
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 384, height: 576 }, deviceScaleFactor: 3.125 });
for (const id of ['flow1', 'flow2']) {
  await p.setContent(`<html><body style="margin:0">${fs.readFileSync(`qr/card-${id}-4x6.svg`, 'utf8')}</body></html>`);
  await p.locator('svg').first().screenshot({ path: `qr/card-${id}-4x6.png` });
}
await b.close();
