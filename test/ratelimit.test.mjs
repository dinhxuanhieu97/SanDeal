import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server.js';

let server;
let baseURL;

before(async () => {
  // Ngưỡng thấp để test nhanh: chỉ cho 3 lần / cửa sổ
  const app = createApp({ subId: 'sandeal', rateLimit: { windowMs: 60_000, max: 3 } });
  await new Promise((r) => (server = app.listen(0, r)));
  baseURL = `http://localhost:${server.address().port}`;
});

after(() => server?.close());

function convert() {
  return fetch(`${baseURL}/api/convert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: 'https://shopee.vn/product/1/2' }),
  });
}

test('Rate limit: cho phép tới ngưỡng rồi chặn 429', async () => {
  const r1 = await convert();
  const r2 = await convert();
  const r3 = await convert();
  assert.equal(r1.status, 200);
  assert.equal(r2.status, 200);
  assert.equal(r3.status, 200);

  const r4 = await convert(); // vượt ngưỡng
  assert.equal(r4.status, 429);
  const body = await r4.json();
  assert.equal(body.ok, false);
  assert.match(body.error, /quá nhanh/i);
});
