/**
 * 국가법령정보 공동활용(DRF) 직접 조회 — 이용자 브라우저에서 호출.
 * 법제처에 등록한 사이트 도메인(aom-law-review.gdistyle.workers.dev)에서의 정상 요청이며,
 * 현행(시행 중) 법령·자치법규만 선택한다. 시행 예정·연혁본은 제외한다.
 */
import {norm,date8,currentByDate,array} from './core.js';
import {normalizeLaw} from './legal.js';

const BASE = 'https://www.law.go.kr/DRF/';

const CACHE = new Map();
/** 법제처는 짧은 시간 다수 요청 시 일시 거부(CORS 헤더 없는 오류)하므로 간격을 두고 재시도. 같은 주소는 재사용. */
async function getJSON(url) {
  const key = String(url);
  if (CACHE.has(key)) return CACHE.get(key);
  let last;
  for (let t = 0; t < 5; t++) {
    try {
      const r = await fetch(url, {cache: 'no-store'});
      if (!r.ok) throw new Error('법제처 응답 오류 ' + r.status);
      const data = await r.json();
      if (data && data.result && data.msg) throw new Error('법제처: ' + data.msg);
      CACHE.set(key, data);
      return data;
    } catch (e) { last = e; await new Promise(res => setTimeout(res, 600 * 2 ** t)); }
  }
  throw last;
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
  if (kind === 'ordin') await fillAnnexFiles(law);
  return {ok: true, law, source: {name: '국가법령정보센터 ' + name, url: `https://www.law.go.kr/${kind === 'ordin' ? '자치법규' : '법령'}/${encodeURIComponent(norm(name))}`, retrievedAt: new Date().toISOString()}};
}

/* 자치법규 별표 중 표가 첨부 HWP로만 공개된 것(부설주차장 설치기준·조경 등)은 사이트 서버를 거쳐 받아 글자를 읽는다. 실패하면 그대로 둠. */
async function fillAnnexFiles(law) {
  const targets = (law.annexes || []).filter(a => !String(a.text || '').trim() && /flSeq=\d+/.test(a.file || '') && /주차|조경|설치기준/.test(a.title || '')).slice(0, 4);
  if (!targets.length) return;
  const {hwpParagraphs} = await import('./hwp5.js');
  await Promise.all(targets.map(async a => {
    try {
      const seq = a.file.match(/flSeq=(\d+)/)[1];
      const r = await fetch('/api/annexfile?flSeq=' + seq);
      if (!r.ok) return;
      const paras = await hwpParagraphs(new Uint8Array(await r.arrayBuffer()));
      if (paras.length) { a.text = paras.join('\n'); a.fromFile = true; }
    } catch (e) { console.warn('별표 첨부 읽기 실패', a.title, e); }
  }));
}
