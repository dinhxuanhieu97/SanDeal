import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { parseShopeeIds, queryProductOffer } from '../lib/shopee.js';
import { createApp } from '../server.js';

test('parseShopeeIds: tách đúng shopId/itemId từ link i.SHOP.ITEM', () => {
  const r = parseShopeeIds('https://shopee.vn/Boc-goi-KOHNAN-i.503010158.21579457897');
  assert.deepEqual(r, { shopId: 503010158, itemId: 21579457897 });
});

test('parseShopeeIds: hỗ trợ dạng /product/SHOP/ITEM', () => {
  const r = parseShopeeIds('https://shopee.vn/product/503010158/21579457897');
  assert.deepEqual(r, { shopId: 503010158, itemId: 21579457897 });
});

test('parseShopeeIds: trả null với link không có id (shortlink / rác)', () => {
  assert.equal(parseShopeeIds('https://s.shopee.vn/abc123'), null);
  assert.equal(parseShopeeIds('không phải url'), null);
  assert.equal(parseShopeeIds(null), null);
});

test('queryProductOffer: trả node sản phẩm khi API thành công (fetch giả lập)', async () => {
  const fake = async () => ({
    json: async () => ({
      data: {
        productOfferV2: {
          nodes: [{ productName: 'Bọc gối KOHNAN', priceMin: 119000, imageUrl: 'https://cf.shopee.vn/x.jpg', commissionRate: 0.12 }],
        },
      },
    }),
  });
  const p = await queryProductOffer({ itemId: 1, shopId: 2, appId: 'A', appSecret: 'B', timestamp: 100, fetchImpl: fake });
  assert.equal(p.productName, 'Bọc gối KOHNAN');
  assert.equal(p.priceMin, 119000);
});

test('queryProductOffer: ném lỗi khi không có sản phẩm', async () => {
  const fake = async () => ({ json: async () => ({ data: { productOfferV2: { nodes: [] } } }) });
  await assert.rejects(
    () => queryProductOffer({ itemId: 1, shopId: 2, appId: 'A', appSecret: 'B', timestamp: 100, fetchImpl: fake }),
    /Không tìm thấy sản phẩm/
  );
});

// ===== Integration: /api/product ở chế độ demo =====
let server;
let baseURL;
before(async () => {
  const app = createApp({ subId: 'sandeal' }); // không credentials → demo
  await new Promise((r) => (server = app.listen(0, r)));
  baseURL = `http://localhost:${server.address().port}`;
});
after(() => server?.close());

async function postProduct(url) {
  const res = await fetch(`${baseURL}/api/product`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  return { status: res.status, json: await res.json() };
}

test('POST /api/product link hợp lệ → demo product có shopId/itemId', async () => {
  const { status, json } = await postProduct('https://shopee.vn/Boc-goi-i.503010158.21579457897');
  assert.equal(status, 200);
  assert.equal(json.ok, true);
  assert.equal(json.mode, 'demo');
  assert.equal(json.product.shopId, 503010158);
  assert.equal(json.product.itemId, 21579457897);
});

test('POST /api/product link không tách được id → 422', async () => {
  const { status, json } = await postProduct('https://s.shopee.vn/abc123');
  assert.equal(status, 422);
  assert.equal(json.ok, false);
});

test('POST /api/product link không phải Shopee → 400', async () => {
  const { status } = await postProduct('https://tiki.vn/abc');
  assert.equal(status, 400);
});
