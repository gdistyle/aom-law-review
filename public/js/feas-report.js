/* 사업성 검토 자료 (개략 · 초안) — 워드. 건축 사전 검토 자료와 같은 서식(A4 가로)으로 내용만 다르게. */
import {packDocx, W} from './report.js';
import {feasibility, sensitivity, FEAS_NOTE} from './feasibility.js';
import {FEAS_DEFAULTS, FEAS_BASIS, krw, toUser} from './feas-ui.js';
import {displayDate, fmt} from './core.js';
import {redFlags} from './feas-flags.js';
import {analyze, costShares, eok} from './feas-analysis.js';
export {redFlags};

const {r, p, gap, table, h1, h2, note, picture, ORANGE, GRAY, SOFT, BODY_W} = W;
const won = v => v == null || !Number.isFinite(v) ? '' : Math.round(v).toLocaleString('ko-KR');
const pc = v => v == null || !Number.isFinite(v) ? '' : (Math.abs(v) < 0.0005 ? 0 : v * 100).toFixed(1) + '%';
const MODE = {sale: '분양 (지어서 판매)', lease: '임대 (지어서 임대)', own: '직접 사용'};
const LAND = {buy: '새로 매입', own: '이미 보유 (토지비 제외)'};
const num = v => { if (v === null || v === undefined || v === '') return null; const x = Number(String(v).replaceAll(',', '')); return Number.isFinite(x) ? x : null; };

function cover(P, logo) {
  return gap(1400)
    + p(r('BUILDING FEASIBILITY', {sz: 18, b: true, color: ORANGE, sp: 40}), {after: 120})
    + p(r(P.address || '대지', {sz: 44, b: true}), {after: 120})
    + p(r('사업성 검토 자료 (개략 · 초안)', {sz: 30, color: GRAY}), {after: 360, line: ORANGE})
    + p(r(displayDate(P.date), {sz: 22, b: true}), {after: 3300})
    + (logo ? p(picture('rIdLogo', 9001, logo.w, logo.h, 2600), {after: 120}) : p(r('A.O.M', {sz: 48, b: true, color: ORANGE})))
    + p(r('A.O.M 종합건축사사무소', {sz: 20, b: true}) + r('   |   경기도 하남시 대청로22번길 17, 206호 (신장동)   ·   031-791-2536', {sz: 18, color: GRAY}), {after: 60})
    + p(r('본 자료는 입력값과 공개 자료 기반 기본값으로 산출한 개략 검토 자료이며, 확정된 사업성이 아님.', {sz: 16, red: true}), {after: 0});
}

