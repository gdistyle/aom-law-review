/* 대지 맥락 · 컨셉 자동 요약 (규칙 기반, AI 미사용).
   입력: 주변 장소(카카오 장소검색), 주변 건물 층수(브이월드), 수치표고 점, 용도지역.
   출력: 사실(facts) · 분위기(character) · 계획 착안점(concepts) · 요약 문장(story) · 유의(cautions).
   같은 입력이면 항상 같은 결과를 낸다. 수치를 지어내지 않고, 자료가 없으면 해당 줄을 만들지 않는다. */

const WALK = 80; // 도보 m/분 (보행속도 가정치, 화면에 가정으로 표기)
const DIRS = ['북', '북동', '동', '남동', '남', '남서', '서', '북서'];

const hasBatchim = w => { const c = String(w).trim().slice(-1).charCodeAt(0); return c >= 0xAC00 && c <= 0xD7A3 ? (c - 0xAC00) % 28 !== 0 : /[0-9LMNlmn]$/.test(String(w).trim()); };
const josa = (w, a, b) => `${w}${hasBatchim(w.replace(/\([^)]*\)$/, '')) ? a : b}`;
const nearest = (items, kind) => items.filter(o => o.kind === kind).sort((a, b) => a.distance - b.distance)[0] || null;
const walkMin = m => Math.max(1, Math.round(m / WALK));
const fmtM = m => `${Math.round(m).toLocaleString('ko-KR')}m`;

/** 수치표고 점([x(동), y(북), h])으로 대상지 반경 r m 안의 평균 경사(%)·낮아지는 방향·주변 대비 높이차를 구한다. */
export function terrainSummary(points, r = 60) {
  if (!Array.isArray(points) || points.length < 9) return null;
  const near = points.filter(([x, y]) => Math.hypot(x, y) <= r);
  if (near.length < 6) return null;
  // 최소제곱 평면 h = a·x + b·y + c
  let sx = 0, sy = 0, sh = 0, sxx = 0, syy = 0, sxy = 0, sxh = 0, syh = 0; const n = near.length;
  for (const [x, y, h] of near) { sx += x; sy += y; sh += h; sxx += x * x; syy += y * y; sxy += x * y; sxh += x * h; syh += y * h; }
  const mx = sx / n, my = sy / n, mh = sh / n;
  const cxx = sxx / n - mx * mx, cyy = syy / n - my * my, cxy = sxy / n - mx * my, cxh = sxh / n - mx * mh, cyh = syh / n - my * mh;
  const det = cxx * cyy - cxy * cxy; if (!(Math.abs(det) > 1e-9)) return null;
  const a = (cxh * cyy - cyh * cxy) / det, b = (cyh * cxx - cxh * cxy) / det;
  const slope = Math.hypot(a, b) * 100;
  const deg = (Math.atan2(-a, -b) * 180 / Math.PI + 360) % 360; // 낮아지는 방향(북=0°, 동=90°)
  const down = DIRS[Math.round(deg / 45) % 8];
  const wide = points.filter(([x, y]) => Math.hypot(x, y) <= 250);
  const wideMean = wide.length ? wide.reduce((s, p) => s + p[2], 0) / wide.length : mh;
  return { slope, down, elevation: mh, relative: mh - wideMean };
}

/** 주변 건물 층수 통계 (층수 정보가 있는 건물만). */
export function buildingSummary(features) {
  const fl = (features || []).map(f => Number(f?.properties?.floors ?? f?.floors)).filter(v => Number.isFinite(v) && v > 0);
  if (fl.length < 3) return null;
  fl.sort((a, b) => a - b);
  const avg = fl.reduce((s, v) => s + v, 0) / fl.length;
  return { count: fl.length, avg, median: fl[Math.floor(fl.length / 2)], max: fl[fl.length - 1] };
}

