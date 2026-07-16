import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server.js';

let server;
let baseURL;

before(async () => {
  const app = createApp({ subId: 'sandeal' }); // ép chế độ demo (không credentials)
  await new Promise((resolve) => {
    server = app.listen(0, resolve); // cổng ngẫu nhiên
  });
  baseURL = `http://localhost:${server.address().port}`;
});

after(() => {
  server?.close();
});

async function postConvert(body) {
  const res = await fetch(`${baseURL}/api/convert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
}

test('GET /api/health trả về chế độ demo', async () => {
  const res = await fetch(`${baseURL}/api/health`);
  const data = await res.json();
  assert.equal(res.status, 200);
  assert.equal(data.ok, true);
  assert.equal(data.mode, 'demo');
  assert.equal(data.subId, 'sandeal');
});

test('POST /api/convert với link Shopee hợp lệ → gắn sub_id', async () => {
  const { status, json } = await postConvert({ url: 'https://shopee.vn/product/1/2' });
  assert.equal(status, 200);
  assert.equal(json.ok, true);
  assert.equal(json.mode, 'demo');
  assert.ok(json.convertedUrl.includes('af_sub1=sandeal'));
});

test('POST /api/convert với link không phải Shopee → 400', async () => {
  const { status, json } = await postConvert({ url: 'https://tiki.vn/abc' });
  assert.equal(status, 400);
  assert.equal(json.ok, false);
  assert.match(json.error, /không phải link Shopee/i);
});

test('POST /api/convert thiếu url → 400', async () => {
  const { status, json } = await postConvert({});
  assert.equal(status, 400);
  assert.equal(json.ok, false);
});

test('POST /api/convert url không phải chuỗi → 400', async () => {
  const { status, json } = await postConvert({ url: 12345 });
  assert.equal(status, 400);
  assert.equal(json.ok, false);
});

test('Trang chủ phục vụ file tĩnh (index.html)', async () => {
  const res = await fetch(`${baseURL}/`);
  const html = await res.text();
  assert.equal(res.status, 200);
  assert.match(html, /Săn Deal/);
});

test('GET /huong-dan-su-dung (route thân thiện SEO) trả về trang HTML hướng dẫn', async () => {
  const res = await fetch(`${baseURL}/huong-dan-su-dung`);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(res.headers.get('content-type'), /text\/html/);
  assert.match(html, /Hướng dẫn sử dụng/i);
});
