/* 건축 사전 검토 자료 (초안) — 워드 문서를 양식 없이 처음부터 생성.
   하나의 서식 규칙(글꼴·크기·색·여백·표)으로 통일. 값이 없는 줄·행은 만들지 않음.
   빨간 글씨 = 가정·미대조·원문 미수신 값. 주황 = A.O.M 대표색(제목 표식·표 강조). */
import {esc, fmt, displayDate, titleOf, totalArea, selectedBuilding} from './core.js';
import {shortLaw} from './legal.js';
import {scaleChecklist} from './checklist.js';
import {stripMarks} from './context.js';
import {parcelRows} from './multiparcel.js';
import {permitSteps} from './permits.js';
import {duties, DUTY_NOTE} from './duties.js';
import {charges} from './charges.js';
import {zonePlain} from './zoneplain.js';

const ORANGE = 'F37021', DARK = '303236', GRAY = '6B6E73', LINE = 'D9D9D6', SOFT = 'FFF4EC', HEAD = '3A3B3F', RED = 'E00000';
const PAGE_W = 16838, PAGE_H = 11906, MARGIN = 1134, BODY_W = PAGE_W - MARGIN * 2; // A4 가로, 좌우 2cm
const FONT = '<w:rFonts w:ascii="맑은 고딕" w:hAnsi="맑은 고딕" w:eastAsia="맑은 고딕" w:cs="맑은 고딕"/>';

/* ---------- 기본 조각 ---------- */
function r(text, o = {}) {
  const sz = o.sz || 19;
  return `<w:r><w:rPr>${FONT}${o.b ? '<w:b/>' : ''}<w:color w:val="${o.red ? RED : (o.color || DARK)}"/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/>${o.sp ? `<w:spacing w:val="${o.sp}"/>` : ''}</w:rPr><w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;
}
function runs(text, o = {}) { return String(text ?? '').split('\n').map(t => r(t, o)).join('<w:r><w:br/></w:r>'); }
function p(content, o = {}) {
  const pPr = `<w:pPr><w:widowControl/>${o.keep ? '<w:keepNext/>' : ''}${o.pb ? '<w:pageBreakBefore/>' : ''}`
    + (o.bar ? `<w:pBdr><w:left w:val="single" w:sz="36" w:space="8" w:color="${ORANGE}"/></w:pBdr>` : '')
    + (o.line ? `<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="4" w:color="${o.line}"/></w:pBdr>` : '')
    + (o.shd ? `<w:shd w:val="clear" w:color="auto" w:fill="${o.shd}"/>` : '')
    + `<w:spacing w:before="${o.before ?? 0}" w:after="${o.after ?? 80}" w:line="${o.lh ?? 276}" w:lineRule="auto"/>`
    + `<w:ind w:left="${o.ind ?? 0}" w:right="${o.indR ?? 0}" w:firstLine="0"/><w:jc w:val="${o.jc || 'left'}"/></w:pPr>`;
  return `<w:p>${pPr}${typeof content === 'string' && !content.startsWith('<w:r') ? runs(content, o) : content}</w:p>`;
}
const gap = (h = 120) => `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="${h}" w:lineRule="exact"/></w:pPr></w:p>`;

/* 표: cols=[폭...], head=[제목...], rows=[[셀...]] 셀은 문자열 또는 {t,red,b,jc,fill,color,sz} */
function table(cols, head, rows, o = {}) {
  const border = `<w:tblBorders><w:top w:val="single" w:sz="8" w:color="${HEAD}"/><w:bottom w:val="single" w:sz="8" w:color="${HEAD}"/><w:insideH w:val="single" w:sz="4" w:color="${LINE}"/><w:insideV w:val="single" w:sz="4" w:color="${LINE}"/><w:left w:val="nil"/><w:right w:val="nil"/></w:tblBorders>`;
  const tc = (c, w, rowFill, isHead) => {
    const x = typeof c === 'object' && c !== null ? c : {t: c};
    const fill = isHead ? HEAD : (x.fill || rowFill);
    return `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/><w:vAlign w:val="center"/>${fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>` : ''}<w:tcMar><w:top w:w="${o.pad ?? 70}" w:type="dxa"/><w:bottom w:w="${o.pad ?? 70}" w:type="dxa"/><w:left w:w="110" w:type="dxa"/><w:right w:w="110" w:type="dxa"/></w:tcMar></w:tcPr>`
      + p(runs(x.t ?? '', {sz: x.sz || (isHead ? 18 : o.sz || 18), b: isHead || x.b, color: isHead ? 'FFFFFF' : x.color, red: !isHead && x.red}), {jc: isHead ? 'center' : (x.jc || 'left'), after: 0, lh: 264, keep: !!o.keep}) + '</w:tc>';
  };
  const tr = (cells, i, isHead) => `<w:tr><w:trPr>${isHead ? '<w:tblHeader/>' : ''}<w:cantSplit/></w:trPr>${cells.map((c, k) => tc(c, cols[k], !isHead && o.zebra && i % 2 ? 'F7F7F5' : '', isHead)).join('')}</w:tr>`;
  return `<w:tbl><w:tblPr><w:tblW w:w="${cols.reduce((a, b) => a + b, 0)}" w:type="dxa"/><w:tblLayout w:type="fixed"/>${border}</w:tblPr><w:tblGrid>${cols.map(w => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>`
    + (head ? tr(head, 0, true) : '') + rows.map((row, i) => tr(row, i, false)).join('') + '</w:tbl>';
}
const h1 = (num, text, pb = false) => p(`${r(num + '  ', {sz: 30, b: true, color: ORANGE})}${r(text, {sz: 30, b: true})}`, {bar: false, keep: true, pb, before: pb ? 0 : 360, after: 160, line: LINE});
const h2 = text => p(r(text, {sz: 21, b: true}), {bar: true, keep: true, before: 200, after: 100, ind: 0});
const note = (text, red = false) => p(text, {sz: 16, color: GRAY, red, after: 60});