function zoneType(zone) {
  const z = String(zone || '');
  if (/중심상업|일반상업|근린상업|유통상업|상업/.test(z)) return { key: 'commerce', label: '상업 가로' };
  if (/준주거/.test(z)) return { key: 'mixed', label: '주거·상업 혼재 지역' };
  if (/전용주거|제1종일반/.test(z)) return { key: 'lowres', label: '저층 주거지' };
  if (/제2종일반|제3종일반|일반주거/.test(z)) return { key: 'midres', label: '중층 주거지' };
  if (/공업/.test(z)) return { key: 'industry', label: '산업·업무 지역' };
  if (/녹지|관리|농림|자연환경/.test(z)) return { key: 'nature', label: '자연·전원 지역' };
  return z ? { key: 'other', label: z } : null;
}

/**
 * @param {{zone?:string, places?:Array, buildings?:Array, terrainPoints?:Array}} input
 */
export function siteContext({ zone = '', places = [], buildings = [], terrainPoints = null } = {}) {
  const facts = [], concepts = [], cautions = [], signature = [];
  const type = zoneType(zone);
  const st = nearest(places, '지하철역'), park = nearest(places, '공원'), river = nearest(places, '하천'), school = nearest(places, '학교');
  const t = terrainSummary(terrainPoints);
  const b = buildingSummary(buildings);

  if (st) facts.push(`교통 : ${st.name} ${fmtM(st.distance)} (도보 약 ${walkMin(st.distance)}분)`);
  if (park) facts.push(`녹지 : ${park.name} ${fmtM(park.distance)}`);
  if (river) facts.push(`수변 : ${river.name} ${fmtM(river.distance)}`);
  if (school) facts.push(`교육시설 : ${school.name} ${fmtM(school.distance)}`);
  for (const kind of ['문화시설', '관광명소', '공공기관', '대형마트']) {
    for (const o of places.filter(p => p.kind === kind).sort((a, b) => a.distance - b.distance).slice(0, kind === '문화시설' || kind === '관광명소' ? 2 : 1)) {
      if (!signature.some(s => s.name === o.name)) signature.push(o);
    }
  }
  signature.sort((a, b) => a.distance - b.distance).splice(5);
  if (t) facts.push(`지형 : 표고 약 ${Math.round(t.elevation)}m, ${t.slope < 2 ? '거의 평탄' : `${t.down}쪽으로 낮아지는 경사(약 ${t.slope.toFixed(1)}%)`}${Math.abs(t.relative) >= 5 ? `, 반경 250m 평균보다 약 ${Math.abs(Math.round(t.relative))}m ${t.relative > 0 ? '높음' : '낮음'}` : ''}`);
  if (b) facts.push(`주변 건물 : 층수 확인 ${b.count}동, 평균 약 ${b.avg.toFixed(1)}층 · 최고 ${b.max}층`);

  // 분위기
  let character = type ? type.label : '';
  if (st && st.distance <= 500 && type && type.key !== 'nature') character = `역세권 ${character}`;
  if (b && type) character += b.avg < 3 ? ' (저층 위주)' : b.avg < 7 ? ' (중층 위주)' : ' (고층 위주)';

  // 계획 착안점 (규칙)
  if (st && st.distance <= 500 && type && ['commerce', 'mixed', 'midres'].includes(type.key)) concepts.push('역 방향 보행 흐름을 고려하여 1층은 가로에 열린 근린생활시설로 계획');
  if (type?.key === 'commerce' && !(st && st.distance <= 500)) concepts.push('가로변 저층부 상업 공간 연속성 확보');
  if (park && park.distance <= 300) concepts.push(`${park.name} 방향 조망·테라스·개구부 배치`);
  if (river && river.distance <= 500) concepts.push('수변 방향 조망 확보를 위한 매스 배치');
  if (t && t.slope >= 8) concepts.push('대지 레벨차를 활용한 반지하·스킵플로어 계획 및 저층부 진입 동선 분리');
  else if (t && t.slope >= 3) concepts.push('완만한 레벨차를 활용한 진입부·주차 출입구 계획');
  if (t && t.slope >= 2 && /남/.test(t.down)) concepts.push('남측으로 낮아지는 지형을 활용한 남향 개방형 배치');
  if (b && b.avg < 3 && type && ['midres', 'mixed', 'commerce'].includes(type.key)) concepts.push('주변 저층 맥락을 고려한 볼륨 분절 및 상부 셋백');
  if (type?.key === 'lowres') concepts.push('주변 저층 주거지 스케일에 맞춘 소규모 매스 분할');
  if (type?.key === 'nature') concepts.push('자연 지형에 순응하는 저층 분산 배치 및 절·성토 최소화');
  if (type?.key === 'industry') concepts.push('차량 동선과 보행 동선을 분리한 업무·생산 공간 배치');
  concepts.splice(4);

  if (school && school.distance <= 200) cautions.push(`${school.name} ${fmtM(school.distance)} : 교육환경보호구역(학교 경계 200m) 해당 여부 확인 대상, 해당 시 일부 용도 제한`);
  if (t && t.slope >= 15) cautions.push('평균 경사 15% 이상 : 개발행위허가 경사도 기준(지자체 조례) 검토 대상');

  // 요약 문장
  const parts = [];
  if (zone) parts.push(`${zone} 대지로서${st ? ` ${st.name}에서 도보 약 ${walkMin(st.distance)}분 거리에 위치함` : ' 위치함'}.`);
  const env = [park && `${park.name}(${fmtM(park.distance)})`, river && `${river.name}(${fmtM(river.distance)})`].filter(Boolean);
  if (env.length) parts.push(`주변에 ${josa(env.join(', '), '이', '가')} 있어 녹지·조망 자원을 활용할 수 있음.`);
  if (t) parts.push(t.slope < 2 ? '대지는 거의 평탄함.' : `대지는 ${t.down}쪽으로 낮아지는 약 ${t.slope.toFixed(1)}% 경사지임.`);
  if (concepts.length) parts.push(`${josa(concepts.slice(0, 2).join(', '), '을', '를')} 중심으로 계획하는 것이 적합함.`);
  const story = parts.join(' ');

  return { facts, signature, character, concepts, cautions, story, assumptions: [`도보 시간은 분당 ${WALK}m 가정치`, '지형은 공개 수치표고(약 10m 화소) 기반 개략값', '거리는 대지 중심점 기준 직선거리'] };
}

