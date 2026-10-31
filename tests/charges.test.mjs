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