function picture(rid, id, w, h, cxTw) {
  const cx = Math.round(cxTw / 1440 * 914400), cy = Math.round(cx * h / w);
  return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${id}" name="그림 ${id}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${id}" name="img${id}.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
}

/* ---------- 내용 정리 ---------- */
const val = (d, unit = '') => d?.value == null || d.value === '' ? '' : (typeof d.value === 'number' ? fmt(d.value) : String(d.value)) + unit;
function brief(row) {
  const L = String(row.text || '').replace(/[┌┐└┘├┤┬┴┼─│]+/g, ' ').split('\n').map(x => x.trim()).filter(Boolean);
  const key = L.filter(x => /^\[|^적용|^산식|→|^대공|^개발제한구역 :|^세부|강화될 수/.test(x));
  const first = t => { const m = t.match(/^.{20,180}?(?:다\.|함\.|음\.)/); return m ? m[0] : t.length > 180 ? t.slice(0, 180) + '…' : t; };
  return (key.length ? key : L.slice(0, 1).map(first)).map(x => x.length > 280 ? x.slice(0, 280) + '…' : x).join('\n');
}
function limitsOf(P) {
  const l = P.review?.limits; if (!l || l.maxFootprint == null) return null;
  const cap = Number(P.manual?.floorLimit) > 0, lh = l.legalHeight;
  const floors = cap ? Number(P.manual.floorLimit) : lh?.floors > 0 ? lh.floors : (l.maxGross > 0 && l.maxFootprint > 0 ? Math.ceil(l.maxGross / l.maxFootprint - 1e-9) : null);
  return {l, floors, floorsByRatio: !(cap || lh?.floors > 0), unsure: !!(l.bcr?.uncertain || l.far?.uncertain)};
}
const py = v => fmt(v * 0.3025, 2);

/* ---------- 장 구성 ---------- */
function cover(P, logo) {
  const t = titleOf(P);
  return gap(1400)
    + p_(r('BUILDING PRE-REVIEW', {sz: 18, b: true, color: ORANGE, sp: 40}), {after: 120})
    + p_(r(P.address || t, {sz: 44, b: true}), {after: 120})
    + p_(r('건축 사전 검토 자료 (초안)', {sz: 30, color: GRAY}), {after: 360, line: ORANGE})
    + p_(r(displayDate(P.date), {sz: 22, b: true}) + (P.author ? r(`   ·   작성 ${P.author}`, {sz: 20, color: GRAY}) : ''), {after: 3300})
    + (logo ? p_(picture('rIdLogo', 9001, logo.w, logo.h, 2600), {after: 120}) : p_(r('A.O.M', {sz: 48, b: true, color: ORANGE})))
    + p_(r('A.O.M 종합건축사사무소', {sz: 20, b: true}) + r('   |   경기도 하남시 대청로22번길 17, 206호 (신장동)   ·   031-791-2536', {sz: 18, color: GRAY}), {after: 60})
    + p_(r('본 자료는 공개 자료를 기반으로 자동 작성한 초안으로 참고 자료로만 사용함. 최종 판단은 건축사 검토 및 인허가권자 협의에 따름.', {sz: 16, red: true}), {after: 0});
}
function p_(c, o) { return p(c, o); }

function summary(P, imgs) {
  const L = limitsOf(P), area = totalArea(P);
  let x = h1('', '한눈에 보기', true) + p(r('■ ', {sz: 16, red: true}) + r('빨간 글씨', {sz: 16, b: true, red: true}) + r(' : 가정값(주용도 미선택 등), 조례·지구단위계획 시행지침과 대조하지 못한 값, 법령 원문을 받지 못한 항목. 건축사 검토 시 우선 대조할 사항임.', {sz: 16, color: GRAY}), {after: 120});
  if (L) {
    const {l} = L;
    const cells = [
      ['적용 용도지역', P.land?.zone?.value || '', !!P.land?.zone?.uncertain],
      ['대지면적', area != null ? `${fmt(area, 2)} ㎡` : '', !!P.land?.area?.uncertain],
      ['지상 최대 층수', L.floors ? `${L.floors} 층` : '', L.floorsByRatio],
      ['건폐율', l.bcr?.value != null ? `${fmt(l.bcr.value)} %` : '', !!l.bcr?.uncertain],
      ['용적률', l.far?.value != null ? `${fmt(l.far.value)} %` : '', !!l.far?.uncertain],
      ['부설주차', l.parking != null ? `${fmt(l.parking)} 대` : '', !!l.parkingPurposeAssumed || L.unsure],
      ['최대 건축면적', `${fmt(l.maxFootprint, 2)} ㎡`, L.unsure],
      ['최대 연면적', l.maxGross != null ? `${fmt(l.maxGross, 2)} ㎡` : '', L.unsure],
      ['조경면적', l.landscapeExempt ? '면제 대상' : l.landscapeArea != null ? `${fmt(l.landscapeArea, 2)} ㎡ 이상` : '', L.unsure && !l.landscapeExempt]
    ].filter(c => c[1]);
    const W = Math.floor(BODY_W / 3), rows = [];
    for (let i = 0; i < cells.length; i += 3) {
      const row = cells.slice(i, i + 3); while (row.length < 3) row.push(['', '', false]);
      rows.push(row.map(([k, v, red]) => ({t: k ? `${k}\n` : '', sz: 16, color: GRAY, _v: v, _red: red})));
    }
    const kpi = `<w:tbl><w:tblPr><w:tblW w:w="${W * 3}" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders><w:top w:val="single" w:sz="8" w:color="${HEAD}"/><w:bottom w:val="single" w:sz="8" w:color="${HEAD}"/><w:insideH w:val="single" w:sz="4" w:color="${LINE}"/><w:insideV w:val="single" w:sz="4" w:color="${LINE}"/><w:left w:val="nil"/><w:right w:val="nil"/></w:tblBorders></w:tblPr><w:tblGrid>${('<w:gridCol w:w="' + W + '"/>').repeat(3)}</w:tblGrid>`
      + rows.map(row => `<w:tr><w:trPr><w:cantSplit/></w:trPr>${row.map(c => `<w:tc><w:tcPr><w:tcW w:w="${W}" w:type="dxa"/><w:tcMar><w:top w:w="120" w:type="dxa"/><w:bottom w:w="120" w:type="dxa"/><w:left w:w="200" w:type="dxa"/><w:right w:w="200" w:type="dxa"/></w:tcMar></w:tcPr>${p(r(c.t.trim(), {sz: 16, color: GRAY}), {after: 20})}${p(r(c._v, {sz: 30, b: true, red: c._red}), {after: 0})}</w:tc>`).join('')}</w:tr>`).join('') + '</w:tbl>';
    x += kpi;
    if (L.floorsByRatio || L.unsure || l.parkingPurposeAssumed) x += note([L.floorsByRatio ? '층수는 법정 높이 제한이 아닌 비율 산정치' : '', l.parkingPurposeAssumed ? `부설주차는 ${l.parkingPurpose} 가정` : '', L.unsure ? '조례·지구단위계획 미대조 수치 포함' : ''].filter(Boolean).join(' · '), true);
  }
  if (imgs) {
    const w = Math.floor((BODY_W - 300) / 2);
    x += h2('위치도 (지적도 · 항공사진)') + `<w:tbl><w:tblPr><w:tblW w:w="${BODY_W}" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(s => `<w:${s} w:val="nil"/>`).join('')}</w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="${w}"/><w:gridCol w:w="300"/><w:gridCol w:w="${w}"/></w:tblGrid><w:tr>`
      + [[imgs.cad, 'rIdSite1', 9101, '지적도'], null, [imgs.photo, 'rIdSite2', 9102, '항공사진']].map(c => c
        ? `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/></w:tcPr>${p(picture(c[1], c[2], c[0].w, c[0].h, Math.min(w - 100, Math.round(3900 * c[0].w / Math.max(c[0].h, 1)))), {jc: 'center', after: 40})}${p(r(c[3], {sz: 16, color: GRAY}), {jc: 'center', after: 0})}</w:tc>`
        : `<w:tc><w:tcPr><w:tcW w:w="300" w:type="dxa"/></w:tcPr><w:p/></w:tc>`).join('') + '</w:tr></w:tbl>';
  }
  return x;
}

function siteOverview(P) {
  const area = totalArea(P), zones = (P.land?.zones || []).map(z => z.name).filter(Boolean);
  const rows = [
    ['소재지', P.address + (P.extra?.length ? ` 외 ${P.extra.length}필지` : ''), false],
    ['지목', val(P.land?.category), !!P.land?.category?.uncertain],
    ['대지면적', area != null ? `${fmt(area, 2)} ㎡ (${py(area)} 평)` : '', !!P.land?.area?.uncertain],
    ['개별공시지가', P.land?.price?.value != null ? `${fmt(P.land.price.value)} 원/㎡${P.land?.priceDate?.value ? ` (${P.land.priceDate.value} 기준)` : ''}` : '', !!P.land?.price?.uncertain],
    ['도로접면', val(P.land?.road), !!P.land?.road?.uncertain],
    ['용도지역', val(P.land?.zone), !!P.land?.zone?.uncertain],
    ['지역·지구 등', [...new Set(zones)].join(', '), (P.land?.zones || []).some(z => z.uncertain)]
  ].filter(x => x[1]);
  let x = h1('Ⅰ', '대지 개요') + table([3000, BODY_W - 3000], null, rows.map(([k, v, red]) => [{t: k, b: true, fill: 'F2F2F0', jc: 'center'}, {t: v, red}]));
  { const seen = new Set(), zr = [];
    for (const z of (P.land?.zones || [])) { if (seen.has(z.name)) continue; seen.add(z.name); const zp = zonePlain(z.name); if (zp) zr.push([{t: z.name, b: true, jc: 'center'}, zp.what, {t: zp.effect, color: GRAY, sz: 16}]); }
    if (zr.length) x += h2('지역·지구 쉬운 풀이') + table([3600, 5200, BODY_W - 8800], ['지역·지구', '뜻', '건축 시 영향 (일반)'], zr, {sz: 16, pad: 40, zebra: true}) + note('※ 지정 목적 수준의 일반 설명이며, 개별 필지의 구체적 제한은 Ⅲ장 근거 원문과 인허가권자 협의로 확정.'); }
  const PR = parcelRows(P);
  if (PR.length > 1) {
    const tot = PR.reduce((s, q) => s + (q.area || 0), 0), zs = new Set(PR.map(q => q.zone)), M = P.review?.multi;
    const cw = [1500, 4300, 1700, 1500, 2600]; cw.push(BODY_W - cw.reduce((s, v) => s + v, 0));
    x += h2(`필지별 현황 (${PR.length}필지)`) + table(cw, ['구분', '지번', '면적 (㎡)', '지목', '용도지역', '공시지가 (원/㎡)'],
      [...PR.map((q, i) => [{t: i ? '추가 ' + i : '대표', jc: 'center'}, q.address || '', {t: q.area != null ? fmt(q.area, 2) : '미수집', jc: 'right', red: q.area == null}, {t: q.category, jc: 'center'}, {t: (q.zone || '미수집') + (new Set(q.zones).size > 1 ? ' (필지 안에서 나뉨)' : ''), jc: 'center', red: !q.zone || new Set(q.zones).size > 1}, {t: q.price != null ? fmt(q.price) : '미수집', jc: 'right', red: q.price == null}]),
       [{t: '합계', jc: 'center', b: true, fill: 'FFF4EC'}, {t: '', fill: 'FFF4EC'}, {t: fmt(tot, 2), jc: 'right', b: true, fill: 'FFF4EC'}, {t: '', fill: 'FFF4EC'}, {t: zs.size > 1 ? `용도지역 ${zs.size}개` : [...zs][0] || '', jc: 'center', b: true, red: zs.size > 1, fill: 'FFF4EC'}, {t: '', fill: 'FFF4EC'}]], {sz: 16, pad: 40});
    if (zs.size > 1 && M?.ruleText) x += p(`※ 용도지역이 서로 다른 필지를 합친 대지 : ${M.ruleText}. 대지 전체 환산 건폐율 ${fmt(P.review.limits.bcr?.value)}% · 용적률 ${fmt(P.review.limits.far?.value)}% (「국토의 계획 및 이용에 관한 법률」 제84조, 같은 법 시행령 제94조, Ⅲ장 원문 인용).`, {red: true, sz: 17, after: 80});
    if (M?.note) x += p('※ ' + M.note, {red: true, sz: 17, after: 80});
  }
  const b = selectedBuilding(P);
  x += h2('기존 건축물');
  if (b) {
    const brow = [
      ['건축물명', [b.bldNm, b.dongNm].filter(Boolean).join(' / ')], ['주용도', b.mainPurpsCdNm], ['구조', b.strctCdNm],
      ['규모', [b.ugrndFlrCnt ? `지하 ${b.ugrndFlrCnt}층` : '', b.grndFlrCnt ? `지상 ${b.grndFlrCnt}층` : ''].filter(Boolean).join(' / ')],
      ['건축면적 / 연면적', [b.archArea ? `${fmt(b.archArea, 2)} ㎡` : '', b.totArea ? `${fmt(b.totArea, 2)} ㎡` : ''].filter(Boolean).join(' / ')],
      ['사용승인일', b.useAprDay ? displayDate(b.useAprDay) : '']
    ].filter(v => v[1]);
    x += table([3000, BODY_W - 3000], null, brow.map(([k, v]) => [{t: k, b: true, fill: 'F2F2F0', jc: 'center'}, v]));
    x += p('※ 위반건축물 여부는 공공 자료로 제공되지 않아 본 자료에 반영하지 않았음. 증축·용도변경·대수선·매매 전 세움터(www.eais.go.kr) 건축물대장 표제부 상단의 「위반건축물」 표시 유무를 직접 열람할 것. 위반건축물인 경우 위반 사항 해소 전에는 허가가 제한될 수 있음.', {red: true, sz: 17, b: true, before: 60, after: 80});
  } else x += p(P.building?.status === 'empty' ? '건축물대장 조회 결과 등재 건축물 없음 (나대지 또는 대표 지번 등재 여부 대조 대상)' : '건축물대장 조회 자료 없음', {red: true, sz: 18});
  if (PR.length > 1) {
    const rows = [];
    for (const q of PR.slice(1)) {
      const ts = q.building?.titles || [];
      if (!ts.length) rows.push([q.address || '', {t: q.building?.status === 'empty' ? '등재 건축물 없음' : '건축물대장 조회 자료 없음', red: q.building?.status !== 'empty'}, '', '', '', '']);
      else ts.forEach((t, k) => rows.push([k ? '' : (q.address || ''), [t.bldNm, t.dongNm].filter(Boolean).join(' / ') || '(명칭 없음)', {t: t.mainPurpsCdNm || '', jc: 'center'}, {t: [t.ugrndFlrCnt ? `지하 ${t.ugrndFlrCnt}층` : '', t.grndFlrCnt ? `지상 ${t.grndFlrCnt}층` : ''].filter(Boolean).join(' / '), jc: 'center'}, {t: t.totArea ? fmt(t.totArea, 2) : '', jc: 'right'}, {t: t.useAprDay ? displayDate(t.useAprDay) : '', jc: 'center'}]));
    }
    const cw = [3800, 3600, 2200, 2000, 1600]; cw.push(BODY_W - cw.reduce((a2, b2) => a2 + b2, 0));
    x += h2('추가 필지 기존 건축물') + table(cw, ['지번', '건축물명', '주용도', '규모', '연면적 (㎡)', '사용승인일'], rows, {sz: 16, pad: 40})
      + p('※ 추가 필지도 세움터 건축물대장 표제부에서 「위반건축물」 표시 유무를 각각 열람할 것.', {red: true, sz: 17, after: 80});
  }
  return x;
}

function maxScale(P) {
  const L = limitsOf(P); if (!L) return '';
  const {l} = L, area = totalArea(P);
  const rows = [
    ['적용 건폐율', l.bcr?.value != null ? `${fmt(l.bcr.value)} %` : '', area != null && l.bcr?.value != null ? `${fmt(area, 2)} ㎡ × ${fmt(l.bcr.value)} %` : '', !!l.bcr?.uncertain],
    ['적용 용적률', l.far?.value != null ? `${fmt(l.far.value)} %` : '', area != null && l.far?.value != null ? `${fmt(area, 2)} ㎡ × ${fmt(l.far.value)} %` : '', !!l.far?.uncertain],
    ['법정 최대 건축면적', `${fmt(l.maxFootprint, 2)} ㎡ (${py(l.maxFootprint)} 평)`, '대지면적 × 적용 건폐율', L.unsure],
    ['법정 최대 연면적', l.maxGross != null ? `${fmt(l.maxGross, 2)} ㎡ (${py(l.maxGross)} 평)` : '', '용적률 산정용 연면적 (별도 상한 있을 시 상한 적용)', L.unsure],
    ['지상 최대 층수', L.floors ? `${L.floors} 층` : '', L.floorsByRatio ? '건폐율 가득 적층 시 비율 산정치' : (l.legalHeight?.lines?.[0] || '법령 층수 제한'), L.floorsByRatio],
    ['부설주차', l.parking != null ? `${fmt(l.parking)} 대` : '', l.parkingFormula || '', !!l.parkingPurposeAssumed || L.unsure],
    ['조경면적', l.landscapeExempt ? '조경 의무 면제 대상' : l.landscapeArea != null ? `${fmt(l.landscapeArea, 2)} ㎡ 이상` : '', l.landscapeFormula || '', L.unsure && !l.landscapeExempt]
  ].filter(x => x[1]);
  const fl = Number(P.floors) || null, bs = Number(P.basement) || 0;
  const plan = [
    ['주용도', P.purpose || '미선택', P.purpose ? '05 계획 조건에서 선택' : '주용도 미선택 — 부설주차·조경 등은 가정값으로 산정', !P.purpose],
    ['부용도', P.purpose2 || '없음', '', false],
    ['행위 구분', P.operation || '신축', '', false],
    ['지상 층수', fl ? `${fl} 층` : '', fl && L.floors && fl === L.floors ? '법정 최대 층수 적용' : fl ? `법정 최대 ${L.floors ?? '-'}층 중 선택` : '', L.floorsByRatio],
    ['지하 층수', bs ? `${bs} 층` : '없음', '', false]
  ].filter(x => x[1]);
  return h1('Ⅱ', '계획 조건 및 법정 최대 규모') + h2('계획 조건') + table([3000, 3600, BODY_W - 6600], ['항 목', '적용', '비 고'], plan.map(([k, v, f, red]) => [{t: k, b: true, jc: 'center'}, {t: v, b: true, red, jc: 'center'}, {t: f, sz: 16, color: GRAY, red}]), {zebra: true})
    + h2('법정 최대 규모') + table([3000, 3600, BODY_W - 6600], ['항 목', '산정 결과', '산정 근거'], rows.map(([k, v, f, red]) => [{t: k, b: true, jc: 'center'}, {t: v, b: true, red, jc: 'center'}, {t: f, sz: 16, color: GRAY}]), {zebra: true})
    + (() => { const PS = permitSteps(P); const c = [900, 3800, 3800]; c.push(BODY_W - c.reduce((a2, b2) => a2 + b2, 0));
      return h2('인허가 절차 (일반 순서)') + table(c, ['순서', '절 차', '해당 조건', '비고 · 근거'], PS.steps.map(s => [{t: String(s.no), jc: 'center'}, {t: s.step, b: true, red: s.red}, {t: s.when, sz: 16}, {t: [s.note, s.refs.map(x => `${shortLaw(x.name)} ${x.article}`).join(' · ')].filter(Boolean).join('\n'), sz: 15, color: GRAY, red: s.red}]), {sz: 16, pad: 40})
        + p('※ ' + PS.note, {red: true, sz: 16, after: 60}); })()
    + (() => { if (!P.pnu) return ''; const D = duties(P), lab = {yes: '해당', no: '해당 없음', unknown: '판정 불가'}, c = [2800, 1300, 3400, 2600]; c.push(BODY_W - c.reduce((a2, b2) => a2 + b2, 0));
      return h2('설계 의무 대상 (참고자료)') + table(c, ['항 목', '판 정', '기준 (대표)', '판정에 쓴 규모', '근 거'], D.rows.map(r => [{t: r.item, b: true, jc: 'center'}, {t: lab[r.result], jc: 'center', b: r.result === 'yes', color: r.result === 'yes' ? ORANGE : r.result === 'no' ? GRAY : undefined, red: r.result === 'unknown'}, {t: r.basis, sz: 16}, {t: r.scale, sz: 16, red: true}, {t: `${shortLaw(r.ref.name)} ${r.ref.article}`, sz: 15, jc: 'center', color: GRAY}]), {sz: 16, pad: 40})
        + p('※ ' + DUTY_NOTE, {red: true, sz: 16, after: 60}); })()
    + (() => { const C = charges(P); if (!C.length) return ''; const c = [3600, 3200]; c.push(BODY_W - c.reduce((a2, b2) => a2 + b2, 0));
      return h2('농지·산지 전용 부담금 (개략)') + table(c, ['구 분', '산정 금액', '산정 기준 · 근거'], C.map(x => [{t: x.kind, b: true, jc: 'center'}, {t: x.ok ? `${fmt(Math.round(x.total))} 원` : '자동 산정 안 함', jc: 'center', b: true, red: true}, {t: `${x.note}\n${x.ref.name} ${x.ref.article}`, sz: 15, red: true}]), {sz: 16, pad: 40}); })();
}

function lawReview(P) {
  const rows = P.review.rows.filter(rw => String(rw.text || '').trim() || String(rw.target || '').trim());
  const empty = [...new Set(P.review.rows.filter(rw => !String(rw.text || '').trim() && !String(rw.target || '').trim()).map(rw => rw.item))];
  const t = rows.map(rw => [
    {t: rw.item, b: true, jc: 'center'},
    {t: rw.target || '-', jc: 'center', red: rw.uncertain},
    {t: brief(rw), red: !rw.verified, sz: 17},
    {t: (rw.refs || []).map(x => shortLaw(x.name) + ' ' + x.article).filter(Boolean).slice(0, 3).join('\n') || rw.group, sz: 16, color: GRAY, red: rw.refs?.some(x => !x.current)}
  ]);
  if (empty.length) t.push([{t: '기타 지역·지구', b: true, jc: 'center'}, {t: '지정', jc: 'center'}, {t: empty.join(', ') + '\n각 지정 근거 법령에 따른 행위제한 적용 — 관계 기관 협의·개별 확인 대상', red: true, sz: 17}, {t: '토지이용계획 확인', sz: 16, color: GRAY}]);
  let x = h1('Ⅲ', '관련 법규 검토 (참고)') + table([2400, 2300, BODY_W - 2400 - 2300 - 2900, 2900], ['항 목', '대 상', '검토 내용', '근거 조문'], t, {zebra: true});
  const L = limitsOf(P);
  if (L) {
    const ck = scaleChecklist({zone: P.land?.zone?.value || '', purpose: P.purpose || '', floors: L.floors, gross: L.l.maxGross});
    if (ck.length) x += h2('규모별 검토 항목 (법정 최대 규모로 건축 시)') + table([3000, 3400, BODY_W - 3000 - 3400 - 3000, 3000], ['항 목', '판 정', '기 준', '근 거'], ck.map(c => [{t: c.item, b: true, jc: 'center'}, {t: c.result, red: true, jc: 'center'}, {t: c.basis, sz: 17}, {t: c.law, sz: 16, color: GRAY}]), {zebra: true});
  }
  return x;
}

function context(P) {
  const c = P.context; if (!c || !(c.facts?.length || c.concepts?.length)) return '';
  const rows = [];
  if (c.character) rows.push(['분위기', c.character]);
  for (const f of c.facts || []) { const k = f.indexOf(' : '); rows.push(k > 0 ? [f.slice(0, k), f.slice(k + 3)] : ['현황', f]); }
  if (c.signature?.length) rows.push(['주변 주요 시설', c.signature.map(o => `${o.name} (${o.kind}, ${Math.round(o.distance).toLocaleString('ko-KR')}m)`).join('\n')]);
  if (c.concepts?.length) rows.push(['계획 착안점', c.concepts.map(x => '· ' + x).join('\n')]);
  if (c.dirSentence) rows.unshift(['동서남북', stripMarks(c.dirSentence)]);
  let x = h1('Ⅴ', '대지 특성 · 건축 컨셉 (참고)') + table([3000, BODY_W - 3000], null, rows.map(([k, v]) => [{t: k, b: true, fill: 'F2F2F0', jc: 'center'}, v]));
  if (c.stories?.length) {
    const reqW = 5200, useW = 2400, storyW = BODY_W - useW - reqW;
    x += h2('용도별 건축 이야기 · 건축 요건') + table([useW, storyW, reqW], ['용 도', '건축 이야기', '건축 요건'], c.stories.map(st => [
      {t: st.use + (st.allowed === false ? '\n(허용 용도 아님)' : c.usesFromFallback ? '\n(허용 여부 대조 대상)' : ''), b: true, jc: 'center', red: st.allowed === false || c.usesFromFallback},
      {t: stripMarks(st.story), sz: 18},
      {t: (st.requirements || []).map(q => '· ' + q).join('\n') + (st.change ? '\n· 용도변경: ' + st.change : ''), sz: 16, red: true}
    ]), {zebra: true});
  }

  if (c.story) x += h2('요약') + p(c.story, {sz: 19, lh: 300});
  if (c.cautions?.length) x += note(c.cautions.map(s => '· ' + s).join('\n'), true);
  if (c.assumptions?.length) x += note('※ ' + c.assumptions.join(' · '));
  return x;
}

function sanctions(P) {
  const art = t => [...new Set(String(t || '').split('\n').map(s => s.trim()).filter(s => /^「/.test(s)).map(s => { const m = s.match(/^(「[^」]+」\s*제[\d조의\s]+(?:\([^)]*\))?)/); return m ? m[1].trim() : s.split(' : ')[0]; }))];
  const num = 'Ⅳ';
  return h1(num, '법적 제재 유의사항')
    + table([4200, BODY_W - 4200], ['위반 유형', '관련 조문'], P.review.sanctions.map(s => [{t: s.item, b: true}, art(s.text).join('\n') || s.text]), {zebra: true})
    + note('위반 시 공사 중지·철거 등 시정명령, 이행강제금 및 벌칙이 부과될 수 있음. 세부 기준은 각 조문 원문 확인.');
}

