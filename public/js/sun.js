/* 태양 위치(고도·방위각) — NOAA 태양 위치 근사식(오차 약 1° 이내).
   방위각: 진북 기준 시계 방향(동 90°, 남 180°). 시각은 한국 표준시(UTC+9). */
const rad = Math.PI / 180, deg = 180 / Math.PI;

/** @param {number} lat 위도 @param {number} lon 경도 @param {Date} date UTC 기준 Date */
export function sunPosition(lat, lon, date) {
  const jd = date.getTime() / 86400000 + 2440587.5, t = (jd - 2451545) / 36525;
  const L0 = (280.46646 + t * (36000.76983 + t * 0.0003032)) % 360;
  const M = 357.52911 + t * (35999.05029 - 0.0001537 * t);
  const e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
  const C = Math.sin(M * rad) * (1.914602 - t * (0.004817 + 0.000014 * t)) + Math.sin(2 * M * rad) * (0.019993 - 0.000101 * t) + Math.sin(3 * M * rad) * 0.000289;
  const trueLong = L0 + C, omega = 125.04 - 1934.136 * t, lambda = trueLong - 0.00569 - 0.00478 * Math.sin(omega * rad);
  const eps0 = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60, eps = eps0 + 0.00256 * Math.cos(omega * rad);
  const decl = Math.asin(Math.sin(eps * rad) * Math.sin(lambda * rad)) * deg;
  const y = Math.tan(eps / 2 * rad) ** 2;
  const eqTime = 4 * deg * (y * Math.sin(2 * L0 * rad) - 2 * e * Math.sin(M * rad) + 4 * e * y * Math.sin(M * rad) * Math.cos(2 * L0 * rad) - 0.5 * y * y * Math.sin(4 * L0 * rad) - 1.25 * e * e * Math.sin(2 * M * rad));
  const minutesUTC = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
  let tst = (minutesUTC + eqTime + 4 * lon) % 1440; if (tst < 0) tst += 1440;
  let ha = tst / 4 - 180; if (ha < -180) ha += 360;
  const cosZ = Math.sin(lat * rad) * Math.sin(decl * rad) + Math.cos(lat * rad) * Math.cos(decl * rad) * Math.cos(ha * rad);
  const zen = Math.acos(Math.max(-1, Math.min(1, cosZ))) * deg, alt = 90 - zen;
  let az = Math.atan2(Math.sin(ha * rad), Math.cos(ha * rad) * Math.sin(lat * rad) - Math.tan(decl * rad) * Math.cos(lat * rad)) * deg + 180;
  az = (az + 360) % 360;
  return {altitude: alt, azimuth: az, declination: decl};
}

/** 한국 표준시 날짜·시각 → Date */
export const kst = (y, m, d, h, min = 0) => new Date(Date.UTC(y, m - 1, d, h - 9, min));

/** 높이 1 m당 그림자 벡터(동 x, 북 y, m). 태양 고도 5° 미만이면 null */
export function shadowVector(sun) {
  if (sun.altitude < 5) return null;
  const k = 1 / Math.tan(sun.altitude * rad), a = sun.azimuth * rad;
  return [-Math.sin(a) * k, -Math.cos(a) * k];
}

export const SEASONS = [
  {id: 'winter', label: '동지', month: 12, day: 22},
  {id: 'equinox', label: '춘분·추분', month: 3, day: 20},
  {id: 'summer', label: '하지', month: 6, day: 21}
];
