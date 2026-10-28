"""네트워크 탐색이 제한된 렌더러용 메모리 내 HTML 하네스.
브라우저 정책은 변경하지 않음. 서버 전송 검수와 별개인 DOM/Canvas/OOXML 검수.
"""
import base64,json,re,urllib.request
from pathlib import Path

def prepare(page,root:Path):
 modules={}
 for path in (root/'public/js').glob('*.js'):
  s=path.read_text()
  s=re.sub(r"(['\"])\./([^'\"]+\.js)\1",lambda m:json.dumps('aom/'+m[2]),s)
  if path.name=='app.js':
   s=s.replace('new URL(path,location.origin)',"new URL(path,'http://localhost:8787')")
   s=s.replace("frame.src='/stamp/index.html';","frame.srcdoc=window.__stamp;")
  modules['aom/'+path.name]='data:text/javascript;base64,'+base64.b64encode(s.encode()).decode()
 def local_fetch(url):
  # localhost 고정. 외부 네트워크·인증정보 접근 없음.
  path=urllib.parse.urlsplit(url).path;query=urllib.parse.urlsplit(url).query
  if path.startswith('/api/'):
   with urllib.request.urlopen('http://localhost:8787'+path+('?' + query if query else '')) as r:return {'bytes':base64.b64encode(r.read()).decode(),'type':r.headers.get('Content-Type'),'status':r.status}
  file=(root/'public'/urllib.parse.unquote(path).lstrip('/')).resolve()
  if not file.is_relative_to((root/'public').resolve()) or not file.is_file():return {'bytes':'','status':404,'type':'text/plain'}
  return {'bytes':base64.b64encode(file.read_bytes()).decode(),'status':200,'type':'application/octet-stream'}
 page.expose_function('__aomLocalRead',local_fetch)
 html=(root/'public/index.html').read_text()
 html=re.sub(r'<link rel="stylesheet"[^>]+>','<style>'+(root/'public/assets/site.css').read_text()+'</style>',html,count=1)
 html=re.sub(r'<script type="importmap">.*?</script>','<script type="importmap">'+json.dumps({'imports':modules})+'</script>',html,flags=re.S)
 html=re.sub(r'<script src="/vendor/jszip-3.10.1.min.js" defer></script>',lambda m:'<script>'+(root/'public/vendor/jszip-3.10.1.min.js').read_text()+'</script>',html)
 setup='''<script>window.__stamp=STAMP;window.__aomModules=MODULES;window.fetch=async function(url,options){const result=await window.__aomLocalRead(String(url));return new Response(Uint8Array.from(atob(result.bytes),c=>c.charCodeAt(0)),{status:result.status,headers:{'Content-Type':result.type||'application/octet-stream'}});};</script>'''.replace('STAMP',json.dumps((root/'public/stamp/index.html').read_text()).replace('</script>','<\\/script>')).replace('MODULES',json.dumps(modules))
 html=html.replace('<script type="module" src="/js/app.js"></script>',setup+'<script type="module">import "aom/app.js";</script>')
 page.set_content(html,wait_until='load')
 page.wait_for_function('document.getElementById("connection").textContent.includes("자료 연결 전")')
