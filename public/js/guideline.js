/**
 * 지구단위계획 시행지침 파일 읽기 — 이용자가 넣은 PDF·HWPX·TXT를 브라우저 안에서만 읽고(서버 전송 없음)
 * 블록 번호와 조경·건폐율·용적률·높이·층수·주차·건축선 조항을 찾아 쪽 번호와 함께 돌려준다.
 * AI 없이 문자열 규칙으로만 찾으므로, 찾은 문장은 원문 대조용으로 그대로 보여 준다.
 */
const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
let pdfLoaded = null;
function loadPdfJs() {
  pdfLoaded ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = PDFJS + 'pdf.min.js';
    s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js'; resolve(window.pdfjsLib); };
    s.onerror = () => reject(new Error('PDF 읽기 도구를 불러오지 못했습니다.'));
    document.head.append(s);
  });
  return pdfLoaded;
}

/** 파일 → [{page, lines:[...]}] */
export async function readGuideline(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) {
    const lib = await loadPdfJs();
    const doc = await lib.getDocument({data: new Uint8Array(await file.arrayBuffer())}).promise;
    const pages = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const pg = await doc.getPage(i), tc = await pg.getTextContent();
      const rows = new Map();
      for (const it of tc.items) { if (!it.str?.trim()) continue; const y = Math.round(it.transform[5] / 3) * 3; if (!rows.has(y)) rows.set(y, []); rows.get(y).push([it.transform[4], it.str]); }
      const lines = [...rows.entries()].sort((a, b) => b[0] - a[0]).map(([, r]) => r.sort((a, b) => a[0] - b[0]).map(x => x[1]).join(' ').replace(/\s+/g, ' ').trim()).filter(Boolean);
      pages.push({page: i, lines});
    }
    return pages;
  }
  if (name.endsWith('.hwpx')) {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const secs = Object.keys(zip.files).filter(n => /^Contents\/section\d+\.xml$/i.test(n)).sort((a, b) => a.localeCompare(b, 'en', {numeric: true}));
    const pages = [];
    for (const [i, n] of secs.entries()) {
      const xml = await zip.file(n).async('string');
      const lines = [...xml.matchAll(/<hp:p\b[\s\S]*?<\/hp:p>/g)].map(m => [...m[0].matchAll(/<hp:t[^>]*>([^<]*)<\/hp:t>/g)].map(t => t[1]).join('')).map(s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()).filter(Boolean);
      pages.push({page: i + 1, lines, section: true});
    }
    return pages;
  }
  if (name.endsWith('.txt')) return [{page: 1, lines: (await file.text()).split(/\r?\n/).map(s => s.trim()).filter(Boolean)}];
  if (name.endsWith('.hwp')) { const CFB = await loadCfb(); return hwpPages(await file.arrayBuffer(), CFB, inflateRawBrowser); }
  throw new Error('PDF·HWPX·TXT 파일만 읽을 수 있습니다.');
}

const TOPICS = [
  ['bcr', '건폐율', /건폐율/, /(\d+(?:\.\d+)?)\s*(?:%|퍼센트)/],
  ['far', '용적률', /용적률/, /(\d+(?:\.\d+)?)\s*(?:%|퍼센트)/],
  ['landscape', '조경', /조경/, /(\d+(?:\.\d+)?)\s*(?:%|퍼센트)/],
  ['floorLimit', '층수', /층\s*이하|최고\s*층수|층수/, /(\d+)\s*층\s*이하/],
  ['height', '높이', /높이|최고\s*고도/, /(\d+(?:\.\d+)?)\s*(?:m|미터)\s*이하/i],
  ['parking', '주차', /주차/, null],
  ['buildingLine', '건축선 · 대지 안의 공지', /건축선|건축한계선|공지|후퇴/, /(\d+(?:\.\d+)?)\s*(?:m|미터)/i],
  ['use', '허용 · 불허 용도', /허용\s*용도|불허\s*용도|건축할\s*수\s*(?:있|없)는/, null]
];
const normBlock = s => String(s || '').replace(/\s+/g, '').replace(/[－–—]/g, '-');

/** 블록 번호(선택)와 주제별 문장 찾기. 블록 번호가 들어간 쪽을 우선. */
export function searchGuideline(pages, block = '') {
  const b = normBlock(block);
  const blockPages = b ? new Set(pages.filter(p => p.lines.some(l => normBlock(l).includes(b))).map(p => p.page)) : new Set();
  const heads = new Map();
  for (const pg of pages) { let h = ''; heads.set(pg.page, pg.lines.map(l => { if (/^제\s*\d+\s*(?:조|장|절)/.test(l) && l.length < 60) h = l.replace(/\d+$/, ''); return h; })); }
  const out = [];
  for (const [key, label, re, num] of TOPICS) {
    const hits = [];
    for (const pg of pages) for (const [i, line] of pg.lines.entries()) {
      if (!re.test(line)) continue;
      const ctx = [pg.lines[i - 1], line, pg.lines[i + 1]].filter(Boolean).join(' / ');
      const grab = t => num ? [...t.matchAll(new RegExp(num.source, 'gi'))].map(m => +m[1]).filter(v => Number.isFinite(v)) : [];
      const m0 = line.match(re), after = m0 ? line.slice(m0.index + m0[0].length).split(/건폐율|용적률|조경|높이|최고\s*층수/)[0] : '';
      const near = grab(after), own = near.length ? near : grab(line), values = [...new Set(own.length ? own : grab(pg.lines.slice(i + 1, i + 7).join(' ')).slice(0, 4))];
      hits.push({page: pg.page, head: heads.get(pg.page)[i] || '', section: !!pg.section, line, ctx, values, inBlock: blockPages.has(pg.page) || (b && normBlock(ctx).includes(b))});
    }
    hits.sort((x, y) => (y.inBlock - x.inBlock) || (y.values.length - x.values.length) || (x.page - y.page));
    out.push({key, label, hits: hits.slice(0, 12), total: hits.length});
  }
  return {blockFound: !b || blockPages.size > 0, blockPages: [...blockPages], topics: out};
}

