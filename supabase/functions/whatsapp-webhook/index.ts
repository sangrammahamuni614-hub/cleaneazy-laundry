import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type, x-hub-signature-256","Access-Control-Allow-Methods":"GET,POST,OPTIONS","Content-Type":"application/json"};
const out=(x:any,s=200)=>new Response(JSON.stringify(x),{status:s,headers:CORS});
function toHex(b:ArrayBuffer){return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("")}
async function sign(secret:string,data:string){const enc=new TextEncoder();const key=await crypto.subtle.importKey("raw",enc.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);return toHex(await crypto.subtle.sign("HMAC",key,enc.encode(data)))}
function equal(a:string,b:string){if(a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i++)x|=a.charCodeAt(i)^b.charCodeAt(i);return x===0}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:CORS});
 const u=new URL(req.url);
 if(req.method==="GET"){if(u.searchParams.get("hub.mode")==="subscribe"&&u.searchParams.get("hub.verify_token")===Deno.env.get("WHATSAPP_VERIFY_TOKEN"))return new Response(u.searchParams.get("hub.challenge")||"",{status:200});return out({error:"Verification failed"},403)}
 if(req.method!=="POST")return out({error:"POST required"},405);
 const m=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}"),key=m.default||Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),appSecret=Deno.env.get("META_APP_SECRET");
 if(!key||!appSecret)return out({error:"Webhook secret configuration missing"},500);
 const raw=await req.text(),sig=req.headers.get("x-hub-signature-256")||"",expected="sha256="+await sign(appSecret,raw);
 if(!equal(sig,expected))return out({error:"Invalid signature"},403);
 const sb=createClient(Deno.env.get("SUPABASE_URL")!,key,{auth:{persistSession:false}}),body=JSON.parse(raw);let processed=0;
 for(const e of body.entry||[])for(const ch of e.changes||[])for(const s of ch.value?.statuses||[]){if(!s.id)continue;const state=s.status==="delivered"?"delivered":s.status==="read"?"read":s.status==="failed"?"failed":"sent";await sb.from("whatsapp_messages").update({status:state,last_error:s.errors?.[0]?.title||null,updated_at:new Date().toISOString()}).eq("provider_message_id",s.id);processed++}
 return out({ok:true,processed});
});