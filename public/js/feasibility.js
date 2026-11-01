/* 개략 사업수지(사업성) 계산 — 규칙 계산만 수행. 확정 사업성이 아님.
   금액 단위: 원. 면적: ㎡. 비율 입력: % (예: 4.6 → 4.6%).
   같은 산식을 엑셀 계산표(수식)와 별도 파이썬 검산기에서 다시 계산해 대조한다. */

export const FEAS_NOTE = '본 사업성 검토는 입력값과 공개 자료 기반 기본값으로 산출한 개략 검토 자료이며, 확정된 사업성이 아님. 실제 사업비·분양가·임대료·금리·세금은 시점·현장·계약 조건에 따라 달라지므로, 사업 결정 전 감정평가·시공사 견적·세무 검토로 재확인할 것.';

const n = v => { if (v === null || v === undefined || v === '') return null; const x = Number(String(v).replaceAll(',', '')); return Number.isFinite(x) ? x : null; };
const z = v => n(v) ?? 0;
const pct = v => z(v) / 100;

/** IRR (연 단위 현금흐름) — 이분법. 해가 없으면 null */
export function irr(cfs) {
  if (!cfs.length || !cfs.some(c => c < 0) || !cfs.some(c => c > 0)) return null;
  const npvAt = r => cfs.reduce((s, c, t) => s + c / Math.pow(1 + r, t), 0);
  let lo = -0.99, hi = 10, flo = npvAt(lo), fhi = npvAt(hi);
  if (flo * fhi > 0) return null;
  for (let i = 0; i < 300; i++) {
    const mid = (lo + hi) / 2, f = npvAt(mid);
    if (f === 0 || hi - lo < 1e-15) return mid;
    if (flo * f < 0) { hi = mid; fhi = f; } else { lo = mid; flo = f; }
  }
  return (lo + hi) / 2;
}
export function npv(rate, cfs) { return cfs.reduce((s, c, t) => s + c / Math.pow(1 + rate, t), 0); }

/**
 * @param {object} x 입력
 *  mode: 'sale' | 'lease' | 'own'
 *  landMode: 'buy' | 'own'
 *  siteArea, gross, netRatio(분양·임대 면적 비율 %), landCost, buildUnit, designRate, otherCost, contRate,
 *  landTaxRate, buildTaxRate, loanRatio, loanRate, months,
 *  saleUnit, saleRate, saleCostRate,
 *  rentUnit, depositUnit, vacancy, opexRate, capRate, holdYears, discountRate,
 *  target (목표 수익률 %)
 */
export function feasibility(x = {}) {
  const gross = z(x.gross);
  const L = x.landMode === 'own' ? 0 : z(x.landCost);
  const landTax = L * pct(x.landTaxRate);
  const C = z(x.buildUnit) * gross;
  const D = C * pct(x.designRate);
  const buildTax = C * pct(x.buildTaxRate);
  const O = z(x.otherCost);
  const cont = C * pct(x.contRate);
  const S = L + landTax + C + D + buildTax + O + cont;               // 이자·분양경비 전 사업비
  const loan = S * pct(x.loanRatio);
  const interest = loan * pct(x.loanRate) * z(x.months) / 12;        // 대출 전액이 기간 내내 사용된다고 가정(보수적)
  const net = (n(x.netRatio) ?? 100) / 100;                          // 분양·임대 가능 면적 비율(연면적 대비), 미입력 시 100%
  const netArea = gross * net;
  const out = {gross, netArea, land: L, landTax, build: C, design: D, buildTax, other: O, cont, subtotal: S, loan, interest};

  if (x.mode === 'sale') {
    const revenue = z(x.saleUnit) * netArea * pct(x.saleRate);
    const saleCost = revenue * pct(x.saleCostRate);
    const total = S + interest + saleCost;
    const profit = revenue - total;
    const equity = total - loan;
    Object.assign(out, {revenue, saleCost, total, equity, profit,
      margin: total > 0 ? profit / total : null,
      roe: equity > 0 ? profit / equity : null,
      breakEvenUnit: netArea > 0 && pct(x.saleRate) > 0 && (1 - pct(x.saleCostRate)) > 0 ? (S + interest) / (netArea * pct(x.saleRate) * (1 - pct(x.saleCostRate))) : null});
    out.metric = out.margin;
  } else if (x.mode === 'lease') {
    const total = S + interest;
    const occ = 1 - pct(x.vacancy);
    const grossRent = z(x.rentUnit) * netArea * 12 * occ;
    const opex = grossRent * pct(x.opexRate);
    const noi = grossRent - opex;
    const deposit = z(x.depositUnit) * netArea * occ;
    const netInvest = total - deposit;
    const value = pct(x.capRate) > 0 ? noi / pct(x.capRate) : null;
    const years = Math.min(30, Math.max(0, Math.round(z(x.holdYears))));  // 엑셀 계산표(현금흐름 30행)와 같게 최대 30년
    const cfs = netInvest > 0 && years > 0 ? [-netInvest, ...Array.from({length: years}, (_, i) => noi + (i === years - 1 && value != null ? value - deposit : 0))] : [];
    Object.assign(out, {total, grossRent, opex, noi, deposit, netInvest, value,
      devProfit: value != null ? value - total : null,
      yield: netInvest > 0 ? noi / netInvest : null,
      payback: noi > 0 && netInvest > 0 ? netInvest / noi : null,
      cashflows: cfs,
      irr: cfs.length ? irr(cfs) : null,
      npv: cfs.length && n(x.discountRate) != null ? npv(pct(x.discountRate), cfs) : null});
    out.metric = out.yield;
  } else {
    const total = S + interest;
    Object.assign(out, {total, perM2: gross > 0 ? total / gross : null});
    out.metric = null;
  }
  out.verdict = verdict(x, out);
  return out;
}

