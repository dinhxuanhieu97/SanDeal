# 🔥 Săn Deal

Website chuyển link Shopee → tự động gắn affiliate và săn voucher/hoàn tiền.
Giao diện + nội dung + thương hiệu gốc, chạy được ngay trên máy local.

## Chạy thử trên máy (local)

Cần cài [Node.js](https://nodejs.org) phiên bản 18 trở lên.

```bash
# 1. Cài thư viện
npm install

# 2. Tạo file cấu hình từ mẫu
cp .env.example .env

# 3. Chạy server
npm start
```

Mở trình duyệt tại **http://localhost:3000**

## Chế độ hoạt động

| Chế độ | Khi nào | Kết quả |
|--------|---------|---------|
| **DEMO** | Chưa điền `SHOPEE_APP_ID` / `SHOPEE_APP_SECRET` | Gắn tham số `sub_id` vào link Shopee gốc — đủ để test giao diện & luồng. |
| **OFFICIAL** | Đã điền credentials Shopee Affiliate | Gọi Shopee Affiliate Open API tạo shortlink chính thức có tracking. |

### Lấy credentials để nhận hoàn tiền thật

1. Đăng ký [Shopee Affiliate](https://affiliate.shopee.vn).
2. Vào mục **Open API**, lấy `App ID` và `App Secret`.
3. Điền vào file `.env`:
   ```
   SHOPEE_APP_ID=xxxxxxxx
   SHOPEE_APP_SECRET=xxxxxxxx
   SHOPEE_SUB_ID=sandeal
   ```
4. Chạy lại `npm start`. Site tự chuyển sang chế độ OFFICIAL.

> ⚠️ Chữ ký gọi API theo chuẩn Shopee tại thời điểm viết. Nếu Shopee cập nhật
> định dạng, chỉnh lại hàm `buildOfficialShortLink` trong `server.js` theo tài liệu mới nhất.

## Kiểm thử (test)

```bash
npm test           # unit + api + rate-limit (nhanh, dùng cho CI)
npm run test:e2e   # E2E + axe accessibility — cần: npx playwright install chromium
npm run perf       # load test /api/convert bằng autocannon
```

Đã có sẵn **24 test** (7 unit + 6 API + 1 rate-limit + 8 E2E + 2 axe a11y), tất cả đang xanh;
axe-core 0 vi phạm trên cả trang chủ và trang hướng dẫn; load test ~4.869 req/s.
CI tự chạy qua `.github/workflows/ci.yml`.
Chi tiết chiến lược xem `TEST_PLAN.md`.

## Cấu trúc

```
san-deal/
├── server.js          # Backend Express (export createApp) + API + rate-limit
├── lib/
│   └── shopee.js      # Logic lõi: validate link, gắn affiliate, ký & gọi API
├── test/
│   ├── unit.test.mjs      # Test logic thuần
│   ├── api.test.mjs       # Test tầng HTTP/API
│   ├── ratelimit.test.mjs # Test chống spam (429)
│   ├── e2e.spec.mjs       # Test trình duyệt thật (Playwright)
│   └── a11y.axe.mjs       # Quét accessibility tự động (axe-core)
├── scripts/
│   └── perf.mjs       # Load test bằng autocannon
├── .github/workflows/ci.yml  # CI tự chạy test + Lighthouse
├── lighthouserc.json  # Cấu hình Lighthouse CI
├── package.json
├── .env.example       # Mẫu cấu hình
├── TEST_PLAN.md       # Chiến lược kiểm thử
└── public/            # Frontend
    ├── index.html               # Trang chủ + công cụ chuyển link + SEO
    ├── huong-dan-su-dung.html   # Trang hướng dẫn sử dụng
    ├── styles.css
    ├── app.js
    ├── logo.svg
    └── favicon.svg
```

## SEO đã cài sẵn

- Thẻ `title`, `description`, `keywords`, `canonical`
- Open Graph (Facebook) + Twitter Card
- Structured data JSON-LD (WebApplication)
- `lang="vi"`, `theme-color`, favicon SVG

Nhớ thay `https://sandeal.vn/` và `og-image.png` bằng domain + ảnh thật của bạn khi lên production.

---
*Săn Deal không phải trang chính thức của Shopee. "Shopee" là nhãn hiệu của chủ sở hữu tương ứng.*
