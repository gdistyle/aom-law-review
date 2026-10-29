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
  if (name.endsWith('.hwp')) throw new Error('HWP 파일은 한글에서 [다른 이름으로 저장 → PDF 또는 HWPX]로 바꿔서 넣어 주십시오.');
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
  const out = [];
  for (const [key, label, re, num] of TOPICS) {
    const hits = [];
    for (const pg of pages) for (const [i, line] of pg.lines.entries()) {
      if (!re.test(line)) continue;
      const ctx = [pg.lines[i - 1], line, pg.lines[i + 1]].filter(Boolean).join(' / ');
      const grab = t => num ? [...t.matchAll(new RegExp(num.source, 'gi'))].map(m => +m[1]).filter(v => Number.isFinite(v)) : [];
      const m0 = line.match(re), after = m0 ? line.slice(m0.index + m0[0].length).split(/건폐율|용적률|조경|높이|최고\s*층수/)[0] : '';
      const near = grab(after), values = near.length ? near : grab(line);
      hits.push({page: pg.page, line, ctx, values, inBlock: blockPages.has(pg.page) || (b && normBlock(ctx).includes(b))});
    }
    hits.sort((x, y) => (y.inBlock - x.inBlock) || (y.values.length - x.values.length) || (x.page - y.page));
    out.push({key, label, hits: hits.slice(0, 12), total: hits.length});
  }
  return {blockFound: !b || blockPages.size > 0, blockPages: [...blockPages], topics: out};
}
