import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'fs';
import {reviewProject} from '../public/js/legal.js';
import {blankProject} from '../public/js/core.js';
import {krw, autoValues} from '../public/js/feas-ui.js';
import {duties} from '../public/js/duties.js';
import {sameDong} from '../public/js/trades.js';
const b = blankProject();
test('자연녹지 별표17 "4층 이하" 인식 → 연면적 = 건축면적 × 4', () => {
  const f = JSON.parse(readFileSync(new URL('./fixtures/buam99.json', import.meta.url)));
  const p = {...b, ...f, land: {...b.land, ...f.land, zones: [], zone: {value: '자연녹지지역'}, area: {value: 1000}}};
  const r = reviewProject(p);
  assert.equal(r.limits.legalHeight.floors, 4); assert.equal(r.limits.maxFootprint, 200); assert.equal(r.limits.maxGross, 800);
});
test('층수 제한·선택 시 주차 시설면적·사업성 연면적 일치', () => {
  const p = {...b, pnu: '1', land: {...b.land, area: {value: 2374.1}, zone: {value: '일반상업지역'}}, manual: {...b.manual, bcr: 80, far: 1300, floorLimit: 3}, floors: 3, purpose: '제2종 근린생활시설'};
  p.review = reviewProject(p);
  assert.ok(Math.abs(p.review.limits.maxGross - 5697.84) < 1e-6); assert.ok(Math.abs(p.review.limits.parkingArea - 5697.84) < 1e-6); assert.ok(Math.abs(autoValues(p).gross - 5697.84) < 1e-6);
});
test('금액 읽기', () => { assert.equal(krw(100005000), '1억 5,000 원'); assert.equal(krw(-0.3), '0 원'); assert.equal(krw(123456789), '1억 2,345만 6,789 원'); });
test('의무 판정: 주택 내진, 다중이용 범위', () => {
  const D = (pu, F, G) => duties({pnu: '1', floors: F, basement: 0, purpose: pu, review: {limits: {maxFootprint: G / F, maxGross: G}}}).rows;
  assert.equal(D('단독주택', 1, 100).find(x => x.item.startsWith('구조')).result, 'yes');
  assert.equal(D('의료시설', 10, 6000).find(x => x.item.startsWith('다중')).result, 'unknown');
  assert.equal(D('판매시설', 10, 6000).find(x => x.item.startsWith('다중')).result, 'yes');
  assert.equal(D('업무시설', 10, 6000).find(x => x.item.startsWith('다중')).result, 'no');
});
test('같은 동 판정 경계', () => { assert.ok(sameDong('삼성면 양덕리', '양덕리')); assert.ok(!sameDong('신덕소리', '덕소리')); });
