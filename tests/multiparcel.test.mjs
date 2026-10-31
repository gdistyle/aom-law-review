import test from 'node:test';
import assert from 'node:assert/strict';
import {combineZones, parcelRows, landRefSum, thresholdFromText} from '../public/js/multiparcel.js';
import {blankProject, datum} from '../public/js/core.js';

const RATE = {'제2종일반주거지역': [60, 200], '일반상업지역': [80, 800], '자연녹지지역': [20, 100]};
const fakeReview = q => { const z = q.land.zone.value, A = q.land.area.value, [b, f] = RATE[z]; return {rows: [], limits: {bcr: {value: b}, far: {value: f}, maxFootprint: A * b / 100, maxGross: A * f / 100}}; };
const law94 = {name: '국토의 계획 및 이용에 관한 법률 시행령', kind: 'law', current: true, effectiveDate: '20200101', articles: [{number: '94', branch: '', effectiveDate: '20200101', text: '제94조(어느 지역에 속하는지 여부의 판단 기준) 법 제84조제1항 각 호 외의 부분 본문에서 "대통령령으로 정하는 규모"란 330제곱미터를 말한다.'}]};
function proj(zMain, aMain, extras) {
  const p = blankProject(); p.pnu = '1111010100100010000'; p.address = '가동 1'; p.land.zone = datum(zMain, '', false); p.land.area = datum(aMain, '', false); p.land.price = datum(1_000_000, '', false);
  p.extra = extras.map(([z, a, price], i) => ({pnu: '11110101001000' + (20 + i) + '000', address: '가동 ' + (2 + i), area: datum(a, '', false), price: datum(price ?? 2_000_000, '', false), zone: z, zones: [z]}));
  p.parcels = [{area: datum(aMain)}, ...extras.map(([, a]) => ({area: datum(a)}))]; p.laws = [law94];
  return p;
}

test('같은 용도지역: 기존 계산 유지', () => {
  const p = proj('제2종일반주거지역', 300, [['제2종일반주거지역', 200]]);
  const rv = combineZones(p, fakeReview({land: {zone: p.land.zone, area: datum(500)}}), fakeReview);
  assert.equal(rv.limits.bcr.value, 60); assert.equal(rv.limits.maxFootprint, 300);
});

test('다른 용도지역: 부분별 합산·가중평균 (손계산)', () => {
  const p = proj('제2종일반주거지역', 300, [['일반상업지역', 200]]);
  const rv = combineZones(p, fakeReview({land: {zone: p.land.zone, area: datum(500)}}), fakeReview);
  // 건축면적 300×60% + 200×80% = 180 + 160 = 340 → 340/500 = 68%
  assert.equal(rv.limits.maxFootprint, 340); assert.equal(rv.limits.bcr.value, 68);
  // 연면적 300×200% + 200×800% = 600 + 1600 = 2200 → 440%
  assert.equal(rv.limits.maxGross, 2200); assert.equal(rv.limits.far.value, 440);
  assert.equal(rv.multi.threshold, 330); assert.equal(rv.multi.rule, 'weighted');
  assert.equal(rv.multi.largest, '제2종일반주거지역'); assert.equal(rv.rows[0].id, 'multi-zone');
});

test('작은 부분이 기준 초과면 부분별 적용 판정', () => {
  const p = proj('제2종일반주거지역', 1000, [['자연녹지지역', 400]]);
  const rv = combineZones(p, fakeReview({land: {zone: p.land.zone, area: datum(1400)}}), fakeReview);
  assert.equal(rv.multi.rule, 'separate'); assert.equal(rv.limits.maxFootprint, 600 + 80);
});

test('시행령 원문 없으면 판정 불가 표시', () => {
  const p = proj('제2종일반주거지역', 300, [['일반상업지역', 200]]); p.laws = [];
  const rv = combineZones(p, fakeReview({land: {zone: p.land.zone, area: datum(500)}}), fakeReview);
  assert.equal(rv.multi.rule, 'unknown'); assert.equal(rv.limits.bcr.uncertain, true);
});

test('토지비 참고값: 필지별 공시지가 × 면적 합', () => {
  const p = proj('제2종일반주거지역', 300, [['일반상업지역', 200, 5_000_000]]);
  assert.equal(landRefSum(p), 300 * 1_000_000 + 200 * 5_000_000);
  assert.equal(parcelRows(p).length, 2);
  assert.equal(thresholdFromText('660제곱미터'), 660);
});
