/**
 * 국가법령정보 공동활용(DRF) 직접 조회 — 이용자 브라우저에서 호출.
 * 법제처에 등록한 사이트 도메인(aom-law-review.gdistyle.workers.dev)에서의 정상 요청이며,
 * 현행(시행 중) 법령·자치법규만 선택한다. 시행 예정·연혁본은 제외한다.
 */
import {norm,date8,currentByDate,array} from './core.js';
import {normalizeLaw} from './legal.js';

const BASE = 'https://www.law.go.kr/DRF/';

async function getJSON(url) {
  const r = await fetch(url, {cache: 'no-store'});
  if (!r.ok) throw new Error('법제처 응답 오류 ' + r.status);
  const data = await r.json();
  if (data && data.result && data.msg) throw new Error('법제처: ' + data.msg);
  return data;
}

export async function fetchLawDirect(oc, name, kind = 'law') {
  if (!oc) return {ok: false, code: 'NOT_CONFIGURED', message: '자료 연결 전', name};
  const target = kind === 'ordin' ? 'ordin' : 'eflaw';
  const s = new URL(BASE + 'lawSearch.do');
  const q = {OC: oc, target, type: 'JSON', query: name, search: '1', display: '100', page: '1'};
  if (target === 'eflaw') Object.assign(q, {nw: '3', sort: 'efdes'});
  for (const [k, v] of Object.entries(q)) s.searchParams.set(k, v);
  const data = await getJSON(s);
  const root = kind === 'ordin' ? data.OrdinSearch : data.LawSearch;
  const records = array(root?.law || root?.ordin)
    .filter(r => norm(r.법령명한글 || r.자치법규명) === norm(name))
    .filter(r => currentByDate(r.시행일자))
    .filter(r => !/연혁|예정/.test(String(r.현행연혁코드 || '')))
    .sort((a, b) => date8(b.시행일자).localeCompare(date8(a.시행일자)));
  const chosen = records[0];
  if (!chosen) return {ok: false, code: 'NO_CURRENT_TEXT', message: '현행 원문 수신 없음', name};
  const d = new URL(BASE + 'lawService.do');
  const mst = chosen.법령일련번호 || chosen.자치법규일련번호;
  const p = {OC: oc, target, type: 'JSON', MST: String(mst)};
  if (target === 'eflaw') p.efYd = date8(chosen.시행일자);
  for (const [k, v] of Object.entries(p)) d.searchParams.set(k, v);
  const payload = await getJSON(d);
  const law = normalizeLaw(payload, {kind, name, effectiveDate: chosen.시행일자, current: true});
  if (!law.current || norm(law.name) !== norm(name)) return {ok: false, code: 'NO_CURRENT_TEXT', message: '현행 원문 수신 없음', name};
  return {ok: true, law, source: {name: '국가법령정보센터 ' + name, url: `https://www.law.go.kr/${kind === 'ordin' ? '자치법규' : '법령'}/${encodeURIComponent(norm(name))}`, retrievedAt: new Date().toISOString()}};
}
