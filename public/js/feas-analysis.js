/* 사업성 결과 분석·결론 — 계산 결과에서 정해진 규칙으로 문장을 만든다(추정·창작 없음).
   각 문장은 근거 숫자를 함께 적고, 가정값에서 나온 문장은 red=true (빨간 글씨). */
import {feasibility, sensitivity} from './feasibility.js';
import {redFlags, blankItems} from './feas-flags.js';

const PY = 400 / 121;
const won = v => v == null || !Number.isFinite(v) ? '-' : Math.round(v).toLocaleString('ko-KR');
const pc = v => v == null || !Number.isFinite(v) ? '-' : (Math.round(v * 1000) / 10).toFixed(1) + '%';
const num = v => { if (v === null || v === undefined || v === '') return null; const x = Number(String(v).replaceAll(',', '')); return Number.isFinite(x) ? x : null; };
export function eok(v) { if (v == null || !Number.isFinite(v)) return '-'; const a = Math.abs(v), s = v < 0 ? '−' : ''; return a >= 1e8 ? s + (Math.round(a / 1e6) / 100).toLocaleString('ko-KR') + '억 원' : s + Math.round(a / 1e4).toLocaleString('ko-KR') + '만 원'; }

/** 총사업비 구성 (그림용) */
export function costShares(R, mode) {
  const items = [['토지비', R.land + R.landTax, '토지 매입가 + 취득세'], ['공사비', R.build, ''], ['설계·감리', R.design, ''], ['건물 취득세', R.buildTax, ''], ['기타·예비비', R.other + R.cont, ''], ['대출 이자', R.interest, ''], ...(mode === 'sale' ? [['분양 경비', R.saleCost, '']] : [])];
  const tot = items.reduce((s, x) => s + (x[1] > 0 ? x[1] : 0), 0);
  return items.filter(x => x[1] > 0).map(([label, value, note]) => ({label, value, share: tot > 0 ? value / tot : 0, note}));
}

export function analyze(x) {
  const R = feasibility(x), F = redFlags(x), out = {points: [], conclusion: '', level: R.verdict?.level || '', R};
  if (!(R.total > 0)) { out.conclusion = '공사비 단가 등 필수 값이 비어 있어 결과를 분석할 수 없음.'; return out; }
  const add = (text, red = false) => out.points.push({text, red});
  const sh = costShares(R, x.mode).sort((a, b) => b.value - a.value);
  if (sh.length) add(`총사업비 ${eok(R.total)} 중 ${sh[0].label} ${pc(sh[0].share)}${sh[1] ? `, ${sh[1].label} ${pc(sh[1].share)}` : ''} — ${sh[0].label} 비중이 가장 큼.`, F.total);
  const target = num(x.target);
  if (x.mode === 'sale') {
    add(`예상 분양수입 ${eok(R.revenue)}, 예상 이익 ${eok(R.profit)}, 이익률 ${pc(R.margin)}${target != null ? ` (목표 ${target}%)` : ''}.`, F.profit);
    const su = num(x.saleUnit);
    if (R.breakEvenUnit != null && su) {
      const gap = (su - R.breakEvenUnit) / su;
      add(`손익분기 분양가는 평당 ${won(R.breakEvenUnit * PY)}원으로, 입력 분양가(평당 ${won(su * PY)}원)보다 ${pc(Math.abs(gap))} ${gap >= 0 ? '낮음 — 분양가가 이만큼 내려가도 손실은 없음' : '높음 — 현재 분양가로는 손실'}.`, F.total || F.area);
    }
    const s = sensitivity(x); if (s) add(`분양가가 10% 내리면 이익률 ${pc(s[1][0])}, 공사비가 10% 오르면 ${pc(s[2][1])}, 둘이 동시에 일어나면 ${pc(s[2][0])}.`, F.profit);
    if (R.roe != null) add(`대출을 뺀 자기자본(${eok(R.equity)}) 대비 수익률은 ${pc(R.roe)}.`, F.profit || F.loan);
  } else if (x.mode === 'lease') {
    add(`연 순수입 ${eok(R.noi)}, 실투자금 ${eok(R.netInvest)} 대비 임대 수익률 ${pc(R.yield)}${target != null ? ` (목표 ${target}%)` : ''}.`, F.noi || F.netInvest);
    const lr = num(x.loanRate); if (lr != null && R.yield != null) add(`대출금리 ${lr}% 대비 임대 수익률이 ${R.yield * 100 >= lr ? `${(Math.round((R.yield * 100 - lr) * 10) / 10).toFixed(1)}%p 높음 — 대출을 써도 수익이 남는 구조` : `${(Math.round((lr - R.yield * 100) * 10) / 10).toFixed(1)}%p 낮음 — 대출 이자가 수익보다 큰 구조`}.`, F.noi || F.netInvest);
    if (R.payback != null) add(`투자금 회수 기간은 약 ${R.payback.toFixed(1)}년.`, F.noi || F.netInvest);
    const s = sensitivity(x); if (s) add(`임대료가 10% 내리면 임대 수익률 ${pc(s[1][0])}, 공사비가 10% 오르면 ${pc(s[2][1])}.`, F.noi);
    if (R.irr != null) add(`보유 ${x.holdYears}년 기준 내부수익률(IRR) ${pc(R.irr)}.`, F.irr);
  } else {
    add(`연면적 1평당 사업비 ${won(R.total / (x.gross || 1) * PY)}원 (㎡당 ${won(R.perM2)}원).`, F.total);
  }
  const blanks = blankItems(x).length;
  if (blanks) add(`비어 있는 항목 ${blanks}개가 0으로 계산되어 결과가 실제보다 유리하게 나왔을 수 있음.`, true);

  // 결론
  const lv = R.verdict?.level;
  if (x.mode === 'sale') {
    if (R.profit < 0) out.conclusion = `현재 조건으로는 손실(${eok(R.profit)})이 예상되어 사업 추진이 어려움. 분양가를 평당 ${won((R.breakEvenUnit || 0) * PY)}원 이상으로 높이거나 토지비·공사비를 줄여야 함.`;
    else if (lv === 'good') out.conclusion = `이익률 ${pc(R.margin)}로 목표 수익률을 넘어 사업성이 있는 것으로 판단됨. 다만 분양가·공사비 변동에 대비해 실제 시세·견적으로 재확인할 것.`;
    else out.conclusion = `이익은 나지만(이익률 ${pc(R.margin)}) ${target != null ? '목표 수익률에 못 미쳐' : '목표 수익률이 정해지지 않아'} 추가 검토가 필요함. 분양가 상향, 공사비 절감, 연면적 확대 가능성을 함께 검토할 것.`;
  } else if (x.mode === 'lease') {
    if (lv === 'bad') out.conclusion = `임대 수익률(${pc(R.yield)})이 대출금리보다 낮아 대출을 쓰면 손해가 나는 구조. 임대료·공실률·사업비 조건을 다시 검토해야 함.`;
    else if (lv === 'good') out.conclusion = `임대 수익률 ${pc(R.yield)}로 목표를 넘어 임대 사업성이 있는 것으로 판단됨. 공실률·임대료 시세를 실제 조사로 재확인할 것.`;
    else out.conclusion = `임대 수익률 ${pc(R.yield)}로 대출금리보다는 높지만 ${target != null ? '목표에 못 미쳐' : '목표가 정해지지 않아'} 추가 검토가 필요함.`;
  } else out.conclusion = `직접 사용 기준 총사업비는 ${eok(R.total)}이며, 자금 조달 계획(자기자본·대출) 수립이 필요함.`;
  out.conclusionRed = !!(F.total || F.profit || F.noi);
  return out;
}

