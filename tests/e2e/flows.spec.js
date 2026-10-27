import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);
import { fakeMic, fresh } from './helpers.js';

test.beforeEach(async ({ page }) => { await fresh(page); });

test('home loads fast, demo banner shown, no feed before sharing', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Kindness is contagious.' })).toBeVisible();
  await expect(page.locator('#demo-banner')).toBeVisible();
  await expect(page.getByText("See everyone's kindness")).toHaveCount(0);
  await page.goto('./#/feed');
  await expect(page.getByRole('heading', { name: 'Share first, then see' })).toBeVisible();
  await expect(page.locator('.feed')).toHaveCount(0);
});

test('Flow 1 typing path: consent required, then feed revealed', async ({ page }) => {
  await page.goto('./?f=1');
  await expect(page.getByRole('heading', { name: /kindest thing anyone has ever done for you/ })).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('alert')).toHaveText(/type or record/);
  await page.locator('#a1').fill('A nurse held my hand all night. I feel grateful.');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('heading', { name: /kindest things you've done for someone else/ })).toBeVisible();
  await page.locator('#a2').fill('I drove a stranger to the airport.');
  await expect(page.getByText(/may appear in the book/)).toBeVisible();
  await page.getByRole('button', { name: 'Share my kindness' }).click();
  await expect(page.getByRole('alert')).toHaveText(/tick the box/);
  await page.locator('#consent').check();
  await page.getByRole('button', { name: 'Share my kindness' }).click();
  await expect(page.getByRole('heading', { name: /Thank you/ })).toBeVisible();
  await expect(page.locator('.feed')).toContainText('A nurse held my hand');
  await expect(page.locator('.feed')).toContainText('I drove a stranger');
  await expect(page.locator('.feed')).toContainText('stranger paid for my groceries'); // others' entries
  await expect(page.locator('#tally')).toHaveText('5');
});

test('Flow 1 voice + transcription path (fake mic & speech)', async ({ page }) => {
  await fakeMic(page);
  await page.goto('./#/flow1');
  await page.getByRole('button', { name: /Speak your answer/ }).click();
  await expect(page.getByRole('button', { name: /Stop recording/ })).toBeVisible();
  await expect(page.locator('#a1')).toHaveValue('My neighbor shoveled my driveway');
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: /Stop recording/ }).click();
  await expect(page.locator('[data-audio="a1"] audio')).toBeVisible();
  expect(await page.evaluate(() => window.__micCalls)).toBe(1);
  await page.getByRole('button', { name: 'Next' }).click();
  await page.locator('#a2').fill('I helped my neighbor back.');
  await page.locator('#consent').check();
  await page.getByRole('button', { name: 'Share my kindness' }).click();
  await expect(page.getByRole('heading', { name: /Thank you/ })).toBeVisible();
  // voice entries are held for review, typed one is public
  await expect(page.locator('.feed')).toContainText('I helped my neighbor back.');
  await expect(page.locator('.feed')).not.toContainText('shoveled');
  const e = await page.evaluate(() => JSON.parse(localStorage.getItem('kp-demo-v1')).entries.find(x => x.flow === 'received' && x.input_mode !== 'text'));
  expect(e.input_mode).toBe('audio+transcript'); expect(e.status).toBe('pending'); expect(e.audio_url).toMatch(/^data:audio\//);
});

test('mic denied falls back to typing', async ({ page }) => {
  await fakeMic(page, { deny: true });
  await page.goto('./#/flow1');
  await page.getByRole('button', { name: /Speak your answer/ }).click();
  await expect(page.getByText(/Microphone not allowed/)).toBeVisible();
  await page.locator('#a1').fill('Typed instead');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.locator('#a2')).toBeVisible();
});

test('no speech recognition: records audio only, still works', async ({ page }) => {
  await fakeMic(page, { speech: false });
  await page.goto('./#/flow2');
  await expect(page.getByText('Your voice will be recorded. You can also type.')).toBeVisible();
  await page.getByRole('button', { name: /Speak your answer/ }).click();
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: /Stop recording/ }).click();
  await expect(page.getByText('Recording saved')).toBeVisible();
  await page.locator('#consent').check();
  await page.getByRole('button', { name: 'Share it' }).click();
  await expect(page.getByRole('heading', { name: /Thank you/ })).toBeVisible();
});