/** 입력값 표의 각 행: [항목, 값, 근거·설명, 빨간 글씨 여부] */
function inputRows(x) {
  const a = x._auto || {}, f = x, rows = [];
  const def = k => FEAS_DEFAULTS[k] != null && num(f[k]) === FEAS_DEFAULTS[k];
  const add = (label, v, desc, red = false) => rows.push([label, v, desc, red]);
  add('사업 방식', MODE[f.mode] || '', '');
  add('토지', LAND[f.landMode] || '', '');
  add('대지면적', a.siteArea ? `${fmt(a.siteArea, 2)} ㎡ (${fmt(a.siteArea * 0.3025, 2)} 평)` : '', '토지이용계획 조회값');
  const grossIn = num(f._grossRaw) != null;
  add('연면적', `${fmt(x.gross, 2)} ㎡ (${fmt(x.gross * 0.3025, 2)} 평)`, grossIn ? '직접 입력값' : '05 계획 조건 기준 연면적(선택 층수 × 최대 건축면적, 법정 최대 이내) 적용 — 실제 설계 규모와 다를 수 있음', !grossIn);
  if (f.landMode === 'buy') {
    const ref = num(f._landRaw) == null;
    add('토지 매입가', `${Math.round(x.landCost).toLocaleString('ko-KR')} 원 (${krw(x.landCost)})`, ref ? (a.multi ? '필지별 공시지가 × 필지별 면적 합계 참고값 — 실거래가·감정가와 다름' : '공시지가 × 대지면적 참고값 — 실거래가·감정가와 다름') : '직접 입력값', ref);
    const T = x._trades;
    if (T && T.n) add('토지 실거래가 참고', `평당 ${Math.round(T.perPy).toLocaleString('ko-KR')} 원 (㎡당 ${won(T.perM2)} 원)`, `${T.dong} 최근 12개월 토지 매매 ${T.n}건 중앙값 (국토교통부 실거래 신고, 해제·지분 거래 제외) · × 대지면적 = ${Math.round(T.perM2 * (a.siteArea || 0)).toLocaleString('ko-KR')} 원 — 참고값`, true);
  }
  const nice = v => (Math.round(v * 100) / 100).toLocaleString('ko-KR', {maximumFractionDigits: 2});
  const unit = (k, label, u, desc) => { const v = num(f[k]); const txt = v == null ? '미입력 (0으로 계산)' : u === '원' ? `${Math.round(toUser(k, v)).toLocaleString('ko-KR')} 원 (${krw(v)})` : `${Math.round(toUser(k, v)).toLocaleString('ko-KR')} 원/평${u.includes('월') ? '·월' : ''} (${won(v)} ${u})`; add(label, txt, desc, v == null || def(k)); };
  const rate = (k, label, desc) => { const v = num(f[k]); add(label, v == null ? '미입력 (0으로 계산)' : `${v} %`, desc, v == null || def(k)); };
  if (f.mode !== 'own') { const v = num(f.netRatio); add('분양·임대 면적 비율', v == null ? '미입력 (100%로 계산)' : `${v} %`, '연면적 중 실제 분양·임대 가능 면적 (주차장·공용부 제외)', v == null); }
  unit('buildUnit', '공사비 단가', '원/㎡', '연면적 1평당 공사비');
  rate('designRate', '설계·감리비', '공사비 대비');
  if (f._otherAuto) add('기타 비용', `${Math.round(f.otherCost).toLocaleString('ko-KR')} 원 (${krw(f.otherCost)})`, '농지보전부담금 자동 산정값(공시지가 기준, 전용 면적 = 대지 전체 가정) — 다른 부담금·비용 미포함', true);
  else unit('otherCost', '기타 비용', '원', '학교용지·광역교통·하수도 원인자 부담금, 측량·인입·철거 공사 등');
  rate('contRate', '예비비', '공사비 대비');
  if (f.landMode === 'buy') rate('landTaxRate', '토지 취득세율', FEAS_BASIS.landTaxRate);
  rate('buildTaxRate', '건물 취득세율', FEAS_BASIS.buildTaxRate);
  rate('loanRatio', '대출 비율', '이자·분양경비 전 사업비 대비');
  rate('loanRate', '대출 금리', '연 이자율');
  { const v = num(f.months); add('공사 기간', v == null ? '미입력 (0으로 계산)' : `${v} 개월`, '대출 이자 산정 기간', v == null); }
  if (f.mode === 'sale') { unit('saleUnit', '분양가 단가', '원/㎡', '분양 면적 1평당 분양가 (부가가치세 제외)'); rate('saleRate', '분양률', '전체 중 분양 완료 비율'); rate('saleCostRate', '분양 경비', '분양수입 대비 (대행·광고 등)'); }
  if (f.mode === 'lease') {
    unit('rentUnit', '월 임대료 단가', '원/㎡·월', '임대 면적 1평당 월 임대료'); unit('depositUnit', '보증금 단가', '원/㎡', '임대 면적 1평당 보증금');
    rate('vacancy', '공실률', '임대되지 않는 비율'); rate('opexRate', '운영비', '임대수입 대비 (관리·수선·재산세 등)');
    rate('capRate', '환원율', '건물 가치 = 연 순수입 ÷ 환원율'); { const v = num(f.holdYears); add('보유 기간', v == null ? '' : `${v} 년`, '내부수익률 산정 기간', def('holdYears')); }
    rate('discountRate', '할인율', '순현재가치 산정용 기대 수익률');
  }
  if (f.mode !== 'own') rate('target', '목표 수익률', '판정 기준 (분양: 이익률, 임대: 임대 수익률)');
  return rows;
}



