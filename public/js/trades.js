/* 토지 매매 실거래가 참고 — 국토교통부 실거래 신고 자료(최근 12개월, 같은 법정동).
   ・ 해제된 거래·지분 거래는 통계에서 뺌(목록에는 회색 표시).
   ・ 지번은 기관이 일부만 공개(개인정보 보호). 소유자·거래 당사자 정보는 받지도 표시하지도 않음.
   ・ 통계값은 참고용 — 땅마다 도로·모양·경사가 달라 그대로 매입가가 아님(빨간 글씨). */
import {esc} from './core.js';

export const PY = 400 / 121;          // 1평 = 400/121 ㎡ (3.3058 ㎡)

/** 최근 n개월 계약년월 목록 (이번 달 포함, 최신순). today: Date(KST 기준 연·월만 사용) */
export function recentMonths(today, n = 12) {
  const out = []; let y = today.getFullYear(), m = today.getMonth() + 1;
  for (let i = 0; i < n; i++) { out.push(String(y) + String(m).padStart(2, '0')); if (--m === 0) { m = 12; y--; } }
  return out;
}
export function median(a) {
  const s = a.filter(Number.isFinite).sort((x, y) => x - y); if (!s.length) return null;
  const h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
}
const norm = s => String(s || '').replace(/\s+/g, '');
/** 같은 법정동(읍·면 뒤의 리 포함) 판정 */
export const sameDong = (umd, dong) => !!dong && (norm(umd) === norm(dong) || norm(umd).endsWith(norm(dong)));

/** 거래 1건 → ㎡당(원)·평당(만 원). amount: 만 원, area: ㎡ */
export function unitOf(t) {
  if (!(t.amount > 0) || !(t.area > 0)) return {perM2: null, perPy: null};
  return {perM2: t.amount * 10000 / t.area, perPy: t.amount / t.area * PY};
}
export const usable = t => !t.cancel && !/지분/.test(t.share || '') && t.amount > 0 && t.area > 0;

/** 통계: 전체(같은 동) / 같은 지목 / 같은 용도지역 */
export function tradeStats(items, {dong, jimok, zone} = {}) {
  const inDong = items.filter(t => sameDong(t.umd, dong));
  const ok = inDong.filter(usable).map(t => ({...t, ...unitOf(t)}));
  const grp = list => ({n: list.length, perM2: median(list.map(t => t.perM2)), perPy: median(list.map(t => t.perPy)),
    min: list.length ? Math.min(...list.map(t => t.perM2)) : null, max: list.length ? Math.max(...list.map(t => t.perM2)) : null});
  const zn = norm(zone).replace(/지역$/, '');
  return {
    dongCount: inDong.length, excluded: inDong.length - ok.length,
    all: grp(ok),
    jimok: jimok ? grp(ok.filter(t => t.jimok === jimok)) : null,
    zone: zn ? grp(ok.filter(t => { const z = norm(t.zone).replace(/지역$/, ''); return !!z && (z === zn || z.includes(zn) || zn.includes(z)); })) : null,
    list: inDong.map(t => ({...t, ...unitOf(t), ok: usable(t)})).sort((a, b) => (b.y - a.y) || (b.m - a.m) || (b.d - a.d))
  };
}

const n0 = v => v == null || !Number.isFinite(v) ? '' : Math.round(v).toLocaleString('ko-KR');
const n1 = v => v == null || !Number.isFinite(v) ? '' : (Math.round(v * 10) / 10).toLocaleString('ko-KR');

