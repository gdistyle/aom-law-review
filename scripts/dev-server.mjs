/** npm 설치 없이 실행하는 개발 서버. 배포에서는 Cloudflare Worker가 동일 fetch 함수를 호출. */
import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import worker from '../src/worker.js';
const root=path.resolve(new URL('../public',import.meta.url).pathname);
const env={...process.env};
try{for(const line of (await readFile('.dev.vars','utf8')).split('\n')){const m=line.match(/^([A-Z_]+)\s*=\s*"?([^"\n]*)"?\s*$/);if(m)env[m[1]]=m[2];}}catch{}
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.json':'application/json','.xml':'application/xml','.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'};
env.ASSETS={async fetch(req){let urlPath;try{urlPath=decodeURIComponent(new URL(req.url).pathname);}catch{return new Response('',{status:400});}let file=path.resolve(root,'.'+urlPath);if(file!==root&&!file.startsWith(root+path.sep))return new Response('',{status:403});try{if((await stat(file)).isDirectory())file=path.join(file,'index.html');return new Response(await readFile(file),{headers:{'Content-Type':types[path.extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff'}});}catch{return new Response('Not found',{status:404});}}};
const port=Number(process.env.PORT)||8787;
http.createServer(async(req,res)=>{try{const response=await worker.fetch(new Request(`http://localhost:${port}${req.url}`,{method:req.method,headers:req.headers}),env);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}catch{res.writeHead(500);res.end('Local server error');}}).listen(port,'127.0.0.1',()=>console.log(`A.O.M local: http://localhost:${port}`));