/** 화면용 그림(SVG): 총사업비 구성 막대 + 민감도 막대 */
export function analysisSVG(x, a) {
  const R = a.R, sh = costShares(R, x.mode); if (!sh.length) return '';
  const colors = ['#F37021', '#3A6EA5', '#8C8F94', '#C9A27A', '#5E9E6E', '#E2B48F', '#7A5FA0'];
  const W = 640; let xx = 0;
  const bar = sh.map((s, i) => { const w = Math.max(0, s.share * W); const r = `<rect x="${xx.toFixed(1)}" y="26" width="${w.toFixed(1)}" height="26" fill="${colors[i % colors.length]}"/>`; xx += w; return r; }).join('');
  const legend = sh.map((s, i) => `<g transform="translate(${(i % 3) * 213},${72 + Math.floor(i / 3) * 24})"><rect width="13" height="13" class="fa-sw" fill="${colors[i % colors.length]}"/><text x="19" y="11" class="fa-t">${s.label} ${(Math.round(s.share * 1000) / 10).toFixed(1)}%</text></g>`).join('');
  const rows = Math.ceil(sh.length / 3);
  let svg = `<svg viewBox="0 0 ${W} ${84 + rows * 24}" class="fa-svg" role="img" aria-label="총사업비 구성"><text x="0" y="16" class="fa-h">총사업비 구성 (${eok(R.total)})</text>${bar}${legend}</svg>`;
  const s = sensitivity(x);
  if (s) {
    const lab = x.mode === 'sale' ? '분양가' : '임대료', base = s[1][1];
    const cases = [[`${lab} −10%`, s[1][0]], ['기본', base], [`${lab} +10%`, s[1][2]], ['공사비 +10%', s[2][1]], [`${lab} −10% · 공사비 +10%`, s[2][0]]].filter(c => c[1] != null && Number.isFinite(c[1]));
    const max = Math.max(0.0001, ...cases.map(c => Math.abs(c[1]))), mid = 430, sc = 150 / max;
    const lines = cases.map((c, i) => { const w = Math.abs(c[1]) * sc, y = 30 + i * 26, neg = c[1] < 0, bx = neg ? mid - w : mid, tx = neg ? bx - 6 : mid + w + 6; return `<text x="0" y="${y + 13}" class="fa-t">${c[0]}</text><rect x="${bx.toFixed(1)}" y="${y}" width="${Math.max(1, w).toFixed(1)}" height="18" fill="${neg ? '#E00000' : c[0] === '기본' ? '#F37021' : '#8C8F94'}"/><text x="${tx.toFixed(1)}" y="${y + 13}" text-anchor="${neg ? 'end' : 'start'}" class="fa-t">${(Math.round(c[1] * 1000) / 10).toFixed(1)}%</text>`; }).join('') + `<line x1="${mid}" y1="24" x2="${mid}" y2="${34 + cases.length * 26}" stroke="currentColor" stroke-width="1"/><text x="${mid}" y="${48 + cases.length * 26}" text-anchor="middle" class="fa-t">0%</text>`;
    svg += `<svg viewBox="0 0 ${W} ${56 + cases.length * 26}" class="fa-svg" role="img" aria-label="민감도"><text x="0" y="16" class="fa-h">${x.mode === 'sale' ? '이익률' : '임대 수익률'} 변화 (0% 왼쪽 빨간 막대 = 손실)</text>${lines}</svg>`;
  }
  return svg;
}
