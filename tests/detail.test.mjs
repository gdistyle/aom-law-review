import test from 'node:test';import assert from 'node:assert/strict';
import {blankProject,datum} from '../public/js/core.js';
import {reviewProject,normalizeLaw,DECREE,BLD,BD} from '../public/js/legal.js';
const L=(name,arts,annexes=[],kind='law')=>normalizeLaw({법령:{기본정보:{법령명_한글:name,시행일자:'20240528'},조문:{조문단위:arts.map(([no,title,hang,branch])=>({조문번호:String(no),조문가지번호:branch||'0',조문여부:'조문',조문제목:title,조문내용:`제${no}조(${title})`,항:hang.map(t=>({항내용:t}))}))},별표:{별표단위:annexes.map(([no,title,text])=>({별표번호:String(no).padStart(4,'0'),별표가지번호:'00',별표제목:title,별표내용:text}))}}},{kind,name,current:true});
function project(){const p=blankProject();p.address='경기도 하남시 감이동 440-2';p.location={region1:'경기도',region2:'하남시'};p.land.zone=datum('일반상업지역');p.land.area=datum(2374.1);p.purpose='공장';
 p.laws=[
  L(DECREE,[[84,'용도지역안에서의 건폐율',['① 법 제77조제1항 및 제2항에 따른 건폐율은 다음 각 호의 범위에서 도시ㆍ군계획조례가 정하는 비율 이하로 한다.\n8. 일반상업지역 : 80퍼센트 이하\n9. 근린상업지역 : 70퍼센트 이하']],[85,'용도지역 안에서의 용적률',['① 용적률은 다음 범위에서 조례가 정하는 비율을 초과할 수 없다.\n8. 일반상업지역 : 200퍼센트 이상 1천300퍼센트 이하']],[71,'용도지역안에서의 건축제한',['① ...']]],[[9,'일반상업지역안에서 건축할 수 없는 건축물','1. 건축할 수 없는 건축물\n가. 숙박시설 중 일반숙박시설\n2. 도시ㆍ군계획조례로 정하는 바에 따라 건축할 수 없는 건축물\n가. 공장']]),
  L(BLD,[[44,'대지와 도로의 관계',['① 건축물의 대지는 2미터 이상이 도로(자동차만의 통행에 사용되는 도로는 제외한다)에 접하여야 한다.','② 기준은 대통령령으로 정한다.']],[42,'대지의 조경',['① 면적이 200제곱미터 이상인 대지에 건축을 하는 건축주는 조례로 정하는 기준에 따라 조경을 하여야 한다.']]]),
  L('하남시 도시계획 조례',[[50,'용도지역 안에서의 건폐율',['① 건폐율은 다음 각 호와 같다.\n8. 일반상업지역 : 80퍼센트 이하']],[51,'용도지역 안에서의 용적률',['① 용적률은 다음 각 호와 같다.\n8. 일반상업지역 : 800퍼센트 이하']]],[], 'ordin')
 ];return p;}
test('상세 법규내용: 조례·상한·계산',()=>{const p=project();const r=reviewProject(p);const bcr=r.rows.find(x=>x.id==='bcr'),far=r.rows.find(x=>x.id==='far');
 console.log('---BCR\n'+bcr.text+'\n---FAR\n'+far.text+'\n---ROAD\n'+r.rows.find(x=>x.id==='road').text+'\n---USE\n'+r.rows.find(x=>x.id==='use').text+'\n---LAND\n'+r.rows.find(x=>x.id==='landscape').text);
 assert.match(bcr.text,/일반상업지역 : 80퍼센트 이하/);assert.match(bcr.text,/1,899.28/);assert.match(far.text,/800퍼센트 이하/);assert.match(far.text,/18,992.8/);
 assert.match(r.rows.find(x=>x.id==='road').text,/2미터 이상/);assert.match(r.rows.find(x=>x.id==='use').text,/건축할 수 없는/);assert.ok(!r.rows.find(x=>x.id==='road').text.includes('②'));});
test('시행지침 조항 찾기: 블록 쪽 우선·수치 추출',async()=>{const {searchGuideline}=await import('../public/js/guideline.js');const pages=[{page:3,lines:['제5조 일반 사항','건폐율 60% 이하']},{page:12,lines:['단독1-2 블록','건폐율 50% 이하, 용적률 100% 이하','최고층수 3층 이하','대지면적의 10% 이상 조경']}];const r=searchGuideline(pages,'단독1-2');assert.ok(r.blockFound);assert.deepEqual(r.blockPages,[12]);const bcr=r.topics.find(t=>t.key==='bcr');assert.equal(bcr.hits[0].page,12);assert.deepEqual(bcr.hits[0].values,[50]);assert.deepEqual(r.topics.find(t=>t.key==='far').hits[0].values,[100]);assert.ok(r.topics.find(t=>t.key==='floorLimit').hits[0].values.includes(3));assert.ok(r.topics.find(t=>t.key==='landscape').hits[0].values.includes(10));});
