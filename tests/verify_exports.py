"""browser_smoke.py로 생성한 출력물의 OOXML·PDF·CAD 구조 검사.
표준 라이브러리만 필수. PyMuPDF 설치 시 PDF 구조도 추가 검사.
사용법: python tests/verify_exports.py /출력경로/generated
"""
from pathlib import Path
import sys, zipfile, json, re, xml.etree.ElementTree as ET
ROOT=Path(__file__).resolve().parents[1]
OUT=Path(sys.argv[1]) if len(sys.argv)>1 else ROOT/'.test-output/generated'
S={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
W={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
results=[]
def canonical(node):
    if node is None:return None
    return (node.tag,tuple(sorted(node.attrib.items())),node.text or '',tuple(canonical(c) for c in node))
def formulas(xml):
    r=ET.fromstring(xml)
    return {c.attrib['r']:canonical(c.find('s:f',S)) for c in r.findall('.//s:c',S) if c.find('s:f',S) is not None}
def check_zip_xml(z):
    assert z.testzip() is None
    for name in z.namelist():
        if name.endswith(('.xml','.rels')):ET.fromstring(z.read(name))
def text_at(root,cell):
    c=root.find(f'.//s:c[@r="{cell}"]',S)
    return ''.join(c.itertext()) if c is not None else ''
with zipfile.ZipFile(ROOT/'public/templates/설계개요_빈양식.xlsx') as original,zipfile.ZipFile(next(OUT.glob('*.xlsx'))) as generated:
    check_zip_xml(generated)
    sheets=sorted(n for n in original.namelist() if re.fullmatch(r'xl/worksheets/sheet\d+\.xml',n))
    total=0
    for name in sheets:
        a,b=original.read(name),generated.read(name)
        assert formulas(a)==formulas(b),f'수식 변경: {name}'
        total+=len(formulas(a));ra,rb=ET.fromstring(a),ET.fromstring(b)
        for tag in ['cols','mergeCells','sheetViews','sheetFormatPr','pageMargins','pageSetup','drawing','legacyDrawing']:
            assert canonical(ra.find('s:'+tag,S))==canonical(rb.find('s:'+tag,S)),(name,tag)
        for cell in rb.findall('.//s:c',S):
            if cell.find('s:f',S) is not None:assert cell.find('s:v',S) is None,('남은 수식캐시',name,cell.attrib['r'])
    wa,wb=ET.fromstring(original.read('xl/workbook.xml')),ET.fromstring(generated.read('xl/workbook.xml'))
    assert canonical(wa.find('s:sheets',S))==canonical(wb.find('s:sheets',S))
    assert wb.find('s:calcPr',S).attrib['fullCalcOnLoad']=='1'
    sa,sb=ET.fromstring(original.read('xl/styles.xml')),ET.fromstring(generated.read('xl/styles.xml'))
    for tag in ['fonts','cellXfs']:
        a,b=sa.find('s:'+tag,S),sb.find('s:'+tag,S)
        assert len(b)>=len(a)
        for x,y in zip(a,b):assert canonical(x)==canonical(y),('기존 스타일 변경',tag)
    s1=ET.fromstring(generated.read('xl/worksheets/sheet1.xml'));s6=ET.fromstring(generated.read('xl/worksheets/sheet6.xml'))
    assert '감이동 440-2' in text_at(s1,'D8')
    assert text_at(s1,'F24')==text_at(s1,'F25')==''
    assert float(text_at(s6,'C3'))==2374.1
    assert text_at(s6,'B3')=='440-2'
    for name in generated.namelist():
        if name.endswith('.rels'):assert b'TargetMode="External"' not in generated.read(name),name
    results.append(f'XLSX {len(sheets)}개 시트·수식 {total}개·기존 스타일·병합·열폭·숨김 상태 보존, 캐시 제거·재계산 설정')
    results.append('XLSX 지구단위계획 적용비율 F24/F25 공란, 토지면적·지번 입력값 대조')
with zipfile.ZipFile(ROOT/'public/templates/법규검토서_틀.docx') as original,zipfile.ZipFile(next(OUT.glob('*.docx'))) as generated:
    check_zip_xml(generated)
    for n in original.namelist():
        if re.match(r'word/(header|footer|media|styles|settings|fontTable|theme)',n):assert original.read(n)==generated.read(n),n
    raw=generated.read('word/document.xml').decode();root=ET.fromstring(raw)
    assert '{{' not in raw and '<w:tbl>' in raw and 'https://' not in raw and '<w:hyperlink' not in raw
    assert '맑은 고딕' in raw and '이오상' in generated.read('docProps/core.xml').decode()
    for n in generated.namelist():
        if n.endswith('.rels'):assert b'TargetMode="External"' not in generated.read(n),n
    results.append('DOCX XML 적합·편집 가능 표·원본 머리글/바닥글/이미지/스타일 보존·작성자 반영·문서 링크 없음')
for file in OUT.glob('*.dae'):
    root=ET.parse(file).getroot();assert root.tag.endswith('COLLADA') and root.attrib['version']=='1.4.1'
results.append('DAE 2종 COLLADA 1.4.1 XML 적합')
text=next(OUT.glob('*.dxf')).read_text()
assert 'AC1015' in text and '$INSUNITS' in text
for layer in ['대상필지','주변필지','지번문자','도로','주변건물']:
    assert ''.join('\\U+'+f'{ord(c):04X}' for c in layer) in text
results.append('DXF AC1015·미터 단위·지정 레이어 5종')
try:
    import fitz
    for file in OUT.glob('*.pdf'):
        with fitz.open(file) as doc:
            assert len(doc)>0 and all(page.get_images() for page in doc)
            assert not any(page.get_links() for page in doc)
            results.append(f'{file.name}: {len(doc)}쪽 이미지 PDF·외부 링크 없음')
except ImportError:
    results.append('PyMuPDF 미설치: PDF 추가 구조 검사는 생략')
print(json.dumps({'passed':True,'results':results},ensure_ascii=False,indent=2))
