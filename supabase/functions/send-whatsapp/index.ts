// Deployed source for the CleanEazy send-whatsapp Edge Function.
// Keep secrets in Supabase Edge Function secrets, never in this file.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type, x-cron-secret","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json"};
const L:any={order_received:"Order Received",pickup_assigned:"Pickup Assigned",picked_up:"Picked Up",processing:"Processing",washing_started:"Washing Started",ironing:"Ironing",quality_check:"Quality Check",ready:"Ready",out_for_delivery:"Out for Delivery",delivered:"Delivered",payment_confirmation:"Payment Confirmation",outstanding_reminder:"Outstanding Reminder"};
const ENV:any={order_received:"WA_TEMPLATE_ORDER_RECEIVED",pickup_assigned:"WA_TEMPLATE_PICKUP_ASSIGNED",picked_up:"WA_TEMPLATE_PICKED_UP",processing:"WA_TEMPLATE_PROCESSING",washing_started:"WA_TEMPLATE_WASHING_STARTED",ironing:"WA_TEMPLATE_IRONING",quality_check:"WA_TEMPLATE_QUALITY_CHECK",ready:"WA_TEMPLATE_READY",out_for_delivery:"WA_TEMPLATE_OUT_FOR_DELIVERY",delivered:"WA_TEMPLATE_DELIVERED",payment_confirmation:"WA_TEMPLATE_PAYMENT_CONFIRMATION",outstanding_reminder:"WA_TEMPLATE_OUTSTANDING_REMINDER"};
const reply=(x:any,s=200)=>new Response(JSON.stringify(x),{status:s,headers:CORS});
async function user(req:Request,sb:any){const h=req.headers.get("Authorization")||"";if(!h.startsWith("Bearer "))return null;const r=await sb.auth.getUser(h.slice(7));return r.error?null:r.data?.user||null;}
const phone=(x:string)=>x.replace(/\D/g,"").slice(-10);
Deno.serve(async(req:Request)=>{if(req.method==="OPTIONS")return new Response("ok",{headers:CORS});if(req.method!=="POST")return reply({error:"POST required"},405);
const m=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}"),key=m.default||Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),url=Deno.env.get("SUPABASE_URL");if(!key||!url)return reply({error:"Supabase secret unavailable"},500);
const sb=createClient(url,key,{auth:{persistSession:false}});
const bearerUser=await user(req,sb);
let cronAuthorized=false;
if(!bearerUser){
  const cronSecret=req.headers.get("x-cron-secret")||new URL(req.url).searchParams.get("cron_secret")||"";
  if(cronSecret){
    const vr=await sb.rpc("verify_cron_secret",{p_secret:cronSecret});
    cronAuthorized=vr.data===true;
  }
}
if(!bearerUser&&!cronAuthorized)return reply({error:"Unauthorized"},401);const body=await req.json().catch(()=>({}));let q=sb.from("whatsapp_messages").select("*").eq("status","pending").lte("next_attempt_at",new Date().toISOString()).order("created_at",{ascending:true}).limit(Math.min(Number(body.limit||10),50));if(body.message_id)q=sb.from("whatsapp_messages").select("*").eq("id",Number(body.message_id));const r=await q;if(r.error)return reply({error:r.error.message},500);
const pid=Deno.env.get("WHATSAPP_PHONE_NUMBER_ID")||"",token=Deno.env.get("WHATSAPP_ACCESS_TOKEN")||"",ver=Deno.env.get("WHATSAPP_API_VERSION")||"v23.0";if(!pid||!token)return reply({error:"Meta WhatsApp Cloud API is not configured",code:"WHATSAPP_NOT_CONFIGURED"},503);
const results:any[]=[];
// Recover jobs that were claimed by a worker but abandoned before completion.
await sb.from("whatsapp_messages").update({status:"pending",next_attempt_at:new Date().toISOString(),updated_at:new Date().toISOString()})
  .eq("status","processing").lt("updated_at",new Date(Date.now()-15*60*1000).toISOString());
for(const candidate of r.data||[]){
  const claim=await sb.from("whatsapp_messages").update({status:"processing",attempts:Number(candidate.attempts||0)+1,updated_at:new Date().toISOString()})
    .eq("id",candidate.id).eq("status","pending").select("*").maybeSingle();
  if(claim.error||!claim.data)continue;
  const msg=claim.data;
  const c=(await sb.from("customers").select("*").eq("id",msg.customer_id).maybeSingle()).data;
  const o=msg.order_id?(await sb.from("orders").select("*").eq("id",msg.order_id).maybeSingle()).data:null;
  const fail=async(error:string)=>{const now=new Date().toISOString();await sb.from("whatsapp_messages").update({status:"failed",last_error:error,next_attempt_at:now,updated_at:now}).eq("id",msg.id);results.push({id:msg.id,ok:false,status:"failed",error,attempts:Number(msg.attempts||0)});};
  if(!c){await fail("Customer not found");continue}
  const to=phone(c.whatsapp_number_normalized||c.whatsapp_number||msg.recipient||"");
  if(to.length!==10){await fail("Invalid WhatsApp number");continue}
  const t=ENV[msg.event]?Deno.env.get(ENV[msg.event]):null;
  if(!t){await fail("Template not configured for "+msg.event);continue}
  const total=o?Number(o.total_amount||0).toFixed(2):"0.00",paid=o?Number(o.paid_amount||0).toFixed(2):"0.00",bal=o?Math.max(Number(o.total_amount||0)-Number(o.paid_amount||0),0).toFixed(2):"0.00";
  const last=msg.event==="payment_confirmation"?"Payment: ₹"+Number((msg.payload||{}).payment_amount||0).toFixed(2):msg.event==="outstanding_reminder"?String((msg.payload||{}).message||("Outstanding balance: ₹"+bal)):"Expected delivery: "+(o?.expected_delivery_date||"");
  const payload={messaging_product:"whatsapp",to:"91"+to,type:"template",template:{name:t,language:{code:msg.template_language||"en_US"},components:[{type:"body",parameters:[c.full_name||"Customer",o?.order_number||"",L[msg.event]||msg.event,total,paid,bal,last].map((x:string)=>({type:"text",text:String(x)}))}]}};
  let mid=null,lastError="";
  for(let a=1;a<=3;a++){
    const z=await fetch("https://graph.facebook.com/"+ver+"/"+pid+"/messages",{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify(payload)});
    const j=await z.json().catch(()=>({}));
    if(z.ok){mid=j?.messages?.[0]?.id||null;break}
    lastError=j?.error?.message||"Meta API error "+z.status;
    if(z.status!==429&&z.status<500)break;
    await new Promise(r=>setTimeout(r,a*700));
  }
  const attempts=Number(msg.attempts||0);
  if(mid){
    const now=new Date().toISOString();
    await sb.from("whatsapp_messages").update({status:"sent",sent_at:now,provider_message_id:mid,last_error:null,next_attempt_at:null,updated_at:now}).eq("id",msg.id);
    results.push({id:msg.id,ok:true,status:"sent",provider_message_id:mid,attempts});
  }else{
    const terminal=attempts>=5,now=new Date().toISOString(),next=new Date(Date.now()+Math.min(60,2**Math.min(attempts,5))*60000).toISOString();
    await sb.from("whatsapp_messages").update({status:terminal?"failed":"pending",next_attempt_at:next,last_error:lastError,updated_at:now}).eq("id",msg.id);
    results.push({id:msg.id,ok:false,status:terminal?"failed":"pending",error:lastError,attempts,retry_at:next});
  }
}
return reply({ok:true,results})});