/* 여러 필지 — 필지별 현황과 용도지역이 서로 다른 필지를 합친 대지의 건폐율·용적률 산정.
   ・ 같은 용도지역: 면적 합산 후 그대로 적용(기존 계산).
   ・ 다른 용도지역: 용도지역별로 따로 계산한 최대 건축면적·연면적을 합산하고, 대지 전체의 건폐율·용적률은 면적 가중평균으로 표시.
     근거 조문(「국토의 계획 및 이용에 관한 법률」 제84조, 같은 법 시행령 제94조)은 이용자 브라우저가 받은 현행 원문을 그대로 인용하며,
     원문을 받지 못하면 빨간 글씨로만 표시한다. 한 필지 안에서 용도지역이 나뉘는 경우는 공공 자료로 면적을 알 수 없어 빨간 글씨 경고. */
import {number, datum, fmt} from './core.js';
import {ZONES, getLaw, getArticle, reference, shortLaw} from './legal.js';

const PLAN = '국토의 계획 및 이용에 관한 법률';
const flat = t => String(t || '').replace(/\s+/g, ' ').trim();

/** 필지 목록 (대표 필지 + 추가 필지) */
export function parcelRows(p) {
  const main = {pnu: p.pnu, address: p.address, area: number(p.land?.area?.value), category: p.land?.category?.value || '', zone: p.land?.zone?.value || '',
    zones: (p.land?.zones || []).filter(z => !z.extra && ZONES.includes(z.name)).map(z => z.name), price: number(p.land?.price?.value), priceDate: p.land?.priceDate?.value || '',
    building: {titles: p.building?.titles || [], recaps: p.building?.recaps || [], status: p.building?.status || ''}, main: true};
  const extra = (p.extra || []).map(r => ({pnu: r.pnu, address: r.address, area: number(r.area?.value), category: r.category || '', zone: r.zone || '', zones: r.zones || [],
    price: number(r.price?.value), priceDate: r.priceDate?.value || '', building: r.building || {titles: [], recaps: [], status: ''}}));
  return [main, ...extra];
}

/** 토지비 참고값: 필지별 공시지가 × 필지별 면적의 합 (하나라도 없으면 null) */
export function landRefSum(p) {
  const rows = parcelRows(p);
  if (rows.some(r => r.price == null || r.area == null)) return null;
  return rows.reduce((s, r) => s + r.price * r.area, 0);
}

/** 시행령 제94조 원문에서 ㎡ 기준값 추출 (원문 미수신 시 null) */
export function thresholdFromText(text) {
  const m = flat(text).match(/(\d{3,4})\s*제곱미터/);
  return m ? Number(m[1]) : null;
}

/**
 * @param p 프로젝트
 * @param review reviewProject(p) 결과 (대표 필지 용도지역 기준)
 * @param reviewFn reviewProject 함수 (용도지역별 재계산용)
 */
