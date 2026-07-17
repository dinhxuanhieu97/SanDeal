// Săn Deal — xử lý form chuyển link Shopee
(function () {
  const form = document.getElementById('convert-form');
  const input = document.getElementById('shopee-url');
  const btn = document.getElementById('convert-btn');
  const result = document.getElementById('result');
  const resultUrl = document.getElementById('result-url');
  const resultMode = document.getElementById('result-mode');
  const resultNote = document.getElementById('result-note');
  const openBtn = document.getElementById('open-btn');
  const copyBtn = document.getElementById('copy-btn');
  const errorEl = document.getElementById('error');
  const dealNote = document.getElementById('deal-note');
  const variantsEl = document.getElementById('variants');
  const productCard = document.getElementById('product-card');
  const voucherBlock = document.getElementById('voucher-block');
  const voucherList = document.getElementById('voucher-list');
  const voucherActions = document.getElementById('voucher-actions');

  // Nhãn + màu nút nhanh theo kênh
  const CHANNEL_BTN = {
    Facebook: { label: 'Mã FB', cls: 'vbtn-fb' },
    Youtube: { label: 'Mã YTB', cls: 'vbtn-yt' },
    Instagram: { label: 'Mã IG', cls: 'vbtn-ig' },
  };
  let currentUrl = '';

  const MODE_LABEL = {
    official: 'Link chính thức',
    demo: 'Chế độ demo',
    'demo-fallback': 'Demo (API tạm lỗi)',
  };

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.hidden = false;
    result.hidden = true;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.hidden = true;
    result.hidden = true;

    const url = input.value.trim();
    if (!url) return;

    btn.disabled = true;
    btn.textContent = 'Đang săn...';

    try {
      const res = await fetch('/api/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();

      if (!data.ok) {
        showError(data.error || 'Có lỗi xảy ra, vui lòng thử lại.');
        return;
      }

      resultUrl.value = data.convertedUrl;
      openBtn.href = data.convertedUrl;
      resultMode.textContent = MODE_LABEL[data.mode] || data.mode;
      resultNote.textContent = data.note || 'Mở link này để mua hàng và nhận ưu đãi.';
      currentUrl = data.convertedUrl;
      renderVariants();
      result.hidden = false;
      result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      fetchProduct(url);
      renderVouchers();
    } catch (err) {
      showError('Không kết nối được máy chủ. Kiểm tra server đang chạy chưa?');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Săn Deal ngay';
    }
  });

  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(resultUrl.value);
      const old = copyBtn.textContent;
      copyBtn.textContent = 'Đã chép ✓';
      setTimeout(() => (copyBtn.textContent = old), 1500);
    } catch {
      resultUrl.select();
      document.execCommand('copy');
    }
  });

  // ===== Biến thể kết quả để chia sẻ =====
  function buildVariants(url, note) {
    const deal = note && note.trim() ? note.trim() : 'Ưu đãi độc quyền + hoàn tiền';
    return [
      { label: 'Link gọn', text: url },
      { label: 'Link kèm ưu đãi', text: `🔥 ${deal}\n👉 ${url}` },
      { label: 'Caption bán hàng', text: `🛒 Săn ngay kẻo lỡ!\n✅ ${deal}\n🔗 Mua tại: ${url}\n#SanDeal #Shopee #hoantien` },
    ];
  }

  function renderVariants() {
    if (!variantsEl || !currentUrl) return;
    const items = buildVariants(currentUrl, dealNote ? dealNote.value : '');
    variantsEl.innerHTML = items
      .map(
        (v, i) => `
      <div class="variant">
        <div class="variant-head">
          <span class="variant-label">${v.label}</span>
          <button type="button" class="btn btn-copy variant-copy" data-idx="${i}">Sao chép</button>
        </div>
        <pre class="variant-text" id="variant-text-${i}"></pre>
      </div>`
      )
      .join('');
    items.forEach((v, i) => {
      const el = document.getElementById('variant-text-' + i);
      if (el) el.textContent = v.text;
    });
  }

  if (dealNote) dealNote.addEventListener('input', renderVariants);

  if (variantsEl) {
    variantsEl.addEventListener('click', async (e) => {
      const btn = e.target.closest('.variant-copy');
      if (!btn) return;
      const el = document.getElementById('variant-text-' + btn.getAttribute('data-idx'));
      if (!el) return;
      try {
        await navigator.clipboard.writeText(el.textContent);
      } catch {
        const r = document.createRange();
        r.selectNode(el);
        const sel = getSelection();
        sel.removeAllRanges();
        sel.addRange(r);
        document.execCommand('copy');
        sel.removeAllRanges();
      }
      const old = btn.textContent;
      btn.textContent = 'Đã chép ✓';
      setTimeout(() => (btn.textContent = old), 1500);
    });
  }

  // ===== Thẻ sản phẩm (từ Shopee Affiliate API) =====
  function fmtPrice(v) {
    const n = Number(v);
    if (v == null || !isFinite(n) || n <= 0) return '';
    return n.toLocaleString('vi-VN') + 'đ';
  }

  async function fetchProduct(url) {
    if (!productCard) return;
    productCard.hidden = false;
    productCard.textContent = 'Đang lấy thông tin sản phẩm…';
    productCard.className = 'product-card product-loading';
    try {
      const res = await fetch('/api/product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!data.ok || !data.product) {
        productCard.textContent = data.error || 'Chưa lấy được thông tin sản phẩm.';
        return;
      }
      renderProduct(data.product, data.mode);
    } catch {
      productCard.textContent = 'Không lấy được thông tin sản phẩm.';
    }
  }

  function renderProduct(p, mode) {
    productCard.className = 'product-card';
    productCard.textContent = '';

    const wrap = document.createElement('div');
    wrap.className = 'product-inner';

    const imgEl = document.createElement(p.imageUrl ? 'img' : 'div');
    imgEl.className = 'product-img' + (p.imageUrl ? '' : ' product-img--empty');
    if (p.imageUrl) {
      imgEl.src = p.imageUrl;
      imgEl.alt = '';
      imgEl.loading = 'lazy';
    } else {
      imgEl.textContent = 'Ảnh SP';
    }

    const info = document.createElement('div');
    info.className = 'product-info';

    const name = document.createElement('div');
    name.className = 'product-name';
    name.textContent = p.productName || 'Sản phẩm Shopee';

    const price = document.createElement('div');
    price.className = 'product-price';
    price.textContent =
      fmtPrice(p.priceMin) + (p.priceMax && p.priceMax !== p.priceMin ? ' – ' + fmtPrice(p.priceMax) : '');

    const meta = document.createElement('div');
    meta.className = 'product-meta';
    const commission = p.commissionRate != null ? `Hoa hồng ~${Math.round(Number(p.commissionRate) * 100)}%` : '';
    meta.textContent = [p.shopName, commission].filter(Boolean).join(' · ');

    info.append(name, price, meta);
    if (mode === 'demo') {
      const b = document.createElement('span');
      b.className = 'product-badge';
      b.textContent = 'Demo — cần cắm API để lấy dữ liệu thật';
      info.append(b);
    }

    wrap.append(imgEl, info);
    productCard.appendChild(wrap);
  }

  // ===== Danh sách mã voucher (từ /vouchers.json — thay bằng mã của bạn) =====
  let vouchersData = null;
  async function renderVouchers() {
    if (!voucherBlock || !voucherList) return;
    try {
      if (!vouchersData) {
        const res = await fetch('/vouchers.json', { cache: 'no-store' });
        vouchersData = await res.json();
      }
    } catch {
      return;
    }
    const groups = (vouchersData && vouchersData.groups) || [];
    if (!groups.length) return;

    voucherList.textContent = '';
    for (const g of groups) {
      const codes = g.codes || [];
      if (!codes.length) continue;

      const grp = document.createElement('div');
      grp.className = 'voucher-group';
      grp.dataset.channel = g.channel;
      const head = document.createElement('div');
      head.className = 'voucher-group-head';
      head.textContent = `Mã ${g.channel} (${codes.length} mã)`;
      grp.appendChild(head);

      for (const c of codes) {
        const used = c.status === 'used';
        const card = document.createElement('div');
        card.className = 'voucher-item' + (used ? ' voucher-item--used' : '');

        const left = document.createElement('div');
        left.className = 'voucher-left';
        const code = document.createElement('div');
        code.className = 'voucher-code';
        code.textContent = c.code || '';
        const desc = document.createElement('div');
        desc.className = 'voucher-desc';
        desc.textContent = c.desc || '';
        left.append(code, desc);

        const right = document.createElement('div');
        right.className = 'voucher-right';
        const badge = document.createElement('span');
        badge.className = 'voucher-status ' + (used ? 'is-used' : 'is-ok');
        badge.textContent = used ? 'Hết lượt' : 'Áp được';
        right.appendChild(badge);
        if (!used) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'btn btn-copy voucher-copy';
          btn.textContent = 'Copy mã';
          btn.setAttribute('data-code', c.code || '');
          right.appendChild(btn);
        }

        card.append(left, right);
        grp.appendChild(card);
      }
      voucherList.appendChild(grp);
    }

    // Hàng nút nhanh theo kênh (Mã FB / Mã YTB / Mã IG)
    if (voucherActions) {
      voucherActions.textContent = '';
      for (const g of groups) {
        if (!(g.codes && g.codes.length)) continue;
        const conf = CHANNEL_BTN[g.channel] || { label: 'Mã ' + g.channel, cls: '' };
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'vbtn ' + conf.cls;
        btn.setAttribute('data-channel', g.channel);
        const t = document.createElement('span');
        t.textContent = '→ ' + conf.label;
        const ic = document.createElement('span');
        ic.className = 'vbtn-ic';
        ic.textContent = '⧉';
        btn.append(t, ic);
        voucherActions.appendChild(btn);
      }
    }

    voucherBlock.hidden = false;
  }

  // Bấm nút kênh: copy mã còn lượt đầu tiên của kênh + cuộn tới nhóm
  if (voucherActions) {
    voucherActions.addEventListener('click', async (e) => {
      const btn = e.target.closest('.vbtn');
      if (!btn) return;
      const channel = btn.getAttribute('data-channel');
      const group = (vouchersData?.groups || []).find((g) => g.channel === channel);
      const avail = group && (group.codes || []).find((c) => c.status !== 'used');
      const grpEl = voucherList.querySelector(`.voucher-group[data-channel="${CSS.escape(channel)}"]`);
      if (grpEl) grpEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      const label = btn.querySelector('span').textContent;
      if (!avail) {
        btn.querySelector('span').textContent = 'Hết mã';
        setTimeout(() => (btn.querySelector('span').textContent = label), 1500);
        return;
      }
      try {
        await navigator.clipboard.writeText(avail.code);
      } catch {
        const t = document.createElement('textarea');
        t.value = avail.code;
        document.body.appendChild(t);
        t.select();
        document.execCommand('copy');
        document.body.removeChild(t);
      }
      btn.querySelector('span').textContent = 'Đã chép: ' + avail.code;
      setTimeout(() => (btn.querySelector('span').textContent = label), 1600);
    });
  }

  if (voucherList) {
    voucherList.addEventListener('click', async (e) => {
      const btn = e.target.closest('.voucher-copy');
      if (!btn) return;
      const code = btn.getAttribute('data-code') || '';
      try {
        await navigator.clipboard.writeText(code);
      } catch {
        const t = document.createElement('textarea');
        t.value = code;
        document.body.appendChild(t);
        t.select();
        document.execCommand('copy');
        document.body.removeChild(t);
      }
      const old = btn.textContent;
      btn.textContent = 'Đã chép ✓';
      setTimeout(() => (btn.textContent = old), 1500);
    });
  }
})();
