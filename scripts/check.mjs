/** 배포 전 정적 검증. 원본 도구 변경/누락 및 JS 문법 오류 탐지. */
import {readFileSync,existsSync,readdirSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const required=['README.md','THIRD_PARTY_NOTICES.md','wrangler.jsonc','public/index.html','public/_headers','src/worker.js','public/js/app.js','public/js/legal.js','public/js/ooxml.js','public/js/pdf.js','public/js/geometry.js','public/js/scene.js','public/js/cad.js','public/js/exports.js','docs/API_RECHECK.md','docs/REQUIREMENTS.md','docs/GEOMETRY.md','docs/TEST_REPORT.md'];
for(const file of required)if(!existsSync(join(root,file)))throw new Error(`필수 파일 없음: ${file}`);
const manifest=JSON.parse(readFileSync(join(root,'assets-manifest.json'),'utf8'));
for(const a of manifest.assets){const actual=createHash('sha256').update(readFileSync(join(root,a.path))).digest('hex');if(actual!==a.sha256)throw new Error(`제공 자산 무결성 오류: ${a.path}`);}
const walk=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()&&!['node_modules','.git','__pycache__'].includes(e.name)?walk(join(dir,e.name)):e.isFile()?[join(dir,e.name)]:[]);
const scripts=walk(root).filter(p=>/\.(?:mjs|js)$/.test(p)&&!p.includes('/vendor/'));
for(const script of scripts)execFileSync(process.execPath,['--check',script],{stdio:'pipe'});
const html=readFileSync(join(root,'public/index.html'),'utf8');
for(let i=0;i<=8;i++)if(!html.includes(`id="s${i}"`))throw new Error(`화면 구역 ${i} 누락`);
for(const match of html.matchAll(/(?:src|href)="(\/(?:js|assets|vendor)\/[^"#?]+)"/g))if(!existsSync(join(root,'public',match[1])))throw new Error('정적 파일 누락: '+match[1]);
if(!readFileSync(join(root,'src/worker.js'),'utf8').includes('기관 문서로 사양 재확인할 곳'))throw new Error('기관 사양 재확인 주석 없음');
if(existsSync(join(root,'public/.dev.vars')))throw new Error('공개 경로에 비밀키 파일 존재');
console.log(`PASS: JavaScript ${scripts.length}개 문법, 제공 자산 ${manifest.assets.length}개 해시, 필수 파일·0–8구역·정적 경로.`);
