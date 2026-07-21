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
      img.referrerPolicy = 'no-referrer';
      const placeholder =
        'data:image/svg+xml,' +
        encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220"><rect width="100%" height="100%" fill="#fff5f2"/><text x="50%" y="50%" font-family="sans-serif" font-size="16" fill="#c2185b" text-anchor="middle" dy=".3em">Săn Deal</text></svg>'
        );
      img.src = d.image || placeholder;
      // Ảnh Shopee lỗi/không tải được → hiện ảnh thay thế thay vì ô trống
      img.onerror = () => {
        img.onerror = null;
        img.src = placeholder;
      };

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

  // Bỏ dấu để tìm kiếm không phân biệt dấu
  const norm = (s) =>
    (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
  const parseDisc = (d) => {
    const m = /(-?\d+)/.exec(d.discountText || '');
    return m ? Math.abs(+m[1]) : 0;
  };

  // Lọc + sắp xếp + render lại lưới theo trạng thái hiện tại
  function renderFiltered(all, subId, state) {
    let list = all.filter((d) => state.cat === 'Tất cả' || d.category === state.cat);
    if (state.q) {
      const q = norm(state.q);
      list = list.filter((d) => norm(d.name).includes(q));
    }
    if (state.sort === 'disc') list = [...list].sort((a, b) => parseDisc(b) - parseDisc(a));
    else if (state.sort === 'price-asc') list = [...list].sort((a, b) => (a.priceNew || 0) - (b.priceNew || 0));
    else if (state.sort === 'price-desc') list = [...list].sort((a, b) => (b.priceNew || 0) - (a.priceNew || 0));
    const cnt = document.getElementById('deal-count');
    if (cnt) cnt.textContent = list.length + ' sản phẩm';
    if (!list.length) {
      grid.innerHTML = '<p class="deals-empty">Không tìm thấy sản phẩm phù hợp. Thử từ khoá khác nhé!</p>';
      return;
    }
    renderCards(list, subId);
  }

  // Dựng thanh điều khiển: chip danh mục + ô tìm + sắp xếp
  function buildControls(cats, all, subId, state) {
    const wrap = document.createElement('div');
    wrap.className = 'deal-controls';

    const chips = document.createElement('div');
    chips.className = 'cat-chips';
    cats.forEach((c) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cat-chip' + (c === state.cat ? ' active' : '');
      b.textContent = c;
      b.addEventListener('click', () => {
        state.cat = c;
        chips.querySelectorAll('.cat-chip').forEach((x) => x.classList.toggle('active', x === b));
        renderFiltered(all, subId, state);
      });
      chips.appendChild(b);
    });

    const row = document.createElement('div');
    row.className = 'deal-controls-row';
    const search = document.createElement('input');
    search.type = 'search';
    search.className = 'deal-search';
    search.placeholder = '🔎 Tìm sản phẩm...';
    search.setAttribute('aria-label', 'Tìm sản phẩm');
    const sort = document.createElement('select');
    sort.className = 'deal-sort';
    sort.setAttribute('aria-label', 'Sắp xếp');
    [
      ['default', 'Mặc định'],
      ['disc', 'Giảm nhiều nhất'],
      ['price-asc', 'Giá thấp → cao'],
      ['price-desc', 'Giá cao → thấp'],
    ].forEach(([v, t]) => {
      const o = document.createElement('option');
      o.value = v;
      o.textContent = t;
      sort.appendChild(o);
    });
    row.append(search, sort);

    const count = document.createElement('span');
    count.className = 'deal-count';
    count.id = 'deal-count';

    wrap.append(chips, row, count);
    grid.parentNode.insertBefore(wrap, grid);

    let t;
    search.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => {
        state.q = search.value;
        renderFiltered(all, subId, state);
      }, 180);
    });
    sort.addEventListener('change', () => {
      state.sort = sort.value;
      renderFiltered(all, subId, state);
    });
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
    } else if (updatedEl && data.mode === 'manual') {
      updatedEl.insertAdjacentHTML(
        'afterend',
        '<p class="deals-demo-note">💡 Giá là mức tham khảo tại thời điểm cập nhật' +
          (data.updated ? ' (' + data.updated + ')' : '') +
          '. Bấm "Săn ngay" để xem giá &amp; ưu đãi mới nhất trên Shopee.</p>'
      );
    }
    if (!deals.length) {
      grid.innerHTML = '<p class="deals-empty">Chưa có deal nào. Quay lại sau nhé!</p>';
      return;
    }
    injectSchema(deals);
    const state = { cat: 'Tất cả', q: '', sort: 'default' };
    const cats = ['Tất cả', ...Array.from(new Set(deals.map((d) => d.category).filter(Boolean)))];
    buildControls(cats, deals, subId, state);
    renderFiltered(deals, subId, state);
  })();
})();
