import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'fs';
import {reviewProject} from '../public/js/legal.js';
import {blankProject} from '../public/js/core.js';
import {krw, autoValues} from '../public/js/feas-ui.js';
import {duties} from '../public/js/duties.js';
import {sameDong} from '../public/js/trades.js';
const b = blankProject();
test('자연녹지 별표17 "4층 이하" 인식 + 서울시 조례 자연녹지 용적률 50% ("비율 이하로" 뒤 숫자만 있는 형식)', () => {
  const f = JSON.parse(readFileSync(new URL('./fixtures/buam99.json', import.meta.url)));
  const p = {...b, ...f, land: {...b.land, ...f.land, zones: [], zone: {value: '자연녹지지역'}, area: {value: 1000}}};
  const r = reviewProject(p);
  assert.equal(r.limits.legalHeight.floors, 4); assert.equal(r.limits.maxFootprint, 200); assert.equal(r.limits.far.value, 50); assert.equal(r.limits.maxGross, 500);
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
import {ordinanceParking} from '../public/js/legal.js';
test('조례 부설주차장 설치기준 표(첨부 HWP 글자) — 하남시 형식', () => {
  const t = ['[별표 2] 부설주차장설치기준(제17조제1항 관련)', '시 설 물', '설 치 기 준', ' 1. 위락시설', '  시설면적 70㎡당 1대', '2. 문화 및 집회시설(관람장은 제외한다), 종교 시설, 판매시설, 업무시설(외국공관 및 오피스텔은 제외한다)', '  시설면적 100㎡당 1대', ' 3. 제1종 근린생활시설(건축법시행령 별표1 ', '   제3호 바목 및 사목을 제외한다), 제2종 ', '   근린생활시설, 숙박시설', '  시설면적 134㎡당 1대 [시설면적 / 134㎡]', '  다만, 숙박시설 중 생활숙박시설은 시설면적 ', '  100㎡당 1대로 한다.', ' 4. 단독주택(다가구 주택을 제외한다)', ' ․ 시설면적 50㎡ 초과 134㎡ 이하 : 1대', ' ․ 시설면적이 134㎡ 초과 : 1대에 134㎡를 초과하는 ', '    81㎡ 당 1대를 더한 대수', ' 5. 창고시설', '  시설면적 300㎡당 1대 이상', ' 〔비고〕', ' 1. 기계식주차장...'].join('\n');
  const law = {current: true, name: '하남시 주차장 조례', articles: [], annexes: [{title: '[별표 2] 부설주차장설치기준(제17조제1항 관련)', text: t}]};
  assert.equal(ordinanceParking(law, '제2종 근린생활시설').unit, 134);
  assert.equal(ordinanceParking(law, '판매시설').unit, 100);
  assert.deepEqual(ordinanceParking(law, '단독주택').house, {min: 50, base: 134, step: 81});
  assert.equal(ordinanceParking(law, '창고시설').unit, 300);
});
import {legalHeight} from '../public/js/legal.js';
test('제1종일반주거 별표4 "[4층 이하" (대괄호) 인식', () => {
  const txt = '■ 국토의 계획 및 이용에 관한 법률 시행령 [별표 4]\n  제1종일반주거지역안에서 건축할 수 있는\n  건축물(제71조제1항제3호관련)\n  1. 건축할 수 있는 건축물[4층 이하(「주택법 시행령」 제10조제1항제2호에\n  따른 단지형 연립주택 및 같은 항 제3호에 따른 단지형 다세대주택인 경우에\n  는 5층 이하를 말하며)의 건축물만 해당한다.';
  const p = {...b, land: {...b.land, zones: [], zone: {value: '제1종일반주거지역'}}, laws: [{name: '국토의 계획 및 이용에 관한 법률 시행령', current: true, effectiveDate: '20260101', articles: [], annexes: [{number: '4', branch: '', title: '', text: txt}]}]};
  assert.equal(legalHeight(p, '').floors, 4);
});

import {extractRatio} from '../public/js/legal.js';
test('조례 용적률: "(단, 지구단위계획: N)" 구분, 지역 단서는 미채택', () => {
  const t = '1. 제1종전용주거지역: 80퍼센트 2. 제2종일반주거지역: 240퍼센트 (단, 지구단위계획: 250퍼센트) 3. 중심상업지역: 1천퍼센트(단, 서울도심: 800퍼센트)';
  assert.equal(extractRatio(t, '제2종일반주거지역'), 240); assert.equal(extractRatio(t, '제2종일반주거지역', false, true), 250);
  assert.equal(extractRatio(t, '제1종전용주거지역'), 80); assert.equal(extractRatio(t, '중심상업지역'), null);
  assert.equal(extractRatio('2. 제2종일반주거지역 : 100퍼센트 이상 250퍼센트 이하', '제2종일반주거지역', true), 250);
});
import {ordinanceSetback} from '../public/js/legal.js';
test('조례 대지 안의 공지 표(하남시 형식) — 공동주택 3종·그 밖의 건축물 면적 구간', () => {
  const t = ['[별표 3] 대지 안의 공지 기준(제31조 관련)', '용 도', '1. 공장', '모든 지역', '5백 제곱미터 이상', '적용 대상', '3미터 이상(다만, 준공업지역에서 건축하는 경우에는 1.5미터 이상)', '모든 건축선', '2미터 이상', '인접 대지경계선',
    '2. 공동주택', '모든 지역', '아파트', '연립주택', '다세대', '적용 대상', '3미터', '이상', '2미터', '이상', '1미터', '이상', '모든 건축선', '3미터', '이상', '2미터', '이상', '1미터', '이상', '인접 대지경계선 ',
    '3. 그 밖의 건축물', '모든 지역', '1미터 이상', '모든 건축선', '1,000제곱미터 이상 1미터 이상', '인접 대지경계선', '1,000제곱미터 미만 0.5미터 이상'].join('\n');
  const law = {current: true, name: '하남시 건축 조례', articles: [], annexes: [{title: '[별표 3] 대지 안의 공지 기준(제31조 관련)', text: t}]};
  assert.deepEqual(ordinanceSetback(law, '다세대주택', 800, '').line, 1);
  assert.equal(ordinanceSetback(law, '공동주택', 800, '').multi[1].boundary, 2);
  assert.equal(ordinanceSetback(law, '공장', 600, '').boundary, 2);
  assert.equal(ordinanceSetback(law, '공장', 300, '').boundary, 0.5);
  assert.equal(ordinanceSetback(law, '제2종 근린생활시설', 1500, '').boundary, 1);
});
