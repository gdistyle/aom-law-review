import test from 'node:test';
import assert from 'node:assert/strict';
import {sunPosition, kst, shadowVector} from '../public/js/sun.js';

const LAT = 37.5665, LON = 126.978;  // 서울시청
const peak = (m, d) => { let best = {altitude: -90}; for (let h = 11; h <= 14; h++) for (let mi = 0; mi < 60; mi += 2) { const s = sunPosition(LAT, LON, kst(2026, m, d, h, mi)); if (s.altitude > best.altitude) best = s; } return best; };

test('남중 고도: 동지 ≈ 90−위도−23.44°, 하지 ≈ 90−위도+23.44°, 춘분 ≈ 90−위도', () => {
  const w = peak(12, 22), s = peak(6, 21), e = peak(3, 20);
  assert.ok(Math.abs(w.altitude - (90 - LAT - 23.44)) < 0.4, 'winter ' + w.altitude);
  assert.ok(Math.abs(s.altitude - (90 - LAT + 23.44)) < 0.4, 'summer ' + s.altitude);
  assert.ok(Math.abs(e.altitude - (90 - LAT)) < 0.8, 'equinox ' + e.altitude);
  assert.ok(Math.abs(w.azimuth - 180) < 1.5 && Math.abs(s.azimuth - 180) < 3);
});
test('오전에는 해가 남동쪽, 오후에는 남서쪽', () => {
  const am = sunPosition(LAT, LON, kst(2026, 12, 22, 9)), pm = sunPosition(LAT, LON, kst(2026, 12, 22, 15));
  assert.ok(am.azimuth > 90 && am.azimuth < 180); assert.ok(pm.azimuth > 180 && pm.azimuth < 270);
});
test('그림자 벡터: 남중 시 북쪽으로, 길이 = 1/tan(고도)', () => {
  const w = peak(12, 22), v = shadowVector(w);
  assert.ok(v[1] > 0 && Math.abs(v[0]) < 0.1);
  assert.ok(Math.abs(Math.hypot(...v) - 1 / Math.tan(w.altitude * Math.PI / 180)) < 1e-9);
  assert.equal(shadowVector({altitude: 3, azimuth: 180}), null);
});

import {layerShadow, hourlySun} from '../public/js/shadow-ui.js';
test('층 그림자: 10×10 정사각형, 높이 10 m, 북쪽 그림자 벡터 → 북쪽으로 10/tan(고도)만큼 늘어남', () => {
  const sq = [[0, 0], [10, 0], [10, 10], [0, 10]], v = [0, 2];   // 높이 1 m당 북쪽 2 m
  const s = layerShadow(sq, 0, 10, v), ys = s.map(q => q[1]);
  assert.equal(Math.min(...ys), 0); assert.equal(Math.max(...ys), 30);
  assert.equal(hourlySun(37.5, 127, 'winter').length, 7);
});
