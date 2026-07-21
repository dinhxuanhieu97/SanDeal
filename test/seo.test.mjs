import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server.js';

let server;
let baseURL;

before(async () => {
  const app = createApp({ subId: 'sandeal' });
  await new Promise((r) => (server = app.listen(0, r)));
  baseURL = `http://localhost:${server.address().port}`;
});

after(() => server?.close());

test('robots.txt phục vụ đúng, trỏ sitemap & chặn /api', async () => {
  const res = await fetch(`${baseURL}/robots.txt`);
  const body = await res.text();
  assert.equal(res.status, 200);
  assert.match(body, /Sitemap:\s*https:\/\/san-deal\.vercel\.app\/sitemap\.xml/);
  assert.match(body, /Disallow:\s*\/api\//);
});

test('sitemap.xml phục vụ đúng, có cả 2 trang', async () => {
  const res = await fetch(`${baseURL}/sitemap.xml`);
  const body = await res.text();
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') || '', /xml/);
  assert.match(body, /<loc>https:\/\/san-deal\.vercel\.app\/<\/loc>/);
  assert.match(body, /<loc>https:\/\/san-deal\.vercel\.app\/huong-dan-su-dung<\/loc>/);
});

test('og-image.png tồn tại và là ảnh', async () => {
  const res = await fetch(`${baseURL}/og-image.png`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') || '', /image\/png/);
});

test('meta OG trong trang chủ trỏ đúng ảnh og-image.png', async () => {
  const res = await fetch(`${baseURL}/`);
  const html = await res.text();
  assert.match(html, /og:image"\s+content="https:\/\/san-deal\.vercel\.app\/og-image\.png"/);
});
