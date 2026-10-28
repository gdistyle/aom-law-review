import {shortLaw} from './legal.js';
import {kstTime,esc,fmt,number,displayDate,titleOf,totalArea,selectedBuilding,BUILDING_FIELDS,redactFreeText,assertRowLinks} from './core.js';
const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const S='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const font='<w:rFonts w:ascii="맑은 고딕" w:hAnsi="맑은 고딕" w:eastAsia="맑은 고딕" w:cs="맑은 고딕"/>';
function run(text,{red=false,bold=false,italic=false,size=18}={}){return `<w:r><w:rPr>${font}${red?'<w:color w:val="E00000"/>':''}${bold?'<w:b/>':''}${italic?'<w:i/>':''}<w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr><w:t xml:space="preserve">${esc(redactFreeText(text)||' ')}</w:t></w:r>`;}
function para(text,opts={}){return `<w:p><w:pPr><w:jc w:val="${opts.align||'left'}"/><w:spacing w:after="80" w:line="240" w:lineRule="auto"/>${opts.keep?'<w:keepNext/>':''}${opts.pageBreak?'<w:pageBreakBefore/>':''}</w:pPr>${String(text??'').split('\n').map(t=>run(t,opts)).join('<w:r><w:br/></w:r>')}</w:p>`;}
function cell(text,width,opts={}){return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/><w:vAlign w:val="center"/>${opts.fill?`<w:shd w:fill="${opts.fill}"/>`:''}</w:tcPr>${para(text,opts).replace(opts.white?'<w:rPr>':'__NO__',opts.white?'<w:rPr><w:color w:val="FFFFFF"/>':'')}</w:tc>`;}
export function wordTable(headers,rows,widths){
 const header='<w:tr><w:trPr><w:tblHeader/></w:trPr>'+headers.map((h,i)=>cell(h,widths[i],{bold:true,white:true,fill:'595959',align:'center'})).join('')+'</w:tr>';
 const body=rows.map(row=>'<w:tr>'+row.map((v,i)=>cell(typeof v==='object'?v.text:v,widths[i],{...(typeof v==='object'?v:{}),size:18})).join('')+'</w:tr>').join('');
 return `<w:tbl><w:tblPr><w:tblW w:w="${widths.reduce((a,b)=>a+b,0)}" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders>${['top','left','bottom','right','insideH','insideV'].map(s=>`<w:${s} w:val="single" w:sz="4" w:color="A6A6A6"/>`).join('')}</w:tblBorders><w:tblCellMar><w:top w:w="65" w:type="dxa"/><w:bottom w:w="65" w:type="dxa"/><w:left w:w="85" w:type="dxa"/><w:right w:w="85" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${widths.map(w=>`<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${header}${body}</w:tbl>${para('')}`;
}
const h=(text,pageBreak=false)=>para(text,{bold:true,size:24,keep:true,pageBreak});
const dataCell=(d,unit='')=>({text:d?.value==null?'':typeof d.value==='number'?fmt(d.value)+unit:String(d.value)+unit,red:d?.uncertain!==false,align:typeof d?.value==='number'?'right':'left'});
export function wordBody(p){
 assertRowLinks(p.review.rows);const area=totalArea(p),b=selectedBuilding(p);
 const parcels=p.parcels.length?p.parcels:[{name:p.address,lot:p.address,area:p.land.area,price:p.land.price,priceDate:p.land.priceDate,zones:p.land.zones.map(z=>z.name).join(', ')}];
 let xml=h('Ⅰ. 대지개요')+para('. 대지위치 : '+p.address)+para('. 대지면적 : '+(area===null?'':`${fmt(area)}㎡(${fmt(area*.3025,2)}평)`),{red:p.land.area.uncertain})+para('. 지역지구 : '+p.land.zones.map(z=>z.name).join(', '),{red:p.land.zones.some(z=>z.uncertain)})+para('. 지번현황',{keep:true});
 const plotRows=parcels.map(x=>[{text:x.lot||x.name||'',red:x.area?.uncertain},dataCell(x.area),{text:x.area?.value==null?'':fmt(x.area.value*.3025,2),red:x.area?.uncertain,align:'right'},dataCell(x.price),{text:x.priceDate?.value||'',red:x.priceDate?.uncertain},x.zones||p.land.zones.map(z=>z.name).join(', '),{text:'',red:true}]);
 plotRows.push(['합계',{text:area===null?'':fmt(area),align:'right',red:p.land.area.uncertain},{text:area===null?'':fmt(area*.3025,2),align:'right',red:p.land.area.uncertain},'','','','']);
 xml+=wordTable(['지번','면적 Sqm','면적 py','공시지가 원/㎡','기준연월','지역,지구','비고'],plotRows,[1800,1200,1100,1700,1300,4201,1500]);
 xml+=h('Ⅱ. 기존건축물 현황',true);
 if(p.building.status==='empty')xml+=para(p.building.manual?'해당 없음(나대지)':'건축물대장 조회 결과 0건 (나대지·대표 지번 등재·미등재 건축물 여부 대조 대상)',{red:true});
 else if(b){xml+=para('건축물명 : '+(b.bldNm||'')+' / '+(b.dongNm||''));xml+=wordTable(['항목','내용','항목','내용'],Array.from({length:Math.ceil(BUILDING_FIELDS.length/2)},(_,i)=>{const pair=BUILDING_FIELDS.slice(i*2,i*2+2);return pair.flatMap(([label,key,unit])=>[label,{text:key==='useAprDay'?displayDate(b[key]):number(b[key])!==null?fmt(b[key])+unit:String(b[key]??''),red:!!b._manual||b[key]==null,align:number(b[key])!==null?'right':'left'}]).concat(pair.length===1?['','']:[]);}),[2200,4200,2200,4201]);
  if(p.building.titles.length>1)xml+=para('선택 동 기준. 다른 동은 건축물대장 조회 자료에 포함.');
  const fs=p.building.floors.filter(f=>!b.mgmBldrgstPk||f.mgmBldrgstPk===b.mgmBldrgstPk);
  if(fs.length)xml+=wordTable(['동','층','구조','용도','면적 ㎡'],fs.map(f=>[f.dongNm||'',f.flrNoNm||'',f.strctCdNm||'',f.etcPurps||f.mainPurpsCdNm||'',{text:fmt(f.area),align:'right',red:!!f._manual}]),[1700,1300,2400,5601,1700]);
 }else xml+=para('건축물대장 자료 연결 전',{red:true});
 xml+=h('Ⅲ. 법규검토',true);
 xml+=wordTable(['구 분','항 목','대 상','법규내용','비 고'],p.review.rows.map(r=>[{text:r.group,fill:'D9D9D9',italic:true,align:'center',red:r.refs.some(x=>!x.current)},{text:r.item,align:'center'},{text:r.target,align:'center',red:r.uncertain},{text:r.text,red:!r.verified},{text:r.judgment|| (r.uncertain?r.refs.map(x=>shortLaw(x.name)+' '+x.article).join('\n'):''),red:r.uncertain||!!r.judgment}]),[1821,1440,1080,7020,1440]);
 if(p.issue)xml+=h('판단 내용')+para(p.issue,{red:true});
 xml+=h('Ⅳ. 법적 제재 유의사항',true)+wordTable(['위반 유형','근거 조문 및 내용'],p.review.sanctions.map(s=>[{text:s.item,align:'center'},{text:s.text,red:/현행 원문 미수신/.test(s.text)}]),[3300,9501]);
 return xml;
}
async function template(path){const r=await fetch('/templates/'+encodeURIComponent(path));if(!r.ok)throw new Error('빈 양식 읽기 실패');return r.arrayBuffer();}
/** 표지: 떠 있는 글상자(앵커) 대신 본문 흐름 배치 — 휴대폰·한글·워드 어디서 열어도 겹침·빈 쪽 없음. 로고(rId2)는 원본 이미지 그대로. */
function coverPage(xml,p){const b=xml.indexOf('<w:body>')+8,brk=xml.indexOf('<w:br w:type="page"/>');if(b<8||brk<0)return xml;const pStart=Math.max(xml.lastIndexOf('<w:p>',brk),xml.lastIndexOf('<w:p ',brk));if(pStart<b)return xml;
 const F='<w:rFonts w:ascii="맑은 고딕" w:hAnsi="맑은 고딕" w:eastAsia="맑은 고딕" w:cs="맑은 고딕"/>';
 const run=(t,sz,{bold=false,color='222222',spacing=0}={})=>`<w:r><w:rPr>${F}${bold?'<w:b/>':''}<w:color w:val="${color}"/>${spacing?`<w:spacing w:val="${spacing}"/>`:''}<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr><w:t xml:space="preserve">${t}</w:t></w:r>`;
 const para=(inner,{jc='left',before=0,after=0,border=false,keep=false}={})=>`<w:p><w:pPr>${keep?'<w:keepNext/>':''}${border?'<w:pBdr><w:top w:val="single" w:sz="6" w:space="2" w:color="222222"/><w:bottom w:val="single" w:sz="6" w:space="2" w:color="222222"/></w:pBdr>':''}<w:spacing w:before="${before}" w:after="${after}" w:line="240" w:lineRule="auto"/><w:ind w:left="0" w:right="0"/><w:jc w:val="${jc}"/></w:pPr>${inner}</w:p>`;
 const logo=`<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="1381760" cy="570865"/><wp:docPr id="9001" name="AOM 로고"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="9001" name="aom-logo.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1381760" cy="570865"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
 const g='8A8A8A';
 const cover=para(run('Strictly Confidential',15,{color:'222222',spacing:10}),{jc:'right',border:true})
  +para(run('{{TITLE}}',36,{color:'222222'}),{jc:'right',before:1100,after:120})
  +para(run('법규검토서',36,{color:'222222'}),{jc:'right',after:0})
  +para(run('{{DATE}}',20,{bold:true,color:'222222'}),{jc:'right',before:360})
  +para(run(`조회 ${esc(kstTime(p.queriedAt))} · 작성 ${esc(p.author||'')}`,15,{color:'8A8A8A'}),{jc:'right',before:80})
  +para(logo,{before:1000,after:80})
  +para(run('Copyright © 2020 by AOM Architects &amp; Developers Co.,Ltd All. RIGHTS RESERVED.',12,{color:g}))
  +para(run('No part of this publication may be reproduced, stored in a retrieval system, or transmitted in any form or by any means — electronic, mechanical, photocopying, recording, or otherwise — without the permission of AOM A&amp;D.',12,{color:g}))
  +para(run('This document provides an outline of a presentation and is incomplete without the accompanying oral commentary and discussion.',12,{color:g}),{keep:false});
 return xml.slice(0,b)+cover+xml.slice(pStart);}
export async function exportWord(p){
 const zip=await JSZip.loadAsync(await template('법규검토서_틀.docx'));
 let xml=await zip.file('word/document.xml').async('string');
 const tocTemplate=await (await fetch('/templates/'+encodeURIComponent('목차줄_서식.xml'))).text();
 const toc=['대지개요','기존건축물 현황','법규검토','법적 제재 유의사항'].map((name,i)=>tocTemplate.replace('Ⅰ',['Ⅰ','Ⅱ','Ⅲ','Ⅳ'][i]).replace('대지개요',name)).join('');
 xml=coverPage(xml,p);
 xml=xml.replaceAll('{{TITLE}}',esc(titleOf(p))).replaceAll('{{DATE}}',esc(displayDate(p.date)));
 // 원본 TOC/BODY는 w:t가 아닌 body 직하 텍스트 자리표시자. XML 조각 직접 대입.
 xml=xml.replace('{{TOC}}',toc).replace('{{BODY}}',wordBody(p));
 if(/\{\{\w+\}\}/.test(xml))throw new Error('워드 자리표시자 잔존');
 const parsed=new DOMParser().parseFromString(xml,'application/xml');if(parsed.querySelector('parsererror'))throw new Error('워드 XML 생성 오류');
 zip.file('word/document.xml',xml);
 let core=await zip.file('docProps/core.xml').async('string');for(const name of ['dc:creator','cp:lastModifiedBy']){const reg=new RegExp(`<${name}(?:\\s[^>]*)?>[\\s\\S]*?<\\/${name}>`);if(reg.test(core))core=core.replace(reg,`<${name}>${esc(p.author)}</${name}>`);else core=core.replace('</cp:coreProperties>',`<${name}>${esc(p.author)}</${name}></cp:coreProperties>`);}zip.file('docProps/core.xml',core);
 return zip.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',compression:'DEFLATE'});
}
function cellRegex(address){return new RegExp(`<c\\b(?=[^>]*\\br="${address}")[^>]*?(?:\\/>|>[\\s\\S]*?<\\/c>)`);}
export function setSheetCell(xml,address,value,styleOverride=null){
 const reg=cellRegex(address),match=xml.match(reg);let attrs=match?match[0].match(/^<c\b([^>]*?)(?:\/?>)/)[1]:` r="${address}"`;
 attrs=attrs.replace(/\s+t="[^"]*"/g,'').replace(/\/$/,'');
 if(styleOverride!==null)attrs=attrs.replace(/\s+s="[^"]*"/g,'')+` s="${styleOverride}"`;
 const val=value===null||value===undefined||value===''?'':typeof value==='number'?`<v>${value}</v>`:`<is><t xml:space="preserve">${esc(value)}</t></is>`;
 const replacement=`<c${attrs}${typeof value==='number'?'':' t="inlineStr"'}>${val}</c>`;
 if(match)return xml.replace(reg,()=>replacement);
 const rowN=Number(address.match(/\d+$/)[0]),rowRE=new RegExp(`(<row\\b(?=[^>]*\\br="${rowN}")[^>]*>)([\\s\\S]*?)(<\\/row>)`);
 if(rowRE.test(xml))return xml.replace(rowRE,(_,a,body,c)=>{const cells=body.match(/<c\b[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g)||[];cells.push(replacement);const col=t=>{const letter=t.match(/\br="([A-Z]+)\d+"/)[1];return [...letter].reduce((n,c)=>n*26+c.charCodeAt(0)-64,0);};cells.sort((a,b)=>col(a)-col(b));return a+cells.join('')+c;});
 const row=`<row r="${rowN}">${replacement}</row>`;let inserted=false;xml=xml.replace(/<row\b[^>]*\br="(\d+)"[^>]*>/g,(s,n)=>{if(!inserted&&+n>rowN){inserted=true;return row+s;}return s;});return inserted?xml:xml.replace('</sheetData>',row+'</sheetData>');
}
function getStyle(xml,address){return Number(xml.match(cellRegex(address))?.[0].match(/\bs="(\d+)"/)?.[1]||0);}
function redStyleFactory(styleXML){
 const d=new DOMParser().parseFromString(styleXML,'application/xml'),fonts=d.getElementsByTagNameNS(S,'fonts')[0],xfs=d.getElementsByTagNameNS(S,'cellXfs')[0],map=new Map();
 return {get(style){if(map.has(style))return map.get(style);const xf=xfs.children[style].cloneNode(true),originalFont=fonts.children[Number(xf.getAttribute('fontId')||0)].cloneNode(true);for(const c of [...originalFont.children])if(c.localName==='color')c.remove();const color=d.createElementNS(S,'color');color.setAttribute('rgb','FFE00000');originalFont.appendChild(color);const fontId=fonts.children.length;fonts.appendChild(originalFont);fonts.setAttribute('count',String(fonts.children.length));xf.setAttribute('fontId',String(fontId));xf.setAttribute('applyFont','1');const id=xfs.children.length;xfs.appendChild(xf);xfs.setAttribute('count',String(xfs.children.length));map.set(style,id);return id;},xml(){return new XMLSerializer().serializeToString(d);}};
}
export async function exportExcel(p){
 const zip=await JSZip.loadAsync(await template('설계개요_빈양식.xlsx')),styles=redStyleFactory(await zip.file('xl/styles.xml').async('string'));
 let s1=await zip.file('xl/worksheets/sheet1.xml').async('string'),s6=await zip.file('xl/worksheets/sheet6.xml').async('string'),s7=await zip.file('xl/worksheets/sheet7.xml').async('string');
 const put=(xml,address,value,red)=>setSheetCell(xml,address,value,red?styles.get(getStyle(xml,address)):null);
 const L=p.review.limits;
 for(const [cell,value,red]of [['C7',titleOf(p),false],['D8',p.address,false],['D17',p.land.road.value,p.land.road.uncertain],['D18',[p.purpose,p.purpose2].filter(Boolean).join(', '),false],['D19',p.floors?`${p.basement?'지하 '+p.basement+'층, ':''}지상 ${p.floors}층`:'',true],['E34',L.landscape==null?null:L.landscape/100,true],['F24',L.bcr.value===null?null:L.bcr.value/100,L.bcr.uncertain],['F25',L.far.value===null?null:L.far.value/100,L.far.uncertain],['AD5',p.date,false]])s1=put(s1,cell,value,red);
 const parcels=p.parcels.length?p.parcels:[{name:p.location?.region3||'',lot:p.address,area:p.land.area,price:p.land.price}];
 if(parcels.length>23)throw new Error('원본 토지내역의 공제·합계 행 보존을 위해 23필지 초과 입력 불가.');
 parcels.forEach((x,i)=>{const r=3+i;for(const [col,v,red]of [['A',x.dong||x.name||'',!!x.area?.uncertain],['B',x.lot||'',!!x.area?.uncertain],['C',x.area?.value??null,x.area?.uncertain!==false],['E',x.price?.value??null,x.price?.uncertain!==false]])s6=put(s6,col+r,v,red);});
 s7=put(s7,'D3',p.land.priceDate.value,p.land.priceDate.uncertain);s7=put(s7,'E4',p.land.zones.map(x=>x.name).join(', '),p.land.zones.some(x=>x.uncertain));
 zip.file('xl/worksheets/sheet1.xml',s1);zip.file('xl/worksheets/sheet6.xml',s6);zip.file('xl/worksheets/sheet7.xml',s7);zip.file('xl/styles.xml',styles.xml());
 // 수식 자체는 보존. 원본 11개 시트의 과거 cached 값만 제거하고 Excel 재계산 요청.
 for(const name of Object.keys(zip.files).filter(n=>/^xl\/worksheets\/sheet\d+\.xml$/.test(n))){let s=await zip.file(name).async('string');s=s.replace(/<c\b[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g,c=>/<f\b/.test(c)?c.replace(/<v(?:\s[^>]*)?>[\s\S]*?<\/v>/g,''):c);zip.file(name,s);}
 let wb=await zip.file('xl/workbook.xml').async('string');wb=wb.replace(/<calcPr\b[^>]*\/>/,'<calcPr calcId="0" calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/>');zip.file('xl/workbook.xml',wb);
 // 원본 수식 범위(예: E15의 두 필지 합계)는 변경하지 않음. 3필지 이상 화면/README에 별도 고지.
 return zip.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',compression:'DEFLATE'});
}
