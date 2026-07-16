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
})();
