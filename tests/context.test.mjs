import test from 'node:test';
import assert from 'node:assert/strict';
import {terrainSummary,buildingSummary,siteContext,contextText} from '../public/js/context.js';

const grid=f=>{const pts=[];for(let x=-240;x<=240;x+=10)for(let y=-240;y<=240;y+=10)pts.push([x,y,f(x,y)]);return pts;};

test('지형: 남쪽으로 5% 낮아지는 평면', ()=>{
  const t=terrainSummary(grid((x,y)=>50+0.05*y));
  assert.ok(Math.abs(t.slope-5)<0.01); assert.equal(t.down,'남'); assert.ok(Math.abs(t.elevation-50)<0.5);
});
test('지형: 동쪽으로 낮아짐 · 평탄 판정', ()=>{
  assert.equal(terrainSummary(grid((x)=>30-0.1*x)).down,'동');
  assert.ok(terrainSummary(grid(()=>12)).slope<0.001);
});
test('지형: 자료 부족 시 null', ()=>{ assert.equal(terrainSummary([]),null); assert.equal(terrainSummary(null),null); });
test('주변 건물: 층수 3동 미만이면 null, 통계 정확', ()=>{
  assert.equal(buildingSummary([{properties:{floors:2}}]),null);
  const b=buildingSummary([2,3,4,5,null,0].map(f=>({properties:{floors:f}})));
  assert.equal(b.count,4); assert.equal(b.max,5); assert.equal(b.avg,3.5);
});
test('맥락: 역세권 상업 · 공원 · 남향 경사 · 학교 유의', ()=>{
  const places=[{name:'가나역',kind:'지하철역',distance:320},{name:'다라공원',kind:'공원',distance:150},{name:'마바초등학교',kind:'학교',distance:180},{name:'사아미술관',kind:'문화시설',distance:400}];
  const c=siteContext({zone:'일반상업지역',places,buildings:[2,2,3,2].map(f=>({properties:{floors:f}})),terrainPoints:grid((x,y)=>40+0.04*y)});
  assert.match(c.character,/^역세권 상업 가로/);
  assert.ok(c.facts.some(f=>f.includes('가나역 320m (도보 약 4분)')));
  assert.ok(c.concepts.some(s=>s.includes('1층은 가로에 열린')));
  assert.ok(c.concepts.some(s=>s.includes('다라공원')));
  assert.ok(c.cautions.some(s=>s.includes('교육환경보호구역')));
  assert.equal(c.signature[0].name,'사아미술관');
  assert.match(c.story,/^일반상업지역 대지로서 가나역에서 도보 약 4분/);
  assert.match(contextText('가상시 가상동 1',c),/계획 착안점/);
});
test('맥락: 자료가 하나도 없으면 지어내지 않음', ()=>{
  const c=siteContext({});
  assert.deepEqual(c.facts,[]); assert.deepEqual(c.concepts,[]); assert.equal(c.story,''); assert.equal(c.character,'');
});
