/* 한글(HWP 5.x) 문서에서 본문 글자만 뽑는 최소 해석기 — 자치법규 별표(표) 첨부파일 읽기용.
   CFB(복합 문서) → BodyText/SectionN 스트림 → (압축 시) raw deflate 해제 → 문단 글자(HWPTAG_PARA_TEXT) 추출.
   표의 칸은 문단 순서대로 한 줄씩 나온다. 그림·수식 등은 무시. */

const u16 = (b, o) => b[o] | (b[o + 1] << 8);
const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
const END = 0xFFFFFFFE, FREE = 0xFFFFFFFF;

function cfb(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (u32(b, 0) !== 0xE011CFD0 || u32(b, 4) !== 0xE11AB1A1) throw new Error('HWP 형식 아님');
  const ss = 1 << u16(b, 0x1E), mss = 1 << u16(b, 0x20), dirStart = u32(b, 0x30), cutoff = u32(b, 0x38);
  const miniFatStart = u32(b, 0x3C), difatStart = u32(b, 0x44), difatCount = u32(b, 0x48);
  const sec = n => 512 + n * ss;
  const difat = []; for (let i = 0; i < 109; i++) { const v = u32(b, 0x4C + i * 4); if (v < 0xFFFFFFFA) difat.push(v); }
  for (let s = difatStart, k = 0; s < 0xFFFFFFFA && k < difatCount; k++) { const o = sec(s); for (let i = 0; i < ss / 4 - 1; i++) { const v = u32(b, o + i * 4); if (v < 0xFFFFFFFA) difat.push(v); } s = u32(b, o + ss - 4); }
  const fat = []; for (const s of difat) { const o = sec(s); for (let i = 0; i < ss / 4; i++) fat.push(u32(b, o + i * 4)); }
  const chain = (start, table) => { const out = []; for (let s = start, g = 0; s !== END && s !== FREE && s < table.length && g < 1e6; g++) { out.push(s); s = table[s]; } return out; };
  const read = (start, size) => { const out = new Uint8Array(size); let at = 0; for (const s of chain(start, fat)) { const o = sec(s), n = Math.min(ss, size - at); if (n <= 0) break; out.set(b.subarray(o, o + n), at); at += n; } return out; };
  const dirBytes = (() => { const c = chain(dirStart, fat); const out = new Uint8Array(c.length * ss); c.forEach((s, i) => out.set(b.subarray(sec(s), sec(s) + ss), i * ss)); return out; })();
  const entries = [];
  for (let o = 0; o + 128 <= dirBytes.length; o += 128) {
    const nl = u16(dirBytes, o + 64); if (!nl) { entries.push(null); continue; }
    let name = ''; for (let i = 0; i < nl / 2 - 1; i++) name += String.fromCharCode(u16(dirBytes, o + i * 2));
    entries.push({name, type: dirBytes[o + 66], left: u32(dirBytes, o + 68), right: u32(dirBytes, o + 72), child: u32(dirBytes, o + 76), start: u32(dirBytes, o + 116), size: u32(dirBytes, o + 120)});
  }
  const root = entries[0];
  const miniStream = root ? read(root.start, root.size) : new Uint8Array(0);
  const miniFat = []; if (miniFatStart < 0xFFFFFFFA) for (const s of chain(miniFatStart, fat)) { const o = sec(s); for (let i = 0; i < ss / 4; i++) miniFat.push(u32(b, o + i * 4)); }
  const readMini = (start, size) => { const out = new Uint8Array(size); let at = 0; for (const s of chain(start, miniFat)) { const n = Math.min(mss, size - at); if (n <= 0) break; out.set(miniStream.subarray(s * mss, s * mss + n), at); at += n; } return out; };
  const get = e => e.size < cutoff ? readMini(e.start, e.size) : read(e.start, e.size);
  // 경로 이름 → 엔트리 (트리 순회)
  const walk = (idx, prefix, out) => { if (idx >= entries.length || idx === FREE || !entries[idx]) return; const e = entries[idx]; walk(e.left, prefix, out); const path = prefix + e.name; out[path] = e; if (e.type === 1) walk(e.child, path + '/', out); walk(e.right, prefix, out); };
  const map = {}; if (root) walk(root.child, '', map);
  return {map, get};
}

