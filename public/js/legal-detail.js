/**
 * 법규검토 표의 '법규내용' 칸을 항목별로 상세 정리한다.
 * 원칙
 *  - 법제처에서 받은 현행 원문 문장만 인용한다. 문장을 새로 지어내지 않는다.
 *  - 원문에서 숫자를 뽑지 못했거나 값이 둘 이상이면 숫자를 넣지 않는다.
 *  - 계산은 원문에서 뽑은 비율 × 대지면적만 수행한다.
 */
import {norm,fmt,number,totalArea} from './core.js';
import {getLaw,getArticle,DECREE,BLD,BD,PARK,PD,PLAN,APPENDIX_BY_ZONE,shortLaw,USES,GREEN} from './legal.js';

const PY = 0.3025;
const plainLines = t => String(t || '').split('\n').map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
const art = (laws, name, no, branch = '') => getArticle(getLaw(laws, name), no, branch);
const annex = (laws, name, no, branch = '') => getLaw(laws, name)?.annexes?.find(a => a.number === String(no) && a.branch === String(branch)) || null;
const label = (name, no, branch = '') => `「${shortLaw(name)}」 제${no}조${branch ? '의' + branch : ''}`;
const area2 = v => `${fmt(v, 2)} ㎡(${fmt(v * PY, 2)}평)`;

