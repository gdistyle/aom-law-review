/* 설계 의무 대상 개략 판정 (참고자료).
   계획 조건(05)의 용도·층수와 법정 최대 규모로 대표적인 설계 의무 대상 여부를 판정한다.
   ・ 기준 수치는 각 조문의 대표 기준만 적용(예외·완화·조례 강화 규정 미반영) — 화면·보고서에 빨간 글씨로 안내.
   ・ 규모는 법정 최대(가정)값이므로 실제 설계 규모가 정해지면 결과가 달라질 수 있음. */
import {lawLink} from './legal.js';

const n = v => (v == null || v === '' || !Number.isFinite(Number(v))) ? null : Number(v);
const ref = (name, no, kind = 'law') => ({name, article: no ? `제${no}조` : '', url: lawLink(name, no, kind)});
const MULTI_USE = /문화\s*및\s*집회|종교시설|판매시설|운수시설|의료시설|관광\s*숙박|숙박시설/;

/** 판정용 규모: 지상 연면적 = min(법정 최대 연면적, 최대 건축면적 × 지상 층수), 지하 = 최대 건축면적 × 지하 층수(가정) */
export function planScale(p) {
  const l = p.review?.limits || {};
  const floors = n(p.floors), base = n(p.basement) || 0, foot = n(l.maxFootprint), max = n(l.maxGross);
  const above = max != null && foot != null && floors ? Math.min(max, foot * floors) : max;
  const gross = above != null ? above + (foot != null ? foot * base : 0) : null;
  const height = floors ? 4.3 + (floors - 1) * 3.3 : null;     // 1층 4.3 m, 2층 이상 3.3 m 가정 (06 3D 기본값과 동일)
  return {floors, base, foot, above, gross, height, purpose: p.purpose || ''};
}

/** @returns {{rows: Array<{item, result: 'yes'|'no'|'unknown', basis, scale, ref}>, scale}} */
export function duties(p) {
  const s = planScale(p), rows = [];
  const add = (item, cond, basis, scale, r) => rows.push({item, result: cond == null ? 'unknown' : cond ? 'yes' : 'no', basis, scale, ref: r});
  const F = s.floors, G = s.gross, H = s.height;
  add('건축허가권자 (특별시장·광역시장 허가)', F == null || G == null ? null : F >= 21 || G >= 100000,
    '21층 이상 또는 연면적 10만 ㎡ 이상이면 특별시장·광역시장 허가', `지상 ${F ?? '-'}층 · 연면적 ${fmt(G)} ㎡`, ref('건축법', 11));
  add('승강기 설치', F == null || G == null ? null : F >= 6 && G >= 2000,
    '6층 이상으로서 연면적 2,000 ㎡ 이상 (일부 예외 있음)', `지상 ${F ?? '-'}층 · 연면적 ${fmt(G)} ㎡`, ref('건축법', 64));
  add('비상용 승강기 설치', H == null ? null : H > 31,
    '높이 31 m 초과', `높이 약 ${H == null ? '-' : H.toFixed(1)} m (층고 가정)`, ref('건축법', 64));
  add('구조 안전 확인 (내진 설계)', F == null || G == null ? null : F >= 2 || G >= 200 || (H != null && H >= 13),
    '2층 이상, 연면적 200 ㎡ 이상, 높이 13 m 이상 등 (목구조는 3층·500 ㎡)', `지상 ${F ?? '-'}층 · 연면적 ${fmt(G)} ㎡`, ref('건축법 시행령', 32));
  add('에너지 절약 계획서 제출', G == null ? null : G >= 500,
    '연면적 합계 500 ㎡ 이상 (일부 용도 제외)', `연면적 ${fmt(G)} ㎡`, ref('녹색건축물 조성 지원법 시행령', 10));
  add('다중이용 건축물 (구조기술사 협력·상주 감리 등)', F == null || G == null ? null : F >= 16 || (MULTI_USE.test(s.purpose) && G >= 5000),
    '16층 이상, 또는 문화·집회·판매·의료·숙박 등 해당 용도 바닥면적 합계 5,000 ㎡ 이상', `지상 ${F ?? '-'}층 · 주용도 ${s.purpose || '미선택'}`, ref('건축법 시행령', 2));
  return {rows, scale: s};
}
const fmt = v => v == null ? '-' : Math.round(v).toLocaleString('ko-KR');

export const DUTY_NOTE = '대표 기준만 적용한 개략 판정임. 예외·완화 규정, 지자체 조례, 장애인 편의시설·주차·소방·교통영향평가·건축위원회 심의 등은 별도 검토 대상. 규모는 05 계획 조건의 법정 최대(가정)값과 층고 가정(1층 4.3 m, 2층 이상 3.3 m) 기준.';

export function renderDuties(box, p) {
  if (!box) return;
  if (!p.pnu) { box.innerHTML = ''; return; }
  const {rows} = duties(p), esc = v => String(v ?? '').replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
  const lab = {yes: '해당', no: '해당 없음', unknown: '판정 불가'};
  box.innerHTML = `<h3>설계 의무 대상 (참고자료)</h3><p class="small">05에서 정한 용도·층수와 법정 최대 규모로 판정합니다. 층수를 바꾸면 바로 다시 판정됩니다.</p>
  <div class="tr-scroll"><table class="feas-auto duty-table"><thead><tr><th>항목</th><th>판정</th><th>기준 (대표)</th><th>판정에 쓴 규모</th><th>근거</th></tr></thead><tbody>
  ${rows.map(r => `<tr><th>${esc(r.item)}</th><td class="c duty-${r.result}">${lab[r.result]}</td><td>${esc(r.basis)}</td><td class="uncertain">${esc(r.scale)}</td><td class="c"><a href="${esc(r.ref.url)}" target="_blank" rel="noopener">${esc(r.ref.name)} ${esc(r.ref.article)} ↗</a></td></tr>`).join('')}
  </tbody></table></div><p class="uncertain small">${esc(DUTY_NOTE)}</p>`;
}
