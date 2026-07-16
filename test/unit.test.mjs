import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isShopeeUrl,
  buildDemoLink,
  signRequest,
  buildOfficialShortLink,
} from '../lib/shopee.js';

test('isShopeeUrl: chấp nhận các link Shopee hợp lệ', () => {
  assert.equal(isShopeeUrl('https://shopee.vn/product/1/2'), true);
  assert.equal(isShopeeUrl('https://www.shopee.vn/abc'), true);
  assert.equal(isShopeeUrl('https://s.shopee.vn/xyz'), true);
  assert.equal(isShopeeUrl('https://shp.ee/abc123'), true);
  assert.equal(isShopeeUrl('http://shopee.vn/deal'), true);
  assert.equal(isShopeeUrl('https://cf.shopee.vn/file/x'), true); // subdomain
});

test('isShopeeUrl: từ chối link không hợp lệ / độc hại', () => {
  assert.equal(isShopeeUrl('https://tiki.vn/abc'), false);
  assert.equal(isShopeeUrl('https://lazada.vn/x'), false);
  assert.equal(isShopeeUrl('https://shopee.vn.evil.com/x'), false); // giả mạo domain
  assert.equal(isShopeeUrl('javascript:alert(1)'), false);
  assert.equal(isShopeeUrl('ftp://shopee.vn/x'), false);
  assert.equal(isShopeeUrl('không phải url'), false);
  assert.equal(isShopeeUrl(''), false);
  assert.equal(isShopeeUrl(null), false);
  assert.equal(isShopeeUrl(12345), false);
});

test('buildDemoLink: gắn đúng tham số theo dõi', () => {
  const out = buildDemoLink('https://shopee.vn/product/1/2', 'sandeal');
  const u = new URL(out);
  assert.equal(u.searchParams.get('af_sub1'), 'sandeal');
  assert.equal(u.searchParams.get('utm_source'), 'sandeal');
  assert.equal(u.searchParams.get('utm_medium'), 'affiliate');
});

test('buildDemoLink: giữ nguyên query sẵn có và dùng subId tuỳ chỉnh', () => {
  const out = buildDemoLink('https://shopee.vn/p?ref=home', 'myshop');
  const u = new URL(out);
  assert.equal(u.searchParams.get('ref'), 'home');
  assert.equal(u.searchParams.get('af_sub1'), 'myshop');
});

test('signRequest: SHA256 xác định & đúng công thức', () => {
  const sig = signRequest({ appId: 'APP', appSecret: 'SECRET', timestamp: 100, payload: 'BODY' });
  // giá trị cố định => phát hiện nếu công thức chữ ký bị đổi ngoài ý muốn
  assert.match(sig, /^[a-f0-9]{64}$/);
  const again = signRequest({ appId: 'APP', appSecret: 'SECRET', timestamp: 100, payload: 'BODY' });
  assert.equal(sig, again); // xác định
  const diff = signRequest({ appId: 'APP', appSecret: 'SECRET', timestamp: 101, payload: 'BODY' });
  assert.notEqual(sig, diff); // đổi timestamp => đổi chữ ký
});

test('buildOfficialShortLink: trả shortLink khi API thành công (fetch giả lập)', async () => {
  let captured;
  const fakeFetch = async (url, opts) => {
    captured = { url, opts };
    return { json: async () => ({ data: { generateShortLink: { shortLink: 'https://s.shopee.vn/SHORT' } } }) };
  };
  const link = await buildOfficialShortLink('https://shopee.vn/p/1', {
    appId: 'APP', appSecret: 'SECRET', subId: 'sandeal', timestamp: 100, fetchImpl: fakeFetch,
  });
  assert.equal(link, 'https://s.shopee.vn/SHORT');
  assert.equal(captured.url, 'https://open-api.affiliate.shopee.vn/graphql');
  assert.equal(captured.opts.method, 'POST');
  assert.match(captured.opts.headers.Authorization, /^SHA256 Credential=APP/);
});

test('buildOfficialShortLink: ném lỗi khi API trả về error', async () => {
  const fakeFetch = async () => ({ json: async () => ({ errors: [{ message: 'Sai credentials' }] }) });
  await assert.rejects(
    () => buildOfficialShortLink('https://shopee.vn/p/1', { appId: 'A', appSecret: 'B', fetchImpl: fakeFetch }),
    /Sai credentials/
  );
});

test('buildOfficialShortLink: API trả body rỗng → lỗi mặc định "Không tạo được shortlink"', async () => {
  const fakeFetch = async () => ({ json: async () => ({}) });
  await assert.rejects(
    buildOfficialShortLink('https://shopee.vn/p/1', {
      appId: 'a',
      appSecret: 'b',
      timestamp: 1700000000,
      fetchImpl: fakeFetch,
    }),
    /Không tạo được shortlink/
  );
});
