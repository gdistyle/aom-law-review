/* 08 사업성 검토 화면 — 처음 쓰는 사람 기준: 3번 선택 → 결과. 세부 값은 접어 두고 기본값 사용. */
import {feasibility, sensitivity, FEAS_NOTE} from './feasibility.js';
import {esc, totalArea} from './core.js';

/* 기본값: 법령으로 정해진 세율만 채우고, 근거가 확인되지 않은 단가는 비워 둔다(빨간 글씨 안내). */
export const FEAS_DEFAULTS = {
  mode: '', landMode: '', landCost: null, gross: null,
  buildUnit: null, designRate: null, otherCost: null, contRate: null,
  landTaxRate: 4.6, buildTaxRate: 3.16,
  loanRatio: null, loanRate: null, months: null,
  saleUnit: null, saleRate: 100, saleCostRate: null,
  rentUnit: null, depositUnit: null, vacancy: null, opexRate: null, capRate: null, holdYears: 10, discountRate: null,
  target: null
};
export const FEAS_BASIS = {
  landTaxRate: '토지 유상취득: 취득세 4% + 농어촌특별세 0.2% + 지방교육세 0.4% (「지방세법」 제11조 등, 농지 외)',
  buildTaxRate: '건축물 신축(원시취득): 취득세 2.8% + 농어촌특별세 0.2% + 지방교육세 0.16% (과세표준은 공사비로 가정)'
};

const num = v => { if (v === null || v === undefined || v === '') return null; const x = Number(String(v).replaceAll(',', '')); return Number.isFinite(x) ? x : null; };
const won = v => v == null || !Number.isFinite(v) ? '' : Math.round(v).toLocaleString('ko-KR');
const pctS = v => v == null || !Number.isFinite(v) ? '' : (Math.abs(v) < 0.0005 ? 0 : v * 100).toFixed(1) + '%';
/** 1234500000 → "12억 3,450만 원" */
export function krw(v) {
  if (v == null || !Number.isFinite(v)) return '';
  const neg = v < 0, a = Math.round(Math.abs(v)), eok = Math.floor(a / 1e8), man = Math.floor((a % 1e8) / 1e4), rest = a % 1e4;
  const parts = [];
  if (eok) parts.push(eok.toLocaleString('ko-KR') + '억');
  if (man) parts.push(man.toLocaleString('ko-KR') + '만');
  if (!eok && !man) parts.push(rest.toLocaleString('ko-KR'));
  return (neg ? '−' : '') + parts.join(' ') + ' 원';
}

/** 화면 상태 → 계산 입력 */
export function feasInput(p) {
  const f = {...FEAS_DEFAULTS, ...(p.feas || {})};
  const auto = autoValues(p);
  return {...f, _landRaw: f.landCost, _grossRaw: f.gross, siteArea: auto.siteArea, gross: num(f.gross) ?? auto.gross, landCost: f.landMode === 'buy' ? (num(f.landCost) ?? auto.landRef) : 0, _auto: auto};
}
export function autoValues(p) {
  const siteArea = totalArea(p), l = p.review?.limits || {};
  const price = num(p.land?.price?.value);
  return {siteArea, gross: num(l.maxGross), landRef: price != null && siteArea ? price * siteArea : null, price, purpose: p.purpose || ''};
}