/** 조문 줄 중 정규식에 맞는 줄만. 없으면 첫 항(①) 또는 첫 본문 줄. */
export function pickLines(text, patterns = [], max = 6) {
  const lines = plainLines(text).filter(l => !/^제\d+조(의\d+)?\s*\(/.test(l) || l.length > 40);
  const hit = patterns.length ? lines.filter(l => patterns.some(re => re.test(norm(l)))) : [];
  if (hit.length) return hit.slice(0, max);
  const first = lines.find(l => /^①/.test(l)) || lines[0];
  return first ? [first] : [];
}

/** 별표에서 예정 용도가 제1호(직접 허용)인지 제2호(조례 위임)인지 판정. 문언에 없으면 null. */
export function useClass(text, purpose) {
  if (!text || !purpose) return null;
  const t = String(text);
  const split = t.search(/2\.?\s*도시\s*[ㆍ·]?\s*군계획\s*조례|2\.?\s*도시계획\s*조례/);
  const head = split > 0 ? t.slice(0, split) : t, tail = split > 0 ? t.slice(split) : '';
  const key = norm(purpose);
  const lineIn = s => plainLines(s).find(l => norm(l).includes(key)) || '';
  const h = lineIn(head), tl = lineIn(tail);
  if (h) return {cls: 1, line: h, conditional: /제외|한정|이하|이상|미만|초과|경우|만해당/.test(norm(h))};
  if (tl) return {cls: 2, line: tl, conditional: true};
  return null;
}

function ratioText(p, r, type) {
  const v = r.limits[type], zone = p.land.zone.value || '';
  const no = type === 'bcr' ? 84 : 85, word = type === 'bcr' ? '건폐율' : '용적률';
  const out = [];
  if (v.upper != null) out.push(`[${label(DECREE, no)}] ${zone} : ${type === 'far' ? '상한 ' : ''}${fmt(v.upper)}퍼센트 이하`);
  else out.push(`[${label(DECREE, no)}] 현행 원문 미수신 — 상한 미기재`);
  if (v.local) { const a = v.local.article; out.push(`[「${r.ordinPlanName || '도시계획 조례'}」${a ? ' 제' + a.number + '조' + (a.branch ? '의' + a.branch : '') : ''}${v.local.annex ? ' 별표' + v.local.annex : ''}] ${zone} : ${fmt(v.local.value)}퍼센트 이하`); }
  else out.push('[도시계획 조례] 해당 용도지역 수치 자동 추출 불가 — 조례 원문 대조 대상');
  if (r.limits.district) out.push(`지구단위계획구역 : 지구단위계획(시행지침)에서 정한 ${word}이 우선 적용됨`);
  if (v.gbRule) out.push(`[「개발제한구역법 시행령」 제22조 별표2 제2호나목] 주택·근린생활시설 : ${word} ${fmt(v.value)}% 이하 적용(용도지역 ${fmt(type === 'bcr' ? r.limits.bcrZone : r.limits.farZone)}%보다 우선) · 높이 3층 이하 · 기존 면적 포함 연면적 ${fmt(r.limits.legalHeight?.gb?.gross)}㎡ 이하 / 또는 건폐율 20%·용적률 100% 선택`);
  const area = totalArea(p);
  if (v.value != null && area != null) {
    const x = area * v.value / 100;
    out.push(`${v.provisional ? '(가정) 조례 기준 ' : '적용 '}${word} ${fmt(v.value)}% → 법정 최대 ${type === 'bcr' ? '건축면적' : '용적률 산정용 연면적'} = ${fmt(area, 2)} ㎡ × ${fmt(v.value)}% = ${area2(x)}`);
  }
  return out.join('\n');
}

export function detailRows(p, review, ordinPlanName = '') {
  const L = p.laws, area = totalArea(p), purpose = p.purpose || '';
  const r = {...review, ordinPlanName};
  for (const row of review.rows) {
    let lines = [];
    switch (row.id) {
      case 'district':
        lines = pickLines(art(L, PLAN, 54)?.text, [/지구단위계획에맞게/, /지구단위계획/], 2);
        lines.push('건폐율·용적률·높이·용도·건축선 등은 해당 지구단위계획 결정도서 및 시행지침 기준 적용');
        break;
      case 'bcr': case 'far':
        lines = [ratioText(p, r, row.id)];
        break;
      case 'use': {
        const zone = p.land.zone.value, no = APPENDIX_BY_ZONE[zone];
        const an = annex(L, DECREE, no);
        const c = useClass(an?.text, purpose);
        lines.push(`[「국토계획법 시행령」 제71조 별표${no ?? ''}] ${an?.title || (zone || '') + ' 안에서의 건축 제한'}`);
        if (!an) lines.push('별표 원문 미수신 — 허용 여부 미판정');
        else if (!c) lines.push(/할수없는/.test(norm(an.title)) ? `예정 용도 '${purpose}' : 건축할 수 없는 건축물 목록에 직접 기재되지 않음 (세부 용도 대조 대상)` : `예정 용도 '${purpose}' : 건축할 수 있는 건축물 목록에 직접 기재되지 않음 (건축 불가 또는 세부 용도 대조 대상)`);
        else {
          const neg = /할수없는/.test(norm(an.title));
          if (neg) lines.push(c.cls === 1 ? `예정 용도 '${purpose}' : 제1호(건축할 수 없는 건축물) 해당 → 건축 불가` : `예정 용도 '${purpose}' : 제2호(도시·군계획조례로 정하는 바에 따라 건축할 수 없는 건축물) 해당 → 조례 금지 여부 대조`);
          else lines.push(c.cls === 1 ? `예정 용도 '${purpose}' : 제1호(건축할 수 있는 건축물) 해당` : `예정 용도 '${purpose}' : 제2호(도시·군계획조례가 정하는 바에 따라 건축할 수 있는 건축물) 해당 → 조례 허용 여부 대조`);
          lines.push('원문 : ' + c.line);
          if (c.conditional || neg) row.uncertain = true;
        }
        break;
      }
      case 'road':
        lines = pickLines(art(L, BLD, 44)?.text, [/2미터이상/, /접하여야/], 3);
        break;
      case 'deadend':
        lines = pickLines(art(L, BD, 3, '3')?.text, [/막다른/, /미터미만/, /미터이상/, /너비/], 8);
        break;
      case 'buildingLine':
        lines = pickLines(art(L, BLD, 46)?.text, [/소요너비/, /중심선/, /후퇴/], 3);
        break;
      case 'sunlight': {
        const n = review.limits.north;
        if (n) lines.push(`[${label(BD, 86)}] 정북 방향 인접대지경계선으로부터 높이 ${fmt(n.threshold)}m 이하 부분 ${fmt(n.low)}m 이상, ${fmt(n.threshold)}m 초과 부분 해당 건축물 각 부분 높이의 ${fmt(1 / n.slope)}분의 1 이상 이격`);
        else lines = pickLines(art(L, BD, 86)?.text, [/정북/], 3);
        break;
      }
      case 'landscape': {
        lines = pickLines(art(L, BLD, 42)?.text, [/제곱미터이상/, /조경/], 2);
        lines.push('산식 : ' + (review.limits.landscapeFormula || '산정 불가'));
        { const Lx = review.limits; row.target = Lx.landscapeArea != null ? `조경 ${fmt(Lx.landscapeArea, 2)}㎡ 이상` + (Lx.landscapeOptional ? ' (면제 선택 가능)' : '') : Lx.landscapeExempt ? '조경 의무 없음' : ''; }
        break;
      }
      case 'setback': {
        const an = annex(L, BD, 2);
        lines = an ? pickLines(an.text, purpose ? [new RegExp(norm(purpose).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))] : [], 6) : pickLines(art(L, BD, 80, '2')?.text, [], 2);
        if (an && !lines.some(l => norm(l).includes(norm(purpose)))) lines.unshift('[「건축법 시행령」 별표2] 예정 용도 해당 행 자동 추출 불가 — 별표 대조 대상');
        lines.push('세부 이격거리는 해당 건축조례에서 정함');
        break;
      }
      case 'parking': {
        const an = annex(L, PD, 1);
        const R0 = review.limits;
        lines.push(`[「주차장법 시행령」 제6조 별표1] ${R0.parkingUnit ? R0.parkingPurpose + ' : 시설면적 ' + fmt(R0.parkingUnit) + '㎡당 1대' : (an ? '예정 용도 해당 행 자동 추출 불가 — 별표 대조 대상' : '별표 원문 미수신')}`);
        const u = review.limits.parkingUnit;
        const Lm = review.limits;
        if (u) lines.push(`적용 기준 시설면적 ${fmt(u)} ㎡당 1대${Lm.parkingBasis ? ' [' + Lm.parkingBasis + ']' : ''}`);
        if (Lm.parkingFormula) lines.push('산식 : ' + Lm.parkingFormula);
        lines.push('주차장 설치 및 관리 조례로 설치기준이 강화될 수 있음');
        break;
      }
      case 'height':
        lines = [`${row.target} : 해당 지역·지구 지정 내용 및 결정도서의 높이·층수 기준 적용`];
        break;
      case 'development':
        lines = pickLines(art(L, PLAN, 56)?.text, [/허가/], 3);
        break;
      case 'farmland':
        lines = pickLines(art(L, '농지법', 34)?.text, [/전용하려는자/, /허가/], 2);
        break;
      case 'forest':
        lines = pickLines(art(L, '산지관리법', 14)?.text, [/산지전용을하려는자/, /허가/], 2);
        break;
      case 'greenbelt':
        lines = pickLines(art(L, row.refs[0].name, 12)?.text, [/할수없다/, /허가를받아/], 3);
        lines.push('이축·진입로·형질변경 등 개별 행위의 허용 여부는 시행령 별표 기준 개별 검토');
        break;
      default:
        if (row.id.startsWith('zone-')) lines = row.text ? pickLines(row.text, [], 3) : [];
    }
    const text = lines.filter(Boolean).join('\n');
    if (text) row.text = text;
  }
  // 법적 제재 유의사항: 조문마다 제목과 제1항 원문
  for (const s of review.sanctions) {
    const out = [];
    for (const ref of s.refs) {
      const m = String(ref.article).match(/제(\d+)조(?:의(\d+))?/);
      const a = m ? art(L, ref.name, m[1], m[2] || '') : null;
      const head = `「${shortLaw(ref.name)}」 ${ref.article}${a?.title ? '(' + a.title + ')' : ''}`;
      const body = a ? (a.hang1 || pickLines(a.text, [], 1)[0] || '') : '';
      out.push(body ? `${head} : ${body.replace(/^제\d+조(?:의\d+)?\([^)]*\)\s*/, '')}` : `${head} : 현행 원문 미수신`);
    }
    s.text = out.join('\n');
  }
  return review;
}