function closing() {
  const box = (t, o = {}) => p(t, {shd: SOFT, ind: 200, indR: 200, keep: true, ...o});
  return box(r('건축 상담   ', {sz: 18, b: true, color: ORANGE}) + r('A.O.M 종합건축사사무소', {sz: 22, b: true}) + r('   신축 · 증축 · 용도변경 · 대수선 · 리모델링 · 인허가', {sz: 18, b: true}), {before: 160, after: 30})
    + box(r('본 자료를 기초로 대지의 실제 건축 가능 규모·인허가 절차·사업성을 건축사가 직접 검토함.', {sz: 18}), {after: 30})
    + box(r('전화 031-791-2536   ·   https://aomand.com   ·   경기도 하남시 대청로22번길 17, 206호 (신장동)', {sz: 18, color: GRAY}), {after: 0});
}

/* ---------- 패키지 ---------- */
const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
function header(title = '건축 사전 검토 자료 (초안)') {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr ${NS}>${p(r('A.O.M', {sz: 16, b: true, color: ORANGE}) + r('   ' + title, {sz: 16, color: GRAY}), {jc: 'right', after: 0, line: LINE})}</w:hdr>`;
}
function footer(tag = '참고용 초안') {
  const fld = `<w:r><w:rPr>${FONT}<w:color w:val="${GRAY}"/><w:sz w:val="16"/></w:rPr><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:rPr>${FONT}<w:sz w:val="16"/></w:rPr><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:rPr>${FONT}<w:sz w:val="16"/></w:rPr><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:rPr>${FONT}<w:color w:val="${GRAY}"/><w:sz w:val="16"/></w:rPr><w:t>1</w:t></w:r><w:r><w:rPr>${FONT}<w:sz w:val="16"/></w:rPr><w:fldChar w:fldCharType="end"/></w:r>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr ${NS}><w:p><w:pPr><w:tabs><w:tab w:val="right" w:pos="${BODY_W}"/></w:tabs><w:spacing w:after="0"/></w:pPr>${r('A.O.M 종합건축사사무소  ·  031-791-2536  ·  ' + tag, {sz: 16, color: GRAY})}<w:r><w:tab/></w:r>${fld}</w:p></w:ftr>`;
}
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr>${FONT}<w:sz w:val="19"/><w:szCs w:val="19"/><w:lang w:val="ko-KR" w:eastAsia="ko-KR"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="80" w:line="276" w:lineRule="auto"/><w:jc w:val="left"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style><w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:left w:w="108" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style></w:styles>`;

export async function exportReport(P, imgs = null, logo = null) {
  const body = cover(P, logo) + summary(P, imgs) + siteOverview(P) + maxScale(P) + lawReview(P) + sanctions(P) + context(P) + closing();
  return packDocx(body, {title: '건축 사전 검토 자료 (초안)', author: P.author, imgs, logo});
}

/** 같은 서식(A4 가로·머리말·꼬리말)으로 워드 패키지 생성 — 다른 보고서에서도 사용 */
export async function packDocx(body, {title, author = '', imgs = null, logo = null, tag = '참고용 초안'} = {}) {
  if (typeof JSZip === 'undefined') throw new Error('압축 모듈 미로드');
  const sect = `<w:sectPr><w:headerReference w:type="default" r:id="rIdH"/><w:footerReference w:type="default" r:id="rIdF"/><w:pgSz w:w="${PAGE_W}" w:h="${PAGE_H}" w:orient="landscape"/><w:pgMar w:top="1134" w:right="${MARGIN}" w:bottom="1020" w:left="${MARGIN}" w:header="567" w:footer="510" w:gutter="0"/><w:titlePg/></w:sectPr>`;
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${body}${sect}</w:body></w:document>`;
  const zip = new JSZip();
  const rels = ['<Relationship Id="rIdS" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>',
    '<Relationship Id="rIdH" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>',
    '<Relationship Id="rIdF" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>'];
  if (imgs) { zip.file('word/media/site_cad.png', imgs.cad.bytes); zip.file('word/media/site_photo.png', imgs.photo.bytes); rels.push('<Relationship Id="rIdSite1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/site_cad.png"/>', '<Relationship Id="rIdSite2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/site_photo.png"/>'); }
  if (logo) { zip.file('word/media/logo.png', logo.bytes); rels.push('<Relationship Id="rIdLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo.png"/>'); }
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>');
  zip.file('docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${esc(title)}</dc:title><dc:creator>${esc(author || 'A.O.M 종합건축사사무소')}</dc:creator></cp:coreProperties>`);
  zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join('')}</Relationships>`);
  zip.file('word/document.xml', doc); zip.file('word/styles.xml', STYLES); zip.file('word/header1.xml', header(title)); zip.file('word/footer1.xml', footer(tag));
  return zip.generateAsync({type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
}

/* 다른 보고서용 서식 조각 공유 */
export const W = {r, runs, p, gap, table, h1, h2, note, picture, val, ORANGE, DARK, GRAY, LINE, SOFT, HEAD, RED, BODY_W};
