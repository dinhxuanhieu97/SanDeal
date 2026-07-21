import express from 'express';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';
import {
  isShopeeUrl,
  buildDemoLink,
  buildOfficialShortLink,
  parseShopeeIds,
  queryProductOffer,
} from './lib/shopee.js';
import { getDealsCached } from './lib/deals.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Tạo Express app. Nhận config để integration test dễ khởi động
 * (mặc định đọc từ biến môi trường).
 */
export function createApp(config = {}) {
  const SUB_ID = config.subId ?? process.env.SHOPEE_SUB_ID ?? 'sandeal';
  const APP_ID = config.appId ?? process.env.SHOPEE_APP_ID ?? '';
  const APP_SECRET = config.appSecret ?? process.env.SHOPEE_APP_SECRET ?? '';
  // Ngưỡng chờ API Shopee trước khi rơi về demo-fallback (chaos test dùng giá trị nhỏ)
  const UPSTREAM_TIMEOUT_MS = config.upstreamTimeoutMs ?? 5000;

  const app = express();
  // Chạy sau proxy (Vercel/CDN): tin 1 hop để req.ip lấy đúng IP người dùng
  // từ X-Forwarded-For — thiếu dòng này rate-limit sẽ gộp mọi user làm 1 IP.
  app.set('trust proxy', 1);
  // Không lộ header "X-Powered-By: Express" (giảm fingerprinting)
  app.disable('x-powered-by');
  app.use(express.json({ limit: '10kb' })); // body chỉ cần chứa 1 URL — chặn payload lớn
  app.use(express.static(path.join(__dirname, 'public')));

  // Route thân thiện SEO cho trang hướng dẫn (không cần đuôi .html)
  app.get('/huong-dan-su-dung', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'huong-dan-su-dung.html'));
  });

  // Route thân thiện SEO cho trang deal
  app.get('/san-sale', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'deals.html'));
  });

  // Chống spam: giới hạn số lần gọi API chuyển link theo IP
  const rlConfig = config.rateLimit ?? {};
  const limiter = rateLimit({
    windowMs: rlConfig.windowMs ?? 60_000, // 1 phút
    max: rlConfig.max ?? 60, // 60 lần / phút / IP
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) =>
      res.status(429).json({ ok: false, error: 'Bạn thao tác quá nhanh, vui lòng thử lại sau ít giây.' }),
  });
  app.use('/api/convert', limiter);
  app.use('/api/product', limiter);

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

  app.post('/api/convert', async (req, res) => {
    const { url } = req.body || {};
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ ok: false, error: 'Vui lòng nhập link Shopee.' });
    }
    if (!isShopeeUrl(url)) {
      return res.status(400).json({
        ok: false,
        error: 'Đây không phải link Shopee hợp lệ. Hãy dán link bắt đầu bằng shopee.vn hoặc s.shopee.vn.',
      });
    }

    const hasCredentials = APP_ID && APP_SECRET;
    try {
      if (hasCredentials) {
        const link = await buildOfficialShortLink(url, {
          appId: APP_ID,
          appSecret: APP_SECRET,
          subId: SUB_ID,
          timeoutMs: UPSTREAM_TIMEOUT_MS,
        });
        return res.json({ ok: true, mode: 'official', originUrl: url, convertedUrl: link });
      }
      const link = buildDemoLink(url, SUB_ID);
      return res.json({ ok: true, mode: 'demo', originUrl: url, convertedUrl: link });
    } catch (err) {
      // Log chi tiết phía server; KHÔNG trả err.message thô cho client (tránh lộ nội bộ)
      console.error('[convert] Shopee API lỗi:', err.message);
      const fallback = buildDemoLink(url, SUB_ID);
      return res.json({
        ok: true,
        mode: 'demo-fallback',
        originUrl: url,
        convertedUrl: fallback,
        note: 'API chính thức tạm thời lỗi, đã dùng link demo (vẫn gắn sub_id).',
      });
    }
  });

  app.post('/api/product', async (req, res) => {
    const { url } = req.body || {};
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ ok: false, error: 'Vui lòng nhập link Shopee.' });
    }
    if (!isShopeeUrl(url)) {
      return res.status(400).json({ ok: false, error: 'Đây không phải link Shopee hợp lệ.' });
    }
    const ids = parseShopeeIds(url);
    if (!ids) {
      return res.status(422).json({
        ok: false,
        error:
          'Không đọc được mã sản phẩm từ link. Hãy dùng link sản phẩm dạng shopee.vn/...-i.SHOPID.ITEMID (không phải link rút gọn s.shopee.vn).',
      });
    }

    if (!(APP_ID && APP_SECRET)) {
      return res.json({ ok: true, mode: 'demo', product: demoProduct(url, ids) });
    }
    try {
      const node = await queryProductOffer({
        itemId: ids.itemId,
        shopId: ids.shopId,
        appId: APP_ID,
        appSecret: APP_SECRET,
        timeoutMs: UPSTREAM_TIMEOUT_MS,
      });
      return res.json({ ok: true, mode: 'official', product: node });
    } catch (err) {
      console.error('[product] Shopee API lỗi:', err.message);
      return res.json({
        ok: true,
        mode: 'demo-fallback',
        product: demoProduct(url, ids),
        note: 'API sản phẩm tạm thời lỗi, hiển thị tạm.',
      });
    }
  });

  // Danh sách deal cho trang /san-sale (tự động lấy từ Shopee API, có cache)
  const DEALS_TTL_MS = config.dealsTtlMs ?? 30 * 60 * 1000;
  app.get('/api/deals', async (req, res) => {
    // Cho CDN/Vercel cache ở biên: 30 phút, phục vụ bản cũ khi đang làm mới
    res.set('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=3600');
    try {
      const payload = await getDealsCached(
        { appId: APP_ID, appSecret: APP_SECRET, subId: SUB_ID, timeoutMs: UPSTREAM_TIMEOUT_MS },
        DEALS_TTL_MS
      );
      return res.json(payload);
    } catch (err) {
      console.error('[deals] lỗi:', err.message);
      return res.status(200).json({ ok: false, error: 'Không tải được deal, thử lại sau.' });
    }
  });

  app.get('/api/health', (req, res) => {
    res.json({ ok: true, mode: APP_ID && APP_SECRET ? 'official' : 'demo', subId: SUB_ID });
  });

  return app;
}

// Chỉ khởi động server khi chạy trực tiếp (node server.js), không chạy khi bị import trong test
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const PORT = process.env.PORT || 3000;
  const app = createApp();
  const mode = process.env.SHOPEE_APP_ID && process.env.SHOPEE_APP_SECRET ? 'OFFICIAL (Shopee API)' : 'DEMO (chưa cắm credentials)';
  app.listen(PORT, () => {
    console.log(`\n  🔥 Săn Deal đang chạy tại  http://localhost:${PORT}`);
    console.log(`  Chế độ: ${mode}`);
    console.log(`  Sub ID: ${process.env.SHOPEE_SUB_ID || 'sandeal'}\n`);
  });
}
