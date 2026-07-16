import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { launchBrowser } from './helpers/browser.mjs';
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

async function columnsInFirstRow(page, selector) {
  return page.$$eval(selector, (els) => {
    if (!els.length) return 0;
    const top = Math.round(els[0].getBoundingClientRect().top);
    return els.filter((el) => Math.round(el.getBoundingClientRect().top) === top).length;
  });
}

async function hasHorizontalOverflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
}

test('Desktop (1280px): hamburger ẩn, menu ngang hiện', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(baseURL);
  assert.equal(await page.isVisible('.nav-toggle'), false);
  assert.equal(await page.isVisible('.main-nav'), true);
  await ctx.close();
});

test('Tablet (768px): hamburger hiện, menu ẩn cho tới khi bấm, deals 2 cột, không tràn ngang', async () => {
  const ctx = await browser.newContext({ viewport: { width: 768, height: 1024 } });
  const page = await ctx.newPage();
  await page.goto(baseURL);

  assert.equal(await page.isVisible('.nav-toggle'), true, 'hamburger phải hiện');
  assert.equal(await page.isVisible('.main-nav'), false, 'menu phải ẩn ban đầu');

  const box = await page.locator('.nav-toggle').boundingBox();
  assert.ok(box.width >= 44 && box.height >= 44, 'nút hamburger phải ≥ 44px');

  await page.click('.nav-toggle');
  assert.equal(await page.isVisible('.main-nav'), true, 'bấm hamburger phải mở menu');
  assert.equal(await page.getAttribute('.nav-toggle', 'aria-expanded'), 'true');

  assert.equal(await columnsInFirstRow(page, '.deal-card'), 2, 'deals nên 2 cột trên tablet');
  assert.equal(await hasHorizontalOverflow(page), false, 'không được tràn ngang');
  await ctx.close();
});

test('Mobile (390px): deals 1 cột, form dọc, không tràn ngang', async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(baseURL);

  assert.equal(await page.isVisible('.nav-toggle'), true);
  assert.equal(await columnsInFirstRow(page, '.deal-card'), 1, 'deals nên 1 cột trên mobile');
  assert.equal(await columnsInFirstRow(page, '.step'), 1, 'steps nên 1 cột trên mobile');
  assert.equal(await hasHorizontalOverflow(page), false, 'không được tràn ngang');

  await page.click('.nav-toggle');
  assert.equal(await page.isVisible('.main-nav'), true);
  await page.keyboard.press('Escape');
  assert.equal(await page.isVisible('.main-nav'), false, 'Esc phải đóng menu');
  await ctx.close();
});

test('Mobile (390px): trang hướng dẫn cũng có hamburger & không tràn ngang', async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(`${baseURL}/huong-dan-su-dung`);
  assert.equal(await page.isVisible('.nav-toggle'), true);
  await page.click('.nav-toggle');
  assert.equal(await page.isVisible('.main-nav'), true);
  assert.equal(await hasHorizontalOverflow(page), false);
  await ctx.close();
});
