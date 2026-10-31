/* A.O.M 법규검토 — 앱 설치·빠른 재실행용 서비스워커.
   - 화면 파일(HTML·CSS·JS·양식)만 캐시한다.
   - /api/* 기관 조회와 외부 기관(법제처·브이월드·카카오) 요청은 캐시하지 않는다 (항상 현행 자료).
   - HTML은 네트워크 우선: 배포 즉시 새 화면이 반영되고, 오프라인일 때만 저장본을 쓴다. */
const CACHE = 'aom-shell-v2';
const SHELL = ['/', '/index.html', '/assets/site.css', '/assets/logo.png', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;      // 외부 기관 자료: 그대로 통과
  if (url.pathname.startsWith('/api/')) return;           // 기관 조회: 캐시 금지
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then(hit => hit || (req.mode === 'navigate' ? caches.match('/index.html') : Response.error())))
  );
});
