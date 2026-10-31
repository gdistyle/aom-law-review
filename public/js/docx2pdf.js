/* 이 사이트가 만든 워드(docx)를 같은 표지·내용으로 A4 PDF로 변환.
   ・ 우리 보고서가 쓰는 서식만 지원(문단 간격·정렬·음영·테두리, 글자 굵기·색·크기, 표·머리글 반복, 그림, 머리말·꼬리말, 쪽 번호).
   ・ 쪽 나눔: 문단 '다음 문단과 함께'·'쪽 나눔 앞'·표 행 나눔 금지·머리글 행 반복을 지켜 A4에 배치.
   ・ 화면에 보이지 않는 작업 영역에서 배치한 뒤 쪽마다 이미지로 PDF에 담음(외부 서버 전송 없음). */
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const tw = v => (Number(v) || 0) / 15;                 // twip → px (96dpi)
const emu = v => (Number(v) || 0) / 9525;              // EMU → px
const FONT = '"맑은 고딕","Malgun Gothic","Pretendard","Apple SD Gothic Neo",sans-serif';

const kids = (el, name) => el ? [...el.childNodes].filter(n => n.nodeType === 1 && n.localName === name) : [];
const kid = (el, name) => kids(el, name)[0] || null;
const att = (el, name) => el ? (el.getAttributeNS(W, name) ?? el.getAttribute('w:' + name)) : null;
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));

function loadScript(src) {
  return new Promise((res, rej) => { if (document.querySelector(`script[src="${src}"]`)) return res(); const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('모듈 로드 실패: ' + src)); document.head.append(s); });
}

function runHtml(r, media) {
  const rPr = kid(r, 'rPr');
  const st = [];
  if (rPr) {
    if (kid(rPr, 'b')) st.push('font-weight:700');
    const c = att(kid(rPr, 'color'), 'val'); if (c && c !== 'auto') st.push('color:#' + c);
    const sz = att(kid(rPr, 'sz'), 'val'); if (sz) st.push(`font-size:${Number(sz) / 2}pt`);
    const sp = att(kid(rPr, 'spacing'), 'val'); if (sp) st.push(`letter-spacing:${Number(sp) / 20}pt`);
  }
  let inner = '';
  for (const n of r.childNodes) {
    if (n.nodeType !== 1) continue;
    if (n.localName === 't') inner += esc(n.textContent);
    else if (n.localName === 'br') inner += '<br>';
    else if (n.localName === 'tab') inner += '<span class="dx-tab"></span>';
    else if (n.localName === 'drawing') {
      const ext = n.getElementsByTagNameNS('*', 'extent')[0], blip = n.getElementsByTagNameNS('*', 'blip')[0];
      const id = blip && (blip.getAttributeNS(R_NS, 'embed') || blip.getAttribute('r:embed'));
      if (ext && media[id]) inner += `<img src="${media[id]}" style="width:${emu(ext.getAttribute('cx'))}px;height:${emu(ext.getAttribute('cy'))}px;vertical-align:bottom">`;
    } else if (n.localName === 'fldChar' || n.localName === 'instrText') { /* 쪽 번호 필드는 꼬리말에서 처리 */ }
  }
  return inner ? `<span style="${st.join(';')}">${inner}</span>` : '';
}

