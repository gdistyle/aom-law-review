/* 08 사업성 검토 화면 — 처음 쓰는 사람 기준: 3번 선택 → 결과. 세부 값은 접어 두고 기본값 사용. */
import {feasibility, sensitivity, FEAS_NOTE} from './feasibility.js';
import {esc, totalArea} from './core.js';
import {landRefSum} from './multiparcel.js';

/* 기본값: 법령으로 정해진 세율만 채우고, 근거가 확인되지 않은 단가는 비워 둔다(빨간 글씨 안내). */
export const FEAS_DEFAULTS = {
  mode: '', landMode: '', landCost: null, gross: null, netRatio: null,
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
  const multi = (p.extra || []).length > 0;
  return {siteArea, gross: num(l.maxGross), landRef: multi ? landRefSum(p) : price != null && siteArea ? price * siteArea : null, price, multi, purpose: p.purpose || ''};
}

const FIELDS = [
  // [key, 라벨, 단위, 설명, 표시 조건]
  ['landCost', '토지 매입가', '만 원', '실제 살 가격. 비우면 공시지가 × 대지면적을 참고값으로 씀(실거래가와 다름).', f => f.landMode === 'buy'],
  ['gross', '연면적', '㎡', '건물 바닥면적 합계. 비우면 04에서 계산한 법정 최대 연면적을 씀.', () => true],
  ['netRatio', '분양·임대 면적 비율', '% (연면적 대비)', '주차장·계단·복도 등 공용부를 뺀, 실제로 팔거나 세놓을 수 있는 면적의 비율. 비우면 100%로 계산되어 결과가 실제보다 좋게 나옴.', f => f.mode !== 'own'],
  ['buildUnit', '공사비 단가 (필수)', '만 원/평', '연면적 1평을 짓는 데 드는 공사비. 시공사 견적 또는 인근 신축 사례 기준으로 넣을 것.', () => true],
  ['designRate', '설계·감리비', '% (공사비 대비)', '건축사 설계·감리 비용을 공사비의 몇 %로 볼지.', () => true],
  ['otherCost', '기타 비용', '만 원', '학교용지·광역교통시설·하수도 원인자 부담금, 측량·인입·철거 공사 등 따로 드는 돈.', () => true],
  ['contRate', '예비비', '% (공사비 대비)', '예상 못 한 추가 공사비에 대비한 여유분.', () => true],
  ['landTaxRate', '토지 취득세율', '%', FEAS_BASIS.landTaxRate, f => f.landMode === 'buy'],
  ['buildTaxRate', '건물 취득세율', '%', FEAS_BASIS.buildTaxRate, () => true],
  ['loanRatio', '대출 비율', '% (사업비 대비)', '사업비 중 대출로 조달하는 비율. 없으면 0.', () => true],
  ['loanRate', '대출 금리', '% (연)', '연 이자율.', () => true],
  ['months', '공사 기간', '개월', '대출 이자가 붙는 기간(설계·공사 합계).', () => true],
  ['saleUnit', '분양가 단가 (필수)', '만 원/평', '분양 면적 1평당 받을 분양가(부가가치세 제외 금액).', f => f.mode === 'sale'],
  ['saleRate', '분양률', '%', '전체 중 실제로 팔릴 비율. 100이면 전부 분양.', f => f.mode === 'sale'],
  ['saleCostRate', '분양 경비', '% (분양수입 대비)', '분양 대행·광고 등.', f => f.mode === 'sale'],
  ['rentUnit', '월 임대료 단가 (필수)', '만 원/평·월', '임대 면적 1평당 한 달 임대료.', f => f.mode === 'lease'],
  ['depositUnit', '보증금 단가', '만 원/평', '임대 면적 1평당 보증금.', f => f.mode === 'lease'],
  ['vacancy', '공실률', '%', '비어 있을 것으로 보는 비율.', f => f.mode === 'lease'],
  ['opexRate', '운영비', '% (임대수입 대비)', '관리·수선·재산세 등.', f => f.mode === 'lease'],
  ['capRate', '환원율', '%', '건물 가치를 계산하는 기준 수익률(연 순수입 ÷ 환원율 = 건물 가치).', f => f.mode === 'lease'],
  ['holdYears', '보유 기간', '년', '임대 후 팔 때까지의 기간(내부수익률 계산용).', f => f.mode === 'lease'],
  ['discountRate', '할인율', '%', '미래 돈을 현재 가치로 바꿀 때 쓰는 기대 수익률(순현재가치 계산용).', f => f.mode === 'lease'],
  ['target', '목표 수익률', '%', '이 이상이면 "양호"로 판정. 분양은 이익률, 임대는 임대 수익률 기준.', f => f.mode !== 'own']
];
const MONEY = new Set(['landCost', 'otherCost', 'buildUnit', 'saleUnit', 'rentUnit', 'depositUnit']);
/* 입력 단위: 단가 = 만 원/평, 총액 = 만 원. 내부 계산은 원/㎡·원 (1평 = 400/121 ㎡) */
export const PY = 400 / 121;
const PER_PY = new Set(['buildUnit', 'saleUnit', 'rentUnit', 'depositUnit']), TOTAL = new Set(['landCost', 'otherCost']);
export const toUser = (k, v) => v == null ? null : PER_PY.has(k) ? v * PY / 1e4 : TOTAL.has(k) ? v / 1e4 : v;
export const fromUser = (k, v) => v == null ? null : PER_PY.has(k) ? v * 1e4 / PY : TOTAL.has(k) ? v * 1e4 : v;
const nice = v => v == null || !Number.isFinite(v) ? '' : (Math.round(v * 100) / 100).toLocaleString('ko-KR', {maximumFractionDigits: 2});
/* 회색 참고값(공식 근거 확인된 값만): {key: {v: 입력 단위 값, src: '출처·기준 시점'}} */
export const FEAS_REF = {};
const readOut = (k, v) => v == null ? '' : PER_PY.has(k) ? `= ㎡당 ${won(v)}원` : TOTAL.has(k) ? `= ${krw(v)}` : '';

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
  html += step(3, '자동으로 들어온 값', `<table class="feas-auto"><tr><th>대지면적</th><td>${a.siteArea ? won(a.siteArea) + ' ㎡' : '<span class="uncertain">미수집</span>'}</td><th>최대 연면적</th><td>${a.gross != null ? won(a.gross) + ' ㎡' : '<span class="uncertain">04에서 용도 선택 필요</span>'}</td></tr><tr><th>주용도</th><td>${esc(a.purpose) || '<span class="uncertain">미선택 (04에서 선택)</span>'}</td><th>공시지가</th><td>${a.multi ? (a.landRef != null ? `필지별 합계 ${krw(a.landRef)}` : '<span class="uncertain">일부 필지 미수집</span>') : a.price != null ? won(a.price) + ' 원/㎡' : '<span class="uncertain">미수집</span>'}</td></tr></table>`);
  if (ready) {
    const vis = FIELDS.filter(([, , , , show]) => show(f));
    const NEED = ['buildUnit', 'saleUnit', 'rentUnit', 'netRatio'];
    const need = vis.filter(([k]) => NEED.includes(k));
    const rest = vis.filter(([k]) => !NEED.includes(k));
    const field = ([k, label, unit, help]) => { const v = f[k], ref = FEAS_REF[k];
      const placeholder = k === 'landCost' && a.landRef != null ? `비우면 ${nice(a.landRef / 1e4)} (공시지가 기준)` : k === 'gross' && a.gross != null ? `비우면 ${nice(a.gross)}` : ref ? `예: ${nice(ref.v)}` : '숫자만 입력';
      const isDef = FEAS_DEFAULTS[k] != null && num(v) === FEAS_DEFAULTS[k];
      return `<label class="feas-field"><span>${label}</span><div class="feas-in"><input data-fin="${k}" inputmode="decimal" autocomplete="off" value="${v == null ? '' : esc(nice(toUser(k, num(v))))}" placeholder="${esc(placeholder)}"${isDef ? ' class="uncertain"' : ''}><b>${unit}</b></div><em class="feas-read">${readOut(k, num(v))}</em>${ref ? `<small class="feas-ref">회색 예시 출처: ${esc(ref.src)}</small>` : ''}<small class="feas-help">${esc(help)}</small></label>`; };
    html += step(4, '단가를 넣으십시오 <small>(모르면 시공사·중개사무소에 물어볼 값)</small>', `<p class="feas-note">칸 안의 <span class="ph">회색 숫자</span>는 참고용 예시일 뿐 계산에 쓰이지 않습니다. 칸을 눌러 <b>숫자만 직접 입력</b>해야 계산됩니다.</p><div class="feas-grid">${need.map(field).join('')}</div>`);
    html += `<details class="feas-more"${f._open ? ' open' : ''}><summary>세부 값 (모르면 그대로 두십시오)</summary><div class="feas-grid">${rest.map(field).join('')}</div><p class="small"><span class="uncertain">빨간 칸</span> = 기본값(법령 세율 등). 바꾸면 검정으로 바뀝니다. 빈칸은 0으로 계산합니다.</p></details>`;
    html += resultHtml(x);
  }
  box.innerHTML = html;
  box.querySelectorAll('[data-fk]').forEach(b => b.onclick = () => { f[b.dataset.fk] = b.dataset.fv; renderFeas(p, onChange); onChange?.(); });
  box.querySelectorAll('[data-feasdl]').forEach(b => b.onclick = async () => {
    const h = b.innerHTML; b.disabled = true; b.textContent = '만드는 중…';
    try {
      const ex = await import('./exports.js');
      const f = b.dataset.feasdl === 'zip' ? await ex.exportFeasZip(p) : await ex.generateFile({word: 'feasWord', pdf: 'feasPdf', excel: 'feasExcel'}[b.dataset.feasdl], p);
      ex.download(f.blob, f.name);
    } catch (e) { console.error(e); alert('파일을 만들지 못했습니다: ' + (e.message || e)); }
    finally { b.disabled = false; b.innerHTML = h; }
  });
  box.querySelectorAll('[data-fin]').forEach(inp => {
    inp.onchange = () => { const k = inp.dataset.fin, raw = inp.value.trim(); f[k] = raw === '' ? null : fromUser(k, num(raw)); f._open = !!box.querySelector('.feas-more')?.open; renderFeas(p, onChange); onChange?.(); };
    inp.oninput = () => { const k = inp.dataset.fin; if (MONEY.has(k)) { const r = inp.closest('.feas-field').querySelector('.feas-read'); if (r) r.textContent = readOut(k, fromUser(k, num(inp.value))); } };
  });
}

