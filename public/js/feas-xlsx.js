/* 사업수지 계산표 (엑셀) — 노란 칸(입력)을 바꾸면 수식으로 다시 계산. A4 세로 1쪽 폭 인쇄.
   수식 칸에는 사이트 계산값을 함께 저장(휴대폰 미리보기에서도 숫자 표시). 산식은 feasibility.js와 동일. */
import {feasibility, sensitivity, FEAS_NOTE} from './feasibility.js';
import {FEAS_DEFAULTS, FEAS_BASIS, toUser} from './feas-ui.js';
import {esc, displayDate} from './core.js';

const num = v => { if (v === null || v === undefined || v === '') return null; const x = Number(String(v).replaceAll(',', '')); return Number.isFinite(x) ? x : null; };
const S = {def: 0, title: 1, head: 2, label: 3, text: 4, inMoney: 5, inMoneyRed: 6, money: 7, pct: 8, total: 9, note: 10, warn: 11, inRate: 12, inRateRed: 13, section: 14, dec: 15, pctB: 16, center: 17, factor: 18, verdict: 19, totalPct: 20, inMan: 21, inManRed: 22, coverKick: 23, coverTitle: 24, coverSub: 25, coverDate: 26, coverOrg: 27};

function stylesXML() {
  const font = (sz, {b = false, color = '222222'} = {}) => `<font>${b ? '<b/>' : ''}<sz val="${sz}"/><color rgb="FF${color}"/><name val="맑은 고딕"/><family val="3"/><charset val="129"/></font>`;
  const fonts = [font(10), font(15, {b: true}), font(10, {b: true, color: 'FFFFFF'}), font(10, {color: 'E00000'}), font(10, {b: true}), font(9, {color: '6B6E73'}), font(10, {b: true, color: 'F37021'}), font(12, {b: true, color: 'F37021'}), font(22, {b: true}), font(14, {color: '6B6E73'})];
  const fill = c => `<fill><patternFill patternType="solid"><fgColor rgb="FF${c}"/><bgColor indexed="64"/></patternFill></fill>`;
  const fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>', fill('3A3B3F'), fill('FFF7CC'), fill('FFF4EC'), fill('F2F2F0')];
  const borders = ['<border><left/><right/><top/><bottom/><diagonal/></border>', '<border><left style="thin"><color rgb="FFD9D9D6"/></left><right style="thin"><color rgb="FFD9D9D6"/></right><top style="thin"><color rgb="FFD9D9D6"/></top><bottom style="thin"><color rgb="FFD9D9D6"/></bottom><diagonal/></border>'];
  const xf = (numFmt, font, fill, border, h, v = 'center', wrap = false) => `<xf numFmtId="${numFmt}" fontId="${font}" fillId="${fill}" borderId="${border}" xfId="0"${numFmt ? ' applyNumberFormat="1"' : ''} applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="${h}" vertical="${v}"${wrap ? ' wrapText="1"' : ''}/></xf>`;
  const xfs = [
    xf(0, 0, 0, 0, 'general'),            // def
    xf(0, 1, 0, 0, 'left'),               // title
    xf(0, 2, 2, 1, 'center'),             // head
    xf(0, 4, 0, 1, 'center', 'center', true), // label
    xf(0, 0, 0, 1, 'left', 'center', true),   // text
    xf(164, 0, 3, 1, 'right'),            // inMoney
    xf(164, 3, 3, 1, 'right'),            // inMoneyRed
    xf(164, 0, 0, 1, 'right'),            // money
    xf(165, 0, 0, 1, 'right'),            // pct
    xf(164, 4, 4, 1, 'right'),            // total
    xf(0, 5, 0, 0, 'left', 'center', true),   // note
    xf(0, 3, 0, 0, 'left', 'center', true),   // warn
    xf(166, 0, 3, 1, 'right'),            // inRate
    xf(166, 3, 3, 1, 'right'),            // inRateRed
    xf(0, 4, 5, 1, 'left'),               // section
    xf(167, 0, 0, 1, 'right'),            // dec
    xf(165, 4, 4, 1, 'right'),            // pctB
    xf(0, 0, 0, 1, 'center'),             // center
    xf(168, 4, 5, 1, 'center'),           // factor
    xf(0, 7, 4, 1, 'center'),             // verdict
    xf(165, 6, 4, 1, 'right'),            // totalPct
    xf(169, 0, 3, 1, 'right'),            // inMan
    xf(169, 3, 3, 1, 'right'),            // inManRed
    xf(0, 6, 0, 0, 'left'),               // coverKick
    xf(0, 8, 0, 0, 'left', 'center', true),   // coverTitle
    xf(0, 9, 0, 0, 'left'),               // coverSub
    xf(0, 4, 0, 0, 'left'),               // coverDate
    xf(0, 4, 0, 0, 'left')                // coverOrg
  ];
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="6"><numFmt numFmtId="164" formatCode="#,##0"/><numFmt numFmtId="165" formatCode="0.0%"/><numFmt numFmtId="166" formatCode="0.0##"/><numFmt numFmtId="167" formatCode="0.0"/><numFmt numFmtId="168" formatCode="+0%;-0%;0%"/><numFmt numFmtId="169" formatCode="#,##0.0#"/></numFmts><fonts count="${fonts.length}">${fonts.join('')}</fonts><fills count="${fills.length}">${fills.join('')}</fills><borders count="${borders.length}">${borders.join('')}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
}

