// Nút chia sẻ mạng xã hội — tự dựng link theo URL hiện tại
(function () {
  const url = encodeURIComponent(location.origin + '/');
  const text = encodeURIComponent('Săn Deal – dán link Shopee, tự động nhận voucher & hoàn tiền!');

  const links = {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
    x: `https://twitter.com/intent/tweet?url=${url}&text=${text}`,
    zalo: `https://zalo.me/share/link?u=${url}&t=${text}`,
  };

  document.querySelectorAll('[data-share]').forEach((el) => {
    const key = el.getAttribute('data-share');
    if (links[key]) el.setAttribute('href', links[key]);
  });

  const copyBtn = document.querySelector('[data-share="copy"]');
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      const link = location.origin + '/';
      try {
        await navigator.clipboard.writeText(link);
      } catch {
        const t = document.createElement('textarea');
        t.value = link; document.body.appendChild(t); t.select();
        document.execCommand('copy'); document.body.removeChild(t);
      }
      const old = copyBtn.textContent;
      copyBtn.textContent = 'Đã chép ✓';
      setTimeout(() => (copyBtn.textContent = old), 1500);
    });
  }
})();