/* ── 한글(HWP 5.0) 직접 읽기: 복합문서(CFB) → BodyText/Section* 압축 해제 → 문단 글자(HWPTAG_PARA_TEXT) ── */
let cfbLoaded = null;
function loadCfb() {
  cfbLoaded ??= new Promise((resolve, reject) => {
    if (window.CFB) return resolve(window.CFB);
    const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/cfb@1.2.2/dist/cfb.min.js';
    s.onload = () => resolve(window.CFB); s.onerror = () => reject(new Error('한글 파일 읽기 도구를 불러오지 못했습니다.')); document.head.append(s);
  });
  return cfbLoaded;
}
let pakoLoaded = null;
function loadPako() {
  pakoLoaded ??= new Promise((resolve, reject) => {
    if (window.pako) return resolve(window.pako);
    const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js';
    s.onload = () => resolve(window.pako); s.onerror = () => reject(new Error('압축 해제 도구를 불러오지 못했습니다.')); document.head.append(s);
  });
  return pakoLoaded;
}
/** 한글 본문은 끝에 여분 바이트가 붙는 경우가 있어, 여분을 허용하는 방식(pako)으로 풀고 실패 시 브라우저 기본 기능 사용. */
async function inflateRawBrowser(u8) {
  try { const pako = await loadPako(); const inf = new pako.Inflate({raw: true}); inf.push(u8, true); if (inf.result && inf.result.length) return inf.result; } catch {}
  const ds = new DecompressionStream('deflate-raw');
  return new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(ds)).arrayBuffer());
}
const EXT = new Set([1, 2, 3, 11, 12, 14, 15, 16, 17, 18, 21, 22, 23]), INL = new Set([4, 5, 6, 7, 8, 9, 19, 20]);
function paraText(u8) {
  const v = new DataView(u8.buffer, u8.byteOffset, u8.byteLength); let s = '';
  for (let i = 0; i + 1 < u8.length;) {
    const c = v.getUint16(i, true);
    if (c < 32) { if (EXT.has(c) || INL.has(c)) { i += 16; continue; } if (c === 9) s += ' '; else if (c === 10 || c === 13) s += '\n'; i += 2; continue; }
    s += String.fromCharCode(c); i += 2;
  }
  return s;
}
/** HWP ArrayBuffer → [{page(=구역 번호), lines}] */
export async function hwpPages(buf, CFB, inflateRaw) {
  const cfb = CFB.read(new Uint8Array(buf), {type: 'array'});
  const find = p => CFB.find(cfb, p);
  const head = find('/FileHeader'); if (!head) throw new Error('한글 파일 형식이 아닙니다.');
  const hb = head.content, props = hb[36] | (hb[37] << 8) | (hb[38] << 16) | (hb[39] << 24);
  if (props & 2) throw new Error('암호가 걸린 한글 파일은 읽을 수 없습니다. 암호를 풀고 다시 저장해 넣어 주십시오.');
  if (props & 4) throw new Error('배포용(읽기 전용) 한글 파일입니다. 한글에서 [다른 이름으로 저장 → PDF]로 바꿔 넣어 주십시오.');
  const compressed = !!(props & 1), pages = [];
  for (let n = 0; ; n++) {
    const st = find('/BodyText/Section' + n); if (!st) break;
    let data = Uint8Array.from(st.content);
    if (compressed) data = await inflateRaw(data);
    const v = new DataView(data.buffer, data.byteOffset, data.byteLength), lines = [];
    for (let i = 0; i + 4 <= data.length;) {
      const h = v.getUint32(i, true); i += 4; const tag = h & 0x3ff; let size = h >>> 20;
      if (size === 0xfff) { size = v.getUint32(i, true); i += 4; }
      if (tag === 67) for (const l of paraText(data.subarray(i, i + size)).split('\n')) { const t = l.replace(/\s+/g, ' ').trim(); if (t) lines.push(t); }
      i += size;
    }
    pages.push({page: n + 1, lines, section: true});
  }
  if (!pages.length) throw new Error('한글 파일에서 본문을 찾지 못했습니다.');
  return pages;
}