export function contextText(address, c) {
  const L = [`[대지 맥락 · 컨셉 — 자동 생성 참고 자료]`, `소재지 : ${address || ''}`, ''];
  if (c.character) L.push(`분위기 : ${c.character}`);
  if (c.facts.length) { L.push('', '■ 주변 현황'); for (const f of c.facts) L.push(`- ${f}`); }
  if (c.signature.length) { L.push('', '■ 주변 주요 시설'); for (const s of c.signature) L.push(`- ${s.name} (${s.kind}, ${fmtM(s.distance)})`); }
  if (c.concepts.length) { L.push('', '■ 계획 착안점'); for (const s of c.concepts) L.push(`- ${s}`); }
  if (c.story) L.push('', '■ 요약', c.story);
  if (c.cautions.length) { L.push('', '■ 유의사항'); for (const s of c.cautions) L.push(`- ${s}`); }
  L.push('', '※ ' + c.assumptions.join(' · ') + '. 설계 판단은 건축사 검토를 거칠 것.');
  return L.join('\n');
}

/* ---------- 동서남북 · 용도별 이야기 (규칙 + 문장 틀, AI 미사용) ---------- */
const SECT = ['북', '동', '남', '서'];
const sectorOf = b => SECT[Math.round(((Number(b) % 360) + 360) % 360 / 90) % 4];
const PRI = ['경관-강', '경관-산', '경관-공원', '지하철역', '관광명소', '문화시설', '공원', '하천'];
const km = m => m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${Math.round(m)}m`;
const clean = n => String(n).replace(/\s*(정상|입구|주차장|산책로|둘레길)$/, '').trim();

/** «이름» 표시는 화면에서 강조색, 문서·텍스트에서는 그대로 이름만 남긴다. */
export const stripMarks = s => String(s || '').replace(/[«»]/g, '');
const batchim = ch => { const c = ch.charCodeAt(0); return c >= 0xAC00 && c <= 0xD7A3 ? (c - 0xAC00) % 28 !== 0 : /[0-9]/.test(ch) ? /[013678]/.test(ch) : /[lmnr]/i.test(ch); };
/** '…산»을(를)', '…(1.2km)이(가)' 같은 겸용 조사를 받침에 맞게 확정 */
export function fixJosa(t) {
  return String(t || '').replace(/([가-힣A-Za-z0-9])(»?)((?:\([^()]*\))?)(을\(를\)|이\(가\)|은\(는\)|과\(와\))/g, (m, ch, mk, paren, j) => {
    const b = batchim(ch), pick = {'을(를)': b ? '을' : '를', '이(가)': b ? '이' : '가', '은(는)': b ? '은' : '는', '과(와)': b ? '과' : '와'}[j];
    return ch + mk + paren + pick;
  });
}

export function siteDirections(items = [], regions = [], here = null) {
  const out = [];
  for (const d of SECT) {
    const cand = items.filter(o => Number.isFinite(o.bearing) && sectorOf(o.bearing) === d);
    let pick = null;
    for (const k of PRI) { const c = cand.filter(o => o.kind === k).sort((a, b) => a.distance - b.distance)[0]; if (c) { pick = c; break; } }
    const reg = regions.find(r => r.dir === d);
    const regName = reg && here && (reg.dong !== here.dong || reg.gu !== here.gu) ? (reg.gu !== here?.gu ? `${reg.gu} ${reg.dong}` : reg.dong) : '';
    if (pick || regName) out.push({dir: d, name: pick ? clean(pick.name) : '', kind: pick?.kind || '', distance: pick?.distance ?? null, region: regName});
  }
  return out;
}
export function directionSentence(dirs) {
  const land = dirs.filter(d => d.name).map(d => `${d.dir}쪽으로 «${d.name}»(${km(d.distance)})`);
  const reg = dirs.filter(d => d.region).map(d => `${d.dir}쪽은 «${d.region}»`);
  const a = land.length ? `${land.join(', ')}이(가) 자리함.` : '';
  const b = reg.length ? ` 생활권은 ${reg.join(', ')} 일대와 맞닿음.` : '';
  return fixJosa((a + b).trim());
}

const hash = s => { let h = 0; for (const c of String(s || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
const CAT = u => /단독주택/.test(u) ? 'house' : /공동주택/.test(u) ? 'apt' : /근린생활/.test(u) ? 'shop' : /업무/.test(u) ? 'office' : /문화|집회|종교|관광|숙박/.test(u) ? 'culture' : /공장|창고/.test(u) ? 'work' : 'etc';
const T = {
  house: [
    v => `${v.view ? `${v.view}을(를) 바라보는 ` : ''}${v.slopeTxt}가족의 집. ${v.parkTxt}낮에는 빛이 깊이 드는 거실과 마당이, 저녁에는 동네의 고요함이 머무는 집으로 계획함.`,
    v => `${v.view ? `«${stripMarks(v.view)}»의 풍경을 일상으로 들이는 ` : '동네의 결을 닮은 '}단독주택. ${v.slopeTxt2}${v.parkTxt}작은 마당과 테라스를 중심으로 가족의 시간이 이어지는 구성이 어울림.`
  ],
  apt: [
    v => `${v.stationTxt}${v.view ? `${v.view} 조망을 나누어 갖는 ` : ''}이웃과 함께 사는 집. 저층부에는 공유 공간을, 상부에는 세대별 조망과 채광을 확보하는 공동주택으로 계획함.`,
    v => `${v.parkTxt}생활 편의를 가까이 둔 공동주택. ${v.slopeTxt2}세대마다 빛과 바람이 고르게 드는 배치가 핵심임.`
  ],
  shop: [
    v => `${v.stationTxt}${v.streetTxt}1층은 가로에 열린 가게로, 2층 이상은 ${v.view ? `${v.view}을(를) 향한 ` : ''}작은 공방·사무실·카페로 이어지는 근린생활시설.`,
    v => `동네 사람들이 오가며 들르는 근린생활시설. ${v.parkTxt}${v.stationTxt}보행 동선과 맞닿는 전면부를 투명하게 열어 가로의 풍경을 만드는 것이 핵심임.`
  ],
  office: [
    v => `${v.stationTxt}출퇴근 동선이 짧은 업무시설. ${v.view ? `상부 업무 공간에서 ${v.view}을(를) 조망하고, ` : ''}저층부는 방문객을 맞는 열린 로비로 계획함.`,
    v => `일하는 사람의 하루를 편안하게 하는 업무시설. ${v.parkTxt}${v.slopeTxt2}채광과 환기를 고르게 확보하는 평면이 어울림.`
  ],
  culture: [
    v => `${v.view ? `${v.view}의 풍경이 머무는 ` : ''}사람들이 찾아와 오래 머무는 장소. ${v.attrTxt}${v.slopeTxt2}경관을 향해 열린 라운지와 테라스가 공간의 중심이 됨.`,
    v => `${v.attrTxt}지역의 이야기를 담는 문화 공간. ${v.parkTxt}방문객의 동선을 따라 풍경이 차례로 펼쳐지는 구성이 어울림.`
  ],
  work: [v => `차량 동선과 작업 동선을 분리한 생산·보관 공간. ${v.slopeTxt2}하역·주차 공간을 대지 전면에 확보하는 배치가 핵심임.`],
  etc: [v => `대지의 조건을 존중하는 건축. ${v.parkTxt}${v.slopeTxt2}주변 맥락과 어울리는 규모로 계획함.`]
};

/**
 * 용도별 이야기 + 건축 요건 + (기존 건물이 있으면) 용도변경 절차
 * @param {{uses:string[], dirs:Array, ctx:object, terrain:object|null, pnu:string, req:(use:string)=>string[], change:(use:string)=>string|null, allowed:Set<string>|null}} a
 */
export function useStories({uses = [], dirs = [], ctx = {}, terrain = null, pnu = '', req = () => [], change = () => null, allowed = null} = {}) {
  const land = dirs.filter(d => d.name && /경관/.test(d.kind)).sort((a, b) => a.distance - b.distance)[0] || dirs.find(d => d.name);
  const view = land ? `${land.dir}쪽 «${land.name}»` : '';
  const facts = ctx.facts || [];
  const st = facts.find(f => f.startsWith('교통 :')), park = facts.find(f => f.startsWith('녹지 :'));
  const sig = (ctx.signature || []).find(o => /문화시설|관광명소/.test(o.kind));
  const v = {
    view,
    slopeTxt: terrain && terrain.slope >= 3 ? `${terrain.down}쪽으로 내려앉는 경사를 품은 ` : '',
    slopeTxt2: terrain && terrain.slope >= 3 ? `${terrain.down}쪽으로 약 ${terrain.slope.toFixed(0)}% 낮아지는 지형을 살려 레벨을 나누고, ` : '',
    openTxt: terrain && terrain.slope >= 2 && /남/.test(terrain.down) ? '남쪽으로 열린 경사를 따라 ' : '',
    parkTxt: park ? `«${park.split(' : ')[1].replace(/\s[\d,.]+m$/, '')}»이(가) 가까워 ` : '',
    stationTxt: st ? `«${st.split(' : ')[1].split(' ')[0]}»에서 걸어 닿는 ` : '',
    streetTxt: st ? '역으로 향하는 보행 흐름을 받아 ' : '',
    attrTxt: sig ? `«${sig.name}» 등 주변 문화 자원과 이어지는 ` : ''
  };
  return uses.map((u, i) => {
    const list = T[CAT(u)] || T.etc, story = fixJosa(list[(hash(pnu) + i) % list.length](v).replace(/\s+/g, ' ').trim());
    return {use: u, story, requirements: req(u), change: change(u), allowed: allowed ? allowed.has(u) : null};
  });
}
