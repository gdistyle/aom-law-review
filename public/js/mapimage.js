/**
 * 법규검토서 대지개요용 그림 2장 — 브이월드 지도 타일(WMTS, 교차 출처 허용) 위에 지적선을 직접 그림.
 *  ① 지적도: 브이월드 일반지도 + 필지 경계·지번(대상 필지 빨간 테두리, 도로 회색)
 *  ② 항공사진: 브이월드 영상지도 + 대상 필지 빨간 테두리
 * 이용자 브라우저에서만 만들며 서버로 보내지 않는다.
 */
const W = 760, H = 500;
const px = (lon, lat, z) => { const n = 256 * 2 ** z, r = lat * Math.PI / 180; return [(lon + 180) / 360 * n, (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n]; };
const polysOf = f => { const g = f.geometry; return g?.type === 'Polygon' ? [g.coordinates] : g?.type === 'MultiPolygon' ? g.coordinates : []; };
const isTarget = (p, f) => f.properties?.target || (p.pnu && f.properties?.pnu === p.pnu);
const isRoad = f => f.properties?.category === '도로' || /도$/.test(String(f.properties?.jibun || '').trim());

function loadImg(url) {
  return new Promise((res, rej) => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = () => rej(new Error('지도 타일 수신 실패')); im.src = url; setTimeout(() => rej(new Error('지도 타일 시간 초과')), 15000); });
}

function frame(p) {
  const pts = (p.geometry.parcels || []).filter(f => isTarget(p, f)).flatMap(f => polysOf(f).flatMap(poly => poly[0]));
  if (!pts.length && p.location?.lon != null) pts.push([p.location.lon, p.location.lat]);
  if (!pts.length) return null;
  const lons = pts.map(a => a[0]), lats = pts.map(a => a[1]);
  const c = [(Math.min(...lons) + Math.max(...lons)) / 2, (Math.min(...lats) + Math.max(...lats)) / 2];
  let z = 19;
  for (; z > 14; z--) { const a = px(Math.min(...lons), Math.max(...lats), z), b = px(Math.max(...lons), Math.min(...lats), z); if (Math.max(b[0] - a[0], 1) * 2.4 <= W && Math.max(b[1] - a[1], 1) * 2.4 <= H) break; }
  return {c, z};
}

async function draw(p, cfg, layer, ext, overlay) {
  const f = frame(p); if (!f) return null;
  const {c, z} = f, [cx, cy] = px(c[0], c[1], z), x0 = cx - W / 2, y0 = cy - H / 2;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
  g.fillStyle = '#eee'; g.fillRect(0, 0, W, H);
  const jobs = [];
  for (let ty = Math.floor(y0 / 256); ty <= Math.floor((y0 + H) / 256); ty++) for (let tx = Math.floor(x0 / 256); tx <= Math.floor((x0 + W) / 256); tx++)
    jobs.push(loadImg(`https://api.vworld.kr/req/wmts/1.0.0/${cfg.vworldKey}/${layer}/${z}/${ty}/${tx}.${ext}`).then(im => g.drawImage(im, tx * 256 - x0, ty * 256 - y0)).catch(() => {}));
  await Promise.all(jobs);
  const P = (lon, lat) => { const a = px(lon, lat, z); return [a[0] - x0, a[1] - y0]; };
  overlay(g, P);
  // 축척 막대·방위
  const m = 156543.03392 * Math.cos(c[1] * Math.PI / 180) / 2 ** z, bar = [10, 20, 50, 100].find(v => v / m > 70) || 100;
  g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(10, H - 34, bar / m + 56, 24); g.fillStyle = '#222'; g.fillRect(18, H - 20, bar / m, 3);
  g.font = '12px "맑은 고딕",sans-serif'; g.fillText(`${bar} m`, 24 + bar / m, H - 15); g.font = 'bold 14px sans-serif'; g.fillText('N ↑', W - 40, 22);
  g.font = '10px sans-serif'; g.fillStyle = 'rgba(0,0,0,.6)'; g.fillText('© VWorld', W - 62, H - 8);
  const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
  return {bytes: new Uint8Array(await blob.arrayBuffer()), w: W, h: H};
}

export async function siteImages(p, cfg) {
  if (!cfg?.vworldKey || !(p.geometry.parcels || []).length && p.location?.lon == null) return null;
  const cad = await draw(p, cfg, 'Base', 'png', (g, P) => {
    g.fillStyle = 'rgba(255,255,255,.45)'; g.fillRect(0, 0, W, H);
    for (const f of p.geometry.parcels || []) for (const poly of polysOf(f)) {
      const r = poly[0].map(a => P(a[0], a[1])); g.beginPath(); r.forEach((a, i) => i ? g.lineTo(...a) : g.moveTo(...a)); g.closePath();
      if (isRoad(f)) { g.fillStyle = 'rgba(150,150,150,.35)'; g.fill(); }
      if (isTarget(p, f)) { g.fillStyle = 'rgba(232,56,47,.12)'; g.fill(); }
      g.strokeStyle = isTarget(p, f) ? '#E00000' : 'rgba(40,40,40,.75)'; g.lineWidth = isTarget(p, f) ? 3 : 1; g.stroke();
      const cx = r.reduce((s, a) => s + a[0], 0) / r.length, cy = r.reduce((s, a) => s + a[1], 0) / r.length;
      if (f.properties?.jibun && cx > 0 && cx < W && cy > 0 && cy < H) { g.font = (isTarget(p, f) ? 'bold 14px' : '11px') + ' "맑은 고딕",sans-serif'; g.textAlign = 'center'; g.fillStyle = isTarget(p, f) ? '#C00000' : '#333'; g.fillText(String(f.properties.jibun).replace(/^(\S+?)(\D)$/, '$1 $2'), cx, cy); g.textAlign = 'left'; }
    }
  });
  const photo = await draw(p, cfg, 'Satellite', 'jpeg', (g, P) => {
    for (const f of (p.geometry.parcels || []).filter(f => isTarget(p, f))) for (const poly of polysOf(f)) {
      const r = poly[0].map(a => P(a[0], a[1])); g.beginPath(); r.forEach((a, i) => i ? g.lineTo(...a) : g.moveTo(...a)); g.closePath(); g.strokeStyle = '#FF2D2D'; g.lineWidth = 3; g.stroke();
    }
  });
  return cad && photo ? {cad, photo} : null;
}
