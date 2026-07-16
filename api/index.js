import {
  isShopeeUrl,
  buildDemoLink,
  buildOfficialShortLink,
  parseShopeeIds,
  queryProductOffer,
} from '../lib/shopee.js';

const SUB_ID = process.env.SHOPEE_SUB_ID || 'sandeal';
const APP_ID = process.env.SHOPEE_APP_ID || '';
const APP_SECRET = process.env.SHOPEE_APP_SECRET || '';

function demoProduct(url, ids) {
  return {
    productName: 'Sản phẩm Shopee (demo — cắm credentials để lấy dữ liệu thật)',
    shopName: 'Shopee',
    priceMin: null,
    priceMax: null,
    imageUrl: '',
    commissionRate: null,
    sales: null,
    ratingStar: null,
    offerLink: buildDemoLink(url, SUB_ID),
    shopId: ids.shopId,
    itemId: ids.itemId,
  };
}

export default async function handler(req, res) {
  const url = req.url || '';

  if (url.startsWith('/api/health')) {
    return res.status(200).json({ ok: true, mode: APP_ID && APP_SECRET ? 'official' : 'demo', subId: SUB_ID });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Phương thức không hỗ trợ.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const link = body && body.url;

  if (!link || typeof link !== 'string') {
    return res.status(400).json({ ok: false, error: 'Vui lòng nhập link Shopee.' });
  }
  if (!isShopeeUrl(link)) {
    return res.status(400).json({
      ok: false,
      error: 'Đây không phải link Shopee hợp lệ. Hãy dán link bắt đầu bằng shopee.vn hoặc s.shopee.vn.',
    });
  }

  // ===== /api/product: lấy thông tin sản phẩm =====
  if (url.startsWith('/api/product')) {
    const ids = parseShopeeIds(link);
    if (!ids) {
      return res.status(422).json({
        ok: false,
        error:
          'Không đọc được mã sản phẩm từ link. Hãy dùng link dạng shopee.vn/...-i.SHOPID.ITEMID (không phải link rút gọn).',
      });
    }
    if (!(APP_ID && APP_SECRET)) {
      return res.status(200).json({ ok: true, mode: 'demo', product: demoProduct(link, ids) });
    }
    try {
      const node = await queryProductOffer({ itemId: ids.itemId, shopId: ids.shopId, appId: APP_ID, appSecret: APP_SECRET });
      return res.status(200).json({ ok: true, mode: 'official', product: node });
    } catch (err) {
      return res.status(200).json({ ok: true, mode: 'demo-fallback', product: demoProduct(link, ids), note: 'API sản phẩm tạm lỗi.' });
    }
  }

  // ===== /api/convert: tạo link affiliate =====
  try {
    if (APP_ID && APP_SECRET) {
      const out = await buildOfficialShortLink(link, { appId: APP_ID, appSecret: APP_SECRET, subId: SUB_ID });
      return res.status(200).json({ ok: true, mode: 'official', originUrl: link, convertedUrl: out });
    }
    return res.status(200).json({ ok: true, mode: 'demo', originUrl: link, convertedUrl: buildDemoLink(link, SUB_ID) });
  } catch (err) {
    return res.status(200).json({
      ok: true,
      mode: 'demo-fallback',
      originUrl: link,
      convertedUrl: buildDemoLink(link, SUB_ID),
      note: 'API chính thức lỗi, tạm dùng link demo.',
    });
  }
}
