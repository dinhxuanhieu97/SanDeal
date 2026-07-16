import { isShopeeUrl, buildDemoLink, buildOfficialShortLink } from '../lib/shopee.js';

const SUB_ID = process.env.SHOPEE_SUB_ID || 'sandeal';
const APP_ID = process.env.SHOPEE_APP_ID || '';
const APP_SECRET = process.env.SHOPEE_APP_SECRET || '';

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
      note: 'API chính thức lỗi (' + err.message + '), tạm dùng link demo.',
    });
  }
}
