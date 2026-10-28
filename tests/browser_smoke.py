"""선택 실행: pip install playwright 후 python tests/browser_smoke.py.
Node 로컬 서버를 8787 포트에서 먼저 실행. 테스트 산출물은 저장소 밖 또는 .test-output에 저장.
실기관 API 시험이 아닌 무키·수동 입력·브라우저 출력 회귀 시험.
"""
from pathlib import Path
import os,json,zipfile,hashlib
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=Path(os.environ.get('AOM_TEST_OUTPUT',str(ROOT/'.test-output')));OUT.mkdir(exist_ok=True,parents=True)
fixture=json.loads((ROOT/'tests/fixtures/hanam.json').read_text())
results=[];errors=[]
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or ('/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None),headless=True,args=['--no-sandbox'])
 context=browser.new_context(viewport={'width':1440,'height':1000},accept_downloads=True)
 context.route('https://**/*',lambda route:route.abort())
 page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
 if os.environ.get('AOM_OFFLINE_RENDER')=='1':
  from offline_harness import prepare
  prepare(page,ROOT)
 else:page.goto('http://localhost:8787',wait_until='networkidle')
 assert page.locator('#connection').inner_text().count('자료 연결 전')==4
 results.append('키 미설정: 4개 기관 연결 전, 앱 초기화 성공')
 page.fill('#address',fixture['address']);page.select_option('#purpose','업무시설');page.fill('#floors','8');page.click('#applyProject')
 page.locator('#s2 summary').click();page.fill('#landArea','2374.1');page.fill('#landCategory','대');page.select_option('#zone',fixture['zone']);page.fill('#zones','국토계획 | 지구단위계획구역 | 국토의 계획 및 이용에 관한 법률');page.click('#applyLand')
 page.locator('#s3 summary').click()
 for key,value in fixture['building'].items():page.fill('#b-'+key,str(value))
 page.click('#applyBuilding')
 assert '지구단위계획 시행지침 우선 적용' in page.locator('#legalTable').inner_text()
 assert page.locator('#legalTable tr').count()>5
 links=page.locator('#legalTable tbody tr').evaluate_all('(rows)=>rows.every(r=>Array.from(r.querySelectorAll("a")).some(a=>a.href.startsWith("https://www.law.go.kr/")))')
 assert links
 results.append('수동 표제부 검수값 및 지구단위계획 빨간 행·전 행 조문 링크')
 page.evaluate('window.scrollTo(0,0)');page.wait_for_timeout(100);page.screenshot(path=str(OUT/'desktop.png'),full_page=False)
 with page.expect_download(timeout=60000) as info:page.click('#downloadAll')
 d=info.value;d.save_as(OUT/'manual-export.zip')
 with zipfile.ZipFile(OUT/'manual-export.zip') as z:
  names=z.namelist();exts={Path(n).suffix for n in names};assert {'.docx','.xlsx','.pdf','.dxf','.dae','.txt'}<=exts
  assert sum(n.endswith('.pdf') for n in names)==2;assert sum(n.endswith('.dae') for n in names)==2
  z.extractall(OUT/'generated')
 results.append('전체 ZIP: PDF 2종·DOCX·XLSX·DXF·DAE 2종·출처/주석 3종')
 for width in [320,360,375,414,768,1024,1440]:
  page.set_viewport_size({'width':width,'height':900});page.wait_for_timeout(80)
  dims=page.evaluate('({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth})')
  assert dims['scroll']<=dims['client'],(width,dims)
  if width==375:page.screenshot(path=str(OUT/'mobile.png'),full_page=True)
 results.append('7개 화면 폭: 320/360/375/414/768/1024/1440px 가로 넘침 없음')
 page.click('[data-tab="cut"]');frame=page.frame_locator('#stampFrame');frame.locator('#p-cut').wait_for(state='visible',timeout=20000);assert frame.locator('#t-cut').get_attribute('aria-selected')=='true'
 page.click('[data-tab="make"]');frame.locator('#p-make').wait_for(state='visible');assert frame.locator('#name').input_value()=='아옴이'
 results.append('원본 도장 도구 두 탭 직접 연결')
 assert not errors,errors
 # 비공개 테스트 하네스의 직접 모듈 검수: 작은 합성 다각형으로 모델 경로와 출력 확인.
 page.click('[data-tab="review"]')
 model=page.evaluate('''async()=>{const c=await import(window.__aomModules?'aom/core.js':'/js/core.js'),g=await import(window.__aomModules?'aom/geometry.js':'/js/geometry.js'),l=await import(window.__aomModules?'aom/legal.js':'/js/legal.js'),cad=await import(window.__aomModules?'aom/cad.js':'/js/cad.js');const p=c.blankProject();p.address='합성 도형 회귀 시험';p.land.area=c.datum(1000,'test',true);p.manual.bcr=60;p.manual.far=200;p.manual.setback=1;p.manual.roadSetback=0;p.manual.height=30;p.model.confirmed=true;p.floors=4;p.geometry.parcels=[{type:'Feature',properties:{target:true},geometry:{type:'Polygon',coordinates:[[[127,37],[127.0004,37],[127.0004,37.0003],[127,37.0003],[127,37]]]}}];p.review=l.reviewProject(p);const r=g.buildModels(p);if(!r.models.length)throw Error(r.message);const dae=cad.volumeDAE(r);if(new DOMParser().parseFromString(dae,'application/xml').querySelector('parsererror'))throw Error('DAE XML');const {showScene}=await import(window.__aomModules?'aom/scene.js':'/js/scene.js');showScene(document.getElementById('viewer'),p,r);return {models:r.models.map(m=>({id:m.id,footprint:m.footprint,gross:m.gross,floors:m.floors})),daeLength:dae.length};}''')
 assert len(model['models'])>=3
 page.locator('#viewer').scroll_into_view_if_needed();page.wait_for_timeout(500);page.locator('#viewer').screenshot(path=str(OUT/'model.png'))
 results.append('합성 실제좌표 형식 도형: 최대·일자·ㄱ자·중정 모델 및 DAE XML 생성')
 page.fill('#address','서울특별시 종로구 부암동 99');page.click('#applyProject')
 assert page.locator('#landArea').input_value()==''
 assert '2374.1' not in page.locator('#buildingData').inner_text()
 assert '지구단위계획 시행지침 우선 적용' not in page.locator('#legalTable').inner_text()
 results.append('주소 변경: 이전 필지 면적·대장·지구단위계획 상태 제거')
 assert not errors,errors
 browser.close()
report={'mode':'offline-dom-harness' if os.environ.get('AOM_OFFLINE_RENDER')=='1' else 'local-browser-manual-fixture','results':results,'pageErrors':errors,'models':model,'liveAPI':'not tested — no issued credentials'}
(OUT/'browser-results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False,indent=2))