function summary(x, R) {
  const v = R.verdict, F = redFlags(x);
  const color = {good: '168C46', mid: ORANGE, bad: 'E00000'}[v.level] || GRAY;
  let cells = [['총사업비', krw(R.total), F.total]];
  if (x.mode === 'sale') cells.push(['예상 분양수입', krw(R.revenue), F.revenue], ['예상 이익', krw(R.profit), F.profit], ['이익률 (사업비 대비)', pc(R.margin), F.profit], ['자기자본 수익률', pc(R.roe), F.profit || F.loan], ['손익분기 분양가', R.breakEvenUnit != null ? `${Math.round(toUser('saleUnit', R.breakEvenUnit)).toLocaleString('ko-KR')} 원/평` : '', F.total || F.area]);
  else if (x.mode === 'lease') cells.push(['연 순수입 (NOI)', krw(R.noi), F.noi], ['임대 수익률', pc(R.yield), F.noi || F.netInvest], ['투자금 회수 기간', R.payback != null ? R.payback.toFixed(1) + ' 년' : '', F.noi || F.netInvest], ['건물 가치 (환원율 기준)', krw(R.value), F.value], ['내부수익률 (IRR)', pc(R.irr), F.irr]);
  else cells.push(['연면적', `${fmt(x.gross, 2)} ㎡`, F.gross], ['㎡당 사업비', R.perM2 != null ? won(R.perM2) + ' 원/㎡' : '', F.total]);
  const Wc = Math.floor(BODY_W / 3), rows = [];
  for (let i = 0; i < cells.length; i += 3) {
    const g = cells.slice(i, i + 3); while (g.length < 3) g.push(['', '']);
    rows.push(g.map(([k]) => ({t: k, jc: 'center', color: GRAY, sz: 16, fill: 'F7F7F5'})));
    rows.push(g.map(([, val, red]) => ({t: val || (g.some(c => c[0]) ? '—' : ''), jc: 'center', b: true, sz: 24, red: !!red && !!val})));
  }
  const zk = [...(x.mode !== 'own' ? [['netRatio', '분양·임대 면적 비율(100%로 계산)']] : []), ['designRate', '설계·감리비'], ['contRate', '예비비'], ['otherCost', '기타 비용'], ['loanRatio', '대출 비율'], ['loanRate', '대출 금리'], ['months', '공사 기간'], ...(x.mode === 'sale' ? [['saleCostRate', '분양 경비']] : []), ...(x.mode === 'lease' ? [['vacancy', '공실률'], ['opexRate', '운영비'], ['capRate', '환원율']] : [])];
  const zeros = (x.mode === 'own' ? zk.slice(0, 6) : zk).filter(([k]) => num(x[k]) == null && !(k === 'otherCost' && x._otherAuto)).map(([, l]) => l);
  const zeroLine = zeros.length ? p(r(`※ 비어 있는 항목 ${zeros.length}개 : ${zeros.join(' · ')} — 비용이 0원으로, 면적 비율이 100%로 잡혀 결과가 실제보다 유리하게 산출되었을 수 있음.`, {sz: 17, b: true, red: true}), {after: 100}) : '';
  return h1('', '한눈에 보기', true) + zeroLine
    + p(r('판정  ', {sz: 20, b: true, color: GRAY}) + r(v.label, {sz: 30, b: true, color}) + r('   ' + v.text, {sz: 19}), {shd: SOFT, ind: 200, indR: 200, before: 80, after: 160})
    + table([Wc, Wc, BODY_W - Wc * 2], null, rows, {keep: true, sz: 16, pad: 40})
    + p(r('■ ', {sz: 16, red: true}) + r('빨간 글씨', {sz: 16, b: true, red: true}) + r(' : 기본값·참고값·미입력 항목과 그 값으로 계산된 결과. 실제 견적·시세·대출 조건으로 바꾸어 다시 계산할 사항임.', {sz: 16, color: GRAY}), {before: 120, after: 60})
    + note('※ 판정 기준 — 분양: 손실이면 미흡, 이익률이 목표 미만이면 검토 필요, 목표 이상이면 양호 / 임대: 임대 수익률이 대출금리 미만이면 미흡, 목표 미만이면 검토 필요, 목표 이상이면 양호.');
}


