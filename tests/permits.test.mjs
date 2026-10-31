import test from 'node:test';
import assert from 'node:assert/strict';
import {permitSteps} from '../public/js/permits.js';
import {blankProject, datum} from '../public/js/core.js';

function proj(zone, cat, op = '신축', zones = []) { const p = blankProject(); p.land.zone = datum(zone, '', false); p.land.category = datum(cat, '', false); p.land.zones = zones.map(n => ({name: n})); p.operation = op; p.review = {limits: {maxGross: 1000}}; return p; }
const names = r => r.steps.map(s => s.step);

test('도시지역 대지 신축: 설계 → 건축허가 → 착공 → 감리 → 사용승인', () => {
  const r = permitSteps(proj('제2종일반주거지역', '대'));
  assert.deepEqual(names(r), ['건축사 설계 · 사전 검토', '건축허가 (신축)', '착공신고', '공사 · 감리', '사용승인']);
});
test('농지(답)·관리지역: 농지전용·개발행위 포함', () => {
  const r = permitSteps(proj('계획관리지역', '답'));
  assert.ok(names(r).includes('농지전용 허가(협의)')); assert.ok(names(r).includes('개발행위허가(협의)'));
  assert.ok(!names(r).includes('산지전용 허가(협의)'));
});
test('임야: 산지전용 포함', () => {
  assert.ok(names(permitSteps(proj('자연녹지지역', '임야'))).includes('산지전용 허가(협의)'));
});
test('개발제한구역·지구단위계획 선행 단계', () => {
  const n = names(permitSteps(proj('자연녹지지역', '대', '신축', ['개발제한구역', '지구단위계획구역'])));
  assert.ok(n.indexOf('개발제한구역 행위허가') < n.indexOf('건축허가 (신축)'));
  assert.ok(n.includes('지구단위계획 적합 검토'));
});
test('비도시 소규모는 건축신고', () => {
  const p = proj('계획관리지역', '대'); p.floors = 2; p.review = {limits: {maxGross: 150}};
  assert.ok(names(permitSteps(p)).includes('건축신고 (신축)'));
});
test('용도변경: 기존 건물 없으면 판정 불가(빨간), 위반건축물 열람 단계', () => {
  const r = permitSteps(proj('제2종일반주거지역', '대', '용도변경'));
  const s = r.steps.find(x => x.step.startsWith('용도변경')); assert.ok(s.red);
  assert.ok(names(r).includes('위반건축물 여부 열람'));
  assert.ok(!names(r).includes('착공신고'));
});
