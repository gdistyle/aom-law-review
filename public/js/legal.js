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
 const annexes=walkObjects(root,x=>x.별표번호!==undefined).map(a=>({number:String(+a.별표번호||a.별표번호),branch:+a.별표가지번호>0?String(+a.별표가지번호):'',title:plain(a.별표제목||''),text:textContent(a)}));
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
 if(['전','답','과수원'].includes(p.land.category.value))set.add('농지법');
 if(p.land.category.value==='임야')set.add('산지관리법');
 if(zones.includes('개발제한구역')){set.add(GREEN);set.add(GREEN+' 시행령');}
 for(const z of p.land.zones){const match=zoneBasis(z.name);if(z.lawName)set.add(z.lawName);else if(match)set.add(match[0]);}
 return [...set];
}
/** 첫 항 본문/호에서 정확히 일치하는 지역 행만 추출. 조건부·복수 수치는 자동 채택하지 않음. */
export function extractRatio(text,zone,range=false) {
 const lines=plain(text).replace(/([^\d\s])(\d{1,2}\.\s)/g,'$1\n$2').replace(/([①-⑳])/g,'\n$1').replace(/(\d+)\s*천\s*(\d{0,3})(?=\s*퍼센트)/g,(m,a,b)=>String(+a*1000+(+b||0))).split(/\n|(?=\s\d+\.\s)/).map(s=>s.trim()).filter(Boolean);
 const target=norm(zone); const matches=[];
 for(const line of lines){
  const clean=norm(line); const idx=clean.indexOf(target);
  if(idx<0||!target)continue;
  const tail=clean.slice(idx+target.length);
  // 동일 행에 다른 용도지역/특례가 섞이면 모호함.
  if(ZONES.some(z=>z!==zone&&tail.includes(norm(z))))continue;
  if(/다만|경우|특례|완화|인센티브|정비사업|지구단위/.test(tail))continue;
  const pattern=range?new RegExp('^[:：ㆍ·\-]?'+NUM+'퍼센트이상'+NUM+'퍼센트이하'):new RegExp('^[:：ㆍ·\-]?'+NUM+'(?:퍼센트|%)이하');
  const m=tail.match(pattern);if(m)matches.push(number(m[range?2:1]));
 }
 const vals=[...new Set(matches.filter(v=>v!==null&&v>=0&&v<=3000))];return vals.length===1?vals[0]:null;
}
function ratioFrom(law,zone,type) {
 if(!law?.current)return null;
 const patterns=type==='bcr'?/용도지역.*건폐율/:/용도지역.*용적률/;
 const articles=law.articles.filter(a=>patterns.test(norm(a.title))&&!/완화|특례|예외/.test(norm(a.title)));
 const result=[];
 for(const a of articles){
  const val=extractRatio((a.hang1||a.text).split(/②/)[0],zone,false);
  if(val!==null)result.push({value:val,article:a});
  // 별표 본문이 실제로 제공된 경우에만 사용. 이미지/PDF 별표의 숫자는 추정하지 않음.
  for(const m of a.text.matchAll(/별표\s*(\d+)(?:의\s*(\d+))?/g)){
   const annex=law.annexes.find(x=>x.number===String(+m[1])&&x.branch===String(m[2]?+m[2]:''));
   const av=annex?extractRatio(annex.text,zone,false):null;if(av!==null)result.push({value:av,article:a,annex:annex.number});
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
export function nationalParking(law,purpose){const an=law?.annexes?.find(a=>a.number==='1'&&!a.branch);if(!an?.text||!purpose)return null;const key=norm(purpose).replace(/^제[12]종/,m=>m);const rows=an.text.split(/\n[┠┣├][─━┼┿╂]+[┨┫┤]?/);for(const r of rows){const L=[],R=[];for(const line of r.split('\n')){const m=line.match(/^\s*┃(.*?)│(.*?)┃\s*$/);if(m){L.push(m[1].trim());R.push(m[2].trim());}}const left=norm(L.join('')),right=norm(R.join(''));if(!left)continue;const hit=left.includes(key)&&!new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'[^,]{0,40}?은제외').test(left);if(!hit)continue;const u=[...right.matchAll(/시설면적(\d+(?:\.\d+)?)(?:㎡|m2)당1대/g)].map(x=>+x[1]);if(u.length===1)return{unit:u[0],row:(L.join(' ').match(/^(\d+)\./)||[])[1]?L.join(' ').match(/^(\d+)\./)[1]+'호':''};return null;}return null;}
/** 건축조례 조경 조항의 연면적 구간별 비율. 연면적은 법정 최대 연면적(가정)으로 판정. */
export function landscapeTier(law,gross){if(!law?.current||gross==null)return null;for(const a of law.articles.filter(a=>/조경/.test(norm(a.title||'')))){const t=kn(norm(a.text).split('②')[0]);const tiers=[];for(const m of t.matchAll(/연면적(?:\([^)]*\))?(?:이)?(\d+)제곱미터(이상|미만)(?:(\d+)제곱미터미만)?인건축물:대지면적의(\d+(?:\.\d+)?)(?:%|퍼센트)/g)){const lo=m[2]==='이상'?+m[1]:0,hi=m[2]==='미만'?+m[1]:(m[3]?+m[3]:Infinity);tiers.push({lo,hi,value:+m[4]});}const hit=tiers.filter(x=>gross>=x.lo&&gross<x.hi);if(hit.length===1)return{...hit[0],article:a,gross};}return null;}
function zoneBasis(name){
 const map=[[/개발제한구역/,GREEN,12],[/군사|비행안전|대공방어/,'군사기지 및 군사시설 보호법',13],
 [/문화유산|문화재|역사문화환경/,'문화유산의 보존 및 활용에 관한 법률',13],[/자연유산/,'자연유산의 보존 및 활용에 관한 법률',10],
 [/상수원보호/,'수도법',7],[/하천/,'하천법',33],[/가축사육제한/,'가축분뇨의 관리 및 이용에 관한 법률',8],
 [/교육환경보호/,'교육환경 보호에 관한 법률',9],[/고도지구|경관지구|방화지구|방재지구|보호지구|취락지구|개발진흥지구|특정용도제한지구|복합용도지구/,PLAN,76]];
 return map.find(([re])=>re.test(name))?.slice(1)||null;
}
export function shortLaw(name){return name.replace(DECREE,'국토계획법 시행령').replace(PLAN,'국토계획법').replace(GREEN,'개발제한구역법');}
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
 if(purpose)add('parking','부설주차장',[R(PARK,19),R(PD,6),local('parking',/설치기준|부설주차장/)],articleText(PARK,19),purpose,true);
 const restrictedHeight=p.land.zones.filter(z=>/고도지구|비행안전|지구단위계획/.test(z.name));
 if(restrictedHeight.length)add('height','높이·층수 제한',[R(BLD,60),R(BLD,61),R(PLAN,54)],'',restrictedHeight.map(x=>x.name).join(', '),true);
 const development=/녹지|관리|농림/.test(p.land.zone.value||'')||p.manual.grading;
 if(development)add('development','개발행위허가',[R(PLAN,56)],articleText(PLAN,56),'',true);
 const farmland=['전','답','과수원'].includes(p.land.category.value), forest=p.land.category.value==='임야',green=p.land.zones.some(z=>z.name.includes('개발제한구역'));
 if(farmland)add('farmland','농지전용',[R('농지법',34)],articleText('농지법',34),p.land.category.value,true);
 if(forest)add('forest','산지전용',[R('산지관리법',14)],articleText('산지관리법',14),'임야',true);
 if(green)add('greenbelt','개발제한구역 행위제한 개별 검토',[R(GREEN,12),R(GREEN+' 시행령',13)],articleText(GREEN,12),'개발제한구역',true);
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
 const parkAuto=specialRate(o.parking,/부설주차장|설치기준/,purpose,new RegExp('시설면적'+NUM+'(?:제곱미터|㎡|m2)당1대','g'));
 const landscapeAuto=specialRate(o.building,/조경/,'',new RegExp('대지면적의'+NUM+'(?:퍼센트|%)','g'));
 const parkPurpose=purpose||'제2종 근린생활시설';const parkNat=parkAuto?null:nationalParking(getLaw(p.laws,PD),parkPurpose);
 limits.parkingUnit=number(p.manual.parkingUnit)??parkAuto?.value??parkNat?.unit??null;
 limits.parkingBasis=number(p.manual.parkingUnit)!=null?'수동 입력':parkAuto?'조례':parkNat?`「주차장법 시행령」 별표1 ${parkNat.row}`:'';
 limits.parkingPurposeAssumed=!purpose;limits.parkingPurpose=parkPurpose;
 limits.parkingArea=number(p.manual.parkingArea)??limits.maxGross??null;limits.parkingAreaAssumed=number(p.manual.parkingArea)==null;
 limits.parking=limits.parkingUnit>0&&limits.parkingArea!==null?Math.ceil(limits.parkingArea/limits.parkingUnit):null;
 const tier=landscapeAuto?null:landscapeTier(o.building,limits.maxGross);limits.landscapeTier=tier;
 limits.landscape=number(p.manual.landscape)??landscapeAuto?.value??tier?.value??null;
 limits.landscapeArea=area!==null&&limits.landscape!==null?area*limits.landscape/100:null;
 limits.north=residential?extractNorth(getLaw(p.laws,BD)):null;
 limits.residential=residential;
 const out={rows,sanctions,limits};detailRows(p,out,o.plan?.name||'');assertRowLinks(rows);assertRowLinks(sanctions);return out;
}
function penaltyRefs(p,name){const law=getLaw(p.laws,name);return (law?.articles||[]).filter(a=>/벌칙|과태료/.test(a.title)).map(a=>reference(p.laws,name,a.number,'law',a.branch));}
export function judgmentPacket(p){return [titleForPacket(p),`대지면적: ${totalArea(p)??''}㎡`,`용도지역: ${p.land.zone.value||''}`,'',...p.review.rows.map(r=>`[${r.id}] ${r.item}\n${r.text}\n근거: ${r.refs.map(x=>x.name+' '+x.article+' (시행일 '+(x.effectiveDate||'')+')').join(' / ')}\n판단: ${r.judgment||''}`),'','빈 판단 칸: '+p.review.rows.filter(r=>!r.judgment).map(r=>r.id).join(', '),'작성 형식: [행 ID] 판단 내용. 원문에 없는 사항 및 미확정 내용은 단정하지 말 것.'].join('\n');}
function titleForPacket(p){return `${p.address} / 예정용도 ${p.purpose} / ${p.date}`;}
export function parseJudgments(text,ids){const result={};let active='';for(const line of String(text).split('\n')){const m=line.match(/^\[([\w-]+)\]\s*(.*)$/);if(m&&ids.includes(m[1])){active=m[1];result[active]=m[2];}else if(active)result[active]+='\n'+line;}return result;}
