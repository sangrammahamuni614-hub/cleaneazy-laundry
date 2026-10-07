const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const port = Number(process.env.CLEANEAZY_PORT || 4173);
const host = '127.0.0.1';
const stateDir = path.join(root, 'work');
const stateFile = path.join(stateDir, '.cleaneazy-server.json');
const mime = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json; charset=utf-8','.svg':'image/svg+xml','.xml':'application/xml; charset=utf-8','.txt':'text/plain; charset=utf-8','.png':'image/png','.ico':'image/x-icon'};

fs.mkdirSync(stateDir, {recursive:true});
const stopToken = crypto.randomBytes(24).toString('hex');
const server = http.createServer((request,response)=>{
  if (request.url === '/__health') { response.writeHead(200,{'Content-Type':'application/json'});response.end(JSON.stringify({ok:true,application:'CleanEazy'}));return; }
  if (request.url === '/__stop' && request.method === 'POST') {
    let supplied=request.headers['x-cleaneazy-stop']||'';
    if (supplied.length !== stopToken.length || !crypto.timingSafeEqual(Buffer.from(supplied),Buffer.from(stopToken))) { response.writeHead(403);response.end('प्रवेश नाकारला.');return; }
    response.writeHead(200,{'Content-Type':'text/plain; charset=utf-8'});response.end('CleanEazy बंद होत आहे.');
    setTimeout(()=>server.close(()=>process.exit(0)),40);return;
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') { response.writeHead(405);response.end();return; }
  let pathname;
  try { pathname=decodeURIComponent(new URL(request.url,`http://${host}:${port}`).pathname); } catch (_) { response.writeHead(400);response.end('अवैध विनंती.');return; }
  if (pathname === '/') pathname='/index.html';
  else if (pathname.endsWith('/')) pathname+='index.html';
  const target=path.resolve(root,`.${pathname}`);
  const safeRoot=root+path.sep;
  if (!target.startsWith(safeRoot) && target!==root) { response.writeHead(403);response.end('प्रवेश नाकारला.');return; }
  if (pathname.split('/').some(part=>part.startsWith('.')&&part!=='.nojekyll') || pathname.includes('/node_modules/')) { response.writeHead(404);response.end('फाइल उपलब्ध नाही.');return; }
  fs.stat(target,(error,stats)=>{
    if(error||!stats.isFile()){response.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});response.end('हे पान उपलब्ध नाही.');return;}
    response.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Cache-Control':path.basename(target)==='runtime-config.js'?'no-store':'no-cache'});
    if(request.method==='HEAD'){response.end();return;}
    fs.createReadStream(target).pipe(response);
  });
});
server.on('error',error=>{if(error.code==='EADDRINUSE')console.error(`पोर्ट ${port} वर सेवा आधीच सुरू आहे.`);else console.error(error.message);process.exit(1);});
server.listen(port,host,()=>{fs.writeFileSync(stateFile,JSON.stringify({pid:process.pid,token:stopToken,host,port}),{mode:0o600});console.log(`CleanEazy स्थानिक सेवा सुरू: http://${host}:${port}/software/`);});
function cleanup(){try{fs.unlinkSync(stateFile);}catch(_){};}
process.on('SIGINT',()=>server.close(()=>{cleanup();process.exit(0);}));
process.on('SIGTERM',()=>server.close(()=>{cleanup();process.exit(0);}));
process.on('exit',cleanup);
