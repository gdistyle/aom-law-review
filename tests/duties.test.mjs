import test from 'node:test';
import assert from 'node:assert/strict';
import {duties, planScale} from '../public/js/duties.js';
const P = (floors, base, foot, max, purpose = '') => ({pnu: '1', floors, basement: base, purpose, review: {limits: {maxFootprint: foot, maxGross: max}}});
const get = (r, k) => r.rows.find(x => x.item.startsWith(k)).result;
test('규모: 지상 = min(최대연면적, 건축면적×층수) + 지하', () => {
  const s = planScale(P(5, 1, 200, 800)); assert.equal(s.above, 800); assert.equal(s.gross, 1000);
  assert.equal(planScale(P(3, 0, 200, 800)).above, 600);
  assert.ok(Math.abs(planScale(P(10, 0, 1, 1)).height - (4.3 + 9 * 3.3)) < 1e-9);
});
test('승강기: 6층 & 2,000㎡ 경계', () => {
  assert.equal(get(duties(P(6, 0, 400, 2400)), '승강기'), 'yes');
  assert.equal(get(duties(P(5, 0, 400, 2400)), '승강기'), 'no');
  assert.equal(get(duties(P(6, 0, 300, 1999)), '승강기'), 'no');
});
test('비상용 승강기: 높이 31 m 초과 (9층 = 30.7 m, 10층 = 34.0 m)', () => {
  assert.equal(get(duties(P(9, 0, 100, 900)), '비상용'), 'no');
  assert.equal(get(duties(P(10, 0, 100, 1000)), '비상용'), 'yes');
});
test('내진·에너지·허가권자·다중이용', () => {
  assert.equal(get(duties(P(1, 0, 150, 150)), '구조'), 'no');
  assert.equal(get(duties(P(1, 0, 250, 250)), '구조'), 'yes');
  assert.equal(get(duties(P(1, 0, 499, 499)), '에너지'), 'no');
  assert.equal(get(duties(P(1, 0, 500, 500)), '에너지'), 'yes');
  assert.equal(get(duties({...P(21, 0, 100, 2100), location: {region1: '서울'}}), '건축허가권자'), 'yes');
  assert.equal(get(duties({...P(21, 0, 100, 2100), location: {region1: '경기'}}), '건축허가권자'), 'no');
  assert.equal(get(duties(P(1, 0, 600, 600, '단독주택')), '에너지'), 'no');
  assert.equal(get(duties(P(1, 0, 300, 300, '창고시설')), '구조'), 'no');
  assert.equal(get(duties(P(5, 0, 1200, 6000, '판매시설')), '다중이용'), 'yes');
  assert.equal(get(duties(P(5, 0, 1200, 6000, '업무시설')), '다중이용'), 'no');
  assert.equal(get(duties(P(null, 0, 1, 1)), '승강기'), 'unknown');
});