/* 셀 쓰기 */
function cellXML(ref, c) {
  if (c == null) return '';
  const s = c.s ? ` s="${c.s}"` : '';
  if (c.f) {
    const v = c.v;
    if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}"${s}><f>${esc(c.f)}</f><v>${v}</v></c>`;
    if (typeof v === 'string' && v !== '') return `<c r="${ref}"${s} t="str"><f>${esc(c.f)}</f><v>${esc(v)}</v></c>`;
    return `<c r="${ref}"${s} t="str"><f>${esc(c.f)}</f><v></v></c>`;
  }
  if (typeof c.v === 'number' && Number.isFinite(c.v)) return `<c r="${ref}"${s}><v>${c.v}</v></c>`;
  if (c.v == null || c.v === '') return c.s ? `<c r="${ref}"${s}/>` : '';
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(c.v)}</t></is></c>`;
}
function sheetXML(rows, cols, merges, {fit = true, landscape = false, breaks = []} = {}) {
  const data = rows.map((row, i) => { if (!row) return ''; const r = i + 1; const ht = row.ht ? ` ht="${row.ht}" customHeight="1"` : '';
    return `<row r="${r}"${ht}>${Object.entries(row.c || {}).sort(([a], [b]) => a.localeCompare(b)).map(([col, c]) => cellXML(col + r, c)).join('')}</row>`; }).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetPr><pageSetUpPr fitToPage="${fit ? 1 : 0}"/></sheetPr><sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews><sheetFormatPr defaultRowHeight="18"/><cols>${cols.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${data}</sheetData>${merges.length ? `<mergeCells count="${merges.length}">${merges.map(m => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>` : ''}<printOptions horizontalCentered="1"/><pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="${landscape ? 'landscape' : 'portrait'}" fitToWidth="1" fitToHeight="0"/><headerFooter><oddFooter>&amp;L&amp;8A.O.M 종합건축사사무소 · 031-791-2536 · 개략 검토 · 확정 아님&amp;R&amp;8&amp;P / &amp;N</oddFooter></headerFooter>${breaks.length ? `<rowBreaks count="${breaks.length}" manualBreakCount="${breaks.length}">${breaks.map(b => `<brk id="${b}" max="16383" man="1"/>`).join('')}</rowBreaks>` : ''}</worksheet>`;
}

/** 계산표 행 구성 — 시트 행 배열과 키→셀 주소 반환 (검산 테스트에서 재사용) */
export function buildFeasSheet(P, x) {
  const R = feasibility(x), sens = sensitivity(x);
  const rows = [], merges = [], at = {};
  const put = (r, col, c) => { (rows[r - 1] ||= {c: {}}).c[col] = c; };
  let r = 1;
  put(r, 'A', {v: '사업수지 계산표 (개략 · 초안)', s: S.title}); rows[0].ht = 26; merges.push('A1:E1'); r++;
  put(r, 'A', {v: `${P.address || '대지'}   ·   ${displayDate(P.date)}   ·   A.O.M 종합건축사사무소`, s: S.note}); merges.push(`A${r}:E${r}`); r++;
  put(r, 'A', {v: FEAS_NOTE, s: S.warn}); rows[r - 1].ht = 42; merges.push(`A${r}:E${r}`); r++;
  put(r, 'A', {v: '사용법 : 노란 칸만 고치면 아래 결과가 자동으로 다시 계산됨. 빨간 글씨는 기본값·참고값임. 금액은 원, 비율은 % 숫자로 입력 (예: 4.6).', s: S.note}); rows[r - 1].ht = 30; merges.push(`A${r}:E${r}`); r++;
  r++;
  const head = () => { ['구분', '항목', '값', '단위', '설명 · 산식'].forEach((t, i) => put(r, 'ABCDE'[i], {v: t, s: S.head})); r++; };
  const section = t => { put(r, 'A', {v: t, s: S.section}); ['B', 'C', 'D', 'E'].forEach(c => put(r, c, {v: '', s: S.section})); merges.push(`A${r}:E${r}`); r++; };
  const ref = k => at[k];

  /* 1. 입력 */
  section('1. 입력 (노란 칸)'); head();
  const a = x._auto || {};
  const def = k => FEAS_DEFAULTS[k] != null && num(x[k]) === FEAS_DEFAULTS[k];
  const MAN = new Set(['landCost', 'otherCost', 'buildUnit', 'saleUnit', 'rentUnit', 'depositUnit']);
  /* 만 원/평·만 원 입력 칸 → 원/㎡·원 환산 (1평 = 400/121 ㎡) */
  const W_ = k => ['landCost', 'otherCost'].includes(k) ? `(${at[k]}*10000)` : `(${at[k]}*10000*121/400)`;
  const input = (k, label, unit, desc, kind = 'money', value = num(x[k]), red = null) => {
    at[k] = 'C' + r; const isRed = red ?? (value == null || def(k));
    put(r, 'A', {v: '입력', s: S.center}); put(r, 'B', {v: label, s: S.label});
    const man = MAN.has(k), shown = man && value != null ? toUser(k, value) : value;
    put(r, 'C', {v: shown, s: man ? (isRed ? S.inManRed : S.inMan) : kind === 'money' ? (isRed ? S.inMoneyRed : S.inMoney) : (isRed ? S.inRateRed : S.inRate)});
    put(r, 'D', {v: unit, s: S.center}); put(r, 'E', {v: desc, s: S.text}); r++;
  };
  put(r, 'A', {v: '조건', s: S.center}); put(r, 'B', {v: '사업 방식', s: S.label}); put(r, 'C', {v: {sale: '분양', lease: '임대', own: '직접 사용'}[x.mode] || '', s: S.center}); put(r, 'D', {v: '', s: S.center}); put(r, 'E', {v: '방식을 바꾸려면 사이트에서 다시 받기', s: S.text}); r++;
  put(r, 'A', {v: '조건', s: S.center}); put(r, 'B', {v: '토지', s: S.label}); put(r, 'C', {v: x.landMode === 'own' ? '이미 보유' : '새로 매입', s: S.center}); put(r, 'D', {v: '', s: S.center}); put(r, 'E', {v: x.landMode === 'own' ? '토지비 0으로 계산' : '', s: S.text}); r++;
  input('siteArea', '대지면적', '㎡', '토지이용계획 조회값', 'rate', num(a.siteArea), false);
  input('gross', '연면적', '㎡', num(x._grossRaw) != null ? '직접 입력값' : '법정 최대 연면적 — 실제 설계 규모와 다를 수 있음', 'rate', num(x.gross), num(x._grossRaw) == null);
  if (x.mode !== 'own') input('netRatio', '분양·임대 면적 비율', '%', num(x.netRatio) == null ? '비워 두면 100%로 계산 (주차장·공용부 제외 비율 입력)' : '연면적 중 실제 분양·임대 가능 면적', 'rate');
  input('landCost', '토지 매입가', '만 원', x.landMode === 'own' ? '보유 토지 (0)' : num(x._landRaw) == null ? '공시지가 × 대지면적 참고값 — 실거래가와 다름' : '직접 입력값', 'money', x.landMode === 'own' ? 0 : num(x.landCost), x.landMode !== 'own' && num(x._landRaw) == null);
  input('buildUnit', '공사비 단가', '만 원/평', '연면적 1평당 공사비 (계산 시 원/㎡로 환산)');
  input('designRate', '설계·감리비율', '%', '공사비 대비', 'rate');
  input('otherCost', '기타 비용', '만 원', '인허가 부담금·측량·인입 공사 등');
  input('contRate', '예비비율', '%', '공사비 대비', 'rate');
  input('landTaxRate', '토지 취득세율', '%', FEAS_BASIS.landTaxRate, 'rate');
  input('buildTaxRate', '건물 취득세율', '%', FEAS_BASIS.buildTaxRate, 'rate');
  input('loanRatio', '대출 비율', '%', '이자·분양경비 전 사업비 대비', 'rate');
  input('loanRate', '대출 금리', '%', '연 이자율', 'rate');
  input('months', '공사 기간', '개월', '대출 이자 산정 기간', 'rate');
  if (x.mode === 'sale') { input('saleUnit', '분양가 단가', '만 원/평', '분양 면적 1평당 분양가 (부가가치세 제외)'); input('saleRate', '분양률', '%', '전체 중 분양 완료 비율', 'rate'); input('saleCostRate', '분양 경비율', '%', '분양수입 대비', 'rate'); }
  if (x.mode === 'lease') {
    input('rentUnit', '월 임대료 단가', '만 원/평·월', '임대 면적 1평당 월 임대료'); input('depositUnit', '보증금 단가', '만 원/평', '임대 면적 1평당 보증금');
    input('vacancy', '공실률', '%', '임대되지 않는 비율', 'rate'); input('opexRate', '운영비율', '%', '임대수입 대비', 'rate');
    input('capRate', '환원율', '%', '건물 가치 = 연 순수입 ÷ 환원율', 'rate'); input('holdYears', '보유 기간', '년', '1~30년 (내부수익률 산정)', 'rate'); input('discountRate', '할인율', '%', '순현재가치 산정용', 'rate');
  }
  if (x.mode !== 'own') input('target', '목표 수익률', '%', '판정 기준 (분양: 이익률, 임대: 임대 수익률)', 'rate');
  r++;

  /* 2. 총사업비 */
  section('2. 총사업비'); head();
  const calc = (k, label, f, v, desc, s = S.money, unit = '원') => { at[k] = 'C' + r; put(r, 'A', {v: '계산', s: S.center}); put(r, 'B', {v: label, s: S.label}); put(r, 'C', {f, v, s}); put(r, 'D', {v: unit, s: S.center}); put(r, 'E', {v: desc, s: S.text}); r++; };
  const $ = ref;
if (x.mode !== 'own') calc('netArea', x.mode === 'sale' ? '분양 면적' : '임대 면적', `${$('gross')}*IF(ISBLANK(${$('netRatio')}),100,${$('netRatio')})/100`, R.netArea, '연면적 × 분양·임대 면적 비율 (비우면 100%)', S.money, '㎡');
  calc('land', '토지비', `${W_('landCost')}`, R.land, '토지 매입가');
  calc('landTax', '토지 취득세', `${$('land')}*${$('landTaxRate')}/100`, R.landTax, '토지비 × 토지 취득세율');
  calc('build', '공사비', `${W_('buildUnit')}*${$('gross')}`, R.build, '공사비 단가(원/㎡ 환산) × 연면적');
  calc('design', '설계·감리비', `${$('build')}*${$('designRate')}/100`, R.design, '공사비 × 설계·감리비율');
  calc('buildTax', '건물 취득세', `${$('build')}*${$('buildTaxRate')}/100`, R.buildTax, '공사비 × 건물 취득세율');
  calc('other', '기타 비용', `${W_('otherCost')}`, R.other, '직접 입력');
  calc('cont', '예비비', `${$('build')}*${$('contRate')}/100`, R.cont, '공사비 × 예비비율');
  calc('subtotal', '소계', `SUM(${$('land')}:${$('cont')})`, R.subtotal, '이자·분양경비 전 사업비', S.total);
  calc('loan', '대출금', `${$('subtotal')}*${$('loanRatio')}/100`, R.loan, '소계 × 대출 비율');
  calc('interest', '대출 이자', `${$('loan')}*${$('loanRate')}/100*${$('months')}/12`, R.interest, '대출금 × 금리 × 기간/12 (전액 기간 내 사용 가정)');
  if (x.mode === 'sale') {
    calc('revenue', '분양수입', `${W_('saleUnit')}*${$('netArea')}*${$('saleRate')}/100`, R.revenue, '분양가 단가 × 분양 면적 × 분양률');
    calc('saleCost', '분양 경비', `${$('revenue')}*${$('saleCostRate')}/100`, R.saleCost, '분양수입 × 분양 경비율');
    calc('total', '총사업비', `${$('subtotal')}+${$('interest')}+${$('saleCost')}`, R.total, '소계 + 이자 + 분양 경비', S.total);
  } else calc('total', '총사업비', `${$('subtotal')}+${$('interest')}`, R.total, '소계 + 이자', S.total);
  r++;

  /* 3. 수익성 */
  const brk3 = r - 1;
  section(x.mode === 'own' ? '3. 사업비 지표' : '3. 수입 및 수익성'); head();
  const blankIf = v => v == null || !Number.isFinite(v) ? '' : v;
  if (x.mode === 'sale') {
    calc('profit', '예상 이익', `${$('revenue')}-${$('total')}`, R.profit, '분양수입 − 총사업비', S.total);
    calc('margin', '이익률', `IF(${$('total')}>0,${$('profit')}/${$('total')},"")`, blankIf(R.margin), '예상 이익 ÷ 총사업비', S.pctB, '');
    calc('equity', '자기자본', `${$('total')}-${$('loan')}`, R.equity, '총사업비 − 대출금');
    calc('roe', '자기자본 수익률', `IF(${$('equity')}>0,${$('profit')}/${$('equity')},"")`, blankIf(R.roe), '예상 이익 ÷ 자기자본', S.pct, '');
    calc('breakEven', '손익분기 분양가', `IF(AND(${$('netArea')}>0,${$('saleRate')}>0,${$('saleCostRate')}<100),(${$('subtotal')}+${$('interest')})/(${$('netArea')}*${$('saleRate')}/100*(1-${$('saleCostRate')}/100)),"")`, blankIf(R.breakEvenUnit), '이익이 0이 되는 분양 면적 ㎡당 분양가', S.money, '원/㎡');
    calc('breakEvenPy', '손익분기 분양가 (평)', `IF(${$('breakEven')}="","",${$('breakEven')}*400/121/10000)`, R.breakEvenUnit == null ? '' : R.breakEvenUnit * (400 / 121) / 1e4, '위 값을 만 원/평으로 환산', S.dec, '만 원/평');
    calc('verdict', '판정', `IF(OR(ISBLANK(${$('buildUnit')}),ISBLANK(${$('saleUnit')}),${$('total')}<=0,${$('margin')}=""),"판정 불가",IF(${$('profit')}<0,"미흡",IF(ISBLANK(${$('target')}),"검토 필요",IF(${$('margin')}>=${$('target')}/100,"양호","검토 필요"))))`, R.verdict.label, '손실 → 미흡 / 목표 미만 → 검토 필요 / 목표 이상 → 양호', S.verdict, '');
  } else if (x.mode === 'lease') {
    calc('grossRent', '연 임대수입', `${W_('rentUnit')}*${$('netArea')}*12*(1-${$('vacancy')}/100)`, R.grossRent, '월 임대료 단가 × 임대 면적 × 12 × (1 − 공실률)');
    calc('opex', '운영비', `${$('grossRent')}*${$('opexRate')}/100`, R.opex, '연 임대수입 × 운영비율');
    calc('noi', '연 순수입 (NOI)', `${$('grossRent')}-${$('opex')}`, R.noi, '연 임대수입 − 운영비', S.total);
    calc('deposit', '보증금 합계', `${W_('depositUnit')}*${$('netArea')}*(1-${$('vacancy')}/100)`, R.deposit, '보증금 단가 × 임대 면적 × (1 − 공실률)');
    calc('netInvest', '실투자금', `${$('total')}-${$('deposit')}`, R.netInvest, '총사업비 − 보증금 합계');
    calc('yield', '임대 수익률', `IF(${$('netInvest')}>0,${$('noi')}/${$('netInvest')},"")`, blankIf(R.yield), '연 순수입 ÷ 실투자금', S.pctB, '');
    calc('payback', '투자금 회수 기간', `IF(AND(${$('noi')}>0,${$('netInvest')}>0),${$('netInvest')}/${$('noi')},"")`, blankIf(R.payback), '실투자금 ÷ 연 순수입', S.dec, '년');
    calc('value', '건물 가치', `IF(${$('capRate')}>0,${$('noi')}/(${$('capRate')}/100),"")`, blankIf(R.value), '연 순수입 ÷ 환원율');
    calc('devProfit', '개발 이익', `IF(${$('capRate')}>0,${$('value')}-${$('total')},"")`, blankIf(R.devProfit), '건물 가치 − 총사업비');
    const cfStart = r + 4; // 아래 현금흐름 표 위치 계산용(IRR·NPV 행 2개 + 판정 1행 + 빈 행 + 제목)
    const cf0 = `C${cfStart + 2}`, cf1 = `C${cfStart + 3}`, cfN = `C${cfStart + 32}`;
    calc('irr', '내부수익률 (IRR)', `IF(OR(${$('netInvest')}<=0,ROUND(${$('holdYears')},0)<1),"",IFERROR(IRR(${cf0}:${cfN}),IFERROR(IRR(${cf0}:${cfN},-0.1),IFERROR(IRR(${cf0}:${cfN},-0.5),""))))`, blankIf(R.irr), '아래 현금흐름 기준', S.pct, '');
    calc('npv', '순현재가치 (NPV)', `IF(OR(${$('netInvest')}<=0,ROUND(${$('holdYears')},0)<1,ISBLANK(${$('discountRate')})),"",${cf0}+NPV(${$('discountRate')}/100,${cf1}:${cfN}))`, blankIf(R.npv), '현금흐름을 할인율로 현재 가치 환산');
    calc('verdict', '판정', `IF(OR(ISBLANK(${$('buildUnit')}),ISBLANK(${$('rentUnit')}),${$('total')}<=0,${$('yield')}=""),"판정 불가",IF(AND(NOT(ISBLANK(${$('loanRate')})),${$('yield')}<${$('loanRate')}/100),"미흡",IF(ISBLANK(${$('target')}),"검토 필요",IF(${$('yield')}>=${$('target')}/100,"양호","검토 필요"))))`, R.verdict.label, '대출금리 미만 → 미흡 / 목표 미만 → 검토 필요 / 목표 이상 → 양호', S.verdict, '');
    r++;
    /* 현금흐름 (0~30년, 보유 기간 이후는 0) */
    if (r !== cfStart) throw new Error('현금흐름 위치 계산 오류');
    section('현금흐름 (내부수익률·순현재가치 계산용, 보유 기간 이후 0)');
    ['연차', '항목', '현금흐름', '단위', '설명'].forEach((t, i) => put(r, 'ABCDE'[i], {v: t, s: S.head})); r++;
    const N = `ROUND(${$('holdYears')},0)`, cfs = R.cashflows || [];
    put(r, 'A', {v: 0, s: S.center}); put(r, 'B', {v: '투입', s: S.label}); put(r, 'C', {f: `-${$('netInvest')}`, v: -R.netInvest, s: S.money}); put(r, 'D', {v: '원', s: S.center}); put(r, 'E', {v: '실투자금 투입', s: S.text}); r++;
    for (let t = 1; t <= 30; t++) {
      const v = cfs.length ? (cfs[t] ?? 0) : (t <= Math.round(num(x.holdYears) || 0) ? R.noi + (t === Math.round(num(x.holdYears) || 0) && R.value != null ? R.value - R.deposit : 0) : 0);
      put(r, 'A', {v: t, s: S.center}); put(r, 'B', {v: t === 1 ? '운영' : '', s: S.label});
      put(r, 'C', {f: `IF(${t}<=${N},${$('noi')}+IF(AND(${t}=${N},${$('capRate')}>0),${$('value')}-${$('deposit')},0),0)`, v, s: S.money}); put(r, 'D', {v: '원', s: S.center}); put(r, 'E', {v: '', s: S.text}); r++;
    }
  } else {
    calc('perM2', '㎡당 사업비', `IF(${$('gross')}>0,${$('total')}/${$('gross')},"")`, blankIf(R.perM2), '총사업비 ÷ 연면적', S.total, '원/㎡');
  }
  r++;

  /* 4. 민감도 */
  if (sens) {
    const lab = x.mode === 'sale' ? '분양가' : '임대료', metric = x.mode === 'sale' ? '이익률' : '임대 수익률';
    section(`4. 민감도 분석 (공사비 · ${lab} ±10% → ${metric})`);
    put(r, 'A', {v: '', s: S.head}); put(r, 'B', {v: `공사비 \\ ${lab}`, s: S.head});
    const fc = ['C', 'D', 'E'], fr = r; [-0.1, 0, 0.1].forEach((b, j) => put(r, fc[j], {v: b, s: S.factor})); r++;
    const K = `(1+${$('designRate')}/100+${$('buildTaxRate')}/100+${$('contRate')}/100)`;
    [-0.1, 0, 0.1].forEach((aF, i) => {
      put(r, 'A', {v: '', s: S.center}); put(r, 'B', {v: aF, s: S.factor}); const br = 'B' + r;
      fc.forEach((col, j) => {
        const bf = `${col}$${fr}`, Sx = `(${$('subtotal')}+${$('build')}*$${br}*${K})`, Ix = `(${Sx}*${$('loanRatio')}/100*${$('loanRate')}/100*${$('months')}/12)`;
        const f = x.mode === 'sale'
          ? `IFERROR(((${$('revenue')}*(1+${bf}))-(${Sx}+${Ix}+${$('revenue')}*(1+${bf})*${$('saleCostRate')}/100))/(${Sx}+${Ix}+${$('revenue')}*(1+${bf})*${$('saleCostRate')}/100),"")`
          : `IFERROR(IF((${Sx}+${Ix}-${$('deposit')})>0,${$('noi')}*(1+${bf})/(${Sx}+${Ix}-${$('deposit')}),""),"")`;
        const v = sens[i][j];
        put(r, col, {f, v: v == null || !Number.isFinite(v) ? '' : v, s: i === 1 && j === 1 ? S.totalPct : S.pct});
        ((at.sens ||= [])[i] ||= [])[j] = col + r;
      });
      r++;
    });
    put(r, 'A', {v: '가운데 칸이 기본 결과. 공사비·' + lab + '가 각각 10% 오르내릴 때의 ' + metric + '임.', s: S.note}); merges.push(`A${r}:E${r}`); r++;
  }
  return {rows, merges, at, R, breaks: [brk3]};
}

function termsSheet(x) {
  const T = [['총사업비', '땅값·공사비·세금·설계비·이자 등 사업에 드는 돈 전체'], ['소계', '대출 이자와 분양 경비를 빼고 먼저 더한 사업비'], ['이익률', '예상 이익 ÷ 총사업비'], ['자기자본 수익률', '대출을 뺀 내 돈 대비 이익의 비율'], ['손익분기 분양가', '이 값보다 비싸게 팔아야 이익이 남는 연면적 ㎡당 분양가'], ['연 순수입 (NOI)', '1년 임대수입에서 운영비를 뺀 금액'], ['실투자금', '총사업비에서 임차인에게 받은 보증금을 뺀 금액'], ['임대 수익률', '연 순수입 ÷ 실투자금'], ['환원율', '임대 건물 가치를 매길 때 쓰는 기준 수익률 (낮을수록 가치가 높게 계산됨)'], ['내부수익률 (IRR)', '투자 기간 전체를 연평균 수익률 하나로 나타낸 값'], ['순현재가치 (NPV)', '앞으로 들어올 돈을 오늘 가치로 바꿔 합친 값. 0보다 크면 할인율보다 나은 투자'], ['민감도 분석', '공사비·분양가(임대료)가 바뀌면 결과가 얼마나 흔들리는지 보는 표']];
  const rows = [], merges = []; const put = (r, col, c) => { (rows[r - 1] ||= {c: {}}).c[col] = c; };
  put(1, 'A', {v: '용어 풀이', s: S.title}); rows[0].ht = 26;
  put(3, 'A', {v: '용어', s: S.head}); put(3, 'B', {v: '뜻', s: S.head});
  T.forEach(([k, d], i) => { put(4 + i, 'A', {v: k, s: S.label}); put(4 + i, 'B', {v: d, s: S.text}); });
  put(5 + T.length, 'A', {v: FEAS_NOTE, s: S.warn}); rows[4 + T.length].ht = 48; merges.push(`A${5 + T.length}:B${5 + T.length}`);
  return sheetXML(rows, [20, 72], merges);
}

/* 표지 시트 (A4 세로 1쪽) — 핵심 결과는 계산 시트를 참조하는 수식이라 값을 바꾸면 함께 바뀜 */
function coverSheet(P, x, at, R) {
  const rows = [], merges = []; const put = (r, col, c) => { (rows[r - 1] ||= {c: {}}).c[col] = c; };
  const ref = k => `'사업수지'!${at[k]}`;
  const line = (r, t, s, ht) => { put(r, 'A', {v: t, s}); put(r, 'B', {v: '', s}); merges.push(`A${r}:B${r}`); if (ht) rows[r - 1].ht = ht; };
  for (let i = 1; i <= 5; i++) rows[i - 1] = {c: {}, ht: 22};
  line(6, 'BUILDING FEASIBILITY', S.coverKick, 20);
  line(7, P.address || '대지', S.coverTitle, 40);
  line(8, '사업수지 계산표 (개략 · 초안)', S.coverSub, 28);
  line(9, displayDate(P.date), S.coverDate, 24);
  rows[9] = {c: {}, ht: 26};
  put(11, 'A', {v: '구분', s: S.head}); put(11, 'B', {v: '값', s: S.head});
  const kv = (r, k, f, v, s) => { put(r, 'A', {v: k, s: S.label}); put(r, 'B', f ? {f, v, s} : {v, s}); rows[r - 1].ht = 24; };
  let r = 12;
  kv(r++, '사업 방식', null, {sale: '분양', lease: '임대', own: '직접 사용'}[x.mode] || '', S.center);
  kv(r++, '토지', null, x.landMode === 'own' ? '이미 보유' : '새로 매입', S.center);
  kv(r++, '총사업비 (원)', ref('total'), R.total, S.money);
  if (x.mode === 'sale') { kv(r++, '예상 분양수입 (원)', ref('revenue'), R.revenue, S.money); kv(r++, '예상 이익 (원)', ref('profit'), R.profit, S.money); kv(r++, '이익률', ref('margin'), R.margin ?? '', S.pct); }
  if (x.mode === 'lease') { kv(r++, '연 순수입 NOI (원)', ref('noi'), R.noi, S.money); kv(r++, '임대 수익률', ref('yield'), R.yield ?? '', S.pct); kv(r++, '내부수익률 (IRR)', ref('irr'), R.irr ?? '', S.pct); }
  if (x.mode === 'own') kv(r++, '㎡당 사업비 (원/㎡)', ref('perM2'), R.perM2 ?? '', S.money);
  if (at.verdict) kv(r++, '판정', ref('verdict'), R.verdict.label, S.verdict);
  r += 2;
  line(r, '본 계산표는 입력값과 공개 자료 기반 기본값으로 산출한 개략 검토 자료이며, 확정된 사업성이 아님. 「사업수지」 시트의 노란 칸을 바꾸면 이 표지의 결과도 함께 다시 계산됨.', S.warn, 46); r += 2;
  line(r, 'A.O.M 종합건축사사무소', S.coverOrg, 22); r++;
  line(r, '경기도 하남시 대청로22번길 17, 206호 (신장동)  ·  031-791-2536  ·  https://aomand.com', S.note, 18);
  return sheetXML(rows, [30, 46], merges);
}

export async function exportFeasXlsx(P, x) {
  if (typeof JSZip === 'undefined') throw new Error('압축 모듈 미로드');
  const {rows, merges, at, R, breaks} = buildFeasSheet(P, x);
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>');
  zip.file('docProps/core.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>사업수지 계산표 (개략 · 초안)</dc:title><dc:creator>A.O.M 종합건축사사무소</dc:creator></cp:coreProperties>');
  zip.file('xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="표지" sheetId="3" r:id="rId4"/><sheet name="사업수지" sheetId="1" r:id="rId1"/><sheet name="용어 풀이" sheetId="2" r:id="rId2"/></sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>');
  zip.file('xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/></Relationships>');
  zip.file('xl/styles.xml', stylesXML());
  zip.file('xl/worksheets/sheet1.xml', sheetXML(rows, [8, 20, 18, 10, 52], merges, {breaks}));
  zip.file('xl/worksheets/sheet2.xml', termsSheet(x));
  zip.file('xl/worksheets/sheet3.xml', coverSheet(P, x, at, R));
  return zip.generateAsync({type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
