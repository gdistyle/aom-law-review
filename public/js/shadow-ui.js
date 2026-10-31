/* 일조·그림자 평면도 — 3D 볼륨(층별 바닥 모양·높이)의 그림자를 동지·춘추분·하지 9~15시로 그림.
   방위표(진북), 축척, 시간별 태양 방향, 주변 필지 외곽 표시. 지형·주변 건물 높이 미반영(빨간 안내). */
import {sunPosition, kst, shadowVector, SEASONS} from './sun.js';

const esc = v => String(v ?? '').replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
function hull(pts) {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]); if (p.length < 3) return p;
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo.at(-2), lo.at(-1), q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.slice().reverse()) { while (up.length >= 2 && cr(up.at(-2), up.at(-1), q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
/** 층(z~z+h) 바닥 조각 하나의 지면 그림자(볼록 조각 기준) */
export function layerShadow(piece, z, h, v) {
  const top = z + h;
  return hull([...piece.map(q => [q[0] + v[0] * z, q[1] + v[1] * z]), ...piece.map(q => [q[0] + v[0] * top, q[1] + v[1] * top])]);
}
export function hourlySun(lat, lon, season, year = new Date().getFullYear()) {
  const s = SEASONS.find(x => x.id === season) || SEASONS[0];
  return [9, 10, 11, 12, 13, 14, 15].map(h => ({h, sun: sunPosition(lat, lon, kst(year, s.month, s.day, h))})).map(o => ({...o, v: shadowVector(o.sun)}));
}

export function renderShadow(box, p, model, site, state = {}) {
  if (!box) return;
  if (!p.pnu || !site || !model) { box.innerHTML = p.pnu ? '<h3>일조 · 그림자</h3><p class="small">3D 볼륨이 만들어지면 그림자를 그립니다.</p>' : ''; return; }
  const season = state.season || 'winter';
  const [lon, lat] = site.origin;
  const hours = hourlySun(lat, lon, season);
  const H = model.height || 0;
  // 범위: 대지 + 그림자 최대 범위
  const pts = site.rings.flat();
  for (const o of hours) if (o.v) for (const q of site.rings.flat()) pts.push([q[0] + o.v[0] * H, q[1] + o.v[1] * H]);
  let minX = Math.min(...pts.map(q => q[0])), maxX = Math.max(...pts.map(q => q[0])), minY = Math.min(...pts.map(q => q[1])), maxY = Math.max(...pts.map(q => q[1]));
  const pad = Math.max(8, (maxX - minX + maxY - minY) * 0.06); minX -= pad; maxX += pad; minY -= pad; maxY += pad;
  const W = 760, Hh = 560, sc = Math.min(W / (maxX - minX), Hh / (maxY - minY));
  const X = x => (x - minX) * sc + (W - (maxX - minX) * sc) / 2, Y = y => Hh - ((y - minY) * sc + (Hh - (maxY - minY) * sc) / 2);
  const path = poly => poly.map((q, i) => `${i ? 'L' : 'M'}${X(q[0]).toFixed(1)},${Y(q[1]).toFixed(1)}`).join('') + 'Z';
  // 주변 필지
  let around = '';
  try { for (const f of (p.geometry?.parcels || [])) { const polys = f.geometry?.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry?.type === 'MultiPolygon' ? f.geometry.coordinates : []; for (const pg of polys) around += `<path d="${path(pg[0].map(site.project))}" class="sh-par"/>`; } } catch {}
  // 그림자
  let shadows = '';
  for (const o of hours) { if (!o.v) continue; for (const L of model.layers) for (const pc of L.pieces) shadows += `<path d="${path(layerShadow(pc, L.z, L.height, o.v))}" class="sh-shadow"/>`; }
  const foot = model.layers[0]?.pieces.map(pc => `<path d="${path(pc)}" class="sh-bld"/>`).join('') || '';
  const siteP = site.rings.map(r => `<path d="${path(r)}" class="sh-site"/>`).join('');
  // 태양 방향 화살표(오른쪽 아래 원)
  const cx = 92, cy = 104, R = 56;
  const arrows = hours.filter(o => o.sun.altitude > 0).map(o => { const a = o.sun.azimuth * Math.PI / 180, x = cx + Math.sin(a) * R, y = cy - Math.cos(a) * R; return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" class="sh-ray"/><text x="${(cx + Math.sin(a) * (R + 16)).toFixed(1)}" y="${(cy - Math.cos(a) * (R + 16) + 4).toFixed(1)}" text-anchor="middle" class="sh-t">${o.h}</text>`; }).join('');
  // 축척 막대
  const nice = [5, 10, 20, 50, 100, 200].find(m => m * sc > 60) || 200, bx = W - 30 - nice * sc;
  const svg = `<svg viewBox="0 0 ${W} ${Hh}" class="sh-svg" role="img" aria-label="일조 그림자 평면도">
    <rect width="${W}" height="${Hh}" class="sh-bg"/>${around}${shadows}${siteP}${foot}
    <g transform="translate(${W - 44},44)"><circle r="22" class="sh-nc"/><path d="M0,-18 L7,8 L0,3 L-7,8 Z" class="sh-n"/><text y="-26" text-anchor="middle" class="sh-nt">N</text></g>
    <g><circle cx="${cx}" cy="${cy}" r="${R}" class="sh-sunc"/>${arrows}<text x="${cx}" y="${cy - R - 16}" text-anchor="middle" class="sh-t sh-cap">태양 방향 (숫자 = 시각)</text></g>
    <g transform="translate(${bx},${Hh - 26})"><rect width="${nice * sc}" height="5" class="sh-scale"/><text x="${nice * sc / 2}" y="-5" text-anchor="middle" class="sh-t">${nice} m</text></g></svg>`;
  const rows = hours.map(o => `<tr><td>${o.h}:00</td><td>${o.sun.altitude.toFixed(1)}°</td><td>${o.sun.azimuth.toFixed(1)}°</td><td>${o.v ? (Math.hypot(...o.v) * 10).toFixed(1) + ' m' : '—'}</td></tr>`).join('');
  box.innerHTML = `<h3>일조 · 그림자 <small>(${esc(model.name)}, 높이 ${H.toFixed(1)} m)</small></h3>
    <div class="sh-chips">${SEASONS.map(s => `<button type="button" class="feas-chip${s.id === season ? ' on' : ''}" data-season="${s.id}"><b>${s.label}</b><small>${s.month}월 ${s.day}일 9~15시</small></button>`).join('')}</div>
    <div class="sh-wrap">${svg}</div>
    <p class="small">진한 부분일수록 그림자가 오래 머무는 곳입니다(9~15시 1시간 간격 겹침). 위쪽이 진북입니다. 주황 선 = 대상 대지, 회색 선 = 주변 필지.</p>
    <table class="feas-auto sh-table"><thead><tr><th>시각</th><th>태양 고도</th><th>태양 방위 (진북 기준)</th><th>높이 10 m 건물의 그림자 길이</th></tr></thead><tbody>${rows}</tbody></table>
    <p class="uncertain small">법정 최대 볼륨(가정 모델) 기준 개략 그림자이며, 지형 높낮이·주변 건물 높이·처마 등은 반영하지 않음. 일조권 등 법적 판단 자료가 아님. 태양 위치는 NOAA 근사식(오차 약 1°).</p>`;
  box.querySelectorAll('[data-season]').forEach(b => b.onclick = () => { state.season = b.dataset.season; renderShadow(box, p, model, site, state); });
}
