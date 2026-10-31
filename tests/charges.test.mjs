import test from 'node:test';
import assert from 'node:assert/strict';
import {parseFarmRate, farmlandCharge, forestCharge} from '../public/js/charges.js';
import {blankProject, datum} from '../public/js/core.js';

const decree = text => ({name: '농지법 시행령', kind: 'law', current: true, effectiveDate: '20200101', articles: [{number: '53', branch: '', title: '농지보전부담금의 부과기준', effectiveDate: '20200101', text}]});
function proj(cat, price, area, laws) { const p = blankProject(); p.pnu = '1'; p.address = '가동 1'; p.land.category = datum(cat, '', false); p.land.price = datum(price, '', false); p.land.area = datum(area, '', false); p.laws = laws; return p; }

test('원문에 비율·상한이 모두 있으면 산정 (손계산)', () => {
  const t = '① 농지보전부담금의 제곱미터당 금액은 해당 농지의 개별공시지가의 100분의 30으로 한다. ② 제곱미터당 5만원을 초과하는 경우에는 5만원으로 한다.';
  assert.deepEqual(parseFarmRate(t), {rate: 30, cap: 50000, capByNotice: false});
  const c = farmlandCharge(proj('답', 100000, 1000, [decree(t)]));      // 100,000×30% = 30,000원/㎡ → 3,000만원
  assert.equal(c.ok, true); assert.equal(c.total, 30_000_000);
  const c2 = farmlandCharge(proj('답', 300000, 1000, [decree(t)]));     // 90,000 > 상한 50,000 → 5,000만원
  assert.equal(c2.total, 50_000_000);
});
test('상한이 고시 금액이면 산정하지 않음', () => {
  const t = '개별공시지가의 100분의 30으로 한다. 농림축산식품부장관이 정하여 고시하는 금액을 초과하는 경우에는 그 금액으로 한다.';
  const c = farmlandCharge(proj('전', 100000, 500, [decree(t)]));
  assert.equal(c.ok, false); assert.equal(c.total, null); assert.match(c.note, /고시/);
});
test('원문 없으면 산정하지 않음, 대지는 대상 아님', () => {
  assert.equal(farmlandCharge(proj('답', 100000, 500, [])).ok, false);
  assert.equal(farmlandCharge(proj('대', 100000, 500, [])), null);
  assert.equal(forestCharge(proj('임야', 1, 1, [])).ok, false);
});
test('현행 형식: 시행령 제53조(진흥지역 30%·밖 20%) + 시행규칙 제47조의2 상한 5만원', () => {
  const t = '①법 제38조제7항에 따른 농지보전부담금의 제곱미터당 금액은 법 제38조제7항 각 호의 부과기준일 현재 가장 최근에 공시된 「부동산 가격공시에 관한 법률」에 따른 해당 농지의 개별공시지가에 다음 각 호의 구분에 따른 비율을 곱한 금액으로 한다. 1. 농업진흥지역의 농지: 100분의 30 2. 농업진흥지역 밖의 농지: 100분의 20 ②제1항에 따라 산정한 농지보전부담금의 제곱미터당 금액이 농림축산식품부령으로 정하는 금액을 초과하는 경우에는 농림축산식품부령으로 정하는 금액을 농지보전부담금의 제곱미터당 금액으로 한다.';
  const rule = {name: '농지법 시행규칙', kind: 'law', current: true, effectiveDate: '20200101', articles: [{number: '47', branch: '2', title: '농지보전부담금의 제곱미터당 상한 금액', effectiveDate: '20200101', text: '제47조의2(농지보전부담금의 제곱미터당 상한 금액) 영 제53조제2항에서 "농림축산식품부령으로 정하는 금액"이란 각각 5만원을 말한다.'}]};
  const dec = {...decree(t), articles: [{number: '53', branch: '', title: '농지보전부담금의 제곱미터당 금액', effectiveDate: '20200101', text: t}]};
  const c = farmlandCharge(proj('답', 100000, 1000, [dec, rule]));   // 밖: 100,000×20% = 20,000원/㎡ × 1,000㎡ = 2,000만원
  assert.equal(c.ok, true); assert.equal(c.rate, 20); assert.equal(c.cap, 50000); assert.equal(c.total, 20_000_000);
  const p2 = proj('답', 300000, 1000, [dec, rule]); p2.land.zones = [{name: '농업진흥구역'}];
  const c2 = farmlandCharge(p2);                                     // 진흥: 90,000 → 상한 50,000 × 1,000 = 5,000만원
  assert.equal(c2.rate, 30); assert.equal(c2.total, 50_000_000);
});