function resultHtml(x) {
  const r = feasibility(x), v = r.verdict;
  const req = [num(x.buildUnit) == null && '공사비 단가', x.mode === 'sale' && num(x.saleUnit) == null && '분양가 단가', x.mode === 'lease' && num(x.rentUnit) == null && '월 임대료 단가'].filter(Boolean);
  if (req.length) return `<div class="feas-result"><p class="feas-warn"><b>필수 항목을 넣어야 계산됩니다</b> : ${req.join(' · ')}</p></div>`;
  const zeroKeys = [...(x.mode !== 'own' ? [['netRatio', '분양·임대 면적 비율(100%로 계산)']] : []), ['designRate', '설계·감리비'], ['contRate', '예비비'], ['otherCost', '기타 비용'], ['loanRatio', '대출 비율'], ['loanRate', '대출 금리'], ['months', '공사 기간'],
    ...(x.mode === 'sale' ? [['saleCostRate', '분양 경비']] : []), ...(x.mode === 'lease' ? [['vacancy', '공실률'], ['opexRate', '운영비'], ['capRate', '환원율']] : [])];
  const zeros = zeroKeys.filter(([k]) => num(x[k]) == null).map(([, l]) => l);
  const zeroWarn = zeros.length ? `<p class="feas-warn"><b>비어 있는 항목 ${zeros.length}개</b> : ${zeros.join(' · ')} — 비워 두면 비용이 빠지거나(0원) 면적이 100%로 잡혀 결과가 실제보다 좋게 나옴. 채울 것.</p>` : '';
  const rows = [['토지비', r.land], ['토지 취득세', r.landTax], ['공사비', r.build], ['설계·감리비', r.design], ['건물 취득세', r.buildTax], ['기타 비용', r.other], ['예비비', r.cont], ['대출 이자', r.interest]];
  if (x.mode === 'sale') rows.push(['분양 경비', r.saleCost]);
  const table = `<table class="feas-table"><thead><tr><th>구분</th><th>금액(원)</th><th>읽기</th></tr></thead><tbody>${rows.map(([k, val]) => `<tr><td>${k}</td><td class="num">${won(val)}</td><td>${krw(val)}</td></tr>`).join('')}<tr class="sum"><td>총사업비</td><td class="num">${won(r.total)}</td><td>${krw(r.total)}</td></tr></tbody></table>`;
  let kpi = [['총사업비', krw(r.total)]];
  if (x.mode === 'sale') kpi.push(['예상 분양수입', krw(r.revenue)], ['예상 이익', krw(r.profit)], ['이익률(사업비 대비)', pctS(r.margin)], ['자기자본 수익률', pctS(r.roe)], ['손익분기 분양가', r.breakEvenUnit != null ? `${nice(toUser('saleUnit', r.breakEvenUnit))} 만 원/평` : '']);
  else if (x.mode === 'lease') kpi.push(['연 순수입(NOI)', krw(r.noi)], ['임대 수익률', pctS(r.yield)], ['보증금 합계', krw(r.deposit)], ['투자금 회수 기간', r.payback != null ? r.payback.toFixed(1) + ' 년' : ''], ['건물 가치(환원율 기준)', krw(r.value)], ['내부수익률(IRR)', pctS(r.irr)]);
  else kpi.push(['㎡당 사업비', r.perM2 != null ? won(r.perM2) + ' 원/㎡' : '']);
  const s = sensitivity(x), lab = x.mode === 'sale' ? '분양가' : '임대료';
  const sens = s ? `<h4>공사비·${lab}가 바뀌면? <small>(${x.mode === 'sale' ? '이익률' : '임대 수익률'})</small></h4><table class="feas-sens"><thead><tr><th>공사비 \\ ${lab}</th><th>−10%</th><th>기본</th><th>+10%</th></tr></thead><tbody>${['−10%', '기본', '+10%'].map((h, i) => `<tr><th>${h}</th>${s[i].map((m, j) => `<td class="${m != null && m < 0 ? 'neg' : ''}${i === 1 && j === 1 ? ' base' : ''}">${pctS(m)}</td>`).join('')}</tr>`).join('')}</tbody></table>` : '';
  return `<div class="feas-result">${zeroWarn}<div class="feas-verdict lv-${v.level}"><b>${v.label}</b><span>${esc(v.text)}</span></div><div class="feas-kpi">${kpi.map(([k, val]) => `<div><span>${k}</span><b>${val || '—'}</b></div>`).join('')}</div>${table}${sens}
  <div class="feas-dl"><button type="button" class="primary" data-feasdl="word">사업성 검토 보고서 <em>WORD</em></button><button type="button" data-feasdl="pdf">보고서 <em>PDF</em></button><button type="button" data-feasdl="excel">사업수지 계산표 <em>EXCEL</em></button><button type="button" data-feasdl="zip">전부 한 번에 (ZIP)</button></div>
  <p class="feas-warn small">판정은 입력값 기준 개략 결과이며 확정이 아님.</p></div>`;
}
