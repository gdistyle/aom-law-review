/* A.O.M 건축 사전 검토 — 로그인(선택 사항)
   로그인하면 최근 조회 주소를 회원 기록으로 저장해 다른 기기에서도 이어 본다. */
(function () {
  'use strict';
  var CONF = window.AOM_LOGIN_CONF = {
    api: 'https://gaonlab.gdistyle.workers.dev/api/auth',
    google: '640982456943-vfboefbl245o7dserpbjti7erav1kvqr.apps.googleusercontent.com',
    naver: 'pGKSTRMNZ_oqxQ2OaOPv',
    kakao: '' // 카카오 앱 등록 후 REST API 키
  };
  if (/\/login(\.html)?$/.test(location.pathname)) return; // 로그인 화면에서는 설정만 제공

  var APP = 'aom', MAX = 30, KEY = 'aom_token', UKEY = 'aom_user';
  var user = null, list = [];
  function st(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function day(t) { var d = new Date(t); return d.getFullYear() + '. ' + (d.getMonth() + 1) + '. ' + d.getDate() + '.'; }
  function api(path, opt) {
    opt = opt || {}; opt.headers = opt.headers || {};
    var t = st(KEY); if (t) opt.headers.Authorization = 'Bearer ' + t;
    return fetch(CONF.api + '/' + path, opt).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { if (r.status === 401) signOut(true); if (!r.ok) throw new Error(j.error || '요청 실패'); return j; });
    });
  }
  function signOut(silent) {
    var t = st(KEY); st(KEY, null); st(UKEY, null); user = null; list = [];
    if (t && !silent) fetch(CONF.api + '/logout', { method: 'POST', headers: { Authorization: 'Bearer ' + t } }).catch(function () {});
    paint();
  }

  function paint() {
    var slot = document.getElementById('aomLogin'), box = document.getElementById('myRecent');
    if (slot) {
      if (!user) { slot.innerHTML = '<button type="button" class="al-btn">로그인</button>'; slot.firstChild.onclick = function () { location.href = '/login'; }; }
      else {
        slot.innerHTML = '<div class="al-wrap"><button type="button" class="al-btn al-on">' + esc(user.name) + ' 님</button><div class="al-menu" hidden><button type="button" class="al-out">로그아웃</button></div></div>';
        var b = slot.querySelector('.al-on'), m = slot.querySelector('.al-menu');
        b.onclick = function (e) { e.stopPropagation(); m.hidden = !m.hidden; };
        document.addEventListener('click', function () { m.hidden = true; });
        slot.querySelector('.al-out').onclick = function () { signOut(false); };
      }
    }
    if (box) {
      if (!user || !list.length) { box.hidden = true; box.innerHTML = ''; return; }
      box.hidden = false;
      box.innerHTML = '<div class="mr-head"><b>내 최근 조회</b><small>' + esc(user.name) + ' 님 기록 · 최대 ' + MAX + '건</small></div><ul>' +
        list.slice(0, 8).map(function (r, i) { return '<li><button type="button" data-i="' + i + '"><span>' + esc(r.address) + '</span><small>' + day(r.at) + '</small></button></li>'; }).join('') + '</ul>';
      Array.prototype.forEach.call(box.querySelectorAll('button[data-i]'), function (el) {
        el.onclick = function () { var r = list[+el.getAttribute('data-i')], inp = document.getElementById('address'); if (!inp) return; inp.value = r.address; window.__autoPick = r.address; document.getElementById('searchForm').requestSubmit(); };
      });
    }
  }

  function start() {
    try { user = JSON.parse(st(UKEY) || 'null'); } catch (e) { user = null; }
    paint();
    try {
      var pend = sessionStorage.getItem('aom_pending');
      if (pend && st(KEY)) { sessionStorage.removeItem('aom_pending'); var inp = document.getElementById('address'), f = document.getElementById('searchForm'); if (inp && f) { inp.value = pend; window.__autoPick = pend; setTimeout(function () { f.requestSubmit(); }, 300); } }
    } catch (e) {}
    if (!st(KEY)) return;
    api('me').then(function (j) { user = j.user; st(UKEY, JSON.stringify(user)); return api('data?app=' + APP); })
      .then(function (d) { list = (d && d.data && d.data.recent) || []; paint(); })
      .catch(function () { paint(); });
  }


  // ---- 자료 받기는 로그인 후 ----
  window.AOM_CAN_DOWNLOAD = function () { if (user && st(KEY)) return true; gate(); return false; };
  function gate() {
    var g = document.getElementById('aomGate');
    if (!g) {
      g = document.createElement('div'); g.id = 'aomGate'; g.className = 'al-gate';
      g.innerHTML = '<div class="al-gate-box" role="dialog" aria-modal="true" aria-labelledby="alGateT"><b id="alGateT">자료 받기는 로그인 후 이용할 수 있습니다</b><p>조회·계산은 지금처럼 로그인 없이 이용하십시오.<br>워드·PDF·엑셀·CAD 파일 받기만 간편 로그인이 필요합니다.</p><div class="al-gate-row"><button type="button" class="primary" id="alGateGo">로그인하고 받기</button><button type="button" id="alGateNo">닫기</button></div></div>';
      document.body.appendChild(g);
      g.addEventListener('click', function (e) { if (e.target === g) g.hidden = true; });
      g.querySelector('#alGateNo').onclick = function () { g.hidden = true; };
      g.querySelector('#alGateGo').onclick = function () {
        try { var a = document.getElementById('address'); if (a && a.value) sessionStorage.setItem('aom_pending', a.value); } catch (e) {}
        location.href = '/login';
      };
    }
    g.hidden = false; g.querySelector('#alGateGo').focus();
  }
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest && e.target.closest('[data-download],[data-feasdl],#downloadAll');
    if (!t || (user && st(KEY))) return;
    e.preventDefault(); e.stopImmediatePropagation(); gate();
  }, true);

  window.addEventListener('aom:selected', function (e) {
    if (!user || !e.detail || !e.detail.address) return;
    var it = { address: e.detail.address, pnu: e.detail.pnu || '', at: Date.now() };
    list = [it].concat(list.filter(function (r) { return r.address !== it.address; })).slice(0, MAX);
    paint();
    api('data?app=' + APP, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recent: list }) }).catch(function () {});
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
