/**
 * 설계개요 엑셀 — 탭 2개(설계개요 · 층별면적표), 값이 있는 항목만 수록.
 * 원본 양식의 빈 계산칸·참고 시트는 넣지 않는다. 가정·미확인 값은 빨간 글씨.
 * 수식 칸에는 계산값을 함께 저장해 휴대폰 보기에서도 숫자가 보이게 한다.
 */
import {esc,titleOf,totalArea,displayDate,number} from './core.js';
import {floorList} from './geometry.js';

const PY = 0.3025;
const colName = n => { let s = ''; n++; while (n) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
const r2 = v => Math.round(v * 100) / 100;

// 스타일 번호
const S = {title: 1, head: 2, label: 3, text: 4, num: 5, numR: 6, textR: 7, pct: 8, center: 9, date: 10, totNum: 11, totLabel: 12, pctR: 13, centerR: 14, note: 15};
function stylesXML() {
  const font = (sz, {b = false, color = '222222'} = {}) => `<font>${b ? '<b/>' : ''}<sz val="${sz}"/><color rgb="FF${color}"/><name val="맑은 고딕"/><family val="3"/><charset val="129"/></font>`;
  const fonts = [font(10), font(16, {b: true}), font(10, {b: true, color: 'FFFFFF'}), font(10, {color: 'E00000'}), font(10, {b: true}), font(9, {color: '808080'})];
  const fill = c => `<fill><patternFill patternType="solid"><fgColor rgb="FF${c}"/><bgColor indexed="64"/></patternFill></fill>`;
  const fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>', fill('595959'), fill('F2F2F0'), fill('FCEDEB')];
  const B = '<border><left style="thin"><color rgb="FFC8C8C8"/></left><right style="thin"><color rgb="FFC8C8C8"/></right><top style="thin"><color rgb="FFC8C8C8"/></top><bottom style="thin"><color rgb="FFC8C8C8"/></bottom><diagonal/></border>';
  const TB = '<border><left/><right/><top/><bottom style="medium"><color rgb="FFE8382F"/></bottom><diagonal/></border>';
  const xf = (f, fi, b, nf, h, {wrap = false} = {}) => `<xf numFmtId="${nf}" fontId="${f}" fillId="${fi}" borderId="${b}" xfId="0"${nf ? ' applyNumberFormat="1"' : ''} applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="${h}" vertical="center"${wrap ? ' wrapText="1"' : ''}/></xf>`;
  const xfs = [
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>',
    xf(1, 0, 2, 0, 'left'),            // title
    xf(2, 2, 1, 0, 'center', {wrap: true}), // head
    xf(4, 3, 1, 0, 'center', {wrap: true}), // label
    xf(0, 0, 1, 0, 'left', {wrap: true}),   // text
    xf(0, 0, 1, 164, 'right'),         // num
    xf(3, 0, 1, 164, 'right'),         // numR
    xf(3, 0, 1, 0, 'left', {wrap: true}),   // textR
    xf(0, 0, 1, 165, 'right'),         // pct
    xf(0, 0, 1, 0, 'center', {wrap: true}), // center
    xf(5, 0, 0, 0, 'right'),           // date
    xf(4, 4, 1, 164, 'right'),         // totNum
    xf(4, 4, 1, 0, 'center'),          // totLabel
    xf(3, 0, 1, 165, 'right'),         // pctR
    xf(3, 0, 1, 0, 'center', {wrap: true}), // centerR
    xf(5, 0, 0, 0, 'left', {wrap: true})    // note
  ];
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0.00"/><numFmt numFmtId="165" formatCode="0.00%"/></numFmts><fonts count="${fonts.length}">${fonts.join('')}</fonts><fills count="${fills.length}">${fills.join('')}</fills><borders count="3"><border><left/><right/><top/><bottom/><diagonal/></border>${B}${TB}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs><cellStyles count="1"><cellStyle name="표준" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
}

/** 시트 작성기: rows = [[{v,f,s}|null,...],...], 1행부터. */
function sheetXML(rows, {cols, merges = [], heights = {}}) {
  const body = rows.map((row, ri) => {
    const r = ri + 1;
    const cells = row.map((c, ci) => {
      if (!c) return '';
      const ref = colName(ci) + r, s = c.s ?? 0;
      if (c.f) return `<c r="${ref}" s="${s}"><f>${esc(c.f)}</f>${c.v != null && Number.isFinite(c.v) ? `<v>${c.v}</v>` : ''}</c>`;
      if (typeof c.v === 'number' && Number.isFinite(c.v)) return `<c r="${ref}" s="${s}"><v>${c.v}</v></c>`;
      if (c.v == null || c.v === '') return `<c r="${ref}" s="${s}"/>`;
      return `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${esc(String(c.v))}</t></is></c>`;
    }).join('');
    return `<row r="${r}"${heights[r] ? ` ht="${heights[r]}" customHeight="1"` : ''}>${cells}</row>`;
  }).join('');
  const colsXML = '<cols>' + cols.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('') + '</cols>';
  const mergeXML = merges.length ? `<mergeCells count="${merges.length}">${merges.map(m => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>` : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews><sheetFormatPr defaultRowHeight="20"/>${colsXML}<sheetData>${body}</sheetData>${mergeXML}<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`;
}

/** 계획 모델: 화면에서 선택한 안(없으면 법정 최대). */
function plan(p, result) {
  const m = result?.models?.find(x => x.id === p.model?.selectedId) || result?.models?.[0] || null;
  return m;
}

export function buildDesignSheets(p, result) {
  const L = p.review?.limits || {}, area = totalArea(p), m = plan(p, result);
  const hs = floorList(p);
  const rows = [], merges = [], heights = {};
  const T = (v, s = S.text) => ({v, s});
  rows.push([{v: '설계개요', s: S.title}, {s: S.title}, {s: S.title}, {s: S.title}, {s: S.title}]); merges.push('A1:E1'); heights[1] = 30;
  rows.push([null, null, null, null, {v: `작성일 ${displayDate(p.date)} · 작성 ${p.author || ''}`, s: S.date}]);
  rows.push([]);
  rows.push([T('구분', S.head), T('항목', S.head), T('내용', S.head), T('평', S.head), T('근거 · 비고', S.head)]); heights[4] = 24;
  const group = [];
  const add = (g, item, val, {py = false, red = false, note = '', noteRed = false, f = null, pct = false} = {}) => {
    if (val == null || val === '' || (typeof val === 'number' && !Number.isFinite(val))) return null;
    const r = rows.length + 1;
    const isNum = typeof val === 'number';
    const vs = pct ? (red ? S.pctR : S.pct) : isNum ? (red ? S.numR : S.num) : (red ? S.textR : S.text);
    rows.push([T(g, S.label), T(item, S.label), f ? {f, v: val, s: vs} : {v: val, s: vs}, py && isNum ? {f: `C${r}*${PY}`, v: r2(val * PY), s: red ? S.numR : S.num} : T('', S.text), T(note, noteRed ? S.textR : S.text)]);
    group.push([g, r]);
    return r;
  };
  // 대지현황
  add('대지현황', '공사명', titleOf(p));
  add('대지현황', '대지위치', p.address);
  const rArea = add('대지현황', '대지면적(㎡)', area, {py: true, note: '토지특성 자료(브이월드)'});
  add('대지현황', '지목', p.land.category?.value || '');
  const zones = [...new Set((p.land.zones || []).map(z => z.name))];
  add('대지현황', '지역 · 지구', zones.join(', '));
  add('대지현황', '도로현황', p.land.road?.value || '', {note: '개별공시지가 토지특성 조사값(건축법상 도로 판정 아님)'});
  // 건축규모
  add('건축규모', '주용도', p.purpose || '');
  add('건축규모', '부용도', p.purpose2 || '');
  const up = m ? m.floors : number(p.floors);
  add('건축규모', '규모', up ? `${p.basement ? '지하 ' + p.basement + '층, ' : ''}지상 ${up}층` : '', {red: true, note: '법정 기준 가정 모델 층수'});
  const fp = m ? r2(m.footprint) : L.maxFootprint != null ? r2(L.maxFootprint) : null;
  const gross = m ? r2(m.gross) : L.maxGross != null ? r2(L.maxGross) : null;
  const rFp = add('건축규모', '건축면적(㎡)', fp, {py: true, red: true, note: m ? `3D ${m.name} 기준` : '법정 최대 건축면적'});
  const rGross = add('건축규모', '연면적 · 지상(㎡)', gross, {py: true, red: true, note: m ? '용적률 산정용 지상층 바닥면적 합계' : '법정 최대 연면적'});
  if (rArea && rFp) add('건축규모', '건폐율', area ? fp / area : null, {pct: true, red: true, f: `C${rFp}/C${rArea}`, note: L.bcr?.value != null ? `법정 ${L.bcr.value}% 이하` : ''});
  if (rArea && rGross) add('건축규모', '용적률', area ? gross / area : null, {pct: true, red: true, f: `C${rGross}/C${rArea}`, note: L.far?.value != null ? `법정 ${L.far.value}% 이하` : ''});
  // 부설주차 · 조경
  add('부설주차장', '법정 대수', L.parking != null ? `${L.parking}대` : '', {red: !!L.parkingPurposeAssumed, note: L.parkingFormula || ''});
  add('조경', '법정 조경면적(㎡)', L.landscapeArea != null ? r2(L.landscapeArea) : null, {py: true, red: !!L.landscapeExempt, note: L.landscapeFormula || ''});
  // 같은 구분 셀 병합
  for (let i = 0; i < group.length;) { let j = i; while (j + 1 < group.length && group[j + 1][0] === group[i][0]) j++; if (j > i) merges.push(`A${group[i][1]}:A${group[j][1]}`); i = j + 1; }
  rows.push([]);
  rows.push([{v: '빨간 글씨 = 가정 · 원문 미대조 값. 계획 수치는 3D 볼륨 스터디에서 선택한 안 기준이며 설계안이 아님.', s: S.note}]); merges.push(`A${rows.length}:E${rows.length}`);
  const s1 = sheetXML(rows, {cols: [12, 18, 44, 14, 62], merges, heights});

  // 층별면적표
  const R = [], M = [], H = {};
  R.push([{v: '층별면적표', s: S.title}, {s: S.title}, {s: S.title}, {s: S.title}, {s: S.title}, {s: S.title}]); M.push('A1:F1'); H[1] = 30;
  R.push([null, null, null, null, null, {v: m ? `3D ${m.name} 기준` : '', s: S.date}]);
  R.push([]);
  R.push(['층', '층고(m)', '바닥면적(㎡)', '바닥면적(평)', '누적 높이(m)', '비고'].map(v => ({v, s: S.head}))); H[4] = 24;
  const first = R.length + 1;
  const layers = m?.layers || [];
  let cum = number(p.model?.baseElevation) || 0;
  for (let i = 0; i < layers.length; i++) {
    const l = layers[i], r = R.length + 1, h = l.height ?? hs[i];
    cum += h || 0;
    R.push([{v: `지상 ${i + 1}층`, s: S.center}, {v: h, s: S.numR}, {v: r2(l.area), s: S.numR}, {f: `C${r}*${PY}`, v: r2(l.area * PY), s: S.numR}, {v: r2(cum), s: S.numR}, {v: i === 0 && p.purpose ? p.purpose : '', s: S.text}]);
  }
  const last = R.length;
  if (layers.length) {
    const r = R.length + 1, sum = r2(layers.reduce((a, l) => a + l.area, 0));
    R.push([{v: '지상 합계', s: S.totLabel}, {v: '', s: S.totLabel}, {f: `SUM(C${first}:C${last})`, v: sum, s: S.totNum}, {f: `C${r}*${PY}`, v: r2(sum * PY), s: S.totNum}, {v: '', s: S.totLabel}, {v: '', s: S.totLabel}]);
  }
  for (let b = 1; b <= (p.basement || 0); b++) R.push([{v: `지하 ${b}층`, s: S.centerR}, {v: '', s: S.text}, {v: '', s: S.text}, {v: '', s: S.text}, {v: '', s: S.text}, {v: '지하층 면적은 계획 시 입력(용적률 산정 제외)', s: S.textR}]);
  if (!layers.length) R.push([{v: '3D 볼륨 모델이 없어 층별 면적 미산정 — 대지 경계·건폐율·용적률 수신 후 생성', s: S.textR}]);
  R.push([]);
  R.push([{v: '빨간 글씨 = 가정 값. 층고는 화면 입력값(기본 1층 4.3 m, 2층 이상 3.3 m 가정).', s: S.note}]); M.push(`A${R.length}:F${R.length}`);
  const s2 = sheetXML(R, {cols: [12, 10, 16, 14, 14, 40], merges: M, heights: H});
  return {s1, s2};
}

export async function exportDesignXLSX(p, result) {
  const {s1, s2} = buildDesignSheets(p, result);
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>');
  zip.file('docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>설계개요</dc:title><dc:creator>${esc(p.author || '')}</dc:creator></cp:coreProperties>`);
  zip.file('xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView activeTab="0"/></bookViews><sheets><sheet name="설계개요" sheetId="1" r:id="rId1"/><sheet name="층별면적표" sheetId="2" r:id="rId2"/></sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>');
  zip.file('xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>');
  zip.file('xl/styles.xml', stylesXML());
  zip.file('xl/worksheets/sheet1.xml', s1);
  zip.file('xl/worksheets/sheet2.xml', s2);
  return zip.generateAsync({type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', compression: 'DEFLATE'});
}
