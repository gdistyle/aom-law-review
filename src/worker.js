/**
 * Cloudflare Workers API 중계. 임의 URL 프록시 금지, 응답 필드 허용목록, 무저장.
 * 법령은 조회마다 upstream 새 요청. 캐시/예시 데이터/하드코딩된 현행 수치 없음.
 * 기관 문서로 사양 재확인할 곳: 아래 RECHECK 주석과 docs/API_RECHECK.md 참조.
 */
import {makePNU,splitPNU,array,number,currentByDate,kstToday,norm,date8} from '../public/js/core.js';
import {normalizeLaw} from '../public/js/legal.js';
const OPS={title:'getBrTitleInfo',recap:'getBrRecapTitleInfo',floors:'getBrFlrOulnInfo',exclusive:'getBrExposPubuseAreaInfo'};
const BLD_FIELDS=['mgmBldrgstPk','regstrGbCd','regstrGbCdNm','regstrKindCd','regstrKindCdNm','platPlc','newPlatPlc','bldNm','dongNm','hoNm','mainAtchGbCdNm','platArea','archArea','bcRat','totArea','vlRatEstmTotArea','vlRat','strctCdNm','etcStrct','mainPurpsCdNm','etcPurps','grndFlrCnt','ugrndFlrCnt','heit','roofCdNm','useAprDay','pmsDay','stcnsDay','jiyukCdNm','jiguCdNm','guyukCdNm','totPkngCnt','indrAutoUtcnt','oudrAutoUtcnt','indrMechUtcnt','oudrMechUtcnt','elvtCnt','rideUseElvtCnt','emgenUseElvtCnt','flrGbCd','flrGbCdNm','flrNo','flrNoNm','area','exposPubuseGbCdNm','crtnDay'];
const LAND_FIELDS=['pnu','ldCode','ldCodeNm','mnnmSlno','stdrYear','stdrMt','stdrDe','lndcgrCodeNm','lndpclAr','pblntfPclnd','roadSideCodeNm','tpgrphHgCodeNm','tpgrphFrmCodeNm','prposArea1Nm','prposArea2Nm','prposAreaDstrcCode','prposAreaDstrcCodeNm','cnflcAt','cnflcAtNm','lawNm','lastUpdtDt'];
const LAND_OPS={use:'getLandUseAttr',characteristics:'getLandCharacteristics',price:'getIndvdLandPriceAttr'};
export const pick=(obj,keys)=>Object.fromEntries(keys.filter(k=>obj?.[k]!==undefined).map(k=>[k,obj[k]]));
const counts=new Map();
function json(value,status=200){return new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});}
function fail(code,message,status=400){return json({ok:false,code,message},status);}
function configured(env,key){return typeof env[key]==='string'&&env[key].trim().length>0;}
function missing(key){return json({ok:false,code:'NOT_CONFIGURED',message:'자료 연결 전',service:key},200);}
function checkQuery(u,k,re,max=100){const v=u.searchParams.get(k)||'';if(!v||v.length>max||!re.test(v))throw new Error('INVALID_INPUT');return v;}
function positivePage(u){const n=number(u.searchParams.get('page')||1);if(!Number.isInteger(n)||n<1||n>1000)throw new Error('INVALID_INPUT');return n;}
function rateLimit(req){const id=req.headers.get('CF-Connecting-IP')||'local';const slot=Math.floor(Date.now()/60000),key=id+':'+slot;const n=(counts.get(key)||0)+1;counts.set(key,n);if(counts.size>5000)counts.clear();return n<=180;}
function allowedOrigin(request,env){const origin=request.headers.get('Origin');if(!origin)return request.headers.get('Sec-Fetch-Site')!=='cross-site';const here=new URL(request.url).origin;return origin===here||!!env.SITE_ORIGIN&&origin===env.SITE_ORIGIN;}
async function upstream(url,env,headers={}){
 const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),Math.min(Number(env.UPSTREAM_TIMEOUT_MS)||25000,28000));
 try{
  const r=await fetch(url,{headers,signal:ctl.signal,redirect:'manual'});
  if(r.status>=300&&r.status<400)throw new Error('UPSTREAM_REDIRECT');
  if(!r.ok)throw new Error('UPSTREAM_HTTP_'+r.status);
  const max=Math.min(Number(env.MAX_RESPONSE_BYTES)||4000000,8000000);
  if(Number(r.headers.get('Content-Length'))>max)throw new Error('RESPONSE_TOO_LARGE');
  const reader=r.body.getReader(),chunks=[];let length=0;
  for(;;){const {value,done}=await reader.read();if(done)break;length+=value.byteLength;if(length>max){await reader.cancel();throw new Error('RESPONSE_TOO_LARGE');}chunks.push(value);}
  const bytes=new Uint8Array(length);let at=0;for(const x of chunks){bytes.set(x,at);at+=x.length;}
  return {bytes,contentType:r.headers.get('Content-Type')||''};
 }finally{clearTimeout(timer);}
}
async function upstreamJSON(url,env,headers={}){
 const r=await upstream(url,env,headers),s=new TextDecoder().decode(r.bytes);
 try{return JSON.parse(s);}catch{
  // 인증실패 시 XML을 돌려주는 기관. 원문 URL/키/개인정보를 브라우저에 되돌리지 않음.
  if(/SERVICE_KEY|SERVICE_ACCESS|SERVICE ERROR|LIMITED_NUMBER|INVALID_REQUEST|AUTH/i.test(s))throw new Error('UPSTREAM_AUTH_OR_QUOTA');
  throw new Error('UPSTREAM_FORMAT');
 }
}
const publicSource=(name,url)=>({name,url,retrievedAt:new Date().toISOString()});
function decodeKey(key){try{return decodeURIComponent(key);}catch{return key;}}
async function address(u,env){
 if(!configured(env,'KAKAO_REST_KEY'))return missing('kakao');
 const query=checkQuery(u,'q',/^[\p{L}\p{N}\s.,()·ㆍ-]+$/u,160);
 const url=new URL('https://dapi.kakao.com/v2/local/search/address.json');url.searchParams.set('query',query);url.searchParams.set('size','30');url.searchParams.set('page',String(positivePage(u)));
 const data=await upstreamJSON(url,env,{Authorization:'KakaoAK '+env.KAKAO_REST_KEY});
 if(!Array.isArray(data.documents))throw new Error('UPSTREAM_FORMAT');
 const items=data.documents.filter(x=>x.address?.b_code).map(x=>{const a=x.address;let pnu='';try{pnu=makePNU(a);}catch{}
 return {address:a.address_name,pnu,lon:number(a.x||x.x),lat:number(a.y||x.y),region1:a.region_1depth_name,region2:a.region_2depth_name,region3:a.region_3depth_name,main:a.main_address_no,sub:a.sub_address_no,mountain:a.mountain_yn};});
 return json({ok:true,items,isEnd:!!data.meta?.is_end,source:publicSource('카카오 로컬 주소검색','https://developers.kakao.com/docs/ko/kakaomap/rest-api')});
}
async function nearby(u,env){
 if(!configured(env,'KAKAO_REST_KEY'))return missing('kakao');
 const x=number(u.searchParams.get('x')),y=number(u.searchParams.get('y'));
 if(!(x>124&&x<132&&y>32&&y<40))throw new Error('INVALID_INPUT');
 // 카카오 로컬 검색. 이름·분류·거리·방위만 반환(주소·전화 미반환).
 const H={Authorization:'KakaoAK '+env.KAKAO_REST_KEY};
 const BAD=/주차장|정류장|노래|카페|약국|아파트|빌라|부동산|교회|학원|마트|편의점|식당|주유소|휴게소|입구|매표소|화장실|등산로|둘레길|산책로|공영|약수터|쉼터/;
 const bearing=(lon,lat)=>{const r=Math.PI/180,dl=(lon-x)*r,a=lat*r,b=y*r;const yy=Math.sin(dl)*Math.cos(a),xx=Math.cos(b)*Math.sin(a)-Math.sin(b)*Math.cos(a)*Math.cos(dl);return (Math.atan2(yy,xx)/r+360)%360;};
 const one=async(url,label,keep=()=>true,limit=5)=>{try{const d=await upstreamJSON(url,env,H);return (Array.isArray(d.documents)?d.documents:[]).filter(keep).slice(0,limit).map(o=>({name:String(o.place_name||'').slice(0,60),kind:label,group:String(o.category_name||'').split('>').pop().trim().slice(0,30),distance:number(o.distance),bearing:Math.round(bearing(number(o.x),number(o.y)))})).filter(o=>o.name&&Number.isFinite(o.distance));}catch{return [];}};
 const cat=(code,r,size=5)=>{const url=new URL('https://dapi.kakao.com/v2/local/search/category.json');for(const [k,v]of Object.entries({category_group_code:code,x:String(x),y:String(y),radius:String(r),sort:'distance',size:String(size)}))url.searchParams.set(k,v);return url;};
 const kw=(q,r,size=15)=>{const url=new URL('https://dapi.kakao.com/v2/local/search/keyword.json');for(const [k,v]of Object.entries({query:q,x:String(x),y:String(y),radius:String(r),sort:'distance',size:String(size)}))url.searchParams.set(k,v);return url;};
 const nm=o=>String(o.place_name||''),cn=o=>String(o.category_name||'');
 const WATER=o=>{const last=cn(o).split('>').pop().trim();return /하천|강|호수|저수지|계곡/.test(last)&&/^여행|자연|명소|하천|지명/.test(cn(o).replace(/\s/g,''))&&/(강|천|호|저수지|계곡)$/.test(nm(o).trim())&&!BAD.test(nm(o))&&!/의원|병원|약국|학원|센터|마트|식당|카페/.test(nm(o)+cn(o));};
 const jobs=[one(cat('SW8',1000),'지하철역'),one(cat('SC4',500),'학교'),one(cat('CT1',800),'문화시설'),one(cat('AT4',1000),'관광명소'),one(cat('PO3',600),'공공기관'),one(cat('MT1',1000),'대형마트'),
  one(kw('공원',800),'공원',o=>/공원|숲/.test(cn(o))&&/공원|숲/.test(nm(o))&&!BAD.test(nm(o))),
  one(kw('하천',800),'하천',WATER),
  // 동서남북 경관 요소(반경 5km): 강·하천, 산, 큰 공원
  one(kw('강',5000),'경관-강',WATER,8),
  one(kw('천',5000),'경관-강',WATER,8),
  one(kw('산',5000),'경관-산',o=>/(산|봉)$/.test(nm(o).trim())&&/^(산|봉우리|오름)$/.test(cn(o).split('>').pop().trim())&&!BAD.test(nm(o)),10),
  one(kw('공원',3000),'경관-공원',o=>/공원$/.test(cn(o).split('>').pop().trim())&&/공원$/.test(nm(o).trim())&&!BAD.test(nm(o))&&!/어린이공원|소공원|놀이터/.test(nm(o)),8)];
 // 동서남북 1.5km 지점의 행정구역
 const dirs=[['북',0],['동',90],['남',180],['서',270]];
 const region=dirs.map(async([d,deg])=>{const dist=1500,r=Math.PI/180,lat=y+(dist*Math.cos(deg*r))/111320,lon=x+(dist*Math.sin(deg*r))/(111320*Math.cos(y*r));try{const url=new URL('https://dapi.kakao.com/v2/local/geo/coord2regioncode.json');url.searchParams.set('x',String(lon));url.searchParams.set('y',String(lat));const dd=await upstreamJSON(url,env,H);const h=(dd.documents||[]).find(o=>o.region_type==='H')||(dd.documents||[])[0];return h?{dir:d,gu:String(h.region_2depth_name||''),dong:String(h.region_3depth_name||'')}:null;}catch{return null;}});
 const here=(async()=>{try{const url=new URL('https://dapi.kakao.com/v2/local/geo/coord2regioncode.json');url.searchParams.set('x',String(x));url.searchParams.set('y',String(y));const dd=await upstreamJSON(url,env,H);const h=(dd.documents||[]).find(o=>o.region_type==='H')||(dd.documents||[])[0];return h?{gu:String(h.region_2depth_name||''),dong:String(h.region_3depth_name||'')}:null;}catch{return null;}})();
 const items=(await Promise.all(jobs)).flat();
 return json({ok:true,items,regions:(await Promise.all(region)).filter(Boolean),here:await here,source:publicSource('카카오 로컬 장소·좌표 검색','https://developers.kakao.com/docs/ko/kakaomap/rest-api')});
}
async function buildings(u,env){
 if(!configured(env,'DATA_GO_KR_KEY'))return missing('building');
 const pnu=checkQuery(u,'pnu',/^\d{19}$/),params=splitPNU(pnu),kind=u.searchParams.get('kind')||'title';if(!OPS[kind])throw new Error('INVALID_INPUT');
 const url=new URL('https://apis.data.go.kr/1613000/BldRgstHubService/'+OPS[kind]);
 for(const [k,v]of Object.entries({...params,serviceKey:decodeKey(env.DATA_GO_KR_KEY),_type:'json',numOfRows:'100',pageNo:String(positivePage(u))}))url.searchParams.set(k,v);
 const data=await upstreamJSON(url,env),root=data.response;
 if(!root?.header||!['00','0','0000'].includes(String(root.header.resultCode)))throw new Error('UPSTREAM_BUSINESS_ERROR');
 const total=number(root.body?.totalCount);if(total===null)throw new Error('UPSTREAM_FORMAT');
 const items=array(root.body?.items?.item).map(x=>pick(x,BLD_FIELDS));
 return json({ok:true,items,total,page:positivePage(u),pageSize:100,source:publicSource('국토교통부 건축HUB 건축물대장정보 서비스','https://www.data.go.kr/data/15134735/openapi.do')});
 // 기관 문서로 사양 재확인할 곳: 건축물대장 변동사항 전용 공개 오퍼레이션은 확인되지 않음.
 // crtnDay(데이터 생성일)를 변동일로 오인하지 않음. 변동사항은 사용자 확인자료 입력 경로로 처리.
}
function fieldRows(node,out=[]){
 if(!node||typeof node!=='object')return out;
 if(!Array.isArray(node)&&('pnu'in node)&&Object.keys(node).some(k=>LAND_FIELDS.includes(k)&&k!=='pnu')){out.push(node);return out;}
 for(const v of Object.values(node))if(typeof v==='object')fieldRows(v,out);return out;
}
function findTotal(node){if(!node||typeof node!=='object')return null;for(const k of ['totalCount','totalCnt'])if(node[k]!==undefined)return number(node[k]);for(const v of Object.values(node)){const r=findTotal(v);if(r!==null)return r;}return null;}
async function land(u,env){
 if(!configured(env,'VWORLD_KEY'))return missing('land');
 const pnu=checkQuery(u,'pnu',/^\d{19}$/);splitPNU(pnu);const kind=u.searchParams.get('kind')||'use';if(!LAND_OPS[kind])throw new Error('INVALID_INPUT');
 const domain=env.VWORLD_DOMAIN||env.SITE_ORIGIN;if(!domain)return missing('vworld-domain');
 const url=new URL('https://api.vworld.kr/ned/data/'+LAND_OPS[kind]);
 for(const [k,v]of Object.entries({pnu,key:env.VWORLD_KEY,domain,format:'json',numOfRows:'100',pageNo:String(positivePage(u))}))url.searchParams.set(k,v);
 // 기관 문서로 사양 재확인할 곳: NED의 서비스별 JSON 래퍼/제공 연도 범위/페이지 필드.
 // 임의로 올해 값을 가정하지 않으며 모든 응답 중 실제 기준연월 최신행을 client에서 선택.
 const data=await upstreamJSON(url,env);if(data.response?.error||data.error)throw new Error('UPSTREAM_BUSINESS_ERROR');
 const items=fieldRows(data).filter(r=>String(r.pnu)===pnu).map(r=>pick(r,LAND_FIELDS));const total=findTotal(data);
 if(total===null)throw new Error('UPSTREAM_FORMAT');
 return json({ok:true,items,total,page:positivePage(u),pageSize:100,source:publicSource('브이월드 '+LAND_OPS[kind],'https://www.vworld.kr')});
}
function geoClean(g){
 if(!g||!['Polygon','MultiPolygon','LineString','MultiLineString'].includes(g.type))return null;
 let n=0;const walk=x=>{if(!Array.isArray(x))throw new Error('UPSTREAM_FORMAT');if(typeof x[0]==='number'){if(++n>100000||!Number.isFinite(x[0])||!Number.isFinite(x[1])||Math.abs(x[0])>180||Math.abs(x[1])>90)throw new Error('UPSTREAM_FORMAT');return x.slice(0,2);}return x.map(walk);};
 return {type:g.type,coordinates:walk(g.coordinates)};
}
async function spatial(u,env){
 if(!configured(env,'VWORLD_KEY'))return missing('spatial');const kind=u.searchParams.get('kind')||'parcels';if(!['parcels','buildings'].includes(kind))throw new Error('INVALID_INPUT');
 const domain=env.VWORLD_DOMAIN||env.SITE_ORIGIN;if(!domain)return missing('vworld-domain');
 const layer=kind==='parcels'?'LP_PA_CBND_BUBUN':env.VWORLD_BUILDING_LAYER;
 // 기관 문서로 사양 재확인할 곳: 주변 건물 서비스ID·층수·높이 필드명. 확인 전 guessed layer로 요청하지 않음.
 if(!layer)return json({ok:false,code:'SCHEMA_UNVERIFIED',message:'자료 연결 전',service:'주변 건물 레이어'});
 if(!/^[A-Za-z0-9_]+$/.test(layer))throw new Error('INVALID_CONFIG');
 const box=checkQuery(u,'bbox',/^[0-9.,-]+$/,120).split(',').map(Number);if(box.length!==4||box.some(n=>!Number.isFinite(n))||box[0]<124||box[2]>132||box[1]<32||box[3]>40||box[2]<=box[0]||box[3]<=box[1]||box[2]-box[0]>.03||box[3]-box[1]>.03)throw new Error('INVALID_INPUT');
 const url=new URL('https://api.vworld.kr/req/data');
 for(const [k,v]of Object.entries({service:'data',request:'GetFeature',version:'2.0',data:layer,key:env.VWORLD_KEY,domain,format:'json',crs:'EPSG:4326',geomFilter:`BOX(${box[0]},${box[1]},${box[2]},${box[3]})`,geometry:'true',attribute:'true',size:'100',page:String(positivePage(u))}))url.searchParams.set(k,v);
 const data=await upstreamJSON(url,env),r=data.response;if(!r||!['OK','NOT_FOUND'].includes(r.status))throw new Error('UPSTREAM_BUSINESS_ERROR');
 const raw=r.result?.featureCollection?.features||[];
 const items=raw.map(f=>({type:'Feature',id:String(f.id||''),geometry:geoClean(f.geometry),properties:{pnu:String(f.properties?.pnu||''),jibun:String(f.properties?.jibun||''),category:String(f.properties?.jimok||f.properties?.lndcgrCodeNm||''),height:env.VWORLD_BUILDING_HEIGHT_FIELD?number(f.properties?.[env.VWORLD_BUILDING_HEIGHT_FIELD]):null,floors:env.VWORLD_BUILDING_FLOORS_FIELD?number(f.properties?.[env.VWORLD_BUILDING_FLOORS_FIELD]):null}})).filter(f=>f.geometry);
 const total=r.status==='NOT_FOUND'?0:number(r.record?.total);if(total===null)throw new Error('UPSTREAM_FORMAT');
 return json({ok:true,items,total,page:positivePage(u),pageSize:100,source:publicSource('브이월드 '+layer,'https://www.vworld.kr')});
}
function listRecords(data,kind){const root=kind==='ordin'?data.OrdinSearch:data.LawSearch;return array(root?.[kind==='ordin'?'ordin':'law']);}
async function law(u,env){
 if(!configured(env,'LAW_OC'))return missing('law');
 const name=checkQuery(u,'name',/^[\p{L}\p{N}\sㆍ·().-]+$/u,100),kind=u.searchParams.get('kind')==='ordin'?'ordin':'law',today=date8(kstToday());
 const target=kind==='law'?'eflaw':'ordin';
 const search=new URL('https://www.law.go.kr/DRF/lawSearch.do');
 for(const [k,v]of Object.entries({OC:env.LAW_OC,target,type:'JSON',query:name,search:'1',nw:kind==='law'?'3':'1',display:'100',page:'1',sort:'efdes'}))search.searchParams.set(k,v);
 const result=await upstreamJSON(search,env);let records=listRecords(result,kind);
 const total=number((result.LawSearch||result.OrdinSearch)?.totalCnt);
 if(total>100)throw new Error('LAW_SEARCH_AMBIGUOUS');
 records=records.filter(r=>norm(r.법령명한글||r.자치법규명)===norm(name)&&currentByDate(r.시행일자)&&!String(r.현행연혁코드||'').includes('연혁')&&!String(r.현행연혁코드||'').includes('예정')).sort((a,b)=>date8(b.시행일자).localeCompare(date8(a.시행일자)));
 const chosen=records[0];if(!chosen){const raw=listRecords(result,kind);return json({ok:false,code:'NO_CURRENT_TEXT',message:'현행 원문 수신 없음',name,debug:{rootKeys:Object.keys(result||{}),result:result?.result,msg:result?.msg,total,count:raw.length,sample:raw.slice(0,4).map(r=>({n:r.법령명한글||r.자치법규명,d:r.시행일자,c:r.현행연혁코드,keys:Object.keys(r).slice(0,20)}))}});}
 const id=chosen.법령ID||chosen.자치법규ID,mst=chosen.법령일련번호||chosen.자치법규일련번호;
 if(!id&&!mst)throw new Error('UPSTREAM_FORMAT');
 const detail=new URL('https://www.law.go.kr/DRF/lawService.do');
 for(const [k,v]of Object.entries({OC:env.LAW_OC,target,type:'JSON',...(id?{ID:String(id)}:{MST:String(mst),...(kind==='law'?{efYd:date8(chosen.시행일자)}:{})})}))detail.searchParams.set(k,v);
 const payload=await upstreamJSON(detail,env);
 const normalized=normalizeLaw(payload,{kind,name,effectiveDate:chosen.시행일자,current:true});
 if(!normalized.current||norm(normalized.name)!==norm(name))return json({ok:false,code:'NO_CURRENT_TEXT',message:'현행 원문 수신 없음',name});
 // 기관 문서로 사양 재확인할 곳: 자치법규 별표 제공 범위 제한. 별표 미제공 시 수치 추출 없음.
 return json({ok:true,law:normalized,source:publicSource('국가법령정보센터 '+name,`https://www.law.go.kr/${kind==='law'?'법령':'자치법규'}/${encodeURIComponent(norm(name))}`)});
}
async function terrain(path,env){
 const m=path.match(/^\/api\/terrain\/(\d{1,2})\/(\d+)\/(\d+)\.png$/);if(!m)return fail('INVALID_INPUT','타일 경로 오류');
 const [z,x,y]=m.slice(1).map(Number);if(z<12||z>14||x<0||y<0||x>=2**z||y>=2**z)return fail('INVALID_INPUT','허용 타일 범위 오류');
 const {bytes,contentType}=await upstream(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`,env);
 if(!contentType.includes('png')||bytes[0]!==137||bytes[1]!==80)throw new Error('UPSTREAM_FORMAT');
 return new Response(bytes,{headers:{'Content-Type':'image/png','Cache-Control':'public, max-age=86400','X-Content-Type-Options':'nosniff'}});
}
/* 같은 조회는 Cloudflare 무료 캐시에 저장해 기관 API 호출 수를 줄인다 (성공 응답만, 개인 정보 없음). */
async function cached(u,ttl,make){
 const cache=typeof caches!=='undefined'?caches.default:null;
 const key=new Request('https://cache.aom-law-review/'+u.pathname+'?'+[...u.searchParams].sort(([a],[b])=>a<b?-1:1).map(([k,v])=>encodeURIComponent(k)+'='+encodeURIComponent(v)).join('&'));
 if(cache){try{const hit=await cache.match(key);if(hit){const r=new Response(hit.body,hit);r.headers.set('X-Cache','HIT');return r;}}catch{}}
 const res=await make();
 if(cache&&res.ok){try{const body=await res.clone().text();if(/"ok":true/.test(body)){const store=new Response(body,{headers:{'Content-Type':res.headers.get('Content-Type')||'application/json; charset=utf-8','Cache-Control':'public, max-age='+ttl}});await cache.put(key,store);}}catch{}}
 return res;
}
export default {async fetch(request,env){
 const u=new URL(request.url);if(!u.pathname.startsWith('/api/'))return env.ASSETS.fetch(request);
 if(request.method!=='GET')return fail('METHOD_NOT_ALLOWED','GET 요청만 허용',405);
 if(!allowedOrigin(request,env))return fail('FORBIDDEN','동일 사이트 요청만 허용',403);
 if(!rateLimit(request))return fail('RATE_LIMIT','요청 횟수 제한',429);
 try{
  if(u.pathname==='/api/config')return json({ok:true,kakaoJsKey:env.KAKAO_JS_KEY||'',lawOc:env.LAW_OC||'',vworldKey:env.VWORLD_KEY||'',vworldDomain:env.VWORLD_DOMAIN||'',vworldBuildingLayer:env.VWORLD_BUILDING_LAYER||'',vworldFloorsField:env.VWORLD_BUILDING_FLOORS_FIELD||'',services:{kakao:configured(env,'KAKAO_REST_KEY'),building:configured(env,'DATA_GO_KR_KEY'),land:configured(env,'VWORLD_KEY'),law:configured(env,'LAW_OC')},eumTemplate:publicEumTemplate(env.EUM_PARCEL_URL_TEMPLATE),buildingLayer:!!env.VWORLD_BUILDING_LAYER});
  if(u.pathname==='/api/address')return await cached(u,86400*7,()=>address(u,env));
  if(u.pathname==='/api/nearby')return await cached(u,86400*7,()=>nearby(u,env));
  if(u.pathname==='/api/buildings')return await cached(u,86400,()=>buildings(u,env));
  if(u.pathname==='/api/land')return await cached(u,86400,()=>land(u,env));
  if(u.pathname==='/api/spatial')return await spatial(u,env);
  if(u.pathname==='/api/law')return await law(u,env);
  if(u.pathname.startsWith('/api/terrain/'))return await terrain(u.pathname,env);
  return fail('NOT_FOUND','경로 없음',404);
 }catch(e){const code=e?.name==='AbortError'?'UPSTREAM_TIMEOUT':String(e.message||'').startsWith('INVALID_')?e.message:/^(UPSTREAM_|LAW_SEARCH_|RESPONSE_)/.test(e.message||'')?e.message:'UPSTREAM_UNAVAILABLE';
  const r=fail(code,code.startsWith('INVALID_')?'입력 또는 설정 형식 오류':'기관 자료 수신 실패',code.startsWith('INVALID_')?400:502);if(code==='UPSTREAM_UNAVAILABLE'){const detail=String(e?.name||'')+': '+String(e?.message||'').replace(/[0-9a-f]{20,}/gi,'***').slice(0,160);return json({ok:false,code,message:'기관 자료 수신 실패',detail},502);}return r;}
}};
function publicEumTemplate(template){if(!template||!template.includes('{pnu}'))return '';try{const u=new URL(template.replace('{pnu}','4145011500104400002'));if(u.protocol==='https:'&&['eum.go.kr','www.eum.go.kr'].includes(u.hostname)&&!u.username&&!u.password)return template;}catch{}return '';}