const FIELDS = [
  // [key, 라벨, 단위, 설명, 표시 조건]
  ['landCost', '토지 매입가', '원', '실제 살 가격. 비우면 공시지가 × 대지면적을 참고값으로 씀(실거래가와 다름).', f => f.landMode === 'buy'],
  ['gross', '연면적', '㎡', '건물 바닥면적 합계. 비우면 05에서 계산한 법정 최대 연면적을 씀.', () => true],
  ['buildUnit', '공사비 단가', '원/㎡', '연면적 1㎡를 짓는 데 드는 공사비. 시공사 견적이 있으면 그 값.', () => true],
  ['designRate', '설계·감리비', '% (공사비 대비)', '건축사 설계·감리 비용을 공사비의 몇 %로 볼지.', () => true],
  ['otherCost', '기타 비용', '원', '인허가 부담금·측량·인입 공사 등 따로 드는 돈.', () => true],
  ['contRate', '예비비', '% (공사비 대비)', '예상 못 한 추가 공사비에 대비한 여유분.', () => true],
  ['landTaxRate', '토지 취득세율', '%', FEAS_BASIS.landTaxRate, f => f.landMode === 'buy'],
  ['buildTaxRate', '건물 취득세율', '%', FEAS_BASIS.buildTaxRate, () => true],
  ['loanRatio', '대출 비율', '% (사업비 대비)', '사업비 중 대출로 조달하는 비율. 없으면 0.', () => true],
  ['loanRate', '대출 금리', '% (연)', '연 이자율.', () => true],
  ['months', '공사 기간', '개월', '대출 이자가 붙는 기간(설계·공사 합계).', () => true],
  ['saleUnit', '분양가 단가', '원/㎡', '연면적 1㎡당 받을 분양가.', f => f.mode === 'sale'],
  ['saleRate', '분양률', '%', '전체 중 실제로 팔릴 비율. 100이면 전부 분양.', f => f.mode === 'sale'],
  ['saleCostRate', '분양 경비', '% (분양수입 대비)', '분양 대행·광고 등.', f => f.mode === 'sale'],
  ['rentUnit', '월 임대료 단가', '원/㎡·월', '연면적 1㎡당 한 달 임대료.', f => f.mode === 'lease'],
  ['depositUnit', '보증금 단가', '원/㎡', '연면적 1㎡당 보증금.', f => f.mode === 'lease'],
  ['vacancy', '공실률', '%', '비어 있을 것으로 보는 비율.', f => f.mode === 'lease'],
  ['opexRate', '운영비', '% (임대수입 대비)', '관리·수선·재산세 등.', f => f.mode === 'lease'],
  ['capRate', '환원율', '%', '건물 가치를 계산하는 기준 수익률(연 순수입 ÷ 환원율 = 건물 가치).', f => f.mode === 'lease'],
  ['holdYears', '보유 기간', '년', '임대 후 팔 때까지의 기간(내부수익률 계산용).', f => f.mode === 'lease'],
  ['discountRate', '할인율', '%', '미래 돈을 현재 가치로 바꿀 때 쓰는 기대 수익률(순현재가치 계산용).', f => f.mode === 'lease'],
  ['target', '목표 수익률', '%', '이 이상이면 "양호"로 판정. 분양은 이익률, 임대는 임대 수익률 기준.', f => f.mode !== 'own']
];
const MONEY = new Set(['landCost', 'otherCost', 'buildUnit', 'saleUnit', 'rentUnit', 'depositUnit']);