/** 판정: 손실·대출금리 미만 → 미흡 / 목표 미달 → 검토 필요 / 목표 이상 → 양호 */
export function verdict(x, r) {
  if (x.mode === 'own') return {level: 'info', label: '직접 사용', text: '수입이 없는 직접 사용 계획으로, 총사업비와 ㎡당 사업비만 산출함.'};
  const miss = [n(x.buildUnit) == null && '공사비 단가', x.mode === 'sale' && n(x.saleUnit) == null && '분양가 단가', x.mode === 'lease' && n(x.rentUnit) == null && '월 임대료 단가'].filter(Boolean);
  if (miss.length) return {level: 'none', label: '판정 불가', text: `필수 항목(${miss.join(' · ')})을 넣어야 판정함.`};
  const m = r.metric, target = n(x.target), rate = n(x.loanRate);
  if (m == null || !(r.total > 0)) return {level: 'none', label: '판정 불가', text: '공사비 단가와 분양가(또는 임대료)를 입력하면 판정함.'};
  const p = v => (v * 100).toFixed(1) + '%';
  if (x.mode === 'sale') {
    if (r.profit < 0) return {level: 'bad', label: '미흡', text: `예상 손실 발생 (사업비 대비 이익률 ${p(m)}).`};
    if (target == null) return {level: 'mid', label: '검토 필요', text: `이익 발생 (이익률 ${p(m)}). 목표 수익률을 입력하면 양호 여부를 판정함.`};
    return m >= target / 100 ? {level: 'good', label: '양호', text: `이익률 ${p(m)} ≥ 목표 ${target}%.`} : {level: 'mid', label: '검토 필요', text: `이익률 ${p(m)} < 목표 ${target}%.`};
  }
  if (rate != null && m < rate / 100) return {level: 'bad', label: '미흡', text: `임대 수익률 ${p(m)}이 대출금리 ${rate}%보다 낮음.`};
  if (target == null) return {level: 'mid', label: '검토 필요', text: `임대 수익률 ${p(m)}. 목표 수익률을 입력하면 양호 여부를 판정함.`};
  return m >= target / 100 ? {level: 'good', label: '양호', text: `임대 수익률 ${p(m)} ≥ 목표 ${target}%.`} : {level: 'mid', label: '검토 필요', text: `임대 수익률 ${p(m)} < 목표 ${target}%.`};
}

/** 민감도: 공사비 단가 × 수입 단가 ±10% → 지표(분양: 이익률, 임대: 수익률) */
export function sensitivity(x, steps = [-0.1, 0, 0.1]) {
  if (x.mode === 'own') return null;
  const key = x.mode === 'sale' ? 'saleUnit' : 'rentUnit';
  return steps.map(a => steps.map(b => feasibility({...x, buildUnit: z(x.buildUnit) * (1 + a), [key]: z(x[key]) * (1 + b)}).metric));
}
