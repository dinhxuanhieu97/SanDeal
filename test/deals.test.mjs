import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server.js';
import {
  mapOffer,
  demoDeals,
  buildDealsPayload,
  _resetDealsCache,
  getDealsCached,
} from '../lib/deals.js';
import { queryHotOffers } from '../lib/shopee.js';

test('mapOffer: chuyển node Shopee sang thẻ deal, tính giá gốc từ % giảm', () => {
  const node = {
    productName: 'Nồi chiên',
    priceMin: '800000',
    priceDiscountRate: 20,
    imageUrl: 'https://img/x.jpg',
    offerLink: 'https://s.shopee.vn/abc',
    commissionRate: 0.08,
  };
  const d = mapOffer(node, 'Gia dụng');
  assert.equal(d.name, 'Nồi chiên');
  assert.equal(d.priceNew, 800000);
  assert.equal(d.priceOld, 1000000); // 800k / (1 - 0.2)
  assert.equal(d.discountText, '-20%');
  assert.equal(d.url, 'https://s.shopee.vn/abc'); // dùng offerLink đã gắn tracking
  assert.match(d.note, /Hoàn tiền/);
});

test('demoDeals: link mẫu được gắn sub_id', () => {
  const p = demoDeals('mysub');
  assert.ok(['demo', 'manual'].includes(p.mode));
  assert.ok(p.deals.length > 0);
  for (const d of p.deals) {
    assert.match(d.url, /af_sub1=mysub/);
    assert.match(d.url, /utm_medium=affiliate/);
  }
});

test('buildDealsPayload: không có credentials -> trả deal demo', async () => {
  const p = await buildDealsPayload({ subId: 'sandeal' });
  assert.ok(['demo', 'manual'].includes(p.mode));
  assert.ok(Array.isArray(p.deals) && p.deals.length > 0);
});

test('buildDealsPayload: có credentials -> gọi API, gộp & sắp theo % giảm', async () => {
  let calls = 0;
  const fakeFetch = async () => {
    calls++;
    // trả 1 node, % giảm tăng dần theo lần gọi để kiểm tra sắp xếp
    return {
      json: async () => ({
        data: {
          productOfferV2: {
            nodes: [
              {
                productName: `SP ${calls}`,
                priceMin: '100000',
                priceDiscountRate: calls * 10,
                imageUrl: '',
                offerLink: `https://s.shopee.vn/sp${calls}`,
                commissionRate: 0.05,
              },
            ],
          },
        },
      }),
    };
  };
  const p = await buildDealsPayload({
    appId: 'id',
    appSecret: 'secret',
    fetchImpl: fakeFetch,
    limitPerKeyword: 1,
  });
  assert.equal(p.mode, 'official');
  assert.ok(p.deals.length >= 2);
  // deal có % giảm cao nhất đứng đầu
  assert.equal(p.deals[0].discountText, `-${calls * 10}%`);
  // không lộ trường nội bộ _rate ra client
  assert.equal(p.deals[0]._rate, undefined);
});

test('buildDealsPayload: API lỗi hết -> fallback deal mẫu', async () => {
  const boom = async () => {
    throw new Error('network');
  };
  const p = await buildDealsPayload({ appId: 'id', appSecret: 'secret', fetchImpl: boom });
  assert.equal(p.mode, 'demo-fallback');
  assert.ok(p.deals.length > 0);
});

test('getDealsCached: dùng lại kết quả trong TTL (không gọi lại)', async () => {
  _resetDealsCache();
  let builds = 0;
  const fakeFetch = async () => {
    builds++;
    return {
      json: async () => ({
        data: { productOfferV2: { nodes: [{ productName: 'x', priceMin: '1', offerLink: 'https://s.shopee.vn/x', priceDiscountRate: 5 }] } },
      }),
    };
  };
  const opts = { appId: 'id', appSecret: 'secret', fetchImpl: fakeFetch, limitPerKeyword: 1 };
  let t = 1000;
  const clock = () => t;
  await getDealsCached(opts, 60000, clock);
  const before = builds;
  t = 2000; // trong TTL
  await getDealsCached(opts, 60000, clock);
  assert.equal(builds, before, 'không gọi API lần 2 khi còn trong TTL');
  _resetDealsCache();
});

test('queryHotOffers: gửi keyword & parse nodes', async () => {
  let sentBody = '';
  const fakeFetch = async (url, opt) => {
    sentBody = opt.body;
    return {
      json: async () => ({ data: { productOfferV2: { nodes: [{ productName: 'A' }, { productName: 'B' }] } } }),
    };
  };
  const nodes = await queryHotOffers({ keyword: 'nồi chiên', limit: 2, appId: 'id', appSecret: 's', fetchImpl: fakeFetch });
  assert.equal(nodes.length, 2);
  assert.match(sentBody, /productOfferV2/);
  assert.match(sentBody, /limit:2/);
});

test('GET /api/deals: demo mode trả deal có sub_id', async () => {
  const app = createApp({ subId: 'sandeal' }); // không truyền appId/appSecret -> demo
  const { createServer } = await import('node:http');
  const server = createServer(app);
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const res = await fetch(`http://127.0.0.1:${port}/api/deals`);
  const body = await res.json();
  server.close();
  assert.equal(body.ok, true);
  assert.ok(['demo', 'manual'].includes(body.mode));
  assert.ok(body.deals.length > 0);
  assert.match(body.deals[0].url, /af_sub1=sandeal/);
});
