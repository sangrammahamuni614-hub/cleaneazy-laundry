const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const file = path.join(root,'work','.cleaneazy-server.json');
if(!fs.existsSync(file)){console.log('CleanEazy स्थानिक सेवा सुरू नाही.');process.exit(0);}
let state;try{state=JSON.parse(fs.readFileSync(file,'utf8'));}catch(_){console.error('स्थानिक सेवा माहिती वाचता आली नाही.');process.exit(1);}
(async()=>{
 try{const result=await fetch(`http://${state.host}:${state.port}/__stop`,{method:'POST',headers:{'x-cleaneazy-stop':state.token}});console.log(await result.text());}
 catch(_){try{fs.unlinkSync(file);}catch(__){}console.log('स्थानिक सेवा आधीच बंद झाली आहे.');}
})();