/* 결과 분석 및 결론 — 결론 상자 + 총사업비 구성 막대(편집 가능한 표) + 분석 문장 */
function analysisSection(x) {
  const A = analyze(x); if (!A.points.length) return '';
  const COL = ['F37021', '3A3B3F', '8C8F94', 'C9A27A', 'B9BCC0', 'E2B48F', '5E6166'];
  const sh = costShares(A.R, x.mode);
  let widths = sh.map(s => Math.max(160, Math.round(s.share * BODY_W))); const diff = BODY_W - widths.reduce((a, b) => a + b, 0); widths[widths.indexOf(Math.max(...widths))] += diff;
  const bar = table(widths, null, [sh.map((s, i) => ({t: s.share >= 0.08 ? (Math.round(s.share * 1000) / 10).toFixed(1) + '%' : '', jc: 'center', b: true, sz: 15, color: 'FFFFFF', fill: COL[i % COL.length]}))], {sz: 15, pad: 30});
  const legend = table([3200, 2600, 2600, BODY_W - 8400], ['구 분', '금 액', '구성비', '비 고'], sh.map((s, i) => [{t: '■ ' + s.label, b: true, color: COL[i % COL.length]}, {t: eok(s.value), jc: 'right'}, {t: (Math.round(s.share * 1000) / 10).toFixed(1) + '%', jc: 'center'}, {t: s.note, sz: 15, color: GRAY}]), {sz: 16, pad: 40, keep: true});
  return h1('', '결과 분석 및 결론', true)
    + p(r('결론  ', {b: true, sz: 20, color: ORANGE}) + r(A.conclusion, {sz: 19, b: true, red: A.conclusionRed}), {shd: SOFT, ind: 200, indR: 200, before: 60, after: 160, keep: true})
    + h2(`총사업비 구성 (${eok(A.R.total)})`) + bar + legend
    + h2('분석 내용') + A.points.map(q => p(r('· ' + q.text, {sz: 18, red: q.red}), {after: 50, ind: 200})).join('');
}

function conditions(x) {
  const rows = inputRows(x).map(([k, v, d, red]) => [{t: k, jc: 'center', b: true}, {t: v, jc: 'right', red}, {t: d, red: red && /참고값|최대 연면적/.test(d), color: GRAY, sz: 16}]);
  const c1 = 2600, c2 = 4200;
  return h1('Ⅳ', '검토 조건 (입력값)', true) + table([c1, c2, BODY_W - c1 - c2], ['항목', '적용값', '근거 · 설명'], rows, {zebra: true, sz: 16, pad: 40});
}

function costs(x, R) {
  const share = v => R.total > 0 ? pc(v / R.total) : '', F = redFlags(x);
  const rows = [
    ['토지비', x.landMode === 'own' ? '보유 토지 (제외)' : '토지 매입가', R.land, F.land],
    ['토지 취득세', '토지비 × 토지 취득세율', R.landTax, F.landTax],
    ['공사비', '공사비 단가 × 연면적', R.build, F.build],
    ['설계·감리비', '공사비 × 설계·감리비율', R.design, F.design],
    ['건물 취득세', '공사비 × 건물 취득세율', R.buildTax, F.buildTax],
    ['기타 비용', x._otherAuto ? '농지보전부담금 자동 산정' : '직접 입력', R.other, F.other],
    ['예비비', '공사비 × 예비비율', R.cont, F.cont],
    ['소계', '이자·분양경비 전 사업비', R.subtotal, F.subtotal],
    ['대출 이자', '소계 × 대출비율 × 금리 × 기간/12 (전액 기간 내 사용 가정)', R.interest, F.interest]];
  if (x.mode === 'sale') rows.push(['분양 경비', '분양수입 × 분양경비율', R.saleCost, F.saleCost]);
  const body = rows.map(([k, f, v, red]) => { const sub = k === '소계'; return [{t: k, jc: 'center', b: sub}, {t: f, color: GRAY, sz: 16}, {t: won(v), jc: 'right', b: sub, red}, {t: krw(v), jc: 'right', b: sub, red}, {t: sub ? '' : share(v), jc: 'center'}]; });
  body.push([{t: '총사업비', jc: 'center', b: true, fill: 'FFF4EC'}, {t: '합계', b: true, fill: 'FFF4EC'}, {t: won(R.total), jc: 'right', b: true, fill: 'FFF4EC', red: F.total}, {t: krw(R.total), jc: 'right', b: true, fill: 'FFF4EC', red: F.total}, {t: '100.0%', jc: 'center', b: true, fill: 'FFF4EC'}]);
  const c = [2300, 5600, 2900, 2600]; c.push(BODY_W - c.reduce((s, v) => s + v, 0));
  return h1('Ⅰ', '총사업비') + table(c, ['구분', '산식', '금액 (원)', '읽기', '구성비'], body, {keep: true, sz: 16, pad: 40})
    + note(`※ 자기자본 = 총사업비 − 대출금 (${krw(R.loan)} 대출 가정). 세율은 법정 세율 기준이며, 감면·중과 대상 여부는 세무 검토 사항임.`);
}

