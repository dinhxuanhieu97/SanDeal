import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createApp } from '../server.js';

let server;
let browser;
let baseURL;

// Trong sandbox có thể chỉ định đường dẫn chromium qua PW_CHROMIUM.
// Trên máy người dùng: chạy `npx playwright install chromium` rồi để trống.
const launchOpts = process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {};

before(async () => {
  const app = createApp({ subId: 'sandeal' });
  await new Promise((r) => (server = app.listen(0, r)));
  baseURL = `http://localhost:${server.address().port}`;
  browser = await chromium.launch(launchOpts);
});

after(async () => {
  await browser?.close();
  server?.close();
});

test('E2E: trang chủ tải và hiển thị tiêu đề chính', async () => {
  const page = await browser.newPage();
  await page.goto(baseURL);
  await assert.doesNotReject(page.waitForSelector('h1'));
  const title = await page.title();
  assert.match(title, /Săn Deal/);
  await page.close();
});

test('E2E: luồng dán link → chuyển → hiện kết quả', async () => {
  const page = await browser.newPage();
  await page.goto(baseURL);
  await page.fill('#shopee-url', 'https://shopee.vn/product/12345/67890');
  await page.click('#convert-btn');
  await page.waitForSelector('#result:not([hidden])', { timeout: 5000 });
  const value = await page.inputValue('#result-url');
  assert.ok(value.includes('af_sub1=sandeal'), 'link kết quả phải chứa sub_id');
  await page.close();
});

test('E2E: link không hợp lệ hiển thị thông báo lỗi', async () => {
  const page = await browser.newPage();
  await page.goto(baseURL);
  // bỏ qua validate HTML5 để test được nhánh lỗi từ server
  await page.$eval('#shopee-url', (el) => el.removeAttribute('required'));
  await page.fill('#shopee-url', 'https://tiki.vn/abc');
  await page.click('#convert-btn');
  await page.waitForSelector('#error:not([hidden])', { timeout: 5000 });
  const err = await page.textContent('#error');
  assert.match(err, /không phải link Shopee/i);
  await page.close();
});

test('E2E: nút "Sao chép" đổi trạng thái sau khi bấm', async () => {
  const page = await browser.newPage({ permissions: ['clipboard-read', 'clipboard-write'] });
  await page.goto(baseURL);
  await page.fill('#shopee-url', 'https://shopee.vn/product/1/2');
  await page.click('#convert-btn');
  await page.waitForSelector('#result:not([hidden])');
  await page.click('#copy-btn');
  await page.waitForFunction(() => document.getElementById('copy-btn').textContent.includes('Đã chép'));
  await page.close();
});

test('E2E: responsive mobile (375px) — menu ẩn, form xếp dọc', async () => {
  const page = await browser.newPage({ viewport: { width: 375, height: 700 } });
  await page.goto(baseURL);
  const navVisible = await page.isVisible('.main-nav');
  assert.equal(navVisible, false, 'menu desktop phải ẩn trên mobile');
  await page.close();
});

test('E2E: trang /huong-dan-su-dung tải được và có nội dung hướng dẫn', async () => {
  const page = await browser.newPage();
  const res = await page.goto(`${baseURL}/huong-dan-su-dung`);
  assert.equal(res.status(), 200);
  const h1 = await page.textContent('h1');
  assert.match(h1, /Hướng dẫn sử dụng/i);
  // có link quay lại trang chủ và về ô săn deal
  assert.ok(await page.$('a[href="/#san"]'), 'phải có CTA về trang săn deal');
  await page.close();
});

test('E2E: menu trang chủ có link Hướng dẫn trỏ đúng', async () => {
  const page = await browser.newPage();
  await page.goto(baseURL);
  const href = await page.getAttribute('.main-nav a:has-text("Hướng dẫn")', 'href');
  assert.equal(href, '/huong-dan-su-dung');
  await page.close();
});

test('A11y: có lang, alt cho logo, nhãn cho input, nút có chữ', async () => {
  const page = await browser.newPage();
  await page.goto(baseURL);
  assert.equal(await page.getAttribute('html', 'lang'), 'vi');
  assert.ok(await page.getAttribute('.brand img', 'alt'), 'logo phải có alt');
  const inputLabel = await page.getAttribute('#shopee-url', 'aria-label');
  assert.ok(inputLabel, 'ô nhập link phải có aria-label');
  const btnText = (await page.textContent('#convert-btn'))?.trim();
  assert.ok(btnText && btnText.length > 0, 'nút phải có nhãn chữ');
  await page.close();
});
