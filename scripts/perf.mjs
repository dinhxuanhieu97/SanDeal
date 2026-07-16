// Load test cho /api/convert bằng autocannon.
// Chạy: npm run perf
import autocannon from 'autocannon';
import { createApp } from '../server.js';

// Tắt rate-limit khi benchmark (đặt ngưỡng rất cao)
const app = createApp({ subId: 'sandeal', rateLimit: { windowMs: 60_000, max: 1e9 } });
const server = await new Promise((r) => {
  const s = app.listen(0, () => r(s));
});
const url = `http://localhost:${server.address().port}/api/convert`;

console.log('⏱  Load test /api/convert — 10s, 20 kết nối đồng thời...\n');
const result = await autocannon({
  url,
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ url: 'https://shopee.vn/product/12345/67890' }),
  connections: 20,
  duration: 10,
});

console.log('Kết quả:');
console.log('  Req/s trung bình :', result.requests.average);
console.log('  Độ trễ TB (ms)   :', result.latency.average);
console.log('  Độ trễ p99 (ms)  :', result.latency.p99);
console.log('  Tổng request     :', result.requests.total);
console.log('  Lỗi (non-2xx)    :', result.non2xx);
server.close();
