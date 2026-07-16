import crypto from 'node:crypto';

// Các domain Shopee hợp lệ được chấp nhận
export const SHOPEE_HOSTS = ['shopee.vn', 'shopee.com', 's.shopee.vn', 'shp.ee'];

/** Kiểm tra một chuỗi có phải link Shopee hợp lệ không */
export function isShopeeUrl(raw) {
  if (typeof raw !== 'string') return false;
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    const host = u.hostname.replace(/^www\./, '').toLowerCase();
    return SHOPEE_HOSTS.some((h) => host === h || host.endsWith('.' + h));
  } catch {
    return false;
  }
}

/** DEMO: gắn tham số theo dõi (sub_id / utm) vào link Shopee gốc */
export function buildDemoLink(raw, subId = 'sandeal') {
  const u = new URL(raw.trim());
  u.searchParams.set('af_sub1', subId);
  u.searchParams.set('utm_source', subId);
  u.searchParams.set('utm_medium', 'affiliate');
  return u.toString();
}

/** Chữ ký chuẩn Shopee: SHA256(AppId + Timestamp + Payload + AppSecret) */
export function signRequest({ appId, appSecret, timestamp, payload }) {
  const base = `${appId}${timestamp}${payload}${appSecret}`;
  return crypto.createHash('sha256').update(base).digest('hex');
}

/**
 * PRODUCTION: gọi Shopee Affiliate Open API (GraphQL) tạo shortlink chính thức.
 * fetchImpl & timestamp tách ra tham số để unit test có thể giả lập.
 */
export async function buildOfficialShortLink(
  raw,
  { appId, appSecret, subId = 'sandeal', timestamp, fetchImpl = fetch, timeoutMs = 5000 } = {}
) {
  const ts = timestamp ?? Math.floor(Date.now() / 1000);
  const endpoint = 'https://open-api.affiliate.shopee.vn/graphql';
  const query = `mutation{generateShortLink(input:{originUrl:${JSON.stringify(
    raw
  )},subIds:[${JSON.stringify(subId)}]}){shortLink}}`;
  const payload = JSON.stringify({ query });
  const signature = signRequest({ appId, appSecret, timestamp: ts, payload });

  // Tự huỷ sau timeoutMs để API treo không kéo sập request (nhánh fallback sẽ xử lý)
  const res = await fetchImpl(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `SHA256 Credential=${appId}, Timestamp=${ts}, Signature=${signature}`,
    },
    body: payload,
    signal: AbortSignal.timeout(timeoutMs),
  });

  const data = await res.json();
  const link = data?.data?.generateShortLink?.shortLink;
  if (!link) {
    const msg = data?.errors?.[0]?.message || 'Không tạo được shortlink';
    throw new Error(msg);
  }
  return link;
}
