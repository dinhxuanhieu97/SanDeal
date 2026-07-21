// Trang deal chuẩn SEO: render deal từ /api/deals (Shopee API, tự động, có cache)
// + chèn JSON-LD ItemList. Link ra Shopee đã gắn tracking sẵn từ server.
// Fallback: nếu /api/deals lỗi thì đọc file tĩnh /deals.json và tự gắn sub_id.
(function () {
  const grid = document.getElementById('deal-grid');
  const updatedEl = document.getElementById('deals-updated');
  if (!grid) return;

  const fmtVnd = (n) =>
    typeof n === 'number' ? n.toLocaleString('vi-VN') + 'đ' : '';

  // Gắn tham số theo dõi affiliate vào link Shopee gốc (giống demo-mode server).
  function withSubId(rawUrl, subId) {
    try {
      const u = new URL(rawUrl);
      u.searchParams.set('af_sub1', subId);
      u.searchParams.set('utm_source', subId);
      u.searchParams.set('utm_medium', 'affiliate');
      return u.toString();
    } catch {
      return rawUrl;
    }
  }

  async function getSubId() {
    try {
      const r = await fetch('/api/health');
      const j = await r.json();
      return (j && j.subId) || 'sandeal';
    } catch {
      return 'sandeal';
    }
  }

  function injectSchema(deals) {
    const items = deals.map((d, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Product',
        name: d.name,
        category: d.category,
        image: d.image || undefined,
        offers: {
          '@type': 'Offer',
          price: d.priceNew,
          priceCurrency: 'VND',
          availability: 'https://schema.org/InStock',
          url: 'https://sandeal.top/san-sale',
        },
      },
    }));
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'Deal Shopee hot hôm nay — Săn Deal',
      itemListElement: items,
    };
    const s = document.createElement('script');
    s.type = 'application/ld+json';
    s.textContent = JSON.stringify(schema);
    document.head.appendChild(s);
  }

  function renderCards(deals, subId) {
    grid.textContent = '';
    for (const d of deals) {
      const card = document.createElement('article');
      card.className = 'deal-card';

      const img = document.createElement('img');
      img.className = 'deal-thumb';
      img.loading = 'lazy';
      img.alt = d.name;
      img.src =
        d.image ||
        'data:image/svg+xml,' +
          encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220"><rect width="100%" height="100%" fill="#fff5f2"/><text x="50%" y="50%" font-family="sans-serif" font-size="16" fill="#c2185b" text-anchor="middle" dy=".3em">Săn Deal</text></svg>'
          );

      const body = document.createElement('div');
      body.className = 'deal-body';

      const cat = document.createElement('span');
      cat.className = 'deal-cat';
      cat.textContent = d.category || '';

      const name = document.createElement('h2');
      name.className = 'deal-name';
      name.textContent = d.name;

      const price = document.createElement('div');
      price.className = 'deal-price';
      const pNew = document.createElement('span');
      pNew.className = 'deal-price-new';
      pNew.textContent = fmtVnd(d.priceNew);
      price.appendChild(pNew);
      if (d.priceOld) {
        const pOld = document.createElement('span');
        pOld.className = 'deal-price-old';
        pOld.textContent = fmtVnd(d.priceOld);
        price.appendChild(pOld);
      }

      body.append(cat, name, price);

      if (d.discountText) {
        const badge = document.createElement('span');
        badge.className = 'deal-badge';
        badge.textContent = d.discountText;
        body.appendChild(badge);
      }
      if (d.note) {
        const note = document.createElement('p');
        note.className = 'deal-note';
        note.textContent = d.note;
        body.appendChild(note);
      }

      const cta = document.createElement('a');
      cta.className = 'deal-cta';
      // subId != null => link tĩnh cần gắn tracking; ngược lại link từ API đã gắn sẵn
      cta.href = subId ? withSubId(d.url, subId) : d.url;
      cta.target = '_blank';
      cta.rel = 'nofollow sponsored noopener';
      cta.textContent = 'Săn ngay trên Shopee →';
      body.appendChild(cta);

      card.appendChild(img);
      card.appendChild(body);
      grid.appendChild(card);
    }
  }

  (async function init() {
    let data = null;
    let subId = null; // null => link đã gắn tracking sẵn (từ API)

    // 1) Ưu tiên endpoint động /api/deals (tự cập nhật từ Shopee)
    try {
      const r = await fetch('/api/deals', { cache: 'no-cache' });
      const j = await r.json();
      if (j && j.ok && Array.isArray(j.deals) && j.deals.length) data = j;
    } catch {
      /* rơi xuống fallback tĩnh */
    }

    // 2) Fallback: file tĩnh /deals.json (link gốc, cần gắn sub_id)
    if (!data) {
      try {
        const r = await fetch('/deals.json', { cache: 'no-cache' });
        data = await r.json();
        subId = await getSubId();
      } catch {
        grid.innerHTML = '<p class="deals-empty">Chưa tải được danh sách deal. Vui lòng thử lại.</p>';
        return;
      }
    }

    const deals = (data && data.deals) || [];
    if (updatedEl && data.updated) updatedEl.textContent = 'Cập nhật: ' + data.updated;
    if (updatedEl && (data.mode === 'demo' || data.mode === 'demo-fallback')) {
      updatedEl.insertAdjacentHTML(
        'afterend',
        '<p class="deals-demo-note">⚠️ Đây là deal mẫu minh hoạ. Bấm "Săn ngay" sẽ mở trang tìm kiếm Shopee cho sản phẩm tương tự (đã gắn tracking). Deal thật sẽ hiển thị khi cắm Shopee API hoặc cập nhật danh sách.</p>'
      );
    }
    if (!deals.length) {
      grid.innerHTML = '<p class="deals-empty">Chưa có deal nào. Quay lại sau nhé!</p>';
      return;
    }
    injectSchema(deals);
    renderCards(deals, subId);
  })();
})();
