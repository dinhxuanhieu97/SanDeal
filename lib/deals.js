// Lấy danh sách deal cho trang /san-sale.
// - Có credentials: gọi Shopee Affiliate API theo từ khoá ngách, gộp + sắp theo % giảm.
// - Chưa có credentials (hoặc API lỗi): trả deal mẫu, tự gắn sub_id vào link.
// Có cache theo TTL để không gọi API mỗi request.
import { buildDemoLink, queryHotOffers } from './shopee.js';
import { REAL_DEALS } from './deals-data.js';

// Các ngách muốn lấy deal. Sửa danh sách này để đổi nhóm sản phẩm hiển thị.
export const DEAL_KEYWORDS = [
  { keyword: 'nồi chiên không dầu', category: 'Gia dụng nhà bếp' },
  { keyword: 'serum vitamin c', category: 'Làm đẹp' },
  { keyword: 'đồ dùng cho bé', category: 'Mẹ & bé' },
  { keyword: 'đèn led để bàn', category: 'Gia dụng' },
];

// Deal mẫu dùng khi chưa cắm credentials (link là sản phẩm Shopee gốc, sẽ được gắn sub_id).
// Deal mẫu (chế độ demo). 'kw' = từ khoá; link sẽ trỏ tới trang tìm kiếm Shopee thật
// theo từ khoá đó (gắn sub_id), để không bị link chết. Thay bằng deal thật khi có.
export const SAMPLE_DEALS = [
  { name: 'Nồi chiên không dầu 5L điện tử màn hình cảm ứng', category: 'Gia dụng nhà bếp', image: '', priceNew: 899000, priceOld: 1590000, discountText: '-43%', note: 'Freeship + hoàn tiền 8%', kw: 'nồi chiên không dầu 5L' },
  { name: 'Serum dưỡng trắng da Vitamin C 30ml chính hãng', category: 'Làm đẹp', image: '', priceNew: 149000, priceOld: 320000, discountText: '-53%', note: 'Mã giảm thêm 20k, hoàn tiền 12%', kw: 'serum vitamin c' },
  { name: 'Bộ 4 hộp bảo quản thực phẩm nắp khoá kín', category: 'Gia dụng nhà bếp', image: '', priceNew: 79000, priceOld: 180000, discountText: '-56%', note: 'Freeship đơn từ 50k', kw: 'hộp bảo quản thực phẩm' },
  { name: 'Xe đẩy gấp gọn cho bé thiết kế 2 chiều', category: 'Mẹ & bé', image: '', priceNew: 1290000, priceOld: 2100000, discountText: '-39%', note: 'Trả góp 0%, hoàn tiền 6%', kw: 'xe đẩy em bé gấp gọn' },
  { name: 'Đèn LED để bàn chống cận cảm ứng 3 chế độ sáng', category: 'Gia dụng', image: '', priceNew: 199000, priceOld: 450000, discountText: '-56%', note: 'Mã giảm 30k, freeship', kw: 'đèn led để bàn chống cận' },
  { name: 'Sữa rửa mặt tạo bọt dịu nhẹ cho da nhạy cảm 150ml', category: 'Làm đẹp', image: '', priceNew: 89000, priceOld: 165000, discountText: '-46%', note: 'Mua 1 tặng 1, hoàn tiền 10%', kw: 'sữa rửa mặt dịu nhẹ' },
];

/** Tạo link tìm kiếm Shopee thật từ từ khoá (đã gắn sub_id qua buildDemoLink). */
function searchUrl(kw, subId) {
  return buildDemoLink('https://shopee.vn/search?keyword=' + encodeURIComponent(kw), subId);
}

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

function todayStr(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10);
}

/** Chuyển 1 node từ Shopee API sang định dạng thẻ deal của trang. */
export function mapOffer(node, category) {
  const priceNew = num(node.priceMin ?? node.price);
  const rate = num(node.priceDiscountRate);
  const priceOld = rate && priceNew ? Math.round(priceNew / (1 - rate / 100)) : null;
  const commPct = num(node.commissionRate);
  return {
    name: node.productName || 'Sản phẩm Shopee',
    category: category || node.shopName || '',
    image: node.imageUrl || '',
    priceNew,
    priceOld,
    discountText: rate ? `-${Math.round(rate)}%` : '',
    note: commPct ? `Hoàn tiền tới ${Math.round(commPct * 100)}%` : '',
    url: node.offerLink || node.productLink || '',
    _rate: rate || 0,
  };
}

const stripInternal = ({ _rate, ...rest }) => rest;

/**
 * Deal khi chưa có API.
 * - Nếu có REAL_DEALS (snapshot sản phẩm thật từ Shopee): dùng nó, mode 'manual',
 *   gắn sub_id vào link sản phẩm thật.
 * - Nếu không: dùng deal mẫu trỏ tìm kiếm Shopee, mode 'demo'.
 */
export function demoDeals(subId, now = Date.now()) {
  if (Array.isArray(REAL_DEALS) && REAL_DEALS.length) {
    return {
      ok: true,
      mode: 'manual',
      updated: todayStr(now),
      deals: REAL_DEALS.map((d) => ({ ...d, url: buildDemoLink(d.url, subId) })),
    };
  }
  return {
    ok: true,
    mode: 'demo',
    updated: todayStr(now),
    deals: SAMPLE_DEALS.map(({ kw, ...d }) => ({ ...d, url: searchUrl(kw, subId) })),
  };
}

/** Gọi API thật (nếu có credentials) hoặc rơi về deal mẫu. */
export async function buildDealsPayload({
  appId,
  appSecret,
  subId = 'sandeal',
  timeoutMs = 8000,
  limitPerKeyword = 4,
  total = 12,
  fetchImpl,
  now = Date.now(),
} = {}) {
  if (!(appId && appSecret)) return demoDeals(subId, now);

  const all = [];
  for (const k of DEAL_KEYWORDS) {
    try {
      const nodes = await queryHotOffers({
        keyword: k.keyword,
        limit: limitPerKeyword,
        appId,
        appSecret,
        timeoutMs,
        fetchImpl,
      });
      for (const n of nodes) {
        const deal = mapOffer(n, k.category);
        if (deal.url) all.push(deal);
      }
    } catch {
      // Bỏ qua từ khoá lỗi, vẫn lấy các từ khoá còn lại
    }
  }

  if (!all.length) {
    const demo = demoDeals(subId, now);
    demo.mode = 'demo-fallback';
    demo.note = 'API deal tạm lỗi, hiển thị deal mẫu.';
    return demo;
  }

  all.sort((a, b) => b._rate - a._rate);
  return {
    ok: true,
    mode: 'official',
    updated: todayStr(now),
    deals: all.slice(0, total).map(stripInternal),
  };
}

// ===== Cache đơn giản theo TTL (dùng chung cho server & serverless warm instance) =====
let _cache = { at: 0, data: null };

export async function getDealsCached(opts = {}, ttlMs = 30 * 60 * 1000, clock = Date.now) {
  const now = clock();
  if (_cache.data && now - _cache.at < ttlMs) return _cache.data;
  const data = await buildDealsPayload({ ...opts, now });
  _cache = { at: now, data };
  return data;
}

// Cho test: xoá cache
export function _resetDealsCache() {
  _cache = { at: 0, data: null };
}
