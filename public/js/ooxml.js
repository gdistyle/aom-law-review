import {shortLaw} from './legal.js';
import {kstTime,esc,fmt,number,displayDate,titleOf,totalArea,selectedBuilding,BUILDING_FIELDS,redactFreeText,assertRowLinks} from './core.js';
const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const S='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const font='<w:rFonts w:ascii="맑은 고딕" w:hAnsi="맑은 고딕" w:eastAsia="맑은 고딕" w:cs="맑은 고딕"/>';
function run(text,{red=false,bold=false,italic=false,size=18}={}){return `<w:r><w:rPr>${font}${red?'<w:color w:val="E00000"/>':''}${bold?'<w:b/>':''}${italic?'<w:i/>':''}<w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr><w:t xml:space="preserve">${esc(redactFreeText(text)||' ')}</w:t></w:r>`;}
function para(text,opts={}){return `<w:p><w:pPr><w:widowControl/><w:ind w:left="0" w:firstLine="0"/><w:jc w:val="${opts.align||'left'}"/><w:spacing w:after="80" w:line="240" w:lineRule="auto"/>${opts.keep?'<w:keepNext/>':''}${opts.pageBreak?'<w:pageBreakBefore/>':''}</w:pPr>${String(text??'').split('\n').map(t=>run(t,opts)).join('<w:r><w:br/></w:r>')}</w:p>`;}
function cell(text,width,opts={}){return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/><w:vAlign w:val="center"/>${opts.fill?`<w:shd w:fill="${opts.fill}"/>`:''}</w:tcPr>${para(text,opts).replace(opts.white?'<w:rPr>':'__NO__',opts.white?'<w:rPr><w:color w:val="FFFFFF"/>':'')}</w:tc>`;}
export function wordTable(headers,rows,widths){
 const header='<w:tr><w:trPr><w:tblHeader/></w:trPr>'+headers.map((h,i)=>cell(h,widths[i],{bold:true,white:true,fill:'595959',align:'center'})).join('')+'</w:tr>';
 const body=rows.map(row=>'<w:tr>'+row.map((v,i)=>cell(typeof v==='object'?v.text:v,widths[i],{...(typeof v==='object'?v:{}),size:18})).join('')+'</w:tr>').join('');
 return `<w:tbl><w:tblPr><w:tblW w:w="${widths.reduce((a,b)=>a+b,0)}" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders>${['top','left','bottom','right','insideH','insideV'].map(s=>`<w:${s} w:val="single" w:sz="4" w:color="A6A6A6"/>`).join('')}</w:tblBorders><w:tblCellMar><w:top w:w="65" w:type="dxa"/><w:bottom w:w="65" w:type="dxa"/><w:left w:w="85" w:type="dxa"/><w:right w:w="85" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${widths.map(w=>`<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${header}${body}</w:tbl>${para('')}`;
}
const h=(text,pageBreak=false)=>para(text,{bold:true,size:24,keep:true,pageBreak});
const dataCell=(d,unit='')=>({text:d?.value==null?'':typeof d.value==='number'?fmt(d.value)+unit:String(d.value)+unit,red:d?.uncertain!==false,align:typeof d?.value==='number'?'right':'left'});
const ZRANK=n=>/^(제[12]종|제3종)?(전용|일반|준)?(주거|상업|공업)지역$|^(보전|생산|자연)녹지지역$|^(보전|생산|계획)관리지역$|^(농림|자연환경보전)지역$/.test(n)?0:/^(도시|관리|농림|자연환경보전)지역$/.test(n)?1:/지구$/.test(n)&&!/지구단위|취락/.test(n)?2:/개발제한구역|도시자연공원구역|시가화조정구역|수산자원보호구역/.test(n)?3:/지구단위계획|취락지구/.test(n)?4:5;
const zoneList=zs=>[...new Set(zs.map(z=>z.name))].map((n,i)=>[n,i]).sort((a,b)=>ZRANK(a[0])-ZRANK(b[0])||a[1]-b[1]).map(x=>x[0]);
function picture(rid,id,w,h,cx){const cy=Math.round(cx*h/w);return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${id}" name="대지 그림 ${id}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${id}" name="site${id}.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;}
export function wordBody(p,imgs=null){
 assertRowLinks(p.review.rows);const area=totalArea(p),b=selectedBuilding(p);
 const mainZones=zoneList(p.land.zones.filter(z=>!z.extra)),zAll=zoneList(p.land.zones);
 const parcels=(p.parcels.length?p.parcels:[{lot:(p.address.split(/\s+/).at(-1)||''),area:p.land.area,price:p.land.price,priceDate:p.land.priceDate}]).map((x,i)=>({...x,zones:i===0&&!x.pnu?mainZones:zoneList(p.land.zones.filter(z=>z.extra===x.pnu))}));
 const pd=(parcels.find(x=>x.priceDate?.value)?.priceDate?.value||'').replace('-','/');
 let xml=para('본 자료는 공개 자료(토지이음·건축물대장·법제처 현행 법령)를 기반으로 자동 작성한 초안으로, 참고 자료로만 사용함. 지구단위계획·조례·현장 여건 등에 따라 실제와 다를 수 있으므로, 최종 판단은 건축사 검토 및 인허가권자 협의에 따름.',{size:17,red:true})+h('Ⅰ. 대지개요')+(p.address?para('. 대지위치 : '+p.address+(p.extra?.length?` 외 ${p.extra.length}필지`:'')):'')+(area!==null?para('. 대지면적 : '+`${fmt(area,2)}㎡(${fmt(area*.3025,2)} 평)`,{red:p.land.area.uncertain}):'')+(zAll.length?para('. 지역지구 : '+zAll.join(', '),{red:p.land.zones.some(z=>z.uncertain)}):'')+para('. 지번현황',{bold:true,keep:true});
 const plotRows=parcels.map(x=>[{text:x.lot||'',align:'center',red:x.area?.uncertain},{text:x.area?.value==null?'':fmt(x.area.value,2),align:'right',red:x.area?.uncertain},{text:x.area?.value==null?'':fmt(x.area.value*.3025,2),align:'right',red:x.area?.uncertain},{text:x.price?.value==null?'':fmt(x.price.value),align:'right',red:x.price?.uncertain},{text:(x.zones||[]).join(', ')},'']);
 plotRows.push([{text:'합계',align:'center',fill:'D9D9D9'},{text:area===null?'':fmt(area,2),align:'right',fill:'D9D9D9',red:p.land.area.uncertain},{text:area===null?'':fmt(area*.3025,2),align:'right',fill:'D9D9D9',red:p.land.area.uncertain},{text:'',fill:'D9D9D9'},{text:'',fill:'D9D9D9'},{text:'',fill:'D9D9D9'}]);
 xml+=wordTable(['지번','면적 Sqm','면적 py',`공시지가 원/㎡${pd?'\n'+pd:''}`,'지역, 지구','비고'],plotRows,[1300,1400,1300,1700,6000,1100]);
 let imgXml='';if(imgs){const cw=6300,cx=Math.round(cw/1440*914400*0.98);imgXml+=para('Ⅰ-1. 위치도 (지적도 · 항공사진)',{bold:true,size:24,keep:true,pageBreak:true})+`<w:tbl><w:tblPr><w:tblW w:w="${cw*2+200}" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders>${['top','left','bottom','right','insideH','insideV'].map(s=>`<w:${s} w:val="nil"/>`).join('')}</w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="${cw}"/><w:gridCol w:w="200"/><w:gridCol w:w="${cw}"/></w:tblGrid><w:tr>`+[[imgs.cad,'rIdSite1',9101,'지적도 (브이월드 일반지도 위 지적선)'],null,[imgs.photo,'rIdSite2',9102,'항공사진 (브이월드 영상지도)']].map(c=>c?`<w:tc><w:tcPr><w:tcW w:w="${cw}" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="40"/></w:pPr>${picture(c[1],c[2],c[0].w,c[0].h,cx)}</w:p>${para(c[3],{align:'center',size:16})}</w:tc>`:`<w:tc><w:tcPr><w:tcW w:w="200" w:type="dxa"/></w:tcPr><w:p/></w:tc>`).join('')+`</w:tr></w:tbl>`;}
 xml+=h('Ⅱ. 기존건축물 현황');
 if(p.building.status==='empty')xml+=para(p.building.manual?'해당 없음(나대지)':'건축물대장 조회 결과 0건 (나대지·대표 지번 등재·미등재 건축물 여부 대조 대상)',{red:true});
 else if(b){xml+=para('건축물명 : '+(b.bldNm||'')+' / '+(b.dongNm||''));xml+=wordTable(['항목','내용','항목','내용'],Array.from({length:Math.ceil(BUILDING_FIELDS.length/2)},(_,i)=>{const pair=BUILDING_FIELDS.slice(i*2,i*2+2);return pair.flatMap(([label,key,unit])=>[label,{text:key==='useAprDay'?displayDate(b[key]):number(b[key])!==null?fmt(b[key])+unit:String(b[key]??''),red:!!b._manual||b[key]==null,align:number(b[key])!==null?'right':'left'}]).concat(pair.length===1?['','']:[]);}),[2200,4200,2200,4201]);
  if(p.building.titles.length>1)xml+=para('선택 동 기준. 다른 동은 건축물대장 조회 자료에 포함.');
  const fs=p.building.floors.filter(f=>!b.mgmBldrgstPk||f.mgmBldrgstPk===b.mgmBldrgstPk);
  if(fs.length)xml+=wordTable(['동','층','구조','용도','면적 ㎡'],fs.map(f=>[f.dongNm||'',f.flrNoNm||'',f.strctCdNm||'',f.etcPurps||f.mainPurpsCdNm||'',{text:fmt(f.area),align:'right',red:!!f._manual}]),[1700,1300,2400,5601,1700]);
 }else xml+=para('건축물대장 조회 자료 없음',{red:true});
 xml+=imgXml;xml+=h('Ⅲ. 관련 법규 검토 (참고)');
 // 보고서용 요약: 판정·산식 줄을 우선 싣고, 조문 원문은 첫 문장만. 내용 없는 지역·지구 행은 한 행으로 묶음.
 const brief=r=>{const L=String(r.text||'').replace(/[┌┐└┘├┤┬┴┼─│]+/g,' ').split('\n').map(x=>x.trim()).filter(Boolean);const key=L.filter(x=>/^\[|^적용|^산식|→|^대공|^개발제한구역 :|^세부|강화될 수/.test(x));const first=t=>{const m=t.match(/^.{20,170}?(?:다\.|함\.|음\.)/);return m?m[0]:t.length>170?t.slice(0,170)+'…':t;};return (key.length?key:L.slice(0,1).map(first)).map(x=>x.length>260?x.slice(0,260)+'…':x).join('\n');};
 const rows=p.review.rows.filter(r=>String(r.text||'').trim()||String(r.target||'').trim());const empty=[...new Set(p.review.rows.filter(r=>!String(r.text||'').trim()&&!String(r.target||'').trim()).map(r=>r.item))];
 const tRows=rows.map(r=>[{text:r.group,fill:'F2F2F2',align:'center',red:r.refs.some(x=>!x.current)},{text:r.item,align:'center'},{text:r.target||'-',align:'center',red:r.uncertain},{text:brief(r),red:!r.verified},{text:r.judgment||(r.uncertain?r.refs.map(x=>shortLaw(x.name)+' '+x.article).join('\n'):''),red:r.uncertain||!!r.judgment}]);
 if(empty.length)tRows.push([{text:'기타 지역·지구',fill:'F2F2F2',align:'center'},{text:'지정 현황',align:'center'},{text:'-',align:'center'},{text:empty.join(', ')+'\n각 지정 근거 법령에 따른 행위제한 적용 — 해당 기관 협의·개별 확인 대상',red:true},{text:'토지이용계획 확인',red:true}]);
 xml+=wordTable(['구 분','항 목','대 상','검토 내용','비 고'],tRows,[1900,1500,1500,6400,1501]);
 {const l=p.review?.limits;if(l&&l.maxFootprint!=null){const cap=Number(p.manual?.floorLimit)>0,lh=l.legalHeight,fl=cap?Number(p.manual.floorLimit):lh?.floors>0?lh.floors:(l.maxGross>0&&l.maxFootprint>0?Math.ceil(l.maxGross/l.maxFootprint-1e-9):null),ratio=!(cap||lh?.floors>0),rr=!!(l.bcr?.uncertain||l.far?.uncertain);
 const rows=[['적용 용도지역',p.land?.zone?.value||'',!!p.land?.zone?.uncertain],['대지면적',area!==null?`${fmt(area,2)} ㎡ (${fmt(area*.3025,2)} 평)`:'',!!p.land?.area?.uncertain],['적용 건폐율',l.bcr?.value!=null?`${fmt(l.bcr.value)} %`:'',!!l.bcr?.uncertain],['적용 용적률',l.far?.value!=null?`${fmt(l.far.value)} %`:'',!!l.far?.uncertain],['법정 최대 건축면적',`${fmt(l.maxFootprint,2)} ㎡ (${fmt(l.maxFootprint*.3025,2)} 평)`,rr],['법정 최대 연면적 (용적률 산정용)',l.maxGross!=null?`${fmt(l.maxGross,2)} ㎡ (${fmt(l.maxGross*.3025,2)} 평)`:'',rr],['지상 최대 층수',fl?`${fl} 층${ratio?' (건폐율 가득 적층 시 비율 산정치)':''}`:'',ratio],['부설주차',l.parking!=null?`${fmt(l.parking)} 대${l.parkingPurposeAssumed?' ('+l.parkingPurpose+' 가정)':''}`:'',!!l.parkingPurposeAssumed||rr],['조경면적',l.landscapeExempt?'조경 의무 면제 대상':l.landscapeArea!=null?`${fmt(l.landscapeArea,2)} ㎡ 이상${l.landscapeOptional?' (녹지지역 면제 선택 가능)':''}`:'',rr&&!l.landscapeExempt]].filter(r=>r[1]);
 if(rows.length){xml+=h('Ⅳ. 설계 개요 (법정 최대 규모)')+wordTable(['항 목','내 용'],rows.map(r=>[{text:r[0],align:'center',fill:'F2F2F2'},{text:r[1],red:r[2]}]),[4300,8501]);}}}
 if(p.issue)xml+=para('. 판단 내용',{bold:true,keep:true})+para(p.issue,{red:true});
 {const c=p.context;if(c&&(c.facts?.length||c.concepts?.length)){xml+=h('Ⅴ. 대지 맥락 · 계획 착안점 (참고)');const cr=[];if(c.character)cr.push(['분위기',c.character]);for(const f of c.facts||[]){const k=f.indexOf(' : ');cr.push(k>0?[f.slice(0,k),f.slice(k+3)]:['현황',f]);}if(c.signature?.length)cr.push(['주변 주요 시설',c.signature.map(o=>`${o.name} (${o.kind}, ${Math.round(o.distance).toLocaleString('ko-KR')}m)`).join('\n')]);if(c.concepts?.length)cr.push(['계획 착안점',c.concepts.map(x=>'· '+x).join('\n')]);if(c.story)cr.push(['요약',c.story]);xml+=wordTable(['구 분','내 용'],cr.map(r=>[{text:r[0],align:'center',fill:'F2F2F2'},{text:r[1]}]),[2800,10001]);if(c.cautions?.length)xml+=para(c.cautions.map(x=>'· '+x).join('\n'),{red:true,size:17});xml+=para('※ '+(c.assumptions||[]).join(' · '),{size:16,red:true});}}
 const art=t=>String(t||'').split('\n').map(x=>x.trim()).filter(x=>/^「/.test(x)).map(x=>{const m=x.match(/^(「[^」]+」\s*제[\d조의\s]+(?:\([^)]*\))?)/);return m?m[1].trim():x.split(' : ')[0];});
 xml+=h('Ⅵ. 법적 제재 유의사항')+wordTable(['위반 유형','관련 조문'],p.review.sanctions.map(s=>[{text:s.item,align:'center',fill:'F2F2F2'},{text:[...new Set(art(s.text))].join('\n')||s.text}]),[4300,8501]);
 xml+=para('위반 시 허가 취소·공사 중지·철거 등 시정명령, 이행강제금 및 벌칙이 부과될 수 있음. 세부 기준은 각 조문 원문 확인.',{size:17});
 xml+=para(' ',{})+para('A.O.M 종합건축사사무소  |  제30회 경기도 건축문화상 사용승인부문 금상 (2025, 감애휴가)',{bold:true,size:22,keep:true})+para('신축 · 증축 · 용도변경 · 대수선 · 리모델링 · 인허가 상담 : 031-791-2536   ·   홈페이지 : https://aomand.com',{size:20})+para('경기도 하남시 대청로22번길 17, 206호 (신장동)',{size:20});
 xml+=para('※ 본 자료는 공개 자료(토지이음·건축물대장·법제처 현행 법령)를 기반으로 자동 작성한 초안으로, 참고 자료로만 사용함. 지구단위계획·조례·현장 여건 등에 따라 실제와 다를 수 있으므로, 최종 판단은 건축사 검토 및 인허가권자 협의에 따름.',{size:17,red:true});
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
  +para(run('건축 사전 검토 자료 (초안)',36,{color:'222222'}),{jc:'right',after:0})
  +para(run('{{DATE}}',20,{bold:true,color:'222222'}),{jc:'right',before:360})
  +(p.author?para(run(`작성 ${esc(p.author)}`,15,{color:'8A8A8A'}),{jc:'right',before:80}):'')
  +para(logo,{before:1000,after:80})
  +para(run('Copyright © 2020 by AOM Architects &amp; Developers Co.,Ltd All. RIGHTS RESERVED.',12,{color:g}))
  +para(run('No part of this publication may be reproduced, stored in a retrieval system, or transmitted in any form or by any means — electronic, mechanical, photocopying, recording, or otherwise — without the permission of AOM A&amp;D.',12,{color:g}))
  +para(run('This document provides an outline of a presentation and is incomplete without the accompanying oral commentary and discussion.',12,{color:g}),{keep:false});
 let rest=xml.slice(pStart);rest=rest.replace('<w:br w:type="page"/>','');rest=rest.replace(/^<w:p>(<w:pPr>)?/,m=>m.endsWith('<w:pPr>')?'<w:p><w:pPr><w:pageBreakBefore/>':'<w:p><w:pPr><w:pageBreakBefore/></w:pPr>');if(!rest.includes('<w:pageBreakBefore/>'))rest=rest.replace(/^<w:p ([^>]*)>(<w:pPr>)?/,(m,a,pp)=>`<w:p ${a}><w:pPr><w:pageBreakBefore/>`+(pp?'':'</w:pPr>'));return xml.slice(0,b)+cover+rest;}
export async function exportWord(p){
 const zip=await JSZip.loadAsync(await template('법규검토서_틀.docx'));
 let xml=await zip.file('word/document.xml').async('string');
 const tocTemplate=await (await fetch('/templates/'+encodeURIComponent('목차줄_서식.xml'))).text();
 const tocNames=['대지개요','기존건축물 현황','관련 법규 검토 (참고)','설계 개요 (법정 최대 규모)',...(p.context&&(p.context.facts?.length||p.context.concepts?.length)?['대지 맥락 · 계획 착안점 (참고)']:[]),'법적 제재 유의사항'];const toc=tocNames.map((name,i)=>`<w:p><w:pPr><w:keepLines/><w:spacing w:before="0" w:after="200" w:line="300" w:lineRule="auto"/><w:ind w:left="4200" w:firstLine="0"/><w:jc w:val="left"/></w:pPr><w:r><w:rPr>${font}<w:b/><w:sz w:val="24"/><w:szCs w:val="24"/><w:color w:val="303236"/></w:rPr><w:t xml:space="preserve">${['Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ','Ⅵ'][i]}.  ${esc(name)}</w:t></w:r></w:p>`).join('');
 {const k=xml.indexOf('w:firstLine="5133"'),ps=xml.lastIndexOf('<w:p>',k),te=xml.indexOf('{{TOC}}');if(k>0&&ps>0&&te>k)xml=xml.slice(0,ps)+'<w:p><w:pPr><w:spacing w:before="1600" w:after="500"/><w:ind w:left="4200" w:firstLine="0"/><w:jc w:val="left"/></w:pPr><w:r><w:rPr>'+font+'<w:b/><w:sz w:val="32"/><w:szCs w:val="32"/><w:color w:val="222222"/></w:rPr><w:t xml:space="preserve">목   차</w:t></w:r></w:p>'+xml.slice(te);}
 xml=coverPage(xml,p);
 xml=xml.replaceAll('{{TITLE}}',esc(titleOf(p))).replaceAll('{{DATE}}',esc(displayDate(p.date)));
 // 원본 TOC/BODY는 w:t가 아닌 body 직하 텍스트 자리표시자. XML 조각 직접 대입.
 let imgs=null;try{const cfg=await (await fetch('/api/config')).json();const {siteImages}=await import('./mapimage.js');imgs=await siteImages(p,cfg);}catch(e){console.warn('대지 그림 생성 실패',e);}
 if(imgs){zip.file('word/media/site_cad.png',imgs.cad.bytes);zip.file('word/media/site_photo.png',imgs.photo.bytes);let rels=await zip.file('word/_rels/document.xml.rels').async('string');rels=rels.replace('</Relationships>','<Relationship Id="rIdSite1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/site_cad.png"/><Relationship Id="rIdSite2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/site_photo.png"/></Relationships>');zip.file('word/_rels/document.xml.rels',rels);let ct=await zip.file('[Content_Types].xml').async('string');if(!/Extension="png"/i.test(ct)){ct=ct.replace('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="png" ContentType="image/png"/>');zip.file('[Content_Types].xml',ct);}}
 xml=xml.replace('{{TOC}}',toc).replace('{{BODY}}',wordBody(p,imgs));
 if(/\{\{\w+\}\}/.test(xml))throw new Error('워드 자리표시자 잔존');
 const parsed=new DOMParser().parseFromString(xml,'application/xml');if(parsed.querySelector('parsererror'))throw new Error('워드 XML 생성 오류');
 // 쪽 앞 나눔 직전의 빈 문단은 표가 쪽 끝에 닿으면 빈 쪽을 만들므로 제거
 xml=xml.replace(/<w:p>(?:(?!<\/w:p>).)*?<w:t[^>]*>\s*<\/w:t><\/w:r><\/w:p>(?=<w:p><w:pPr>(?:(?!<\/w:pPr>).)*<w:pageBreakBefore\/>)/gs,m=>/<w:t[^>]*>[^<\s]/.test(m)||/<w:drawing|<w:br/.test(m)?m:'');
 zip.file('word/document.xml',xml);
 let core=await zip.file('docProps/core.xml').async('string');for(const name of ['dc:creator','cp:lastModifiedBy']){const reg=new RegExp(`<${name}(?:\\s[^>]*)?>[\\s\\S]*?<\\/${name}>`);if(reg.test(core))core=core.replace(reg,`<${name}>${esc(p.author)}</${name}>`);else core=core.replace('</cp:coreProperties>',`<${name}>${esc(p.author)}</${name}></cp:coreProperties>`);}core=/<dc:title>/.test(core)?core.replace(/<dc:title>[\s\S]*?<\/dc:title>/,'<dc:title>건축 사전 검토 자료 (초안)</dc:title>'):core.replace('</cp:coreProperties>','<dc:title>건축 사전 검토 자료 (초안)</dc:title></cp:coreProperties>');zip.file('docProps/core.xml',core);
 return zip.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',compression:'DEFLATE'});
}
function cellRegex(address){return new RegExp(`<c\\b(?=[^>]*\\br="${address}")[^>]*?(?:\\/>|>[\\s\\S]*?<\\/c>)`);}
export function setSheetCell(xml,address,value,styleOverride=null){
 const reg=cellRegex(address),match=xml.match(reg);let attrs=match?match[0].match(/^<c\b([^>]*?)(?:\/?>)/)[1]:` r="${address}"`;
 attrs=attrs.replace(/\s+t="[^"]*"/g,'').replace(/\/$/,'');
 if(styleOverride!==null)attrs=attrs.replace(/\s+s="[^"]*"/g,'')+` s="${styleOverride}"`;
 const isF=value&&typeof value==='object'&&'f' in value,val=value===null||value===undefined||value===''?'':isF?`<f>${esc(value.f.replace(/^=/,''))}</f>`:typeof value==='number'?`<v>${value}</v>`:`<is><t xml:space="preserve">${esc(value)}</t></is>`;
 const replacement=`<c${attrs}${typeof value==='number'||isF||val===''?'':' t="inlineStr"'}>${val}</c>`;
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
/** 층별 면적: 3D 볼륨에서 고른 안(없으면 최대 볼륨)의 층별 바닥면적. 3D가 없으면 건폐율 최대 면적을 연면적 상한까지 아래층부터 채움. */
export function floorAreas(p,result){
 const m=result?.models?.find(x=>x.id===p.model?.selectedId)||result?.models?.[0];
 if(m?.layers?.length)return {areas:m.layers.map(l=>Math.round(l.area*100)/100),source:m.name};
 const L=p.review.limits,fp=number(L.maxFootprint),g=number(L.maxGross),n=number(p.floors)||number(p.legalMaxFloors);
 if(!(fp>0)||!(g>0)||!(n>0))return {areas:[],source:''};
 const out=[];let left=g;for(let i=0;i<n&&left>1e-6;i++){const a=Math.min(fp,left);out.push(Math.round(a*100)/100);left-=a;}
 return {areas:out,source:'법정 최대'};
}
export async function exportExcel(p,result=null){
 const zip=await JSZip.loadAsync(await template('설계개요_양식.xlsx')),styles=redStyleFactory(await zip.file('xl/styles.xml').async('string'));
 let s1=await zip.file('xl/worksheets/sheet1.xml').async('string'),s2=await zip.file('xl/worksheets/sheet2.xml').async('string');
 const put=(xml,address,value,red)=>setSheetCell(xml,address,value,red?styles.get(getStyle(xml,address)):null);
 const W=(a,v,red=false)=>{s1=put(s1,a,v,red);},WL=(a,v,red=false)=>{s2=put(s2,a,v,red);};
 const L=p.review.limits,uses=[p.purpose,p.purpose2].filter(Boolean);
 // ① 토지내역(전체 필지)
 const parcels=p.parcels.length?p.parcels:[{dong:p.location?.region3||'',lot:p.address,area:p.land.area,price:p.land.price}];
 if(parcels.length>26)throw new Error('토지내역 표는 26필지까지 들어갑니다.');
 parcels.forEach((x,i)=>{const r=3+i,av=x.area?.value??null,pv=x.price?.value??null;
  WL('A'+r,x.dong||x.name||'',false);WL('B'+r,x.lot||'',false);WL('C'+r,av,x.area?.uncertain!==false&&av!=null);
  if(av!=null)WL('D'+r,{f:`ROUND(C${r}*0.3025,2)`});WL('E'+r,pv,x.price?.uncertain!==false&&pv!=null);if(pv!=null)WL('F'+r,{f:`ROUND(E${r}/0.3025,0)`});
  if(x.category)WL('I'+r,x.category);});
 // ② 설계개요 — 대지현황
 W('AD5',displayDate(p.date));W('C6',uses.length?`[${uses.join(' · ')}]`:'');W('C7',titleOf(p));W('D8',p.address);
 const name=x=>[x.dong||x.name,x.lot].filter(Boolean).join(' ').trim(),shown=parcels.length>4?parcels.slice(0,3):parcels;
 shown.forEach((x,i)=>{const r=9+i,av=x.area?.value??null;W('D'+r,name(x));W('E'+r,av,x.area?.uncertain!==false&&av!=null);if(av!=null)W('F'+r,{f:`E${r}*0.3025`});});
 if(parcels.length>4){const rest=parcels.slice(3);W('D12',`외 ${rest.length}필지`);W('E12',{f:`SUM(토지내역!C6:C${2+parcels.length})`});W('F12',{f:'E12*0.3025'});}
 W('D16',zoneList(p.land.zones).join(', '),p.land.zones.some(x=>x.uncertain));{const t=zoneList(p.land.zones).join(', '),n=Math.max(1,Math.ceil([...t].reduce((w,c)=>w+(c.charCodeAt(0)>255?1:.55),0)/27));s1=s1.replace(/<row\b([^>]*?)\br="16"([^>]*)>/,(m,a,b)=>`<row${(a+' r="16"'+b).replace(/\s(?:ht|customHeight)="[^"]*"/g,'')} ht="${Math.max(20,n*16+6)}" customHeight="1">`);}W('D17',p.land.road.value||'',p.land.road.uncertain);
 // 건설규모
 const fa=floorAreas(p,result),nB=number(p.basement)||0,nF=fa.areas.length;
 W('D18',uses.join(', '));W('D19',nF?`${nB?'지하 '+nB+'층, ':''}지상 ${nF}층`:'',true);
 W('D20',{f:'IF(MAX(P9:P28)=0,"",MAX(P9:P28))'});
 W('F24',L.bcr.value===null?null:L.bcr.value/100,L.bcr.uncertain);W('F25',L.far.value===null?null:L.far.value/100,L.far.uncertain);
 // 주차
 // 주차 — 연면적(E23)이 바뀌면 대수가 다시 계산되도록 법령 산식 그대로 수식으로 넣음
 {const H=L.parkingHouse,U=number(L.parkingUnit);let raw=null;
  if(H)raw=`IF(E26<=${H.min},E26/100,IF(E26<=${H.base},1,1+(E26-${H.base})/${H.step}))`;else if(U>0)raw=`E26/${U}`;
  if(raw){W('D26',L.parkingPurpose||p.purpose||'',!p.purpose);W('E26',{f:'E23'});W('G26',{f:`IF(E26="","",IF(${raw}<1,0,IF(${raw}-INT(${raw})>=0.5,INT(${raw})+1,INT(${raw}))))`});W('G30',{f:'G26'});W('G31',{f:'G30'},true);
   W('D27',H?`단독주택 50㎡ 초과 ${H.base}㎡ 이하 1대, ${H.base}㎡ 초과 시 1 + (시설면적 − ${H.base}) ÷ ${H.step}`:`시설면적 ${U}㎡당 1대`);W('D28','소수점 0.5 이상 1대, 1대 미만 0대 (주차장법 시행령 별표1 비고6)');}}
 // 조경
 // 조경 — 조례 연면적 구간이 있으면 연면적(E23)에 따라 비율이 바뀌는 수식
 {const T=L.landscapeTier;
  if(L.landscapeExempt){W('E34',0);W('D35','대지면적 기준 조경 의무 없음');}
  else if(T?.tiers?.length&&!T.small&&number(p.manual.landscape)==null){const ts=[...T.tiers].sort((a,b)=>a.lo-b.lo);let f='""';for(const t of ts)f=`IF(E23>=${t.lo},${t.value/100},${f})`;W('E34',{f});W('D35','건축조례 연면적 구간별 비율 (연면적 합계 기준)');}
  else if(L.landscape!=null){W('E34',L.landscape/100,number(p.manual.landscape)!=null);if(T?.small)W('D35',`건축조례: 대지 ${T.small[0]}㎡ 이상 ${T.small[1]}㎡ 미만 → ${T.value}%`);}}
 // 법정 최대(적용 기준) 요약표
 W('D2',{f:'IF(OR(E15="",F24=""),"",E15*F24)'});W('E2',{f:'IF(D2="","",D2*0.3025)'});W('F2',{f:'IF(D2="","","대지 "&TEXT(E15,"#,##0.00")&"㎡ × 건폐율 "&TEXT(F24*100,"General")&"%")'});
 {const cap=L.grossCapped?number(L.maxGross):null;W('D3',{f:cap?`IF(OR(E15="",F25=""),"",MIN(E15*F25,${cap}))`:'IF(OR(E15="",F25=""),"",E15*F25)'});W('E3',{f:'IF(D3="","",D3*0.3025)'});
  W('F3',{f:`IF(D3="","","대지 "&TEXT(E15,"#,##0.00")&"㎡ × 용적률 "&TEXT(F25*100,"General")&"%"${cap?`&" (연면적 상한 ${cap}㎡ 적용)"`:''})`});}
 if(p.legalMaxFloors)W('D4',p.legalMaxFloors);{const ln=(L.legalHeight?.lines||[]).find(x=>/\d+층\s*이하/.test(x)),src=ln?.match(/^\[([^\]]+)\]/)?.[1];if(src&&p.legalMaxFloors)W('F4',`${src} : ${p.legalMaxFloors}층 이하`);}
 // ③ 층별면적표 — 머리글을 실제 용도로, 지상은 최상층부터 1층(28행)까지, 지하는 30행부터
 W('J7',p.purpose||'주용도');W('L7',p.purpose2||'-');
 if(nF>20)throw new Error('층별면적표는 지상 20층까지 들어갑니다.');
 fa.areas.forEach((a,i)=>{const r=28-i;W('I'+r,`${i+1}층`);W('J'+r,a,true);for(const [c,f]of [['K',`J${r}*0.3025`],['P',`J${r}+L${r}+N${r}`],['Q',`P${r}*0.3025`]])W(c+r,{f});});
 for(let i=0;i<Math.min(nB,6);i++){const r=30+i;W('I'+r,`지하${i+1}층`);for(const [c,f]of [['K',`J${r}*0.3025`],['P',`J${r}+L${r}+N${r}`],['Q',`P${r}*0.3025`]])W(c+r,{f});}
 if(fa.source)W('AB28',`${fa.source} 기준`,true);
 zip.file('xl/worksheets/sheet1.xml',s1);zip.file('xl/worksheets/sheet2.xml',s2);zip.file('xl/styles.xml',styles.xml());
 let wb=await zip.file('xl/workbook.xml').async('string');wb=/<calcPr\b/.test(wb)?wb.replace(/<calcPr\b[^>]*\/>/,'<calcPr calcId="0" fullCalcOnLoad="1"/>'):wb.replace('</workbook>','<calcPr calcId="0" fullCalcOnLoad="1"/></workbook>');zip.file('xl/workbook.xml',wb);
 return zip.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',compression:'DEFLATE'});
}

