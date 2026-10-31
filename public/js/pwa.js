/* 앱 설치(PWA) · 상담 번호 복사. 법규 계산과 무관한 보조 기능. */
(() => {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); });
  }
  let deferred = null;
  const btn = () => document.getElementById('installApp');
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; const b = btn(); if (b) b.hidden = false; });
  window.addEventListener('appinstalled', () => { deferred = null; const b = btn(); if (b) b.hidden = true; });
  document.addEventListener('click', async e => {
    if (e.target.closest('#installApp') && deferred) { deferred.prompt(); try { await deferred.userChoice; } catch (_) {} deferred = null; btn().hidden = true; }
    const c = e.target.closest('#copyTel');
    if (c) {
      const tel = c.dataset.tel;
      try { await navigator.clipboard.writeText(tel); c.textContent = '복사됨'; }
      catch (_) { const a = document.querySelector('.consult-tel'); const r = document.createRange(); r.selectNodeContents(a); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); c.textContent = '번호 선택됨'; }
      setTimeout(() => { c.textContent = '번호 복사'; }, 1800);
    }
  });
})();
