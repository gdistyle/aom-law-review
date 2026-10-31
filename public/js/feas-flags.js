/* 사업성 결과값 빨간 글씨 판정(화면·워드·엑셀 공통) */
import {FEAS_DEFAULTS} from './feas-ui.js';
const num = v => { if (v === null || v === undefined || v === '') return null; const x = Number(String(v).replaceAll(',', '')); return Number.isFinite(x) ? x : null; };
/** 결과값 빨간 글씨 전파: 기본값·참고값·미입력 입력에서 나온 결과는 빨간 글씨 */
export function redFlags(x) {
  const miss = k => num(x[k]) == null, def = k => FEAS_DEFAULTS[k] != null && num(x[k]) === FEAS_DEFAULTS[k], a = k => miss(k) || def(k);
  const F = {};
  F.gross = num(x._grossRaw) == null;
  F.land = x.landMode === 'buy' && num(x._landRaw) == null;
  F.landTax = x.landMode === 'buy' && (F.land || a('landTaxRate'));
  F.build = F.gross || a('buildUnit');
  F.design = F.build || miss('designRate');
  F.buildTax = F.build || true;                 // 과세표준을 공사비로 가정 (유의사항 참조)
  F.other = !!x._otherAuto || miss('otherCost');
  F.cont = F.build || miss('contRate');
  F.subtotal = F.land || F.landTax || F.build || F.design || F.buildTax || F.other || F.cont;
  F.interest = F.subtotal || miss('loanRatio') || miss('loanRate') || miss('months');
  F.area = F.gross || (x.mode !== 'own' && miss('netRatio'));
  F.revenue = x.mode === 'sale' && (F.area || a('saleUnit') || def('saleRate'));
  F.saleCost = x.mode === 'sale' && (F.revenue || miss('saleCostRate'));
  F.total = F.subtotal || F.interest || F.saleCost;
  F.loan = F.subtotal || miss('loanRatio');
  F.rent = x.mode === 'lease' && (F.area || a('rentUnit') || miss('vacancy'));
  F.opex = F.rent || miss('opexRate');
  F.noi = F.rent || F.opex;
  F.deposit = x.mode === 'lease' && (F.area || miss('depositUnit') || miss('vacancy'));
  F.netInvest = F.total || F.deposit;
  F.value = F.noi || miss('capRate');
  F.profit = F.total || F.revenue;
  F.irr = F.netInvest || F.noi || F.value || def('holdYears');
  F.npv = F.irr || miss('discountRate');
  return F;
}
