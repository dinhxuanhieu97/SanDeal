// Visual regression test — chụp màn hình và so pixel với baseline.
// Lần chạy đầu: tự tạo baseline trong test/__screenshots__/ (test pass).
// Các lần sau: so sánh; nếu >0.5% pixel khác → fail và xuất ảnh diff.
// Cập nhật giao diện có chủ đích? Xoá baseline tương ứng rồi chạy lại.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { createApp } from '../server.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SNAP_DIR = path.join(__dirname, '__screenshots__');
const DIFF_DIR = path.join(SNAP_DIR, 'diff');
const MAX_DIFF_RATIO = 0.005; // cho phép tối đa 0.5% pixel khác biệt

let server;
let browser;
let baseURL;
const launchOpts = process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {};

before(async () => {
  fs.mkdirSync(DIFF_DIR, { recursive: true });
  const app = createApp({ subId: 'sandeal' });
  await new Promise((r) => (server = app.listen(0, r)));
  baseURL = `http://localhost:${server.address().port}`;
  browser = await chromium.launch(launchOpts);
});

after(async () => {
  await browser?.close();
  server?.close();
});

async function capture(urlPath, viewport) {
  const page = await browser.newPage({ viewport });
  await page.goto(`${baseURL}${urlPath}`, { waitUntil: 'networkidle' });
  // Tắt animation/transition/caret để ảnh chụp ổn định giữa các lần chạy
  await page.addStyleTag({
    content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}',
  });
  await page.evaluate(() => document.fonts.ready);
  const buf = await page.screenshot({ fullPage: true });
  await page.close();
  return PNG.sync.read(buf);
}

function compareToBaseline(name, img) {
  const baselinePath = path.join(SNAP_DIR, `${name}.png`);
  if (!fs.existsSync(baselinePath)) {
    fs.writeFileSync(baselinePath, PNG.sync.write(img));
    console.error(`[visual] Đã tạo baseline mới: ${name}.png — lần chạy sau mới bắt đầu so sánh.`);
    return { created: true, ratio: 0 };
  }
  const base = PNG.sync.read(fs.readFileSync(baselinePath));
  assert.equal(
    `${img.width}x${img.height}`,
    `${base.width}x${base.height}`,
    `Kích thước ảnh "${name}" khác baseline — layout đã thay đổi lớn`
  );
  const diff = new PNG({ width: base.width, height: base.height });
  const mismatched = pixelmatch(base.data, img.data, diff.data, base.width, base.height, { threshold: 0.2 });
  const ratio = mismatched / (base.width * base.height);
  if (ratio > MAX_DIFF_RATIO) {
    fs.writeFileSync(path.join(DIFF_DIR, `${name}.diff.png`), PNG.sync.write(diff));
  }
  return { created: false, ratio };
}

const SCENARIOS = [
  ['home-desktop', '/', { width: 1280, height: 800 }],
  ['home-mobile', '/', { width: 375, height: 700 }],
  ['huong-dan-desktop', '/huong-dan-su-dung', { width: 1280, height: 800 }],
  ['huong-dan-mobile', '/huong-dan-su-dung', { width: 375, height: 700 }],
];

for (const [name, urlPath, viewport] of SCENARIOS) {
  test(`Visual: ${name} khớp baseline (≤${MAX_DIFF_RATIO * 100}% pixel khác)`, async () => {
    const img = await capture(urlPath, viewport);
    const { created, ratio } = compareToBaseline(name, img);
    if (created) return; // lần đầu: chỉ tạo baseline
    assert.ok(
      ratio <= MAX_DIFF_RATIO,
      `${name}: ${(ratio * 100).toFixed(3)}% pixel khác baseline — xem test/__screenshots__/diff/${name}.diff.png`
    );
  });
}
