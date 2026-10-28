/**
 * 대지 경계 선택기 — 평면도에서 변을 클릭해 '도로측'·'정북측' 경계를 지정.
 * 자동 추천: 정북측 = 바깥 방향이 북쪽(±45°)인 변 / 도로측 = 지목 '도로' 필지와 1.5 m 이내로 붙은 변.
 */
import {siteGeometry} from './geometry.js';

const isRoad = f => f.properties?.category === '도로' || /도$/.test(String(f.properties?.jibun || '').trim());
function signedArea(r) { let s = 0; for (let i = 0; i < r.length; i++) { const a = r[i], b = r[(i + 1) % r.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; }
function segDist(p, a, b) { const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy; let t = L ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L : 0; t = Math.max(0, Math.min(1, t)); const x = a[0] + t * dx - p[0], y = a[1] + t * dy - p[1]; return Math.hypot(x, y); }
function rings(f, project) { const g = f.geometry; const polys = g?.type === 'Polygon' ? [g.coordinates] : g?.type === 'MultiPolygon' ? g.coordinates : []; return polys.map(poly => poly[0].map(project)); }

export function suggestEdges(p) {
  const site = siteGeometry(p); if (!site) return {north: [], road: []};
  const north = [], road = [];
  const roadRings = (p.geometry.parcels || []).filter(isRoad).flatMap(f => rings(f, site.project));
  for (const e of site.edges) {
    const r = site.rings[e.ring], ccw = signedArea(r) > 0;
    const dx = e.b[0] - e.a[0], dy = e.b[1] - e.a[1], len = Math.hypot(dx, dy) || 1;
    const nx = (ccw ? dy : -dy) / len, ny = (ccw ? -dx : dx) / len; // 바깥 방향 법선
    if (ny > Math.SQRT1_2) north.push(e.index);
    const mid = [(e.a[0] + e.b[0]) / 2, (e.a[1] + e.b[1]) / 2];
    if (roadRings.some(rr => rr.some((a, i) => segDist(mid, a, rr[(i + 1) % rr.length]) < 1.5))) road.push(e.index);
  }
  return {north, road};
}

export function drawEdgePicker(host, p, state, onChange) {
  const site = siteGeometry(p);
  if (!site) { host.innerHTML = '<p class="uncertain">대상 필지 경계 자료가 없어 평면도를 그릴 수 없습니다. [주변 지적·건물 새로 조회]를 먼저 누르십시오.</p>'; return; }
  const b = site.bounds, pad = Math.max(b.maxX - b.minX, b.maxY - b.minY) * 0.6 + 8;
  const minX = b.minX - pad, maxX = b.maxX + pad, minY = b.minY - pad, maxY = b.maxY + pad;
  const W = 560, H = Math.round(W * (maxY - minY) / (maxX - minX)) || 360, sx = W / (maxX - minX);
  const X = x => ((x - minX) * sx).toFixed(1), Y = y => ((maxY - y) * sx).toFixed(1);
  let svg = `<svg viewBox="0 0 ${W} ${H}" class="edge-svg" role="img" aria-label="대지 경계 선택 평면도">`;
  for (const f of p.geometry.parcels || []) {
    if (f.properties?.target || f.properties?.pnu === p.pnu) continue;
    for (const r of rings(f, site.project)) {
      svg += `<polygon points="${r.map(a => X(a[0]) + ',' + Y(a[1])).join(' ')}" class="${isRoad(f) ? 'nb-road' : 'nb'}"/>`;
      const c = r.reduce((s, a) => [s[0] + a[0] / r.length, s[1] + a[1] / r.length], [0, 0]);
      if (c[0] > minX && c[0] < maxX && c[1] > minY && c[1] < maxY && f.properties?.jibun) svg += `<text x="${X(c[0])}" y="${Y(c[1])}" class="nb-t">${String(f.properties.jibun).replace(/[<&>]/g, '')}</text>`;
    }
  }
  for (const r of site.rings) svg += `<polygon points="${r.map(a => X(a[0]) + ',' + Y(a[1])).join(' ')}" class="site"/>`;
  for (const e of site.edges) {
    const cls = state.road.includes(e.index) && state.north.includes(e.index) ? 'both' : state.road.includes(e.index) ? 'road' : state.north.includes(e.index) ? 'north' : 'plain';
    const mx = (e.a[0] + e.b[0]) / 2, my = (e.a[1] + e.b[1]) / 2;
    svg += `<g class="edge ${cls}" data-edge="${e.index}"><line x1="${X(e.a[0])}" y1="${Y(e.a[1])}" x2="${X(e.b[0])}" y2="${Y(e.b[1])}" class="hit"/><line x1="${X(e.a[0])}" y1="${Y(e.a[1])}" x2="${X(e.b[0])}" y2="${Y(e.b[1])}" class="vis"/><circle cx="${X(mx)}" cy="${Y(my)}" r="9"/><text x="${X(mx)}" y="${Y(my)}">${e.index}</text></g>`;
  }
  svg += `<g class="north-arrow" transform="translate(${W - 34},40)"><path d="M0,-22 L8,6 L0,0 L-8,6 Z"/><text y="22">N</text></g></svg>`;
  host.innerHTML = `<div class="edge-tools"><span>선택 대상</span><label><input type="radio" name="edgeMode" value="road"${state.mode !== 'north' ? ' checked' : ''}> <b class="c-road">도로측 경계</b> (건축선 후퇴 기준)</label><label><input type="radio" name="edgeMode" value="north"${state.mode === 'north' ? ' checked' : ''}> <b class="c-north">정북측 경계</b> (일조 사선 기준)</label><button type="button" data-edge-auto>자동 추천</button><button type="button" data-edge-clear>모두 해제</button></div>${svg}<p class="small">변을 클릭하면 선택·해제됩니다. 파란 선 = 도로측, 주황 선 = 정북측, 연한 파란 면 = 지목 '도로' 필지. 자동 추천은 가정이므로 현장 도로 현황과 대조하십시오.</p>`;
  for (const r of host.querySelectorAll('[name="edgeMode"]')) r.onchange = () => { state.mode = r.value; };
  for (const g of host.querySelectorAll('[data-edge]')) g.onclick = () => {
    const i = +g.dataset.edge, key = state.mode === 'north' ? 'north' : 'road';
    state[key] = state[key].includes(i) ? state[key].filter(x => x !== i) : [...state[key], i].sort((a, b) => a - b);
    onChange(state); drawEdgePicker(host, p, state, onChange);
  };
  host.querySelector('[data-edge-auto]').onclick = () => { const s = suggestEdges(p); state.north = s.north; state.road = s.road; onChange(state); drawEdgePicker(host, p, state, onChange); };
  host.querySelector('[data-edge-clear]').onclick = () => { state.north = []; state.road = []; onChange(state); drawEdgePicker(host, p, state, onChange); };
}
