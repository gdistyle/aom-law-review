/** 공유 모델. null은 미수집이며 0과 구별한다. 예시값은 실행 코드에 내장하지 않는다. */
export const RED = '#E00000';
export const TERRAIN_NOTE = '지형 높이는 공개 수치표고자료(해상도 약 30 m) 기반의 개략값으로, 실제 지반고·현황과 다를 수 있음. 정밀 검토 시 현황측량 또는 국토지리정보원 수치지형도 기준으로 재검토할 것.';
export const MASS_NOTE = '법정 기준에 따른 가정 모델이며 설계안이 아님.';
export const FONT = '"맑은 고딕", "Malgun Gothic", sans-serif';
export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export function number(v) {
  if (v === null || v === undefined || (typeof v === 'string' && !v.trim()) || typeof v === 'boolean') return null;
  const n = Number(String(v).replaceAll(',', '')); return Number.isFinite(n) ? n : null;
}
export const fmt = (v, digits = 4) => number(v) === null ? '' : number(v).toLocaleString('ko-KR', { maximumFractionDigits: digits });
export const array = v => v == null || v === '' ? [] : Array.isArray(v) ? v : [v];
export const norm = v => String(v ?? '').replace(/\s+/g, '').normalize('NFKC');
export const date8 = v => String(v ?? '').replace(/\D/g, '').slice(0, 8);
export function kstToday(now = new Date()) { return new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now); }
export function displayDate(v) { const s = date8(v); return s.length === 8 ? `${s.slice(0,4)}. ${s.slice(4,6)}. ${s.slice(6)}.` : ''; }
export function safeName(v) { return String(v || '대지').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').trim().slice(0, 90) || '대지'; }
export function makePNU(a) {
  if (!/^\d{10}$/.test(String(a.b_code))) throw new Error('법정동코드는 10자리 숫자이어야 함.');
  const main = String(a.main_address_no ?? ''), sub = String(a.sub_address_no || '0');
  if (!/^\d{1,4}$/.test(main) || !/^\d{1,4}$/.test(sub) || +main < 1) throw new Error('본번·부번 형식 오류.');
  if (!['Y','N'].includes(a.mountain_yn)) throw new Error('산 구분 자료 없음.');
  return a.b_code + (a.mountain_yn === 'Y' ? '2' : '1') + main.padStart(4,'0') + sub.padStart(4,'0');
}
export function splitPNU(pnu) {
  if (!/^\d{10}[12]\d{8}$/.test(pnu) || +pnu.slice(11,15) === 0) throw new Error('PNU는 19자리 필지고유번호이어야 함.');
  return {sigunguCd:pnu.slice(0,5),bjdongCd:pnu.slice(5,10),platGbCd:pnu[10]==='2'?'1':'0',bun:pnu.slice(11,15),ji:pnu.slice(15,19)};
}
export function datum(value = null, source = '', uncertain = true) { return {value, source, uncertain}; }
export function blankProject() {
  return {version:1,address:'',pnu:'',author:'이오상',date:kstToday(),purpose:'',floors:null,operation:'신축',
    location:null,parcels:[],land:{area:datum(),category:datum(),price:datum(),priceDate:datum(),road:datum(),zones:[],zone:datum()},
    building:{status:'unavailable',titles:[],recaps:[],floors:[],exclusive:[],changes:[],selected:0},
    laws:[],sources:[],geometry:{parcels:[],buildings:[]},judgments:{},issue:'',
    manual:{district:false,districtResolved:false,bcr:null,far:null,landscape:null,parkingUnit:null,parkingArea:null,setback:null,roadSetback:null,height:null,northLow:null,northThreshold:null,northSlope:null,frontage:null,roadWidth:null,deadEndLength:null,rural:false,grading:false},
    model:{floorHeight:3.3,floorHeights:[4.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3],baseElevation:0,maxFloors:15,courtyardWidth:null,northEdges:[],roadEdges:[],confirmed:false,terrain:null},
    review:{rows:[],sanctions:[],limits:{}},queriedAt:null};
}
export const titleOf = p => `${p.address || '대지'} ${p.purpose || ''} ${p.operation || '신축'}`.replace(/\s+/g,' ').trim();
export function kstTime(iso){if(!iso)return '';const d=new Date(iso);if(!Number.isFinite(d.getTime()))return String(iso);const k=new Date(d.getTime()+9*3600000),z=n=>String(n).padStart(2,'0');return `${k.getUTCFullYear()}. ${z(k.getUTCMonth()+1)}. ${z(k.getUTCDate())}. ${z(k.getUTCHours())}:${z(k.getUTCMinutes())}`;}
export function currentByDate(date, today = kstToday()) { const d=date8(date), t=date8(today); const parsedDate=new Date(`${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}T00:00:00Z`); return /^\d{8}$/.test(d) && Number.isFinite(parsedDate.getTime()) && parsedDate.toISOString().slice(0,10).replaceAll('-','')===d && d <= t && d >= '19000101'; }
export function redactFreeText(v) { return String(v ?? '').replace(/\b\d{6}\s*[-‐–]\s*[\d*]{7}\b/g,'').replace(/https?:\/\/[^\s<]+/gi,''); }
export function validLawURL(value) { try {const u=new URL(value); return u.protocol==='https:' && ['www.law.go.kr','law.go.kr'].includes(u.hostname) && !u.username && !u.password;} catch{return false;} }
export function assertRowLinks(rows) { for(const r of rows) if(!r.refs?.length || r.refs.some(x=>!validLawURL(x.url))) throw new Error(`조문 링크 누락: ${r.item}`); return true; }
export function fileStem(p) { const tail=p.address.match(/([가-힣\d]+[동리가읍면])\s*(산\s*)?(\d+(?:-\d+)?)(?:\s|$)/); return safeName(tail ? `${tail[1]}${tail[2]||''}${tail[3]}` : p.address || p.pnu || '대지'); }
export function selectedBuilding(p) { return p.building.titles[p.building.selected || 0] || null; }
export const BUILDING_FIELDS = [
  ['대지면적','platArea','㎡'],['건축면적','archArea','㎡'],['연면적','totArea','㎡'],['용적률 산정용 연면적','vlRatEstmTotArea','㎡'],
  ['건폐율','bcRat','%'],['용적률','vlRat','%'],['주구조','strctCdNm',''],['주용도','mainPurpsCdNm',''],
  ['지하층수','ugrndFlrCnt','층'],['지상층수','grndFlrCnt','층'],['높이','heit','m'],['사용승인일','useAprDay',''],
  ['지역','jiyukCdNm',''],['지구','jiguCdNm',''],['구역','guyukCdNm','']
];
export function totalArea(p) { const vals=p.parcels.map(x=>number(x.area?.value)); if(vals.length) return vals.every(v=>v!==null)?vals.reduce((a,b)=>a+b,0):null; return number(p.land.area.value); }