/** 법령상 건축 가능한 용도만 추림. 용도지역 별표(허용·금지 목록) + 개발제한구역 시행령 별표1. 원문 미수신이면 null. */
export function allowedUses(p) {
  const zone = p.land.zone.value, no = APPENDIX_BY_ZONE[zone];
  const an = getLaw(p.laws, DECREE)?.annexes?.find(a => a.number === String(no) && !a.branch);
  if (!zone || !an?.text) return null;
  const neg = /할수없는/.test(norm(an.title));
  const gb = (p.land.zones || []).some(z => z.name.includes('개발제한구역'));
  const gbText = gb ? norm(getLaw(p.laws, GREEN + ' 시행령')?.annexes?.find(a => a.number === '1' && !a.branch)?.text || '') : '';
  const out = [];
  for (const u of USES) {
    const c = useClass(an.text, u);
    let ok, cond = false;
    if (neg) { ok = !(c && c.cls === 1); cond = !!c; }
    else { ok = !!c; cond = c ? (c.cls === 2 || c.conditional) : false; }
    // 개발제한구역 대지 신축 허용: 별표1 제5호 다목(주택=단독주택)·라목(근린생활시설)만. 그 밖의 시설은 별도 입지·공익 요건 시설로 제외.
    if (ok && gb) { ok = ['단독주택', '제1종 근린생활시설', '제2종 근린생활시설'].includes(u) && (!gbText || gbText.includes(norm(u === '단독주택' ? '단독주택' : '근린생활시설'))); cond = true; }
    if (ok) out.push({use: u, cond});
  }
  return out;
}
