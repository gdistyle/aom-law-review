/**
 * 브이월드 직접 조회 — 이용자 브라우저에서 JSONP로 호출.
 * 브이월드는 해외 서버(Cloudflare) 요청을 차단하고 교차 출처 fetch를 허용하지 않으므로,
 * 브이월드가 웹페이지용으로 제공하는 callback(JSONP) 방식을 사용한다.
 * 인증키는 발급 시 등록한 서비스 URL(domain)에서만 동작한다.
 */
import {array, number} from './core.js';

const LAND_OPS = {use: 'getLandUseAttr', characteristics: 'getLandCharacteristics', price: 'getIndvdLandPriceAttr'};
const LAND_FIELDS = ['pnu','ldCode','ldCodeNm','mnnmSlno','stdrYear','stdrMt','stdrDe','lndcgrCodeNm','lndpclAr','pblntfPclnd','roadSideCodeNm','tpgrphHgCodeNm','tpgrphFrmCodeNm','prposArea1Nm','prposArea2Nm','prposAreaDstrcCode','prposAreaDstrcCodeNm','cnflcAt','cnflcAtNm','lawNm','lastUpdtDt'];
const pick = (obj, keys) => Object.fromEntries(keys.filter(k => obj?.[k] !== undefined).map(k => [k, obj[k]]));

function jsonp(url, timeout = 20000) {
  return new Promise((resolve, reject) => {
    const cb = 'vw_' + Math.random().toString(36).slice(2);
    const s = document.createElement('script');
    const done = () => { delete window[cb]; s.remove(); clearTimeout(t); };
    const t = setTimeout(() => { done(); reject(new Error('브이월드 응답 시간 초과')); }, timeout);
    window[cb] = data => { done(); resolve(data); };
    s.onerror = () => { done(); reject(new Error('브이월드 자료 수신 실패')); };
    url.searchParams.set('callback', cb);
    s.src = url.toString();
    document.head.appendChild(s);
  });
}

function fieldRows(node, out = []) {
  if (!node || typeof node !== 'object') return out;
  if (!Array.isArray(node) && ('pnu' in node) && Object.keys(node).some(k => LAND_FIELDS.includes(k) && k !== 'pnu')) { out.push(node); return out; }
  for (const v of Object.values(node)) if (typeof v === 'object') fieldRows(v, out);
  return out;
}
function findTotal(node) {
  if (!node || typeof node !== 'object') return null;
  for (const k of ['totalCount', 'totalCnt']) if (node[k] !== undefined) return number(node[k]);
  for (const v of Object.values(node)) { const r = findTotal(v); if (r !== null) return r; }
  return null;
}
function geoClean(g) {
  if (!g || !['Polygon','MultiPolygon','LineString','MultiLineString'].includes(g.type)) return null;
  const walk = x => (typeof x[0] === 'number' ? x.slice(0, 2) : x.map(walk));
  return {type: g.type, coordinates: walk(g.coordinates)};
}
const src = name => ({name, url: 'https://www.vworld.kr', retrievedAt: new Date().toISOString()});

export async function vworldApi(path, params, cfg) {
  const key = cfg?.vworldKey, domain = cfg?.vworldDomain;
  if (!key || !domain) return {ok: false, code: 'NOT_CONFIGURED', message: '자료 연결 전'};
  const page = String(params.page || 1);
  if (path === '/api/land') {
    const op = LAND_OPS[params.kind || 'use'];
    if (!op || !/^\d{19}$/.test(params.pnu || '')) return {ok: false, code: 'INVALID_INPUT', message: '입력 형식 오류'};
    const u = new URL('https://api.vworld.kr/ned/data/' + op);
    for (const [k, v] of Object.entries({pnu: params.pnu, key, domain, format: 'json', numOfRows: '100', pageNo: page})) u.searchParams.set(k, v);
    const data = await jsonp(u);
    if (data?.response?.error || data?.error) throw new Error('브이월드 오류: ' + JSON.stringify(data.response?.error || data.error).slice(0, 120));
    const items = fieldRows(data).filter(r => String(r.pnu) === params.pnu).map(r => pick(r, LAND_FIELDS));
    const total = findTotal(data) ?? items.length;
    return {ok: true, items, total, page: Number(page), pageSize: 100, source: src('브이월드 ' + op)};
  }
  if (path === '/api/spatial') {
    const layer = params.kind === 'parcels' ? 'LP_PA_CBND_BUBUN' : cfg?.vworldBuildingLayer;
    if (!layer) return {ok: false, code: 'SCHEMA_UNVERIFIED', message: '자료 연결 전'};
    const b = String(params.bbox || '').split(',').map(Number);
    if (b.length !== 4 || b.some(n => !Number.isFinite(n))) return {ok: false, code: 'INVALID_INPUT', message: '입력 형식 오류'};
    const u = new URL('https://api.vworld.kr/req/data');
    for (const [k, v] of Object.entries({service: 'data', request: 'GetFeature', version: '2.0', data: layer, key, domain, format: 'json', crs: 'EPSG:4326', geomFilter: `BOX(${b.join(',')})`, geometry: 'true', attribute: 'true', size: '100', page})) u.searchParams.set(k, v);
    const data = await jsonp(u), r = data?.response;
    if (!r || !['OK', 'NOT_FOUND'].includes(r.status)) throw new Error('브이월드 공간자료 수신 실패');
    const items = array(r.result?.featureCollection?.features).map(f => ({type: 'Feature', id: String(f.id || ''), geometry: geoClean(f.geometry), properties: {pnu: String(f.properties?.pnu || ''), jibun: String(f.properties?.jibun || ''), category: String(f.properties?.jimok || f.properties?.lndcgrCodeNm || ''), height: null, floors: null}})).filter(f => f.geometry);
    const total = r.status === 'NOT_FOUND' ? 0 : (number(r.record?.total) ?? items.length);
    return {ok: true, items, total, page: Number(page), pageSize: 100, source: src('브이월드 ' + layer)};
  }
  return null;
}
