import {detailRows} from './legal-detail.js';
import {array,norm,number,currentByDate,kstToday,date8,datum,validLawURL,assertRowLinks,totalArea} from './core.js';
export const PLAN='국토의 계획 및 이용에 관한 법률';
export const DECREE=PLAN+' 시행령';
export const BLD='건축법', BD=BLD+' 시행령', PARK='주차장법', PD=PARK+' 시행령';
export const GREEN='개발제한구역의 지정 및 관리에 관한 특별조치법';
/** 인수인계서 기준값. 현행 원문 대조 성공 전에는 계산에 절대 사용하지 않는다. */
export const BASELINES={
 '제1종전용주거지역':[50,50,100],'제2종전용주거지역':[50,50,150],
 '제1종일반주거지역':[60,100,200],'제2종일반주거지역':[60,100,250],'제3종일반주거지역':[50,100,300],'준주거지역':[70,200,500],
 '중심상업지역':[90,200,1500],'일반상업지역':[80,200,1300],'근린상업지역':[70,200,900],'유통상업지역':[80,200,1100],
 '전용공업지역':[70,150,300],'일반공업지역':[70,150,350],'준공업지역':[70,150,400],
 '보전녹지지역':[20,50,80],'생산녹지지역':[20,50,100],'자연녹지지역':[20,50,100],
 '보전관리지역':[20,50,80],'생산관리지역':[20,50,80],'계획관리지역':[40,50,100],'농림지역':[20,50,80],'자연환경보전지역':[20,50,80]
};
export const ZONES=Object.keys(BASELINES);
export const USES=['단독주택','공동주택','제1종 근린생활시설','제2종 근린생활시설','문화 및 집회시설','종교시설','판매시설','운수시설','의료시설','교육연구시설','노유자시설','수련시설','운동시설','업무시설','숙박시설','위락시설','공장','창고시설','위험물 저장 및 처리 시설','자동차 관련 시설','동물 및 식물 관련 시설','자원순환 관련 시설','교정시설','국방ㆍ군사시설','방송통신시설','발전시설','묘지 관련 시설','관광 휴게시설','장례시설','야영장 시설'];
export const APPENDIX_BY_ZONE=Object.fromEntries(ZONES.map((z,i)=>[z,i+2]));
const NUM='([0-9][0-9,]*(?:\\.[0-9]+)?)';
function plain(v){return String(v??'').replace(/<br\s*\/?\s*>/gi,'\n').replace(/<[^>]+>/g,'').replace(/&nbsp;/g,' ').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/&quot;/g,'"');}
export function textContent(node) {
 if(node==null)return '';
 if(typeof node!=='object')return plain(node);
 if(Array.isArray(node))return node.map(textContent).filter(Boolean).join('\n');
 const keys=['조문내용','조내용','항내용','호내용','목내용','별표내용','내용','#text','항','호','목'];
 return keys.filter(k=>node[k]!=null).map(k=>textContent(node[k])).filter(Boolean).join('\n');
}
function walkObjects(obj,predicate,out=[]){if(!obj||typeof obj!=='object')return out;if(predicate(obj))out.push(obj);for(const v of Object.values(obj))if(typeof v==='object')walkObjects(v,predicate,out);return out;}
/** 법제처 JSON의 공식 필드만 읽음. 구조가 달라지면 조문을 만들지 않고 빈 배열 반환. */
export function normalizeLaw(payload,{kind='law',name='',effectiveDate='',retrievedAt=new Date().toISOString(),current=false}={}) {
 const root=payload?.법령||payload?.자치법규||payload;
 const info=root?.기본정보||root;
 const actualName=info?.법령명_한글||info?.법령명한글||info?.자치법규명||name;
 const effective=String(info?.시행일자||effectiveDate||'');
 const articles=walkObjects(root,x=>x.조문번호!==undefined&&(x.조문내용!==undefined||x.조내용!==undefined)).map(a=>({
   ...artNo(a),hang1:textContent([].concat(a.항||[])[0]||''),
   title:plain(a.조문제목||a.조제목||''),text:textContent(a),effectiveDate:String(a.조문시행일자||effective),
   isArticle:a.조문여부!=='N'&&a.조문여부!=='전문'
 })).filter(a=>a.isArticle && currentByDate(a.effectiveDate));
 const annexes=walkObjects(root,x=>x.별표번호!==undefined).map(a=>({number:String(+a.별표번호||a.별표번호),branch:+a.별표가지번호>0?String(+a.별표가지번호):'',title:plain(a.별표제목||''),text:textContent(a),file:String(a.별표첨부파일명||'')}));
 return {name:actualName,kind,effectiveDate:effective,retrievedAt,current:!!current&&currentByDate(effective),articles,annexes};
}
function artNo(a){let n=Array.isArray(a.조문번호)?a.조문번호[0]:a.조문번호;n=String(n??'');if(/^\d{6}$/.test(n))return {number:String(+n.slice(0,4)),branch:+n.slice(4)>0?String(+n.slice(4)):''};return {number:String(+n||n),branch:+a.조문가지번호>0?String(+a.조문가지번호):''};}
export function lawLink(name,article='',kind='law',branch='') {
 const slug=encodeURIComponent(norm(name));
 return `https://www.law.go.kr/${kind==='ordin'?'자치법규':'법령'}/${slug}${article?'/제'+article+'조'+(branch?'의'+branch:''):''}`;
}
export function getLaw(laws,name){return laws.find(l=>norm(l.name)===norm(name)&&l.current&&currentByDate(l.effectiveDate))||null;}
export function getArticle(law,no,branch=''){return law?.articles?.find(a=>a.number===String(no)&&a.branch===String(branch)&&currentByDate(a.effectiveDate))||null;}
export function reference(laws,name,no='',kind='law',branch='') {
 const law=getLaw(laws,name),a=no?getArticle(law,no,branch):null;
 return {name,article:no?`제${no}조${branch?'의'+branch:''}`:'',url:lawLink(name,no,kind,branch),effectiveDate:a?.effectiveDate||law?.effectiveDate||'',current:!!law&&(!no||!!a)};
}
export function jurisdiction(location,address='') {
 const region=location?.region1||address.split(/\s+/)[0]||'';
 const names={'서울':'서울특별시','부산':'부산광역시','대구':'대구광역시','인천':'인천광역시','광주':'광주광역시','대전':'대전광역시','울산':'울산광역시','세종':'세종특별자치시','제주':'제주특별자치도'};
 const metro=Object.entries(names).find(([k])=>region.startsWith(k));
 if(metro)return metro[1];
 return (location?.region2||address.split(/\s+/)[1]||'').match(/^([^\s]+[시군])/u)?.[1]||'';
}
export function lawNamesFor(p) {
 const zones=p.land.zones.map(z=>z.name).join(' '), set=new Set([PLAN,DECREE,BLD,BD,PARK,PD,'토지이용규제 기본법']);
 if(['전','답','과수원'].includes(p.land.category.value)){set.add('농지법');set.add('농지법 시행령');set.add('농지법 시행규칙');}
 if(p.land.category.value==='임야')set.add('산지관리법');
 if(zones.includes('개발제한구역')){set.add(GREEN);set.add(GREEN+' 시행령');set.add(GREEN+' 시행규칙');}
 for(const z of p.land.zones){const match=zoneBasis(z.name);if(z.lawName)set.add(z.lawName);else if(match)set.add(match[0]);}
 return [...set];
}
/** 첫 항 본문/호에서 정확히 일치하는 지역 행만 추출. 조건부·복수 수치는 자동 채택하지 않음. */
export function extractRatio(text,zone,range=false,district=false) {
 const lines=plain(text).replace(/([^\d\s])(\d{1,2}\.\s)/g,'$1\n$2').replace(/([①-⑳])/g,'\n$1').replace(/(\d+)\s*천\s*(\d{0,3})(?=\s*퍼센트)/g,(m,a,b)=>String(+a*1000+(+b||0))).split(/\n|(?=\s\d+\.\s)/).map(s=>s.trim()).filter(Boolean);
 const target=norm(zone); const matches=[];
 for(const line of lines){
  const clean=norm(line); const idx=clean.indexOf(target);
  if(idx<0||!target)continue;
  const tail=clean.slice(idx+target.length);
  // 동일 행에 다른 용도지역/특례가 섞이면 모호함.
  if(ZONES.some(z=>z!==zone&&tail.includes(norm(z))))continue;
  // '240퍼센트 (단, 지구단위계획: 250퍼센트)' 형식: 기본값과 지구단위계획구역 값을 구분해 읽음
  const dm=!range&&tail.match(new RegExp('^[:：ㆍ·\\-]?'+NUM+'(?:퍼센트|%)(?:이하)?\\(단,?지구단위계획(?:구역)?(?:안)?(?:의경우)?[:：]?'+NUM+'(?:퍼센트|%)(?:이하)?\\)'));
  if(dm){matches.push(number(district?dm[2]:dm[1]));continue;}
  if(/다만|경우|특례|완화|인센티브|정비사업|지구단위/.test(tail))continue;
  if(/^[:：ㆍ·\-]?[\d,.]+(?:퍼센트|%)(?:이하)?\(단/.test(tail))continue;   // '(단, 서울도심: …)' 등 지역 단서는 자동 채택하지 않음
  const pattern=range?new RegExp('^[:：ㆍ·\-]?'+NUM+'퍼센트이상'+NUM+'퍼센트이하'):new RegExp('^[:：ㆍ·\-]?'+NUM+'(?:퍼센트|%)(?:이하)?(?!이상|초과)(?:$|[^\\d])');
  const m=tail.match(pattern);if(m)matches.push(number(m[range?2:1]));
 }
 const vals=[...new Set(matches.filter(v=>v!==null&&v>=0&&v<=3000))];return vals.length===1?vals[0]:null;
}
function ratioFrom(law,zone,type,district=false) {
 if(!law?.current)return null;
 const patterns=type==='bcr'?/용도지역.*건폐율/:/용도지역.*용적률/;
 const articles=law.articles.filter(a=>patterns.test(norm(a.title))&&!/완화|특례|예외/.test(norm(a.title)));
 const result=[];
 for(const a of articles){
  const val=extractRatio((a.hang1||a.text).split(/②/)[0],zone,false,district);
  if(val!==null)result.push({value:val,article:a});
  // 별표 본문이 실제로 제공된 경우에만 사용. 이미지/PDF 별표의 숫자는 추정하지 않음.
  for(const m of a.text.matchAll(/별표\s*(\d+)(?:의\s*(\d+))?/g)){
   const annex=law.annexes.find(x=>x.number===String(+m[1])&&x.branch===String(m[2]?+m[2]:''));
   const av=annex?extractRatio(annex.text,zone,false,district):null;if(av!==null)result.push({value:av,article:a,annex:annex.number});
  }
 }
 if(!result.length||new Set(result.map(r=>r.value)).size!==1)return null;return result[0];
}
function ordinances(p){const j=jurisdiction(p.location,p.address);return {j,plan:p.laws.find(l=>l.kind==='ordin'&&l.current&&norm(l.name).startsWith(norm(j))&&/도시.*계획조례|군계획조례/.test(norm(l.name))),building:p.laws.find(l=>l.kind==='ordin'&&l.current&&norm(l.name).startsWith(norm(j))&&/건축조례/.test(norm(l.name))),parking:p.laws.find(l=>l.kind==='ordin'&&l.current&&norm(l.name).startsWith(norm(j))&&/주차장/.test(norm(l.name)))};}
function localRef(p,law,fallback,titlePattern){const a=law?.articles.find(a=>titlePattern.test(norm(a.title)));return reference(p.laws,law?.name||fallback,a?.number||'','ordin',a?.branch||'');}
export function resolveRatios(p){
 const zone=p.land.zone.value, o=ordinances(p), d=getLaw(p.laws,DECREE), district=p.manual.district||p.land.zones.some(z=>z.name.includes('지구단위계획'));
 const out={bcr:datum(),far:datum(),district,upperBcr:null,upperFar:null};
 for(const [type,no,baseIndex] of [['bcr',84,0],['far',85,2]]){
  const a=getArticle(d,no), upper=a?extractRatio(a.hang1||a.text,zone,type==='far'):null;out[type==='bcr'?'upperBcr':'upperFar']=upper;
  const loc=ratioFrom(o.plan,zone,type), baseline=BASELINES[zone]?.[baseIndex];
  if(district&&(!p.manual.districtResolved||number(p.manual[type])===null)){out[type]=datum(loc&&upper!==null&&loc.value<=upper?loc.value:(upper??null),'조례 기준 가정치 · 지구단위계획 시행지침 우선 적용',true);out[type].provisional=true;out[type].local=loc;out[type].upper=upper;out[type].baseline=baseline;continue;}
  if(number(p.manual[type])!==null){out[type]=datum(number(p.manual[type]),'사용자 입력',true);out[type].local=loc;out[type].upper=upper;out[type].baseline=baseline;continue;}
  if(loc && upper!==null && loc.value<=upper)out[type]=datum(loc.value,o.plan.name,loc.value!==undefined&&upper!==baseline);
  else if(upper!==null)out[type]=datum(upper,`${DECREE} 제${no}조 상한`,true);
  out[type].local=loc;out[type].upper=upper;out[type].baseline=baseline;
 }
 return out;
}
function extractSingle(text,regex){const values=[...String(text).matchAll(regex)].map(m=>number(m[1])).filter(v=>v!==null);return new Set(values).size===1?values[0]:null;}
export function extractNorth(law){const a=getArticle(law,86);if(!a)return null;const s=norm(a.text);const low=s.match(new RegExp('높이'+NUM+'미터이하인부분[^\n]*?'+NUM+'미터이상'));
 const high=s.match(new RegExp(NUM+'미터를?초과(?:하는)?부분[^\n]*?높이의([0-9]+)분의([0-9]+)이상'));
 if(!low||!high||number(low[1])!==number(high[1]))return null;
 return {threshold:number(low[1]),low:number(low[2]),slope:number(high[3])/number(high[2]),ref:a};}
function specialRate(law,titlePattern,purpose,unitPattern){
 if(!law?.current)return null;const vals=[];
 for(const a of law.articles.filter(a=>titlePattern.test(norm(a.title)))){
  const pieces=[a.text];for(const m of a.text.matchAll(/별표\s*(\d+)(?:의\s*(\d+))?/g)){const an=law.annexes.find(x=>x.number===String(+m[1])&&x.branch===(m[2]?String(+m[2]):''));if(an?.text)pieces.push(an.text);}
  for(const piece of pieces)for(const line of piece.split('\n')){
   if(purpose&&!norm(line).includes(norm(purpose)))continue;
   if(/다만|경우|미만|초과|이상|이하/.test(line)&&/연면적|대지면적|세대|층/.test(line))continue;
   const val=extractSingle(norm(line),unitPattern);if(val!==null)vals.push({value:val,article:a});
  }
 }
 return vals.length&&new Set(vals.map(x=>x.value)).size===1?vals[0]:null;
}
const kn=t=>String(t).replace(/(\d+)천(\d+)?/g,(_,a,b)=>String(+a*1000+(b?+b:0))).replace(/,/g,'');
/** 「주차장법 시행령」 별표1 표에서 예정 용도 행의 '시설면적 N㎡당 1대'. */
export function nationalParking(law,purpose){const an=law?.annexes?.find(a=>a.number==='1'&&!a.branch);if(!an?.text||!purpose)return null;const key=norm(purpose).replace(/^제[12]종/,m=>m);const rows=an.text.split(/\n[┠┣├][─━┼┿╂]+[┨┫┤]?/);for(const r of rows){const L=[],R=[];for(const line of r.split('\n')){const m=line.match(/^\s*┃(.*?)│(.*?)┃\s*$/);if(m){L.push(m[1].trim());R.push(m[2].trim());}}const left=norm(L.join('')),right=norm(R.join(''));if(!left)continue;const ek=key.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const hit=left.includes(key)&&!new RegExp('[(\\[][^)\\]]*'+ek+'[^)\\]]*(?:은|는)제외').test(left);if(!hit)continue;const rowNo=(L.join(' ').match(/^(\d+)\./)||[])[1];const hm=right.match(/시설면적(\d+)(?:㎡|m2)초과(\d+)(?:㎡|m2)이하:1대.*?(\d+)(?:㎡|m2)를초과하는(\d+)(?:㎡|m2)당1대/);if(hm)return{house:{min:+hm[1],base:+hm[2],step:+hm[4]},row:rowNo?rowNo+'호':''};const u=[...right.matchAll(/시설면적(\d+(?:\.\d+)?)(?:㎡|m2)당1대/g)].map(x=>+x[1]);if(u.length===1)return{unit:u[0],row:(L.join(' ').match(/^(\d+)\./)||[])[1]?L.join(' ').match(/^(\d+)\./)[1]+'호':''};return null;}return null;}

/** 자치법규(주차장 조례) 별표 「부설주차장 설치기준」 표에서 예정 용도 행의 기준. 첨부 HWP에서 읽은 글자 기준.
    행 구분: 줄 머리의 일련번호(1., 2., …)가 1씩 늘어나는 곳. 반환 형식은 nationalParking과 같음. */
export function ordinanceParking(law,purpose){
 if(!law?.current||!purpose)return null;
 const an=law.annexes.find(a=>/부설주차장/.test(a.title||'')&&/설치기준/.test(a.title||'')&&a.text);if(!an)return null;
 const lines=an.text.split('\n');const rows=[];let want=1,cur=null;
 for(const line of lines){const m=line.match(/^\s*(\d+)\.\s*\S/);if(m&&+m[1]===want){cur={no:want,text:line};rows.push(cur);want++;continue;}if(/〔비고〕|\[비고\]|^\s*비고/.test(line))break;if(cur)cur.text+='\n'+line;}
 const key=norm(purpose),ek=key.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 for(const r of rows){const t=norm(r.text);const head=t.split(/시설면적|세대당|1홀당|「주택건설/)[0];
  if(!head.includes(key)||new RegExp('[(\\[][^)\\]]*'+ek+'[^)\\]]*(?:은|는)제외').test(head))continue;
  const hm=t.match(/시설면적(\d+)(?:㎡|m2)초과(\d+)(?:㎡|m2)이하:1대.*?(\d+)(?:㎡|m2)를초과하는(\d+)(?:㎡|m2)당1대/);if(hm)return{house:{min:+hm[1],base:+hm[2],step:+hm[4]},row:r.no+'호',ordinance:true};
  const u=[...t.matchAll(/시설면적(\d+(?:\.\d+)?)(?:㎡|m2)당1대/g)].map(x=>+x[1]);if(u.length)return{unit:u[0],row:r.no+'호',ordinance:true,exception:u.length>1};
  return null;}
 return null;
}
/** 건축조례 조경 조항의 연면적 구간별 비율. 연면적은 법정 최대 연면적(가정)으로 판정. */
export function landscapeTier(law,gross,site=null){if(!law?.current||gross==null)return null;for(const a of law.articles.filter(a=>/조경/.test(norm(a.title||'')))){const all=kn(norm(a.text));if(site!=null){for(const m of all.matchAll(/면적(\d+)제곱미터이상(\d+)제곱미터미만인대지에건축하는건축물의조경면적은대지면적의(\d+(?:\.\d+)?)(?:%|퍼센트)/g))if(site>=+m[1]&&site<+m[2])return{lo:0,hi:Infinity,value:+m[3],article:a,gross,small:[+m[1],+m[2]]};}const t=kn(norm(a.text).split('②')[0]);const tiers=[];for(const m of t.matchAll(/연면적(?:\([^)]*\))?(?:이)?(\d+)제곱미터(이상|미만)(?:(\d+)제곱미터미만)?인건축물:대지면적의(\d+(?:\.\d+)?)(?:%|퍼센트)/g)){const lo=m[2]==='이상'?+m[1]:0,hi=m[2]==='미만'?+m[1]:(m[3]?+m[3]:Infinity);tiers.push({lo,hi,value:+m[4]});}const hit=tiers.filter(x=>gross>=x.lo&&gross<x.hi);if(hit.length===1)return{...hit[0],article:a,gross,tiers};}return null;}
const boxClean=t=>String(t||'').replace(/[┃│┠┨─┼━┏┓┗┛┯┷╂┿┣┫├┤]/g,' ');
/** 법령 원문에서 층수·연면적 상한 추출(개발제한구역 시행령 별표2, 용도지역별 건축제한 별표 머리글). */
export function legalHeight(p,purpose){const out=[];const zones=p.land.zones.map(z=>z.name).join(' ');
 if(zones.includes('개발제한구역')){const law=getLaw(p.laws,GREEN+' 시행령'),an=law?.annexes?.find(a=>a.number==='2'&&!a.branch);const t=norm(boxClean(an?.text));const i=t.indexOf('2.건축물의건축또는공작물의설치');if(i>=0){const s=t.slice(i,i+1600);const g=s.match(/건폐율100분의(\d+)이하로건축하되높이(\d+)층이하,?용적률(\d+)퍼센트이하/);const h=s.match(/1\)건폐율100분의(\d+)이하로건축하는경우:높이(\d+)층이하,?용적률(\d+)퍼센트이하로서기존면적을포함하여연면적(\d+)제곱미터/);const houseLike=!purpose||/주택|근린생활/.test(purpose);
  if(houseLike&&h)out.push({floors:+h[2],gross:+h[4],bcr:+h[1],far:+h[3],ref:{name:GREEN+' 시행령',annex:2},text:`[「개발제한구역법 시행령」 별표2 제2호나목] 주택·근린생활시설 : 건폐율 ${h[1]}% 이하, 높이 ${h[2]}층 이하, 용적률 ${h[3]}% 이하, 기존 면적 포함 연면적 ${h[4]}㎡ 이하${purpose?'':' (주용도 미선택 — 주택·근린생활시설 가정)'}`});
  else if(g)out.push({floors:+g[2],gross:null,bcr:+g[1],far:+g[3],ref:{name:GREEN+' 시행령',annex:2},text:`[「개발제한구역법 시행령」 별표2 제2호가목] 건폐율 ${g[1]}% 이하, 높이 ${g[2]}층 이하, 용적률 ${g[3]}% 이하`});
  out.push({floors:null,gross:null,text:'개발제한구역 : 별표1의 허용 건축물·입지 요건(지정 당시 지목 대, 기존 주택 등)에 해당하는 경우에만 건축 가능'});}
  else out.push({floors:null,gross:null,text:'개발제한구역 시행령 별표2 원문 미수신 — 층수·연면적 상한 미반영'});}
 const zone=p.land.zone.value,no=APPENDIX_BY_ZONE[zone],an=getLaw(p.laws,DECREE)?.annexes?.find(a=>a.number===String(no)&&!a.branch);
 if(an?.text){const T=norm(boxClean(an.text)),head=T.split(/1\.(?=[가-힣「])/)[0];const m=[...head.matchAll(/(\d+)층이하/g)].map(x=>+x[1]);const k=T.search(/1\.건축할수있는건축물[(\[]/);if(k>=0){const f1=T.slice(k,k+160).match(/^1\.건축할수있는건축물[(\[](\d+)층이하/);if(f1)m.push(+f1[1]);}if(m.length)out.push({floors:Math.min(...m),gross:null,text:`[「국토계획법 시행령」 제71조 별표${no}] ${zone} 안에서 건축할 수 있는 건축물 : ${Math.min(...m)}층 이하`});}
 const fl=out.map(x=>x.floors).filter(x=>x>0),gr=out.map(x=>x.gross).filter(x=>x>0);
 const gb=out.find(x=>x.bcr!=null&&x.far!=null);return {floors:fl.length?Math.min(...fl):null,gross:gr.length?Math.min(...gr):null,gb:gb?{bcr:gb.bcr,far:gb.far,gross:gb.gross}:null,lines:out.map(x=>x.text)};}
const fmt0=v=>Number(v).toLocaleString('ko-KR');
function zoneBasis(name){
 const map=[[/개발제한구역/,GREEN,12],[/군사|비행안전|대공방어/,'군사기지 및 군사시설 보호법',13],
 [/문화유산|문화재|역사문화환경/,'문화유산의 보존 및 활용에 관한 법률',13],[/자연유산/,'자연유산의 보존 및 활용에 관한 법률',10],
 [/상수원보호/,'수도법',7],[/하천/,'하천법',33],[/가축사육제한/,'가축분뇨의 관리 및 이용에 관한 법률',8],
 [/교육환경보호/,'교육환경 보호에 관한 법률',9],[/고도지구|경관지구|방화지구|방재지구|보호지구|취락지구|개발진흥지구|특정용도제한지구|복합용도지구/,PLAN,76]];
 return map.find(([re])=>re.test(name))?.slice(1)||null;
}
export function shortLaw(name){return name.replace(DECREE,'국토계획법 시행령').replace(PLAN,'국토계획법').replace(GREEN,'개발제한구역법');}

/* 항목별 결론 한 줄 (이 대지 기준 수치). 법령 일반 기준은 조문 그대로의 대표 수치만 사용. */
function addSummaries(p,rows,L){
 const f=v=>v==null||!Number.isFinite(Number(v))?null:Math.round(Number(v)*100)/100;const F=v=>f(v)==null?'-':f(v).toLocaleString('ko-KR');
 const rw=number(p.manual?.roadWidth),road=p.land?.road?.value||'';
 const S={
  bcr:()=>L.bcr?.value!=null?(L.maxFootprint!=null?`건폐율 ${L.bcr.value}% 이하 → 건축면적 최대 ${F(L.maxFootprint)} ㎡ (대지 ${F(L.area)} ㎡ × ${L.bcr.value}%)`:`건폐율 ${L.bcr.value}% 이하 (대지면적 미수집으로 면적 산정 불가)`):'건폐율 산정 불가 — 용도지역 또는 조례 수치 미확인',
  far:()=>{if(L.far?.value==null)return '용적률 산정 불가 — 용도지역 또는 조례 수치 미확인';const byFar=L.area!=null?L.area*L.far.value/100:null;return L.grossCapped&&byFar!=null&&L.maxGross!=null&&L.maxGross<byFar-0.01?`용적률 ${L.far.value}% 이하 (용적률만으로는 ${F(byFar)} ㎡) · ${L.grossCapReason||'별도 연면적 상한'} 적용 → 지상 연면적 최대 ${F(L.maxGross)} ㎡`:`용적률 ${L.far.value}% 이하 → 지상 연면적 최대 ${F(L.maxGross)} ㎡${L.area!=null?` (대지 ${F(L.area)} ㎡ × ${L.far.value}%)`:''}`;},
  use:r=>r.text?`${p.purpose} : 허용 용도 목록에 있음${r.uncertain?' (조건부 — 조건 대조)':''}`:`${p.purpose||'주용도'} : 허용 여부를 별표에서 판정하지 못함`,
  road:()=>`너비 4 m 이상 도로에 2 m 이상 접해야 함 (연면적 2,000 ㎡ 이상은 6 m 도로에 4 m 이상)${road?` · 현황 : ${road}`:''}`,
  deadend:()=>'막다른 도로 길이 10 m 미만 → 너비 2 m, 10~35 m → 3 m, 35 m 이상 → 6 m (도시지역 밖 읍·면 4 m)',
  buildingLine:()=>rw!=null?(rw<4?`도로 너비 ${rw} m (4 m 미만) → 도로 중심선에서 2 m 후퇴한 선이 건축선 (대지 쪽 ${F(2-rw/2)} m 후퇴)`:`도로 너비 ${rw} m (4 m 이상) → 대지와 도로의 경계선이 건축선`):'도로 너비 4 m 이상이면 도로 경계선이 건축선, 4 m 미만이면 도로 중심선에서 2 m 후퇴한 선이 건축선',
  sunlight:()=>{const n=number(p.floors),H=n>0?4.3+(n-1)*3.3:null;return '정북 쪽 인접 대지경계선에서 높이 10 m 이하 부분 1.5 m 이상, 10 m 초과 부분은 그 높이의 1/2 이상 이격'+(H!=null?` → 지상 ${n}층 높이 약 ${F(H)} m 가정 시 최상부 ${H>10?F(H/2):'1.5'} m 이상`:'');},
  landscape:()=>L.landscapeExempt?'조경 의무 면제 대상':L.landscape!=null?`대지면적의 ${L.landscape}% 이상 조경 → ${L.landscapeArea!=null?F(L.landscapeArea)+' ㎡ 이상 (대지 '+F(L.area)+' ㎡ × '+L.landscape+'%)':'대지면적 미수집으로 면적 산정 불가'}`:'대지면적 200 ㎡ 이상이면 조경 설치 — 조례 비율 미확인으로 면적 산정 불가',
  setback:()=>'건축선·인접 대지경계선에서 띄울 거리는 용도·규모별로 조례에서 정함 (시행령 별표 2 범위)',
  parking:()=>L.parking!=null?(L.parkingHow?`${L.parkingHow} → 부설주차장 ${F(L.parking)}대 이상 (0.5 이상 1대, 1대 미만 0대 · ${L.parkingBasis||'설치기준'})`:`부설주차장 ${F(L.parking)}대 이상 (${L.parkingBasis||'설치기준'})`):'주용도·시설면적이 정해지면 설치기준으로 대수 산정',
  district:()=>'지구단위계획 시행지침의 용도·건폐율·용적률·높이·건축선이 우선 적용',
  development:()=>'형질변경·토지분할 등을 수반하면 개발행위허가 필요 (건축허가 시 의제 처리)'
 };
 for(const r of rows){const g=S[r.id];if(g){try{r.summary=g(r)||'';}catch{r.summary='';}}}
}
export function reviewProject(p){
 const rows=[],sanctions=[],limits=resolveRatios(p),o=ordinances(p),area=totalArea(p),purpose=p.purpose;
 const R=(name,no='',kind='law',branch='')=>reference(p.laws,name,no,kind,branch);
 const local=(type,pattern)=>localRef(p,o[type],`${o.j||'해당 지방자치단체'} ${type==='plan'?'도시계획 조례':type==='building'?'건축 조례':'주차장 설치 및 관리 조례'}`,pattern);
 const add=(id,item,refs,text='',target='',uncertain=true,extra={})=>{const verified=refs.every(x=>x.current);rows.push({id,item,group:shortLaw(refs[0].name)+' '+refs[0].article,refs,text,target,verified,uncertain:uncertain||!verified,judgment:p.judgments[id]||'',...extra});};
 const articleText=(name,no,branch='')=>getArticle(getLaw(p.laws,name),no,branch)?.text||'';
 if(limits.district)add('district','지구단위계획',[R(PLAN,54)],'지구단위계획 시행지침 우선 적용','',true);
 for(const [type,item,no,lawNo]of[['bcr','건폐율',84,77],['far','용적률',85,78]]){
  const v=limits[type]; const refs=[R(DECREE,no),R(PLAN,lawNo),local('plan',type==='bcr'?/용도지역.*건폐율/:/용도지역.*용적률/)];
  const txt=v.value!==null?`적용값 ${v.value}퍼센트 이하${v.upper!==null&&v.upper!==undefined?` / 시행령 상한 ${v.upper}퍼센트`:''}`:'';
  add(type,item,refs,txt,p.land.zone.value||'',v.uncertain||p.land.zone.uncertain||limits.district,{value:v.value});
 }
 if(purpose){
  const law=getLaw(p.laws,DECREE), an=law?.annexes.find(a=>a.number===String(APPENDIX_BY_ZONE[p.land.zone.value])&&!a.branch);
  let text='',uncertain=true;
  // 독립된 무조건 허용 항목만 긍정 판정. 단순 키워드 일치/불일치를 허용·금지로 바꾸지 않음.
  if(an?.text){const head=an.text.split(/2\.?\s*도시[ㆍ·]?군계획조례|2\.?\s*도시계획조례/)[0];
   const line=head.split('\n').find(s=>norm(s).includes(norm(purpose)));
   if(line){text=line;uncertain=/제외|한정|이하|이상|미만|초과|경우|조례|범위/.test(line)||!!limits.district||p.land.zone.uncertain;}
  }
  add('use','허용 용도',[R(DECREE,71),local('plan',/건축.*제한|용도지역/)],text,purpose,uncertain,{annex:an?.number||APPENDIX_BY_ZONE[p.land.zone.value]||''});
 }
 add('road','대지와 도로의 관계',[R(BLD,44)],articleText(BLD,44),[p.land.road.value,number(p.manual.frontage)!==null?`입력 접도길이 ${p.manual.frontage}m`:''].filter(Boolean).join(' / '),true);
 if(p.land.road.value?.includes('맹지'))rows.at(-1).text='도로에 접하지 않는 대지. '+rows.at(-1).text;
 add('deadend','도로의 지정·막다른 도로',[R(BLD,2),R(BD,3,'law',3)],articleText(BD,3,'3'),[number(p.manual.deadEndLength)!==null?`입력 막다른 길이 ${p.manual.deadEndLength}m`:'',p.manual.rural?'입력 도시지역 밖 읍·면':''].filter(Boolean).join(' / '),true);
 add('buildingLine','건축선',[R(BLD,46)],articleText(BLD,46),[number(p.manual.roadWidth)!==null?`입력 도로 너비 ${p.manual.roadWidth}m`:'',number(p.manual.roadSetback)!==null?`입력 후퇴 ${p.manual.roadSetback}m`:''].filter(Boolean).join(' / '),true);
 const residential=/전용주거|일반주거/.test(p.land.zone.value||'');
 if(residential)add('sunlight','일조 등의 확보를 위한 높이 제한',[R(BLD,61),R(BD,86),local('building',/일조|높이/)],articleText(BD,86),'전용·일반주거지역',true);
 const landscapeThreshold=extractSingle(norm(articleText(BLD,42)),/면적이([0-9,]+(?:\.[0-9]+)?)(?:제곱미터|㎡)이상/g);
 const landscapeApplies=area===null||landscapeThreshold===null||area>=landscapeThreshold;
 if(landscapeApplies){
  add('landscape','대지의 조경',[R(BLD,42),R(BD,27),local('building',/조경/)],articleText(BLD,42),area===null?'':`${area}㎡`,true);
 }
 add('setback','대지 안의 공지',[R(BLD,58),R(BD,80,'law',2),local('building',/대지안의공지/)],articleText(BLD,58),purpose,true);
 add('parking','부설주차장',[R(PARK,19),R(PD,6),local('parking',/설치기준|부설주차장/)],articleText(PARK,19),purpose,true);
 const restrictedHeight=p.land.zones.filter(z=>/고도지구|비행안전|지구단위계획|대공방어|경관지구/.test(z.name));
 { const LH0=legalHeight(p,purpose); if(LH0.lines.length||restrictedHeight.length){ add('legalHeight','건축물 높이·층수',[R(PLAN,76),...(p.land.zones.some(z=>z.name.includes('개발제한구역'))?[R(GREEN+' 시행령',13)]:[])],[...LH0.lines,...restrictedHeight.map(z=>z.name+' : 지정 내용의 높이 기준 별도 적용')].join('\n'),LH0.floors?`${LH0.floors}층 이하`:'',true); } }
 if(restrictedHeight.length)add('height','높이·층수 제한',[R(BLD,60),R(BLD,61),R(PLAN,54)],'',restrictedHeight.map(x=>x.name).join(', '),true);
 const development=/녹지|관리|농림/.test(p.land.zone.value||'')||p.manual.grading;
 if(development)add('development','개발행위허가',[R(PLAN,56)],articleText(PLAN,56),'',true);
 const farmland=['전','답','과수원'].includes(p.land.category.value), forest=p.land.category.value==='임야',green=p.land.zones.some(z=>z.name.includes('개발제한구역'));
 if(farmland)add('farmland','농지전용',[R('농지법',34)],articleText('농지법',34),p.land.category.value,true);
 if(forest)add('forest','산지전용',[R('산지관리법',14)],articleText('산지관리법',14),'임야',true);
 if(green)add('greenbelt','토지의 형질변경 · 행위제한',[R(GREEN,12),R(GREEN+' 시행령',13)],articleText(GREEN,12),'개발제한구역',true);
 if(green){
  const flat=t=>String(t||'').replace(/[┃│┠┨─┼━┏┓┗┛┯┷╂┿┣┫├┤]/g,' ').replace(/\s+/g,' ').trim();
  const cut=(t,start,len=700,end=null)=>{t=flat(t);const i=t.search(start);if(i<0)return '';let s=t.slice(i,i+len);if(end){const j=s.slice(20).search(end);if(j>0)s=s.slice(0,j+20);}return s.trim();};
  const GD=GREEN+' 시행령',GR=GREEN+' 시행규칙',gl=getLaw(p.laws,GD),an=n=>gl?.annexes?.find(a=>a.number===String(n)&&!a.branch)?.text||'';
  const a2=an(2),a1=an(1);
  const ratio=cut(a2,/나\.\s*가목에도 불구하고 주택 또는 근린생활시설/,900,/\s다\.\s/);
  add('gb-ratio','건폐율 및 용적률 (개발제한구역)',[R(GD,22)],ratio||'시행령 별표2 원문 미수신',green?'적용':'',true);
  const gArea=cut(a2,/주택 또는 근린생활시설의 건축을 위하여 대지를 조성하는 경우/,260,/\s\d\)\s|\s[가-하]\.\s/);
  add('gb-grading-area','형질변경 면적',[R(GD,22)],gArea||'시행령 별표2 형질변경 면적 원문 자동 추출 불가',gArea.match(/(\d+)\s*제곱미터 이하/)?.[1]?gArea.match(/(\d+)\s*제곱미터 이하/)[1]+'제곱미터 이하':'',true);
  const a14=cut(articleText(GD,14),/9\.\s*다음 각 목의 어느 하나에 해당하는 시설의 진입로/,700,/\s10\.\s/);
  add('gb-road','건축물의 건축을 수반하지 않는 토지의 형질변경 범위 (진입로)',[R(GD,14)],a14||flat(articleText(GD,14)).slice(0,500),'진입로 설치 시',true);
  const r6=flat(getArticle(getLaw(p.laws,GR),6)?.text||'');
  add('gb-site','주택·근린생활시설 신축 입지기준',[R(GR,6)],r6?r6.slice(0,800):'시행규칙 원문 미수신','이축·공익사업 철거 등 해당 시',true);
  const fa1=flat(a1);const hasH=/다\.\s*주택/.test(fa1),hasS=/라\.\s*근린생활시설/.test(fa1);const shopNames=['슈퍼마켓 및 일용품소매점','휴게음식점ㆍ제과점 및 일반음식점','이용원ㆍ미용원 및 세탁소','의원ㆍ치과의원ㆍ한의원','탁구장 및 체력단련장','기원','당구장','금융업소ㆍ사무소 및 부동산중개사무소','목공소ㆍ방앗간 및 독서실','사진관ㆍ표구점ㆍ학원','장의사','동물병원','안마원','지역아동센터'].filter(n=>norm(fa1).includes(norm(n.split('ㆍ')[0].split(' 및 ')[0])));
  add('gb-use','허용 용도 (개발제한구역)',[R(GD,13)],a1?[hasH?'[별표1 제5호다목] 주택(「건축법 시행령」 별표1 제1호가목 단독주택) : 개발제한구역 지정 당시부터 지목이 대인 토지 또는 기존 주택이 있는 토지에만 신축':'',hasS?'[별표1 제5호라목] 근린생활시설 : '+(shopNames.length?shopNames.join(', '):'별표 목록 대조')+' (휴게음식점·제과점·일반음식점은 5년 이상 거주자 또는 지정 당시 거주자)':''].filter(Boolean).join('\n'):'시행령 별표1 원문 미수신','적용',true);
  const a18=flat(articleText(GD,18));const park=cut(a18,/③/,400,/\s④/);
  add('gb-change','용도변경 · 주차장 부지',[R(GD,18)],[a18.slice(0,600),park].filter(Boolean).join('\n'),'용도변경 시',true);
 }
 for(const [i,z]of p.land.zones.entries()){
  if(ZONES.includes(z.name)||/^(도시지역|관리지역)$/.test(z.name)||/개발제한구역|지구단위계획/.test(z.name))continue;
  const basis=zoneBasis(z.name);const name=z.lawName||basis?.[0]||'토지이용규제 기본법',no=z.article||basis?.[1]||8;
  add('zone-'+i,z.name,[R(name,no)],z.restriction||articleText(name,no),'',true);
 }
 const penal=(id,label,refs)=>sanctions.push({id,item:label,refs,text:refs.map(r=>`${r.name} ${r.article}`).join(' / '),uncertain:refs.some(r=>!r.current)});
 penal('s-permit','허가·신고 없이 건축, 허가 내용과 다르게 건축',[R(BLD,11),R(BLD,14),R(BLD,79),R(BLD,80),...[108,109,110,111].map(n=>R(BLD,n))]);
 penal('s-ratio','건폐율·용적률·높이 초과',[...[55,56,60,61,79,80].map(n=>R(BLD,n))]);
 if(purpose)penal('s-use','용도지역 내 허용되지 않는 용도',[R(PLAN,76),R(PLAN,133),R(PLAN,140)]);
 if(p.operation==='용도변경')penal('s-change','무단 용도변경',[R(BLD,19),R(BLD,79),R(BLD,80)]);
 if(development)penal('s-dev','개발행위허가 없이 형질변경',[R(PLAN,56),R(PLAN,60),R(PLAN,140)]);
 if(farmland)penal('s-farm','무단 농지전용',[R('농지법',34),R('농지법',42),...penaltyRefs(p,'농지법')]);
 if(forest)penal('s-forest','무단 산지전용',[R('산지관리법',14),R('산지관리법',44),...penaltyRefs(p,'산지관리법')]);
 if(green)penal('s-green','개발제한구역 내 위반 행위',[R(GREEN,12),R(GREEN,30),R(GREEN,30,'law',2),...penaltyRefs(p,GREEN)]);
 if(purpose)penal('s-park','부설주차장 미설치·용도 외 사용',[R(PARK,19),R(PARK,19,'law',4),...penaltyRefs(p,PARK)]);
 if(landscapeApplies)penal('s-landscape','조경 미설치',[R(BLD,42),R(BLD,79)]);
 limits.area=area;limits.maxFootprint=area!==null&&limits.bcr.value!==null?area*limits.bcr.value/100:null;
 limits.maxGross=area!==null&&limits.far.value!==null?area*limits.far.value/100:null;
 const LH=legalHeight(p,purpose);limits.legalHeight=LH;
 // 개발제한구역: 시행령 별표2의 건폐율·용적률(주택·근린생활시설 60%·300%, 연면적 상한)이 용도지역(예: 자연녹지 20%·100%)보다 우선
 if(LH.gb&&area!==null&&number(p.manual.bcr)==null&&number(p.manual.far)==null){limits.bcrZone=limits.bcr.value;limits.farZone=limits.far.value;limits.bcr={...limits.bcr,value:LH.gb.bcr,uncertain:!purpose,gbRule:true};limits.far={...limits.far,value:LH.gb.far,uncertain:!purpose,gbRule:true};limits.maxFootprint=area*LH.gb.bcr/100;limits.maxGross=Math.min(area*LH.gb.far/100,LH.gb.gross??Infinity);limits.grossCapped=LH.gb.gross!=null&&LH.gb.gross<area*LH.gb.far/100;}if(LH.gross!=null&&limits.maxGross!=null&&LH.gross<limits.maxGross){limits.maxGross=LH.gross;limits.grossCapped=true;}{const capF=number(p.manual.floorLimit)>0?number(p.manual.floorLimit):LH.floors;if(capF>0&&limits.maxFootprint!=null&&limits.maxGross!=null&&limits.maxFootprint*capF<limits.maxGross-1e-9){limits.farGross=limits.maxGross;limits.maxGross=limits.maxFootprint*capF;limits.grossCapped=true;limits.grossCapReason=`층수 ${capF}층 이하 × 최대 건축면적`;}}
 const parkAuto=specialRate(o.parking,/부설주차장|설치기준/,purpose,new RegExp('시설면적'+NUM+'(?:제곱미터|㎡|m2)당1대','g'));
 const landscapeAuto=specialRate(o.building,/조경/,'',new RegExp('대지면적의'+NUM+'(?:퍼센트|%)','g'));
 const gbZone=p.land.zones.some(z=>z.name.includes('개발제한구역'));const parkPurpose=purpose||(gbZone?'단독주택':'제2종 근린생활시설');const parkOrd=parkAuto?null:ordinanceParking(o.parking,parkPurpose);const parkNat=parkAuto?null:(parkOrd||nationalParking(getLaw(p.laws,PD),parkPurpose));
 limits.parkingUnit=number(p.manual.parkingUnit)??parkAuto?.value??parkNat?.unit??null;
 limits.parkingBasis=number(p.manual.parkingUnit)!=null?'수동 입력':parkAuto?'조례':parkNat?(parkNat.ordinance?`「${o.parking?.name||'주차장 조례'}」 부설주차장 설치기준 ${parkNat.row}`:`「주차장법 시행령」 별표1 ${parkNat.row}`):'';
 limits.parkingPurposeAssumed=!purpose;limits.parkingPurpose=parkPurpose;
 const fsel=number(p.floors),useF=fsel>0&&limits.maxFootprint!=null&&limits.maxGross!=null&&limits.maxFootprint*fsel<limits.maxGross-1e-9;const planG=useF?Math.min(limits.maxGross,limits.maxFootprint*fsel):null;limits.planGross=planG??limits.maxGross;limits.planLabel=useF?`선택 층수 ${fsel}층 × 최대 건축면적`:'법정 최대 연면적';limits.parkingArea=number(p.manual.parkingArea)??planG??limits.maxGross??null;limits.parkingAreaAssumed=number(p.manual.parkingArea)==null;
 limits.parkingHouse=null;{const A=limits.parkingArea,f2=v=>(Math.round(v*100)/100).toLocaleString('ko-KR');let raw=null,how='';
  if(A!=null&&parkNat?.house&&number(p.manual.parkingUnit)==null){const h=parkNat.house;if(A<=h.min){raw=A/100;how=`시설면적 ${f2(A)}㎡ ≤ ${h.min}㎡ → 비고4: ${f2(A)} ÷ 100 = ${f2(raw)}대`;}else if(A<=h.base){raw=1;how=`시설면적 ${f2(A)}㎡ (${h.min}㎡ 초과 ${h.base}㎡ 이하) → 1대`;}else{raw=1+(A-h.base)/h.step;how=`1 + (시설면적 ${f2(A)}㎡ − ${h.base}㎡) ÷ ${h.step}㎡ = ${f2(raw)}대`;}limits.parkingBasis=parkNat.ordinance?`「${o.parking?.name||'주차장 조례'}」 부설주차장 설치기준 ${parkNat.row} 단독주택`:`「주차장법 시행령」 별표1 ${parkNat.row} 단독주택`;limits.parkingHouse=h;}
  else if(A!=null&&limits.parkingUnit>0){raw=A/limits.parkingUnit;how=`시설면적 ${f2(A)}㎡ ÷ ${f2(limits.parkingUnit)}㎡ = ${f2(raw)}대`;}
  if(raw!=null){const fl=Math.floor(raw),r=raw<1?0:(raw-fl>=0.5?fl+1:fl);limits.parking=r;limits.parkingRaw=raw;limits.parkingHow=how;limits.parkingFormula=`[${limits.parkingBasis||'설치기준'}${limits.parkingPurposeAssumed?' · 주용도 미선택으로 '+parkPurpose+' 가정':''}] ${how} → 비고6(소수점 0.5 이상은 1대, 총 1대 미만은 0대) 적용 = ${r}대 · 시설면적 = ${limits.planLabel}${number(p.manual.parkingArea)!=null?'(수동 입력)':''}`;}
  else{limits.parking=null;limits.parkingFormula=A==null?'시설면적(연면적) 미산정':'주차 설치기준 원문 미수신 — 산정 불가';}}
 const tier=landscapeAuto?null:landscapeTier(o.building,planG??limits.maxGross,area);limits.landscapeTier=tier;
 limits.landscape=number(p.manual.landscape)??landscapeAuto?.value??tier?.value??null;
 {const t27=norm(articleText(BD,27));limits.landscapeExempt=null;limits.landscapeOptional=null;
  if(number(p.manual.landscape)==null){
   if(area!==null&&landscapeThreshold!==null&&area<landscapeThreshold){limits.landscape=0;limits.landscapeExempt=`「건축법」 제42조 : 면적 ${fmt0(landscapeThreshold)}㎡ 미만 대지 → 조경 의무 없음`;}
   else if(/녹지지역/.test(p.land.zone.value||'')&&t27.includes('녹지지역에건축하는건축물')){limits.landscapeOptional='「건축법 시행령」 제27조제1항제1호 : 녹지지역 건축물은 조경 등의 조치를 하지 않을 수 있음(면제 선택 가능). 실무·허가 협의상 조례 기준 적용 시 아래 면적';}}}
 limits.landscapeArea=area!==null&&limits.landscape!==null?area*limits.landscape/100:null;
 {const f2=v=>(Math.round(v*100)/100).toLocaleString('ko-KR');const T=limits.landscapeTier;
  limits.landscapeFormula=(limits.landscapeOptional?limits.landscapeOptional+' · ':'')+(limits.landscapeExempt?limits.landscapeExempt:limits.landscapeArea!=null?`[${number(p.manual.landscape)!=null?'수동 입력 비율':T?`건축조례 제${T.article.number}조${T.small?` · 대지 ${T.small[0]}㎡ 이상 ${T.small[1]}㎡ 미만`:` · 연면적 ${T.lo?f2(T.lo)+'㎡ 이상 ':''}${T.hi!==Infinity?f2(T.hi)+'㎡ 미만':''} 구간(${limits.planLabel} ${f2(T.gross)}㎡ 기준)`}`:'건축조례'}] 대지면적 ${f2(area)}㎡ × ${limits.landscape}% = ${f2(limits.landscapeArea)}㎡ 이상`:'건축조례 조경 비율 원문 자동 추출 불가 — 08 적용값 입력 대상');}
 limits.north=residential?extractNorth(getLaw(p.laws,BD)):null;
 limits.residential=residential;
 addSummaries(p,rows,limits);const out={rows,sanctions,limits};detailRows(p,out,o.plan?.name||'');assertRowLinks(rows);assertRowLinks(sanctions);return out;
}
function penaltyRefs(p,name){const law=getLaw(p.laws,name);return (law?.articles||[]).filter(a=>/벌칙|과태료/.test(a.title)).map(a=>reference(p.laws,name,a.number,'law',a.branch));}
export function judgmentPacket(p){return [titleForPacket(p),`대지면적: ${totalArea(p)??''}㎡`,`용도지역: ${p.land.zone.value||''}`,'',...p.review.rows.map(r=>`[${r.id}] ${r.item}\n${r.text}\n근거: ${r.refs.map(x=>x.name+' '+x.article+' (시행일 '+(x.effectiveDate||'')+')').join(' / ')}\n판단: ${r.judgment||''}`),'','빈 판단 칸: '+p.review.rows.filter(r=>!r.judgment).map(r=>r.id).join(', '),'작성 형식: [행 ID] 판단 내용. 원문에 없는 사항 및 미확정 내용은 단정하지 말 것.'].join('\n');}
function titleForPacket(p){return `${p.address} / 예정용도 ${p.purpose} / ${p.date}`;}
export function parseJudgments(text,ids){const result={};let active='';for(const line of String(text).split('\n')){const m=line.match(/^\[([\w-]+)\]\s*(.*)$/);if(m&&ids.includes(m[1])){active=m[1];result[active]=m[2];}else if(active)result[active]+='\n'+line;}return result;}