function income(x, R) {
  let rows; const F = redFlags(x);
  if (x.mode === 'sale') rows = [
    ['분양수입', '분양가 단가 × 분양 면적(연면적 × 면적 비율) × 분양률', won(R.revenue), krw(R.revenue), F.revenue],
    ['총사업비', 'Ⅰ 합계', won(R.total), krw(R.total), F.total],
    ['예상 이익', '분양수입 − 총사업비', won(R.profit), krw(R.profit), F.profit],
    ['이익률', '예상 이익 ÷ 총사업비', pc(R.margin), '', F.profit],
    ['자기자본 수익률', '예상 이익 ÷ (총사업비 − 대출금)', pc(R.roe), '', F.profit || F.loan],
    ['손익분기 분양가', '이익이 0이 되는 분양 면적 평당 분양가', R.breakEvenUnit != null ? `${Math.round(toUser('saleUnit', R.breakEvenUnit)).toLocaleString('ko-KR')} 원/평` : '', R.breakEvenUnit != null ? `${won(R.breakEvenUnit)} 원/㎡` : '', F.total || F.area]];
  else if (x.mode === 'lease') rows = [
    ['연 임대수입', '월 임대료 단가 × 임대 면적 × 12 × (1 − 공실률)', won(R.grossRent), krw(R.grossRent), F.rent],
    ['운영비', '연 임대수입 × 운영비율', won(R.opex), krw(R.opex), F.opex],
    ['연 순수입 (NOI)', '연 임대수입 − 운영비', won(R.noi), krw(R.noi), F.noi],
    ['보증금 합계', '보증금 단가 × 임대 면적 × (1 − 공실률)', won(R.deposit), krw(R.deposit), F.deposit],
    ['실투자금', '총사업비 − 보증금 합계', won(R.netInvest), krw(R.netInvest), F.netInvest],
    ['임대 수익률', '연 순수입 ÷ 실투자금', pc(R.yield), '', F.noi || F.netInvest],
    ['투자금 회수 기간', '실투자금 ÷ 연 순수입', R.payback != null ? R.payback.toFixed(1) + ' 년' : '', '', F.noi || F.netInvest],
    ['건물 가치', '연 순수입 ÷ 환원율', won(R.value), krw(R.value), F.value],
    ['개발 이익', '건물 가치 − 총사업비', won(R.devProfit), krw(R.devProfit), F.value || F.total],
    ['내부수익률 (IRR)', `실투자금 투입 → ${x.holdYears}년간 순수입 → 마지막 해 건물 가치 − 보증금 회수`, pc(R.irr), '', F.irr],
    ['순현재가치 (NPV)', '위 현금흐름을 할인율로 현재 가치 환산', won(R.npv), krw(R.npv), F.npv]];
  else rows = [['총사업비', 'Ⅰ 합계', won(R.total), krw(R.total), F.total], ['㎡당 사업비', '총사업비 ÷ 연면적', R.perM2 != null ? won(R.perM2) + ' 원/㎡' : '', '', F.total]];
  const body = rows.map(([k, f, v, rd, red]) => [{t: k, jc: 'center', b: true}, {t: f, color: GRAY, sz: 16}, {t: v, jc: 'right', b: true, red: !!red || /^−|^-/.test(v)}, {t: rd, jc: 'right', red: !!red}]);
  const c = [2700, 6400, 2900]; c.push(BODY_W - c.reduce((s, v) => s + v, 0));
  return h1('Ⅱ', x.mode === 'own' ? '사업비 지표' : '수입 및 수익성', true) + table(c, ['구분', '산식', '값', '읽기'], body, {keep: true, sz: 16, pad: 40});
}

function sens(x) {
  const s = sensitivity(x); if (!s) return ''; const F = redFlags(x), rr = x.mode === 'sale' ? F.profit : (F.noi || F.netInvest);
  const lab = x.mode === 'sale' ? '분양가' : '임대료', H = ['−10%', '기본', '+10%'];
  const rows = H.map((h, i) => [{t: '공사비 ' + h, jc: 'center', b: true, fill: 'F7F7F5'}, ...s[i].map((m, j) => ({t: pc(m), jc: 'center', b: i === 1 && j === 1, red: m != null && (m < 0 || rr), fill: i === 1 && j === 1 ? 'FFF4EC' : ''}))]);
  const c0 = 3400, cw = Math.floor((BODY_W - c0) / 3);
  return h1('Ⅲ', '민감도 분석') + p(`공사비와 ${lab}가 각각 10% 오르내릴 때 ${x.mode === 'sale' ? '이익률' : '임대 수익률'}의 변화. 가운데 칸이 기본 결과임.`, {after: 100, keep: true})
    + table([c0, cw, cw, BODY_W - c0 - cw * 2], [`공사비 \\ ${lab}`, `${lab} −10%`, `${lab} 기본`, `${lab} +10%`], rows, {keep: true, sz: 16, pad: 40});
}