export function renderTrades(box, p, state, onLoad) {
  if (!box) return;
  if (!p.pnu) { box.innerHTML = ''; return; }
  const head = `<h3>토지 실거래가 참고</h3><p class="small tr-sub"><span>국토교통부 실거래 신고</span> · <span>최근 12개월</span> · <span>같은 법정동</span></p>`;
  const dong = p.parcels?.[0]?.dong || '';
  if (!state.data) {
    box.innerHTML = head + `<p class="small">버튼을 누르면 <b>${esc(dong || '같은 동')}</b>에서 최근 12개월 동안 신고된 토지 매매 가격을 불러옵니다. 토지 매입가를 정할 때 참고하십시오.</p>
      <button type="button" class="primary" id="tradeLoad"${state.loading ? ' disabled' : ''}>${state.loading ? '불러오는 중… (' + (state.done || 0) + '/12개월)' : '최근 12개월 실거래가 불러오기'}</button>${state.error ? `<p class="uncertain small">${esc(state.error)}</p>` : ''}`;
    const b = box.querySelector('#tradeLoad'); if (b) b.onclick = onLoad;
    return;
  }
  const S = tradeStats(state.data, {dong, jimok: p.land?.category?.value, zone: p.land?.zone?.value});
  const area = state.siteArea;
  const lab = l => { const m = l.match(/^(.*?) \((.*)\)$/); return m ? `${esc(m[1])}<br><small class="nw">(${esc(m[2])})</small>` : esc(l); };
  const row = (label, g) => g && g.n ? `<tr><th>${lab(label)}</th><td class="c">${g.n}건</td><td class="r"><b>${n1(g.perPy)}</b></td><td class="r">${n0(g.perM2)}</td><td class="r">${n0(g.min)} ~ ${n0(g.max)}</td><td class="r uncertain">${area ? n0(g.perM2 * area / 1e4) : ''}</td></tr>`
    : `<tr><th>${lab(label)}</th><td class="c">0건</td><td colspan="4" class="muted">해당 거래 없음</td></tr>`;
  let html = head;
  if (!S.dongCount) {
    html += `<p class="small">최근 12개월 동안 <b>${esc(dong)}</b>에서 신고된 토지 매매가 없습니다. 이웃 동 시세나 감정평가를 참고하십시오.</p>`;
  } else {
    html += `<div class="tr-scroll"><table class="feas-auto tr-stat"><thead><tr><th>구분</th><th>거래</th><th>평당 중앙값 (만 원)</th><th>㎡당 중앙값 (원)</th><th>㎡당 범위 (원)</th><th>× 대지면적 (만 원)</th></tr></thead><tbody>
      ${row(`같은 동 전체 (${dong})`, S.all)}${S.jimok ? row(`같은 지목 (${p.land.category.value})`, S.jimok) : ''}${S.zone ? row(`같은 용도지역 (${p.land.zone.value})`, S.zone) : ''}</tbody></table></div>
      <p class="uncertain small">중앙값 = 가격을 줄 세웠을 때 가운데 값(극단적인 거래의 영향을 덜 받음). 「× 대지면적」은 중앙값을 ${area ? `이 대지 면적(${n1(area)} ㎡)` : '대지 면적(미수집)'}에 곱한 단순 참고값이며 실제 매입가가 아님 — 땅마다 도로 접함·모양·경사·개발 가능성이 달라 가격 차이가 큼. 해제·지분 거래 ${S.excluded}건은 통계에서 제외.</p>`;
    const L = S.list.slice(0, 40);
    html += `<details${state.open ? ' open' : ''} class="tr-more"><summary>거래 목록 보기 (${S.list.length}건${S.list.length > 40 ? ', 최근 40건 표시' : ''})</summary><div class="tr-scroll"><table class="feas-auto tr-list"><thead><tr><th>계약일</th><th>지번</th><th>지목</th><th>용도지역</th><th>면적 (㎡)</th><th>거래금액 (만 원)</th><th>㎡당 (원)</th><th>평당 (만 원)</th></tr></thead><tbody>
      ${L.map(t => `<tr class="${t.ok ? '' : 'tr-x'}"><td class="c">${t.y}. ${String(t.m).padStart(2, '0')}. ${String(t.d || '').padStart(2, '0')}.</td><td class="c">${esc(t.jibun)}</td><td class="c">${esc(t.jimok)}</td><td>${esc(t.zone)}</td><td class="r">${n1(t.area)}</td><td class="r">${n0(t.amount)}</td><td class="r">${n0(t.perM2)}</td><td class="r">${n1(t.perPy)}</td></tr>`).join('')}
      </tbody></table></div><p class="small">회색 줄 = 해제되었거나 지분 거래라 통계에서 뺀 거래. 지번은 기관이 개인정보 보호를 위해 일부만 공개합니다.</p></details>`;
  }
  html += `<p class="small">출처: <a href="https://www.data.go.kr/data/15126466/openapi.do" target="_blank" rel="noopener">국토교통부 토지 매매 실거래가 자료 (공공데이터포털) ↗</a> · <a href="https://rt.molit.go.kr/" target="_blank" rel="noopener">국토교통부 실거래가 공개시스템 ↗</a>${state.failed ? ` · <span class="uncertain">${state.failed}개월 자료를 받지 못해 빠져 있음</span>` : ''}</p>`;
  box.innerHTML = html;
  const d = box.querySelector('.tr-more'); if (d) d.ontoggle = () => { state.open = d.open; };
}