export function renderFeas(p, onChange) {
  const box = document.getElementById('feasBox'); if (!box) return;
  p.feas = {...FEAS_DEFAULTS, ...(p.feas || {})};
  const f = p.feas, x = feasInput(p), a = x._auto;
  const step = (no, title, body) => `<div class="feas-step"><b class="feas-no">${no}</b><div><h3>${title}</h3>${body}</div></div>`;
  const chip = (key, val, label, sub) => `<button type="button" class="feas-chip${f[key] === val ? ' on' : ''}" data-fk="${key}" data-fv="${val}"><b>${label}</b><small>${sub}</small></button>`;
  const ready = !!(p.pnu && f.mode && f.landMode);
  let html = `<p class="feas-warn">${esc(FEAS_NOTE)}</p>
  <div class="feas-guide"><div><b>넣을 것</b> 지번 → 사업 방식 → 땅 → (단가)</div><div><b>나오는 것</b> 총사업비 · 예상 수입 · 이익 · 수익률 · 판정 · 워드 보고서 · 엑셀 계산표</div></div>`;
  if (!p.pnu) return void (box.innerHTML = html + `<p class="feas-empty">먼저 위에서 지번을 조회하십시오. 대지면적·최대 연면적·공시지가가 자동으로 들어옵니다.</p>`);
  html += step(1, '사업 방식을 고르십시오', `<div class="feas-chips">${chip('mode', 'sale', '분양', '지어서 팔기')}${chip('mode', 'lease', '임대', '지어서 세놓기')}${chip('mode', 'own', '직접 사용', '내가 쓰기(사업비만 계산)')}</div>`);
  html += step(2, '땅은 어떤 상황입니까', `<div class="feas-chips">${chip('landMode', 'buy', '새로 매입', '토지비·취득세 포함')}${chip('landMode', 'own', '이미 보유', '토지비 제외')}</div>`);
  html += step(3, '자동으로 들어온 값', `<table class="feas-auto"><tr><th>대지면적</th><td>${a.siteArea ? won(a.siteArea) + ' ㎡' : '<span class="uncertain">미수집</span>'}</td><th>최대 연면적</th><td>${a.gross != null ? won(a.gross) + ' ㎡' : '<span class="uncertain">05에서 용도 선택 필요</span>'}</td></tr><tr><th>주용도</th><td>${esc(a.purpose) || '<span class="uncertain">미선택 (05에서 선택)</span>'}</td><th>공시지가</th><td>${a.price != null ? won(a.price) + ' 원/㎡' : '<span class="uncertain">미수집</span>'}</td></tr></table>`);
  if (ready) {
    const vis = FIELDS.filter(([, , , , show]) => show(f));
    const need = vis.filter(([k]) => ['buildUnit', 'saleUnit', 'rentUnit'].includes(k));
    const rest = vis.filter(([k]) => !['buildUnit', 'saleUnit', 'rentUnit'].includes(k));
    const field = ([k, label, unit, help]) => { const v = f[k], placeholder = k === 'landCost' && a.landRef != null ? `비우면 ${won(a.landRef)} (공시지가 기준)` : k === 'gross' && a.gross != null ? `비우면 ${won(a.gross)}` : '';
      const isDef = FEAS_DEFAULTS[k] != null && num(v) === FEAS_DEFAULTS[k];
      return `<label class="feas-field"><span>${label} <small>${unit}</small></span><input data-fin="${k}" inputmode="decimal" value="${v == null ? '' : esc(MONEY.has(k) ? won(num(v)) : v)}" placeholder="${esc(placeholder)}"${isDef ? ' class="uncertain"' : ''}><em class="feas-read">${MONEY.has(k) && num(v) != null ? krw(num(v)) : ''}</em><small class="feas-help">${esc(help)}</small></label>`; };
    html += step(4, '단가를 넣으십시오 <small>(모르면 시공사·중개사무소에 물어볼 값)</small>', `<div class="feas-grid">${need.map(field).join('')}</div>`);
    html += `<details class="feas-more"${f._open ? ' open' : ''}><summary>세부 값 (모르면 그대로 두십시오)</summary><div class="feas-grid">${rest.map(field).join('')}</div><p class="small"><span class="uncertain">빨간 칸</span> = 기본값(법령 세율 등). 바꾸면 검정으로 바뀝니다. 빈칸은 0으로 계산합니다.</p></details>`;
    html += resultHtml(x);
  }
  box.innerHTML = html;
  box.querySelectorAll('[data-fk]').forEach(b => b.onclick = () => { f[b.dataset.fk] = b.dataset.fv; renderFeas(p, onChange); onChange?.(); });
  box.querySelectorAll('[data-feasdl]').forEach(b => b.onclick = async () => {
    const h = b.innerHTML; b.disabled = true; b.textContent = '만드는 중…';
    try {
      const ex = await import('./exports.js');
      const f = b.dataset.feasdl === 'zip' ? await ex.exportFeasZip(p) : await ex.generateFile(b.dataset.feasdl === 'word' ? 'feasWord' : 'feasExcel', p);
      ex.download(f.blob, f.name);
    } catch (e) { console.error(e); alert('파일을 만들지 못했습니다: ' + (e.message || e)); }
    finally { b.disabled = false; b.innerHTML = h; }
  });
  box.querySelectorAll('[data-fin]').forEach(inp => {
    inp.onchange = () => { const k = inp.dataset.fin, raw = inp.value.trim(); f[k] = raw === '' ? null : num(raw); f._open = !!box.querySelector('.feas-more')?.open; renderFeas(p, onChange); onChange?.(); };
    inp.oninput = () => { if (MONEY.has(inp.dataset.fin)) { const r = inp.parentElement.querySelector('.feas-read'); if (r) r.textContent = krw(num(inp.value)); } };
  });
}

