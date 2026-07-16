import express from 'express';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';
import { isShopeeUrl, buildDemoLink, buildOfficialShortLink } from './lib/shopee.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Tạo Express app. Nhận config để integration test dễ khởi động
 * (mặc định đọc từ biến môi trường).
 */
export function createApp(config = {}) {
  const SUB_ID = config.subId ?? process.env.SHOPEE_SUB_ID ?? 'sandeal';
  const APP_ID = config.appId ?? process.env.SHOPEE_APP_ID ?? '';
  const APP_SECRET = config.appSecret ?? process.env.SHOPEE_APP_SECRET ?? '';

  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'public')));

  // Route thân thiện SEO cho trang hướng dẫn (không cần đuôi .html)
  app.get('/huong-dan-su-dung', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'huong-dan-su-dung.html'));
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
        const link = await buildOfficialShortLink(url, { appId: APP_ID, appSecret: APP_SECRET, subId: SUB_ID });
        return res.json({ ok: true, mode: 'official', originUrl: url, convertedUrl: link });
      }
      const link = buildDemoLink(url, SUB_ID);
      return res.json({ ok: true, mode: 'demo', originUrl: url, convertedUrl: link });
    } catch (err) {
      const fallback = buildDemoLink(url, SUB_ID);
      return res.json({
        ok: true,
        mode: 'demo-fallback',
        originUrl: url,
        convertedUrl: fallback,
        note: 'API chính thức lỗi (' + err.message + '), tạm dùng link demo.',
      });
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