function paraHtml(p, media, extra = '') {
  const pPr = kid(p, 'pPr'), st = [`margin:0`];
  let keep = false, pb = false;
  if (pPr) {
    keep = !!kid(pPr, 'keepNext'); pb = !!kid(pPr, 'pageBreakBefore');
    const sp = kid(pPr, 'spacing');
    if (sp) { st.push(`padding-top:${tw(att(sp, 'before'))}px`, `padding-bottom:${tw(att(sp, 'after'))}px`); const line = Number(att(sp, 'line')); const rule = att(sp, 'lineRule'); if (line) st.push(rule === 'exact' ? `line-height:${tw(line)}px;height:${tw(line)}px;overflow:hidden` : `line-height:${(line / 240) * 1.22}`); }
    const ind = kid(pPr, 'ind'); if (ind) st.push(`margin-left:${tw(att(ind, 'left'))}px`, `margin-right:${tw(att(ind, 'right'))}px`);
    const jc = att(kid(pPr, 'jc'), 'val'); if (jc) st.push('text-align:' + ({both: 'justify', center: 'center', right: 'right'}[jc] || 'left'));
    const shd = att(kid(pPr, 'shd'), 'fill'); if (shd && shd !== 'auto') st.push('background:#' + shd);
    const bdr = kid(pPr, 'pBdr');
    if (bdr) { const L = kid(bdr, 'left'), B = kid(bdr, 'bottom');
      if (L) st.push(`border-left:${Math.max(2, Number(att(L, 'sz')) / 8 * 1.33)}px solid #${att(L, 'color')}`, `padding-left:${Number(att(L, 'space') || 0) * 1.33}px`);
      if (B) st.push(`border-bottom:${Math.max(1, Number(att(B, 'sz')) / 8 * 1.33)}px solid #${att(B, 'color')}`); }
  }
  const html = kids(p, 'r').map(r => runHtml(r, media)).join('');
  return {html: `<div class="dx-p" style="${st.join(';')}${extra}">${html || '&nbsp;'}</div>`, keep, pb};
}

function tableBlock(tbl, media) {
  const tPr = kid(tbl, 'tblPr'), grid = kids(kid(tbl, 'tblGrid'), 'gridCol').map(g => tw(att(g, 'w')));
  const b = kid(tPr, 'tblBorders'); const line = (el, def) => el && att(el, 'val') !== 'nil' ? `${Math.max(1, Number(att(el, 'sz')) / 8 * 1.33)}px solid #${att(el, 'color') || '000'}` : def;
  const top = line(kid(b, 'top'), 'none'), bottom = line(kid(b, 'bottom'), 'none'), inH = line(kid(b, 'insideH'), 'none'), inV = line(kid(b, 'insideV'), 'none');
  const rows = kids(tbl, 'tr').map((tr, ri, all) => {
    const head = !!kid(kid(tr, 'trPr'), 'tblHeader');
    const cells = kids(tr, 'tc').map((tc, ci, cs) => {
      const tcPr = kid(tc, 'tcPr'), st = [];
      const fill = att(kid(tcPr, 'shd'), 'fill'); if (fill && fill !== 'auto') st.push('background:#' + fill);
      const m = kid(tcPr, 'tcMar'); if (m) st.push(`padding:${tw(att(kid(m, 'top'), 'w'))}px ${tw(att(kid(m, 'right'), 'w'))}px ${tw(att(kid(m, 'bottom'), 'w'))}px ${tw(att(kid(m, 'left'), 'w'))}px`);
      const va = att(kid(tcPr, 'vAlign'), 'val'); st.push('vertical-align:' + (va === 'center' ? 'middle' : va || 'top'));
      if (ci < cs.length - 1) st.push('border-right:' + inV);
      const inner = [...tc.childNodes].filter(n => n.nodeType === 1).map(n => n.localName === 'p' ? paraHtml(n, media).html : n.localName === 'tbl' ? tableHtml(tableBlock(n, media)) : '').join('');
      return `<td style="${st.join(';')}">${inner}</td>`;
    }).join('');
    return {head, html: cells};
  });
  const keep = kids(tbl, 'tr').some(tr => kids(tr, 'tc').some(tc => kid(kid(kid(tc, 'p'), 'pPr'), 'keepNext')));
  return {kind: 'tbl', grid, top, bottom, inH, rows, keep, width: grid.reduce((a, c) => a + c, 0)};
}
function tableHtml(t, rows = t.rows) {
  return `<table class="dx-t" style="width:${t.width}px;border-top:${t.top};border-bottom:${t.bottom}"><colgroup>${t.grid.map(w => `<col style="width:${w}px">`).join('')}</colgroup><tbody>${rows.map((r, i) => `<tr style="${i ? 'border-top:' + t.inH : ''}">${r.html}</tr>`).join('')}</tbody></table>`;
}

/**
 * @param {Blob|ArrayBuffer} docx
 * @param {{landscape?:boolean, name?:string}} opt
 * @returns {Promise<Blob>} PDF
 */
