import test from 'node:test';
import assert from 'node:assert/strict';
import {feasibility, sensitivity, irr, npv} from '../public/js/feasibility.js';

const base = {landMode: 'buy', gross: 1000, landCost: 1_000_000_000, buildUnit: 3_000_000, designRate: 5, otherCost: 50_000_000,
  contRate: 3, landTaxRate: 4.6, buildTaxRate: 3.16, loanRatio: 50, loanRate: 6, months: 18};

// 손계산 정답 (검산 1)
test('분양: 사업비·이자·이익 손계산 일치', () => {
  const r = feasibility({...base, mode: 'sale', saleUnit: 6_000_000, saleRate: 100, saleCostRate: 3});
  assert.equal(r.landTax, 46_000_000);
  assert.equal(r.design, 150_000_000);
  assert.equal(Math.round(r.buildTax), 94_800_000);
  assert.equal(r.cont, 90_000_000);
  assert.equal(Math.round(r.subtotal), 4_430_800_000);
  assert.equal(Math.round(r.interest), 199_386_000);
  assert.equal(Math.round(r.saleCost), 180_000_000);
  assert.equal(Math.round(r.total), 4_810_186_000);
  assert.equal(Math.round(r.profit), 1_189_814_000);
  assert.ok(Math.abs(r.margin - 1_189_814_000 / 4_810_186_000) < 1e-12);
  assert.equal(r.verdict.label, '검토 필요');
  assert.equal(feasibility({...base, mode: 'sale', saleUnit: 6_000_000, saleRate: 100, saleCostRate: 3, target: 15}).verdict.label, '양호');
  assert.equal(feasibility({...base, mode: 'sale', saleUnit: 4_000_000, saleRate: 100}).verdict.label, '미흡');
});

test('분양: 손익분기 분양가에서 이익 0', () => {
  const x = {...base, mode: 'sale', saleUnit: 6_000_000, saleRate: 90, saleCostRate: 3};
  const be = feasibility(x).breakEvenUnit;
  assert.ok(Math.abs(feasibility({...x, saleUnit: be}).profit) < 1e-3);
});

test('임대: 순영업소득·수익률·판정 손계산 일치', () => {
  const r = feasibility({...base, mode: 'lease', rentUnit: 20_000, depositUnit: 200_000, vacancy: 10, opexRate: 15, capRate: 5, holdYears: 10, discountRate: 6});
  assert.equal(Math.round(r.total), 4_630_186_000);
  assert.equal(Math.round(r.grossRent), 216_000_000);
  assert.equal(Math.round(r.noi), 183_600_000);
  assert.equal(Math.round(r.deposit), 180_000_000);
  assert.equal(Math.round(r.netInvest), 4_450_186_000);
  assert.equal(Math.round(r.value), 3_672_000_000);
  assert.ok(Math.abs(r.yield - 183_600_000 / 4_450_186_000) < 1e-12);
  assert.equal(r.verdict.label, '미흡');
  assert.equal(r.cashflows.length, 11);
  assert.ok(Math.abs(npv(r.irr, r.cashflows)) < 1);
});

test('보유 토지·직접 사용: 토지비 0, ㎡당 사업비', () => {
  const r = feasibility({...base, landMode: 'own', mode: 'own'});
  assert.equal(r.land, 0); assert.equal(r.landTax, 0);
  assert.ok(Math.abs(r.perM2 - r.total / 1000) < 1e-9);
  assert.equal(r.verdict.label, '직접 사용');
});

test('빈 입력은 판정 불가, 오류 없음', () => {
  const r = feasibility({mode: 'sale'});
  assert.equal(r.total, 0); assert.equal(r.verdict.label, '판정 불가');
});

test('IRR: 알려진 값', () => {
  assert.ok(Math.abs(irr([-100, 110]) - 0.1) < 1e-9);
  assert.equal(irr([100, 100]), null);
});

test('민감도 표 3×3, 가운데는 기본값', () => {
  const x = {...base, mode: 'sale', saleUnit: 6_000_000, saleRate: 100};
  const s = sensitivity(x);
  assert.equal(s.length, 3); assert.equal(s[1][1], feasibility(x).metric);
  assert.ok(s[0][2] > s[1][1] && s[2][0] < s[1][1]);
});

test('분양·임대 면적 비율: 수입·보증금·손익분기에 반영 (손계산)', () => {
  const s = feasibility({...base, mode: 'sale', saleUnit: 6_000_000, saleRate: 100, saleCostRate: 3, netRatio: 70});
  assert.equal(s.netArea, 700);
  assert.equal(Math.round(s.revenue), 4_200_000_000);
  assert.equal(Math.round(s.saleCost), 126_000_000);
  assert.equal(Math.round(s.total), 4_430_800_000 + 199_386_000 + 126_000_000);
  assert.ok(Math.abs(feasibility({...base, mode: 'sale', saleRate: 100, saleCostRate: 3, netRatio: 70, saleUnit: s.breakEvenUnit}).profit) < 1e-3);
  const l = feasibility({...base, mode: 'lease', rentUnit: 20_000, depositUnit: 200_000, vacancy: 10, opexRate: 15, netRatio: 80});
  assert.equal(Math.round(l.grossRent), 20_000 * 800 * 12 * 0.9);
  assert.equal(Math.round(l.deposit), 200_000 * 800 * 0.9);
  assert.equal(feasibility({...base, mode: 'sale', saleUnit: 1}).netArea, 1000);
});