/* raw deflate 해제. 크롬은 압축 끝 뒤에 남는 바이트가 있으면 스트림 오류를 내므로, 오류 전까지 나온 결과를 모아 쓴다. */
async function inflateRaw(data) {
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter(), reader = ds.readable.getReader();
  writer.write(data).catch(() => {}); writer.close().catch(() => {});
  const chunks = []; let n = 0;
  try { for (;;) { const {value, done} = await reader.read(); if (done) break; chunks.push(value); n += value.length; } } catch (e) { if (!n) throw e; }
  const out = new Uint8Array(n); let at = 0; for (const c of chunks) { out.set(c, at); at += c.length; }
  return out;
}

const EXT = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]);
function paraTexts(rec) {
  const out = []; let o = 0;
  while (o + 4 <= rec.length) {
    const h = u32(rec, o); o += 4; const tag = h & 0x3FF; let size = h >>> 20;
    if (size === 0xFFF) { size = u32(rec, o); o += 4; }
    if (tag === 67) { // HWPTAG_PARA_TEXT
      let s = ''; for (let i = 0; i + 1 < size;) { const c = u16(rec, o + i); if (EXT.has(c)) { i += 16; continue; } if (c === 10 || c === 13) s += '\n'; else if (c >= 32) s += String.fromCharCode(c); else if (c === 9) s += ' '; i += 2; }
      out.push(s.replace(/\n+$/, ''));
    }
    o += size;
  }
  return out;
}

/* HWPX(zip + XML) — Contents/sectionN.xml의 문단(<hp:p>)마다 한 줄 */
async function hwpxParagraphs(b) {
  let eocd = -1; for (let i = b.length - 22; i >= Math.max(0, b.length - 70000); i--) if (u32(b, i) === 0x06054B50) { eocd = i; break; }
  if (eocd < 0) throw new Error('HWPX 형식 오류');
  const n = u16(b, eocd + 10); let o = u32(b, eocd + 16); const files = [];
  for (let k = 0; k < n; k++) {
    const method = u16(b, o + 10), csize = u32(b, o + 20), nl = u16(b, o + 28), el = u16(b, o + 30), cl = u16(b, o + 32), lho = u32(b, o + 42);
    const name = new TextDecoder().decode(b.subarray(o + 46, o + 46 + nl)); files.push({name, method, csize, lho}); o += 46 + nl + el + cl;
  }
  const secs = files.filter(f => /^Contents\/section\d+\.xml$/.test(f.name)).sort((a, c) => +a.name.match(/\d+/)[0] - +c.name.match(/\d+/)[0]);
  const out = [];
  for (const f of secs) {
    const start = f.lho + 30 + u16(b, f.lho + 26) + u16(b, f.lho + 28), raw = b.subarray(start, start + f.csize);
    const xml = new TextDecoder().decode(f.method === 8 ? await inflateRaw(raw) : raw);
    for (const m of xml.split(/<\/hp:p>/)) { const t = [...m.matchAll(/<hp:t(?:\s[^>]*)?>([\s\S]*?)<\/hp:t>/g)].map(x => x[1].replace(/<hp:(?:tab|lineBreak)\b[^>]*\/?>/g, ' ').replace(/<[^>]+>/g, '')).join('').replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&'); if (t || /<hp:p[\s>]/.test(m)) out.push(t); }
  }
  return out;
}

/** HWP·HWPX 바이트 → 문단 글자 배열 */
export async function hwpParagraphs(bytes) {
  const b0 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (b0[0] === 0x50 && b0[1] === 0x4B) return hwpxParagraphs(b0);
  const {map, get} = cfb(b0);
  const fh = map['FileHeader'] ? get(map['FileHeader']) : null;
  const compressed = fh ? (u32(fh, 36) & 1) === 1 : true;
  const secs = Object.keys(map).filter(k => /^BodyText\/Section\d+$/.test(k)).sort((a, b) => +a.match(/\d+$/)[0] - +b.match(/\d+$/)[0]);
  const paras = [];
  for (const k of secs) { let d = get(map[k]); if (compressed) d = await inflateRaw(d); paras.push(...paraTexts(d)); }
  return paras;
}
