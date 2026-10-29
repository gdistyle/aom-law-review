/**
 * 정답 사례 검사 — 실제 법령 원문(법제처 현행, 2026-10 수신분)으로 고정한 대지별 기대값.
 * 부암동 99 기대값은 A.O.M 법규검토서(종로구 부암동 99 외 1필지 단독주택 신축) 기준과 동일해야 함.
 */
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {blankProject,datum} from '../public/js/core.js';import {reviewProject} from '../public/js/legal.js';import {allowedUses} from '../public/js/legal-detail.js';
function load(file,purpose=''){const d=JSON.parse(readFileSync(new URL('./fixtures/'+file,import.meta.url),'utf8'));const p=blankProject();p.address=d.address;p.pnu=d.pnu;p.purpose=purpose;p.land.area=datum(d.land.area,'검수',false);p.land.category=datum(d.land.category,'검수',false);p.land.zone=datum(d.land.zone,'검수',false);p.land.road=datum(d.land.road,'검수',false);p.land.zones=d.land.zones;p.laws=d.laws;p.review=reviewProject(p);return p;}
const near=(a,b,msg)=>assert.ok(Math.abs(a-b)<1e-6,`${msg}: ${a} ≠ ${b}`);
test('정답 · 부암동 99 (개발제한구역·자연녹지, 단독주택)',()=>{const p=load('buam99.json','단독주택'),L=p.review.limits;
 assert.equal(L.bcr.value,60,'건폐율 = 개발제한구역법 시행령 별표2 60%');assert.equal(L.far.value,300,'용적률 300%');
 near(L.maxFootprint,136.8,'최대 건축면적 228×60%');near(L.maxGross,232,'최대 연면적 = 연면적 상한 232㎡');
 assert.equal(L.legalHeight.floors,3,'높이 3층 이하');
 assert.equal(L.parking,2,'단독주택 부설주차 1+(232-150)/100=1.82→2대');
 near(L.landscapeArea,11.4,'조경 228×5%(서울 건축조례 제24조③)');assert.ok(L.landscapeOptional,'녹지지역 면제 선택 가능 병기');
 const ids=p.review.rows.map(r=>r.id);for(const id of ['gb-ratio','gb-grading-area','gb-use','gb-change','legalHeight','parking','landscape'])assert.ok(ids.includes(id),'법규표 항목 '+id);
 assert.match(p.review.rows.find(r=>r.id==='gb-grading-area').target,/330/,'형질변경 면적 330㎡ 이하');
 const uses=allowedUses(p).map(x=>x.use);assert.deepEqual(uses,['단독주택','제1종 근린생활시설','제2종 근린생활시설'],'허용 용도');});
test('정답 · 부암동 99 주용도 미선택 시에도 같은 상한(주택·근생 가정)',()=>{const L=load('buam99.json').review.limits;assert.equal(L.bcr.value,60);near(L.maxGross,232,'연면적 상한');assert.equal(L.legalHeight.floors,3);});
test('정답 · 하남 감이동 440-2 (일반상업·지구단위계획구역)',()=>{const p=load('gami440-2.json'),L=p.review.limits;
 assert.equal(L.bcr.value,80,'건폐율: 시행령 제84조 80% · 하남시 도시계획조례 80%');assert.equal(L.far.value,1300,'용적률 1,300%');
 assert.ok(L.bcr.uncertain&&L.far.uncertain,'지구단위계획구역 → 시행지침 미대조 빨간 글씨');
 near(L.maxFootprint,1899.28,'2,374.1×80%');near(L.maxGross,30863.3,'2,374.1×1,300%');
 assert.equal(L.parking,154,'2종 근생 가정 30,863.3÷200=154.3→154대(비고6)');
 near(L.landscapeArea,356.115,'하남시 건축조례 제26조 연면적 2천㎡ 이상 15%');
 assert.equal(Math.ceil(L.maxGross/L.maxFootprint-1e-9),17,'지상 최대 17층(비율)');});
