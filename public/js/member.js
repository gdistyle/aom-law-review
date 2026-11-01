/* 가온 통합 로그인 연결 — 로그인한 경우에만 최근 조회 주소를 회원 기록으로 저장 */
(function () {
  'use strict';
  var APP = 'aom', MAX = 30, box = document.getElementById('myRecent');
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function day(t) { var d = new Date(t); return d.getFullYear() + '. ' + (d.getMonth() + 1) + '. ' + d.getDate() + '.'; }
  function start() {
    var GL = window.GaonLogin; if (!GL) return;
    GL.mount(document.getElementById('glSlot'));
    var list = [];
    function draw() {
      if (!box) return;
      if (!GL.user() || !list.length) { box.hidden = true; box.innerHTML = ''; return; }
      box.hidden = false;
      box.innerHTML = '<div class="mr-head"><b>내 최근 조회</b><small>' + esc(GL.user().name) + ' 님 기록 · 최대 ' + MAX + '건</small></div><ul>' +
        list.slice(0, 8).map(function (r, i) { return '<li><button type="button" data-i="' + i + '"><span>' + esc(r.address) + '</span><small>' + day(r.at) + '</small></button></li>'; }).join('') + '</ul>';
      Array.prototype.forEach.call(box.querySelectorAll('button[data-i]'), function (b) {
        b.onclick = function () { var r = list[+b.getAttribute('data-i')]; var inp = document.getElementById('address'); if (!inp) return; inp.value = r.address; window.__autoPick = r.address; document.getElementById('searchForm').requestSubmit(); };
      });
    }
    function refresh() {
      if (!GL.user()) { list = []; draw(); return; }
      GL.load(APP).then(function (d) { list = (d && d.recent) || []; draw(); }).catch(function () { draw(); });
    }
    GL.ready.then(refresh); GL.onChange(refresh);
    window.addEventListener('aom:selected', function (e) {
      if (!GL.user() || !e.detail || !e.detail.address) return;
      var it = { address: e.detail.address, pnu: e.detail.pnu || '', at: Date.now() };
      list = [it].concat(list.filter(function (r) { return r.address !== it.address; })).slice(0, MAX);
      draw();
      GL.save(APP, { recent: list }).catch(function () {});
    });
  }
  if (window.GaonLogin) start(); else window.addEventListener('load', start);
})();
