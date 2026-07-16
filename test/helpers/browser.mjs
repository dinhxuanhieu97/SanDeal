// Chọn engine trình duyệt cho E2E qua biến môi trường PW_BROWSER
// (chromium | firefox | webkit). Mặc định: chromium.
// Ví dụ: PW_BROWSER=firefox npm run test:e2e
import { chromium, firefox, webkit } from 'playwright';

const ENGINES = { chromium, firefox, webkit };

export const browserName = process.env.PW_BROWSER || 'chromium';

export function launchBrowser() {
  const engine = ENGINES[browserName];
  if (!engine) throw new Error(`PW_BROWSER không hợp lệ: "${browserName}" (chromium|firefox|webkit)`);
  // PW_CHROMIUM: đường dẫn chromium tuỳ chỉnh (chỉ áp dụng cho chromium, dùng trong sandbox)
  const opts =
    browserName === 'chromium' && process.env.PW_CHROMIUM
      ? { executablePath: process.env.PW_CHROMIUM }
      : {};
  return engine.launch(opts);
}
