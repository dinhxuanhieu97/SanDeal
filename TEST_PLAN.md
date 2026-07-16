# Chiến lược test — Săn Deal

Áp dụng mô hình **kim tự tháp test**: nhiều unit (nhanh) → integration → ít E2E (chậm, tin cậy cao),
cộng thêm quét **accessibility**, **performance** và **CI tự động**.

```
        /   E2E + A11y   \   7 test — trình duyệt thật + axe-core
       /   Integration     \  7 test — tầng HTTP/API + rate-limit
      /     Unit Tests        \ 7 test — logic thuần, nhanh nhất
   ─────────────────────────────
   Perf (autocannon) · Lighthouse CI · GitHub Actions
```

## Cách chạy

```bash
npm test           # unit + api + rate-limit (không cần trình duyệt) — dùng cho CI
npm run test:unit  # chỉ unit
npm run test:api   # chỉ integration API
npm run test:e2e   # E2E + axe a11y (cần: npx playwright install chromium)
npm run perf       # load test /api/convert bằng autocannon
```

## Phạm vi & loại test

| Khu vực | Loại | File | Che phủ |
|--------|------|------|---------|
| Validate link Shopee | Unit | `test/unit.test.mjs` | hợp lệ, subdomain, giả mạo domain, `javascript:`, ftp, null/số |
| Gắn affiliate sub_id | Unit | `test/unit.test.mjs` | thêm tham số, giữ query cũ, subId tuỳ chỉnh |
| Chữ ký API Shopee | Unit | `test/unit.test.mjs` | SHA256 xác định, đổi timestamp đổi chữ ký |
| Tạo shortlink chính thức | Unit (fetch giả lập) | `test/unit.test.mjs` | thành công + ném lỗi khi API báo lỗi |
| `/api/health` | Integration | `test/api.test.mjs` | trả đúng chế độ demo |
| `/api/convert` | Integration | `test/api.test.mjs` | link hợp lệ, link sai (400), thiếu url (400), sai kiểu (400) |
| Phục vụ file tĩnh | Integration | `test/api.test.mjs` | trang chủ trả HTML |
| Rate limiting | Integration | `test/ratelimit.test.mjs` | cho tới ngưỡng rồi chặn 429 |
| Luồng người dùng | E2E | `test/e2e.spec.mjs` | tải trang, dán link → chuyển → kết quả, báo lỗi, nút sao chép |
| Responsive | E2E | `test/e2e.spec.mjs` | mobile 375px: menu ẩn |
| Accessibility (thủ công) | E2E | `test/e2e.spec.mjs` | lang, alt, aria-label, nhãn nút |
| Accessibility (tự động) | E2E | `test/a11y.axe.mjs` | quét WCAG 2.0/2.1 A+AA bằng axe-core, 0 vi phạm serious/critical |
| Hiệu năng | Load test | `scripts/perf.mjs` | throughput & độ trễ `/api/convert` |
| SEO/Perf/A11y tổng thể | Lighthouse CI | `lighthouserc.json` | ngưỡng điểm ≥ 0.9 |

## Đường đi quan trọng (business-critical) đã bao phủ

1. **Chuyển link đúng** — gắn sub_id/affiliate. ✔ unit + api + e2e
2. **Chặn link rác/độc hại** — từ chối domain giả mạo, `javascript:`. ✔ unit + api + e2e
3. **Không sập khi API Shopee lỗi** — nhánh fallback demo. ✔ unit
4. **Chống spam** — rate-limit 429. ✔ integration
5. **Ai cũng dùng được** — a11y quét tự động 0 vi phạm. ✔ axe-core

## Kết quả gần nhất (đã chạy thật)

- Unit + Integration + Rate-limit: **14/14 pass** (~0.6s)
- E2E + Accessibility (axe): **7/7 pass** (~4.4s)
- **Tổng: 21/21 xanh**
- Accessibility (axe-core): **0 vi phạm** serious/critical
- Load test `/api/convert` (10s, 20 kết nối): **~4.869 req/s**, độ trễ TB **3.56 ms**, p99 **13 ms**, **0 lỗi**

## CI tự động

`.github/workflows/ci.yml` chạy trên mỗi push/PR: `npm ci` → `npm test` → cài Playwright → `npm run test:e2e` → Lighthouse CI.

## Khoảng trống còn lại & đề xuất

- **Chế độ OFFICIAL end-to-end**: hiện test bằng fetch giả lập; cần 1 test staging với credentials thật (không đưa secret vào CI công khai).
- **Visual regression**: thêm `toHaveScreenshot` để bắt lỗi CSS theo pixel.
- **Cross-browser**: E2E đang chạy Chromium; mở rộng Firefox + WebKit.
- **Chaos/độ bền**: mô phỏng Shopee API timeout để kiểm nhánh fallback dưới tải.

## Mục tiêu coverage đề xuất

- Logic lõi (`lib/shopee.js`): **≥ 90%** dòng lệnh.
- Tầng API (`server.js`): mọi endpoint + mọi nhánh lỗi + rate-limit.
- E2E: mọi luồng chính (happy path + 1 nhánh lỗi mỗi luồng) + a11y.