export function combineZones(p, review, reviewFn) {
  const rows = parcelRows(p);
  if (rows.length < 2 || !review?.limits) return review;
  const groups = new Map();
  for (const r of rows) { const z = r.zone || ''; if (!groups.has(z)) groups.set(z, {zone: z, area: 0, parcels: [], missing: false}); const g = groups.get(z); g.parcels.push(r); if (r.area == null) g.missing = true; else g.area += r.area; }
  const splitInside = rows.filter(r => new Set(r.zones).size > 1);
  const info = {parcels: rows.length, groups: [...groups.values()].map(g => ({zone: g.zone, area: g.area, count: g.parcels.length})), splitInside: splitInside.map(r => r.address)};
  review.multi = info;
  if (groups.size < 2 && !splitInside.length) return review;          // 같은 용도지역 → 기존 합산 계산 그대로
  if (groups.size < 2) { review.multi.note = '한 필지 안에서 용도지역이 나뉘는 필지가 있어, 용도지역별 면적을 공공 자료로 알 수 없음. 최대 규모는 대표 용도지역 기준 참고값.'; review.limits.bcr = {...review.limits.bcr, uncertain: true}; review.limits.far = {...review.limits.far, uncertain: true}; return review; }

  // 용도지역별 재계산
  const per = [];
  for (const g of groups.values()) {
    if (!g.zone || g.missing) { per.push({...g, bcr: null, far: null}); continue; }
    const q = {...p, land: {...p.land, zone: datum(g.zone, '필지별 용도지역', false), area: datum(g.area, '필지 면적 합', false)}, parcels: [], extra: []};
    let L = null; try { L = reviewFn(q).limits; } catch { L = null; }
    per.push({...g, bcr: number(L?.bcr?.value), far: number(L?.far?.value), footprint: number(L?.maxFootprint), gross: number(L?.maxGross)});
  }
  const ok = per.every(g => g.bcr != null && g.far != null && g.area > 0);
  const total = per.reduce((s, g) => s + (g.area || 0), 0);
  const largest = [...per].sort((a, b) => b.area - a.area)[0];
  const smallest = [...per].sort((a, b) => a.area - b.area)[0];
  const law = getLaw(p.laws || [], PLAN), dec = getLaw(p.laws || [], PLAN + ' 시행령');
  const a84 = getArticle(law, 84), a94 = getArticle(dec, 94);
  const thr = thresholdFromText(a94?.text);
  Object.assign(review.multi, {per: per.map(g => ({zone: g.zone, area: g.area, bcr: g.bcr, far: g.far, footprint: g.footprint ?? (g.bcr != null ? g.area * g.bcr / 100 : null), gross: g.gross ?? (g.far != null ? g.area * g.far / 100 : null)})),
    largest: largest?.zone, smallestArea: smallest?.area, threshold: thr, a84: a84 ? flat(a84.text) : '', a94: a94 ? flat(a94.text) : '',
    rule: thr == null ? 'unknown' : smallest.area <= thr ? 'weighted' : 'separate'});
  if (!ok) { review.limits.bcr = {...review.limits.bcr, uncertain: true}; review.limits.far = {...review.limits.far, uncertain: true}; review.multi.note = '일부 필지의 용도지역 또는 면적을 받지 못해 용도지역별 계산 불가 — 대표 필지 기준 참고값.'; return review; }
  const fp = review.multi.per.reduce((s, g) => s + g.footprint, 0), gr = review.multi.per.reduce((s, g) => s + g.gross, 0);
  const wBcr = fp / total * 100, wFar = gr / total * 100;
  const l = review.limits;
  l.bcr = {...l.bcr, value: Math.round(wBcr * 100) / 100, uncertain: true, weighted: true};
  l.far = {...l.far, value: Math.round(wFar * 100) / 100, uncertain: true, weighted: true};
  l.maxFootprint = fp; l.maxGross = gr; l.area = total;
  const ruleText = review.multi.rule === 'weighted' ? `가장 작은 부분(${fmt(smallest.area, 2)}㎡)이 시행령 기준 ${thr}㎡ 이하 → 건폐율·용적률은 면적 가중평균, 그 밖의 건축 제한은 가장 넓은 부분(${largest.zone}) 기준`
    : review.multi.rule === 'separate' ? `가장 작은 부분(${fmt(smallest.area, 2)}㎡)이 시행령 기준 ${thr}㎡ 초과 → 각 부분이 속한 용도지역 기준을 각각 적용 (합계 최대 면적은 부분별 합산)`
    : '시행령 제94조 원문을 받지 못해 적용 기준(가중평균/부분별 적용)을 판정하지 못함 — 부분별 합산값을 참고로 표시';
  review.multi.ruleText = ruleText;
  review.rows = review.rows || [];
  const refs = [reference(p.laws || [], PLAN, 84), reference(p.laws || [], PLAN + ' 시행령', 94)];
  review.rows.unshift({id: 'multi-zone', item: '둘 이상의 용도지역에 걸치는 대지', group: shortLaw(refs[0].name) + ' ' + refs[0].article, refs, target: '여러 필지 · 용도지역 상이', verified: refs.every(x => x.current), judgment: (p.judgments || {})['multi-zone'] || '', text: [
    `[필지별] ${review.multi.per.map(g => `${g.zone} ${fmt(g.area, 2)}㎡ (건폐율 ${fmt(g.bcr)}% · 용적률 ${fmt(g.far)}%)`).join(' / ')}`,
    `[합산] 최대 건축면적 ${fmt(fp, 2)}㎡ · 최대 연면적 ${fmt(gr, 2)}㎡ → 대지 전체 환산 건폐율 ${fmt(wBcr, 2)}% · 용적률 ${fmt(wFar, 2)}%`,
    `[적용] ${ruleText}`,
    a84 ? `[제84조 원문] ${flat(a84.text).slice(0, 700)}` : '[제84조] 현행 원문 미수신',
    a94 ? `[시행령 제94조 원문] ${flat(a94.text).slice(0, 300)}` : '[시행령 제94조] 현행 원문 미수신'].join('\n'), result: '적용', uncertain: true});
  return review;
}