function verdictAndNotes(x, R) {
  const terms = [['총사업비', '땅값·공사비·세금·설계비·이자 등 사업에 드는 돈 전체'], ['이익률', '번 돈(이익)이 들어간 돈(총사업비)의 몇 %인지'], ['자기자본 수익률', '대출을 뺀 내 돈 대비 이익의 비율'], ['손익분기 분양가', '이 값보다 비싸게 팔아야 이익이 남는 ㎡당 분양가'], ['연 순수입 (NOI)', '1년 임대수입에서 관리비·세금 등 운영비를 뺀 금액'], ['임대 수익률', '1년 순수입이 실제로 들어간 돈의 몇 %인지'], ['환원율', '임대 건물 가치를 매길 때 쓰는 기준 수익률 (낮을수록 건물 가치가 높게 계산됨)'], ['내부수익률 (IRR)', '투자 기간 전체를 연평균 수익률 하나로 나타낸 값'], ['순현재가치 (NPV)', '앞으로 들어올 돈을 오늘 가치로 바꿔 합친 값. 0보다 크면 할인율보다 나은 투자']]
    .filter(([k]) => x.mode === 'lease' ? !/이익률|자기자본|손익분기/.test(k) : x.mode === 'sale' ? !/NOI|임대|환원|IRR|NPV/.test(k) : k === '총사업비');
  const c1 = 3400;
  return h1('Ⅴ', '판정 및 유의사항', true)
    + p(r('판정 : ', {b: true}) + r(R.verdict.label, {b: true, color: {good: '168C46', mid: ORANGE, bad: 'E00000'}[R.verdict.level] || GRAY}) + r('  —  ' + R.verdict.text), {after: 100, keep: true})
    + h2('유의사항')
    + p(FEAS_NOTE, {red: true, sz: 18, after: 60, keep: true})
    + p('· 토지비는 감정평가 또는 실거래가, 공사비는 시공사 견적, 분양가·임대료는 인근 시세 조사로 재확인할 것.', {sz: 18, after: 40})
    + p('· 연면적은 법정 상한으로, 건축선·일조·주차·지구단위계획 등에 따라 실제 설계 면적은 줄어들 수 있음.', {sz: 18, after: 40})
    + p('· 분양가·임대료는 부가가치세 제외 금액 기준이며, 부가가치세·양도소득세·법인세·재산세 등 보유·처분 단계 세금과 금융 수수료는 반영하지 않음.', {sz: 18, after: 40})
    + p('· 건물 취득세는 공사비를 과세표준으로 가정함. 실제 과세표준에는 설계비 등 간접비가 포함될 수 있음(「지방세법」 시행령 취득가격 규정과 미대조).', {sz: 18, after: 40, red: true})
    + p('· 숫자를 바꾸어 다시 계산하려면 함께 제공하는 「사업수지 계산표(엑셀)」의 노란 칸을 수정할 것.', {sz: 18, after: 100});
}

function closing() {
  const box = (t, o = {}) => p(t, {shd: SOFT, ind: 200, indR: 200, keep: true, ...o});
  return box(r('사업성 상담   ', {sz: 18, b: true, color: ORANGE}) + r('A.O.M 종합건축사사무소', {sz: 22, b: true}) + r('   신축 · 증축 · 용도변경 · 대수선 · 리모델링 · 인허가', {sz: 18, b: true}), {before: 240, after: 30})
    + box(r('실제 설계 가능 면적과 인허가 조건을 반영한 사업성 검토는 건축사가 직접 수행함.', {sz: 18}), {after: 30})
    + box(r('전화 031-791-2536   ·   https://aomand.com   ·   경기도 하남시 대청로22번길 17, 206호 (신장동)', {sz: 18, color: GRAY}), {after: 0});
}

export async function exportFeasReport(P, x, logo = null) {
  const R = feasibility(x);
  const body = cover(P, logo) + summary(x, R) + analysisSection(x) + costs(x, R) + income(x, R) + sens(x) + conditions(x) + verdictAndNotes(x, R) + closing();
  return packDocx(body, {title: '사업성 검토 자료 (개략 · 초안)', author: P.author, logo, tag: '개략 검토 · 확정 아님'});
}