export async function docxToPdf(docx, opt = {}) {
  if (typeof JSZip === 'undefined') throw new Error('압축 모듈 미로드');
  await loadScript('/vendor/html2canvas-1.4.1.min.js'); await loadScript('/vendor/jspdf-2.5.1.umd.min.js');
  const zip = await JSZip.loadAsync(docx);
  const parse = async path => { const f = zip.file(path); return f ? new DOMParser().parseFromString(await f.async('string'), 'application/xml') : null; };
  const doc = await parse('word/document.xml'), rels = await parse('word/_rels/document.xml.rels');
  const media = {};
  for (const rel of rels ? [...rels.getElementsByTagName('Relationship')] : []) {
    const tgt = rel.getAttribute('Target');
    if (/^media\//.test(tgt)) { const f = zip.file('word/' + tgt); if (f) media[rel.getAttribute('Id')] = 'data:image/png;base64,' + await f.async('base64'); }
  }
  const hdr = await parse('word/header1.xml'), ftr = await parse('word/footer1.xml');
  const body = doc.getElementsByTagNameNS(W, 'body')[0];
  const sect = kid(body, 'sectPr'), pgSz = kid(sect, 'pgSz'), pgMar = kid(sect, 'pgMar');
  const PW = tw(att(pgSz, 'w')), PH = tw(att(pgSz, 'h'));
  const M = {t: tw(att(pgMar, 'top')), r: tw(att(pgMar, 'right')), b: tw(att(pgMar, 'bottom')), l: tw(att(pgMar, 'left')), h: tw(att(pgMar, 'header')), f: tw(att(pgMar, 'footer'))};
  const titlePg = !!kid(sect, 'titlePg');
  const hdrHtml = hdr ? kids(hdr.documentElement, 'p').map(p => paraHtml(p, media).html).join('') : '';
  const ftrP = ftr ? kids(ftr.documentElement, 'p')[0] : null;

  // 블록 목록
  const blocks = [];
  for (const n of body.childNodes) {
    if (n.nodeType !== 1) continue;
    if (n.localName === 'p') { const x = paraHtml(n, media); blocks.push({kind: 'p', ...x}); }
    else if (n.localName === 'tbl') blocks.push(tableBlock(n, media));
  }

  // 작업 영역
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-20000px;top:0;z-index:-1;pointer-events:none';
  host.innerHTML = `<style>.dx-page{position:relative;width:${PW}px;height:${PH}px;background:#fff;overflow:hidden;font-family:${FONT};color:#303236;font-size:9.5pt;box-sizing:border-box}.dx-body{position:absolute;left:${M.l}px;top:${M.t}px;width:${PW - M.l - M.r}px;height:${PH - M.t - M.b}px;overflow:hidden}.dx-hdr{position:absolute;left:${M.l}px;right:${M.r}px;top:${M.h}px}.dx-ftr{position:absolute;left:${M.l}px;right:${M.r}px;bottom:${M.f - 6}px;display:flex;justify-content:space-between;font-size:8pt;color:#6B6E73}.dx-t{border-collapse:collapse;table-layout:fixed}.dx-t td{word-break:keep-all;overflow-wrap:anywhere}.dx-p{word-break:keep-all;overflow-wrap:anywhere}.dx-tab{display:inline-block}</style>`;
  document.body.append(host);
  const pages = [];
  const newPage = () => { const pg = document.createElement('div'); pg.className = 'dx-page'; const b = document.createElement('div'); b.className = 'dx-body'; pg.append(b); host.append(pg); pages.push(pg); return b; };
  let cur = newPage();
  const fits = () => cur.scrollHeight <= cur.clientHeight + 0.5;
  const add = (html, keep = false) => { const t = document.createElement('div'); t.innerHTML = html; const el = t.firstElementChild; if (keep) el.dataset.keep = '1'; cur.append(el); return el; };
  /* 새 쪽으로 넘어갈 때 직전 쪽 끝의 '다음과 함께' 문단(제목 등)을 함께 옮김 */
  const breakWithKeeps = () => { const moving = []; let e = cur.lastElementChild; while (e && e.dataset.keep === '1') { moving.unshift(e); e = e.previousElementSibling; } if (moving.length && moving.length === cur.childElementCount) moving.length = 0; cur = newPage(); moving.forEach(m => cur.append(m)); };

  for (let i = 0; i < blocks.length; i++) {
    const bk = blocks[i];
    if (bk.kind === 'p') {
      if (bk.pb && cur.childElementCount) cur = newPage();
      // '다음과 함께' 묶음: 이어지는 keep 문단들 + 다음 블록의 첫 부분이 같은 쪽에 들어가는지 확인
      const el = add(bk.html, bk.keep);
      if (!fits()) { el.remove(); if (cur.childElementCount) cur = newPage(); cur.append(el); }
      else if (bk.keep && blocks[i + 1]) {
        // 다음 블록(문단 또는 표 첫 두 행)을 시험 배치
        const nx = blocks[i + 1];
        const probe = nx.kind === 'p' ? add(nx.html) : add(tableHtml(nx, nx.rows.filter(r => r.head).concat(nx.rows.filter(r => !r.head).slice(0, 1))));
        const ok = fits(); probe.remove();
        if (!ok && cur.childElementCount > 1) {
          // keep 문단(연속된 것 포함)을 새 쪽으로 이동
          const moving = [el]; let k = i - 1, prev = el.previousElementSibling;
          while (k >= 0 && blocks[k].kind === 'p' && blocks[k].keep && prev) { moving.unshift(prev); prev = prev.previousElementSibling; k--; }
          if (moving.length < cur.childElementCount) { cur = newPage(); moving.forEach(m => cur.append(m)); }
        }
      }
      continue;
    }
    // 표: 행 단위로 나눠 배치, 머리글 행 반복
    const heads = bk.rows.filter(r => r.head), bodyRows = bk.rows.filter(r => !r.head);
    if (bk.keep && cur.childElementCount) {            // '다음과 함께' 표: 통째로 안 들어가면 다음 쪽으로
      const whole = add(tableHtml(bk)); const ok = fits(); whole.remove();
      if (!ok) breakWithKeeps();
    }
    let start = 0;
    while (start < bodyRows.length || (start === 0 && !bodyRows.length)) {
      let n = bodyRows.length - start;
      let el = add(tableHtml(bk, heads.concat(bodyRows.slice(start, start + n))));
      if (!fits()) {
        // 들어가는 최대 행 수 탐색
        let lo = 0, hi = n;
        while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); el.remove(); el = add(tableHtml(bk, heads.concat(bodyRows.slice(start, start + mid)))); if (fits()) lo = mid; else hi = mid - 1; }
        el.remove();
        const remain = bodyRows.length - start;
        if (lo < Math.min(2, remain) || (remain - lo > 0 && remain - lo < 2 && lo > 2 && false)) { if (cur.childElementCount) { breakWithKeeps(); continue; } lo = Math.max(lo, 1); }   // 쪽 끝에 1행만 걸치면 제목과 함께 다음 쪽으로
        n = lo; el = add(tableHtml(bk, heads.concat(bodyRows.slice(start, start + n))));
        start += n; if (start < bodyRows.length) cur = newPage();
      } else start += n;
      if (!bodyRows.length) break;
    }
  }
  // 머리말·꼬리말·쪽 번호
  pages.forEach((pg, i) => {
    if (titlePg && i === 0) return;
    if (hdrHtml) { const h = document.createElement('div'); h.className = 'dx-hdr'; h.innerHTML = hdrHtml; pg.append(h); }
    if (ftrP) { const f = document.createElement('div'); f.className = 'dx-ftr'; f.innerHTML = `<span>${kids(ftrP, 'r').map(r => kid(r, 't')?.textContent || '').join('')}</span><span>${i + 1}</span>`; pg.append(f); }
  });
  // 이미지로 PDF
  try { await document.fonts?.ready; } catch {}
  const {jsPDF} = window.jspdf;
  const landscape = PW > PH;
  const pdf = new jsPDF({orientation: landscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4', compress: true});
  const mmW = landscape ? 297 : 210, mmH = landscape ? 210 : 297;
  for (let i = 0; i < pages.length; i++) {
    const c = await window.html2canvas(pages[i], {scale: 2, backgroundColor: '#ffffff', logging: false, useCORS: true});
    if (i) pdf.addPage('a4', landscape ? 'landscape' : 'portrait');
    pdf.addImage(c.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, mmW, mmH, undefined, 'FAST');
  }
  host.remove();
  return pdf.output('blob');
}
