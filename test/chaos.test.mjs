// Chaos test — mô phỏng Shopee API chết/treo để kiểm nhánh fallback.
// Không cần trình duyệt, chạy cùng npm test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildOfficialShortLink } from '../lib/shopee.js';
import { createApp } from '../server.js';

const realFetch = globalThis.fetch; // giữ fetch thật cho client gọi vào server test

// fetch giả lập: treo vô hạn nhưng tôn trọng AbortSignal (giống fetch thật khi bị timeout)
function hangingFetch(url, opts = {}) {
  return new Promise((_resolve, reject) => {
    opts.signal?.addEventListener('abort', () =>
      reject(opts.signal.reason ?? new Error('This operation was aborted'))
    );
  });
}

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });
}

test('Chaos: buildOfficialShortLink tự huỷ sau timeoutMs khi API treo', async () => {
  const t0 = Date.now();
  await assert.rejects(
    buildOfficialShortLink('https://shopee.vn/p/1', {
      appId: 'a',
      appSecret: 'b',
      timeoutMs: 300,
      fetchImpl: hangingFetch,
    }),
    /abort|timeout/i,
    'phải ném lỗi timeout thay vì treo vô hạn'
  );
  const elapsed = Date.now() - t0;
  assert.ok(elapsed < 3000, `phải huỷ trong ~300ms, thực tế ${elapsed}ms`);
});

test('Chaos: Shopee API ném lỗi mạng → server trả demo-fallback, không sập', async (t) => {
  globalThis.fetch = () => Promise.reject(new Error('ECONNRESET'));
  t.after(() => (globalThis.fetch = realFetch));

  const app = createApp({ appId: 'x', appSecret: 'y', subId: 'sandeal' });
  const server = await listen(app);
  t.after(() => server.close());
  const base = `http://localhost:${server.address().port}`;

  const res = await realFetch(`${base}/api/convert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: 'https://shopee.vn/product/1/2' }),
  });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.mode, 'demo-fallback');
  assert.ok(body.convertedUrl.includes('af_sub1=sandeal'), 'fallback vẫn phải gắn sub_id');
});

test('Chaos: Shopee API treo — 20 request đồng thời đều nhận fallback trong ngưỡng', async (t) => {
  globalThis.fetch = hangingFetch;
  t.after(() => (globalThis.fetch = realFetch));

  const app = createApp({ appId: 'x', appSecret: 'y', subId: 'sandeal', upstreamTimeoutMs: 300 });
  const server = await listen(app);
  t.after(() => server.close());
  const base = `http://localhost:${server.address().port}`;

  const t0 = Date.now();
  const results = await Promise.all(
    Array.from({ length: 20 }, (_, i) =>
      realFetch(`${base}/api/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: `https://shopee.vn/product/${i}/1` }),
      }).then((r) => r.json())
    )
  );
  const elapsed = Date.now() - t0;

  assert.equal(results.length, 20);
  for (const body of results) {
    assert.equal(body.ok, true);
    assert.equal(body.mode, 'demo-fallback');
  }
  assert.ok(elapsed < 5000, `20 request phải xong < 5s nhờ timeout 300ms, thực tế ${elapsed}ms`);
});
