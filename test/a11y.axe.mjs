import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { launchBrowser } from './helpers/browser.mjs';
import { AxeBuilder } from '@axe-core/playwright';
import { createApp } from '../server.js';

let server;
let browser;
let baseURL;

before(async () => {
  const app = createApp({ subId: 'sandeal' });
  await new Promise((r) => (server = app.listen(0, r)));
  baseURL = `http://localhost:${server.address().port}`;
  browser = await launchBrowser();
});

after(async () => {
  await browser?.close();
  server?.close();
});

test('A11y (axe-core): 0 vi phạm nghiêm trọng/critical trên trang chủ', async () => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(baseURL);
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  const blocking = results.violations.filter((v) => ['serious', 'critical'].includes(v.impact));
  const summary = blocking.map((v) => `[${v.impact}] ${v.id} (${v.nodes.length})`).join(', ');
  assert.equal(blocking.length, 0, `Còn vi phạm a11y: ${summary}`);
  await ctx.close();
});

test('A11y (axe-core): 0 vi phạm nghiêm trọng trên trang hướng dẫn', async () => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${baseURL}/huong-dan-su-dung`);
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const blocking = results.violations.filter((v) => ['serious', 'critical'].includes(v.impact));
  const summary = blocking.map((v) => `[${v.impact}] ${v.id} (${v.nodes.length})`).join(', ');
  assert.equal(blocking.length, 0, `Còn vi phạm a11y (guide): ${summary}`);
  await ctx.close();
});