function resultHtml(x) {
  const r = feasibility(x), v = r.verdict;
  const zeroKeys = [['designRate', '설계·감리비'], ['contRate', '예비비'], ['otherCost', '기타 비용'], ['loanRatio', '대출 비율'], ['loanRate', '대출 금리'], ['months', '공사 기간'],
    ...(x.mode === 'sale' ? [['saleCostRate', '분양 경비']] : []), ...(x.mode === 'lease' ? [['vacancy', '공실률'], ['opexRate', '운영비'], ['capRate', '환원율']] : [])];
  const zeros = zeroKeys.filter(([k]) => num(x[k]) == null).map(([, l]) => l);
  const zeroWarn = zeros.length ? `<p class="feas-warn"><b>0으로 계산된 항목 ${zeros.length}개</b> : ${zeros.join(' · ')} — 비워 두면 비용이 빠져 결과가 실제보다 좋게 나옴. 「세부 값」에서 채울 것.</p>` : '';
  const rows = [['토지비', r.land], ['토지 취득세', r.landTax], ['공사비', r.build], ['설계·감리비', r.design], ['건물 취득세', r.buildTax], ['기타 비용', r.other], ['예비비', r.cont], ['대출 이자', r.interest]];
  if (x.mode === 'sale') rows.push(['분양 경비', r.saleCost]);
  const table = `<table class="feas-table"><thead><tr><th>구분</th><th>금액(원)</th><th>읽기</th></tr></thead><tbody>${rows.map(([k, val]) => `<tr><td>${k}</td><td class="num">${won(val)}</td><td>${krw(val)}</td></tr>`).join('')}<tr class="sum"><td>총사업비</td><td class="num">${won(r.total)}</td><td>${krw(r.total)}</td></tr></tbody></table>`;
  let kpi = [['총사업비', krw(r.total)]];
  if (x.mode === 'sale') kpi.push(['예상 분양수입', krw(r.revenue)], ['예상 이익', krw(r.profit)], ['이익률(사업비 대비)', pctS(r.margin)], ['자기자본 수익률', pctS(r.roe)], ['손익분기 분양가', r.breakEvenUnit != null ? won(r.breakEvenUnit) + ' 원/㎡' : '']);
  else if (x.mode === 'lease') kpi.push(['연 순수입(NOI)', krw(r.noi)], ['임대 수익률', pctS(r.yield)], ['보증금 합계', krw(r.deposit)], ['투자금 회수 기간', r.payback != null ? r.payback.toFixed(1) + ' 년' : ''], ['건물 가치(환원율 기준)', krw(r.value)], ['내부수익률(IRR)', pctS(r.irr)]);
  else kpi.push(['㎡당 사업비', r.perM2 != null ? won(r.perM2) + ' 원/㎡' : '']);
  const s = sensitivity(x), lab = x.mode === 'sale' ? '분양가' : '임대료';
  const sens = s ? `<h4>공사비·${lab}가 바뀌면? <small>(${x.mode === 'sale' ? '이익률' : '임대 수익률'})</small></h4><table class="feas-sens"><thead><tr><th>공사비 \\ ${lab}</th><th>−10%</th><th>기본</th><th>+10%</th></tr></thead><tbody>${['−10%', '기본', '+10%'].map((h, i) => `<tr><th>${h}</th>${s[i].map((m, j) => `<td class="${m != null && m < 0 ? 'neg' : ''}${i === 1 && j === 1 ? ' base' : ''}">${pctS(m)}</td>`).join('')}</tr>`).join('')}</tbody></table>` : '';
  return `<div class="feas-result">${zeroWarn}<div class="feas-verdict lv-${v.level}"><b>${v.label}</b><span>${esc(v.text)}</span></div><div class="feas-kpi">${kpi.map(([k, val]) => `<div><span>${k}</span><b>${val || '—'}</b></div>`).join('')}</div>${table}${sens}
  <div class="feas-dl"><button type="button" class="primary" data-feasdl="word">사업성 검토 보고서 <em>WORD</em></button><button type="button" data-feasdl="excel">사업수지 계산표 <em>EXCEL</em></button><button type="button" data-feasdl="zip">두 파일 한 번에 (ZIP)</button></div>
  <p class="feas-warn small">판정은 입력값 기준 개략 결과이며 확정이 아님.</p></div>`;
}