test('Flow 2 typing, sees inspired feed, share screen', async ({ page, context }) => {
  await page.goto('./?f=2');
  await expect(page.getByRole('heading', { name: /inspired by the Kindness Project/ })).toBeVisible();
  await page.locator('#a3').fill('I called my mom just to say I love her.');
  await page.locator('#consent').check();
  await page.getByRole('button', { name: 'Share it' }).click();
  await expect(page.locator('.feed')).toContainText('I called my mom');
  await expect(page.locator('.feed')).toContainText('thank-you note');
  await expect(page.locator('.feed')).not.toContainText('groceries'); // only inspired acts
  await page.getByRole('link', { name: 'Share the Kindness Project' }).click();
  await expect(page.getByRole('heading', { name: 'Pass it on' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Text message' })).toHaveAttribute('href', /^sms:/);
  await expect(page.getByRole('link', { name: 'Email' })).toHaveAttribute('href', /^mailto:/);
  await expect(page.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute('href', /wa\.me/);
  await page.evaluate(() => { navigator.clipboard.writeText = async t => { window.__copied = t; }; });
  await page.getByRole('button', { name: 'Copy link' }).click();
  await expect(page.getByText('Link copied.')).toBeVisible();
  expect(await page.evaluate(() => window.__copied)).toContain('kindness-project');
});

test('moderation: emails/phones removed, flagged entry held for admin', async ({ page }) => {
  await page.goto('./#/flow2');
  await page.locator('#a3').fill('My name is Sarah, text me at 415-555-1234 or sarah@x.com');
  await page.locator('#consent').check();
  await page.getByRole('button', { name: 'Share it' }).click();
  await expect(page.locator('.feed')).not.toContainText('Sarah');
  const e = await page.evaluate(() => JSON.parse(localStorage.getItem('kp-demo-v1')).entries.at(-1));
  expect(e.status).toBe('pending'); expect(e.text).not.toContain('555'); expect(e.text).not.toContain('@x.com');
  expect(e.flags).toEqual(expect.arrayContaining(['email', 'phone', 'name']));
});

test('admin: login, review, approve, export CSV & JSON, make codes', async ({ page }) => {
  await page.goto('./#/flow2');
  await page.locator('#a3').fill('Mrs. Lee and I baked for the shelter, what the fuck it was fun');
  await page.locator('#consent').check();
  await page.getByRole('button', { name: 'Share it' }).click();
  await page.goto('./#/admin');
  await page.locator('#em').fill('dane@example.com'); await page.locator('#pw').fill('wrong');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toContainText('demo');
  await page.locator('#pw').fill('demo'); await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: /Waiting for review \(1\)/ })).toBeVisible();
  await expect(page.getByText(/Flagged: name, abusive/)).toBeVisible();
  await page.getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByRole('heading', { name: /Waiting for review \(0\)/ })).toBeVisible();
  const [csv] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download CSV' }).click()]);
  const csvText = require('fs').readFileSync(await csv.path(), 'utf8');
  expect(csvText.split('\r\n')[0]).toContain('consent'); expect(csvText).toContain('baked for the shelter');
  const [js] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download JSON' }).click()]);
  const data = JSON.parse(require('fs').readFileSync(await js.path(), 'utf8'));
  expect(data.length).toBe(4); expect(data.every(d => d.consent === true)).toBe(true);
  await page.locator('#n').fill('25');
  const [codes] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Create/ }).click()]);
  const lines = require('fs').readFileSync(await codes.path(), 'utf8').trim().split('\r\n');
  expect(lines.length).toBe(26); expect(lines[1]).toMatch(/^KB-[2-9A-HJKMNP-Z]{4}$/);
});

test('book-code logging: bad code rejected, good code logged + trail shown', async ({ page }) => {
  await page.goto('./?code=kb7q3m');
  await expect(page.locator('#code')).toHaveValue('kb7q3m');
  await page.locator('#code').fill('KB-ZZZZ'); await page.locator('#place').fill('Lisbon');
  await page.locator('#consent').check();
  await page.getByRole('button', { name: 'Log this copy' }).click();
  await expect(page.getByRole('alert')).toContainText("couldn't find");
  await page.locator('#code').fill('kb 7q3m');
  await page.locator('#story').fill('I left it on a train for the next reader.');
  await page.getByRole('button', { name: 'Log this copy' }).click();
  await expect(page.getByRole('heading', { name: /Logged/ })).toBeVisible();
  await expect(page.locator('.feed')).toContainText('Lisbon');
  await expect(page.locator('#tally')).toHaveText('4');
});

test('accessibility basics: labels, lang, tap targets', async ({ page }) => {
  await page.goto('./#/flow1');
  expect(await page.getAttribute('html', 'lang')).toBe('en');
  await expect(page.getByLabel('Your answer')).toBeVisible();
  const small = await page.$$eval('.btn', bs => bs.filter(b => b.getBoundingClientRect().height < 44).length);
  expect(small).toBe(0);
  const w = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(w).toBe(true);
});
