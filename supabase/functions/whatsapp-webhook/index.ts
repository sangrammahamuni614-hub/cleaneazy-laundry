import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.117.2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-hub-signature-256",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });

function serviceKey(): string | null {
  try {
    const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
    return keys.default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || null;
  } catch {
    return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || null;
  }
}
function hex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (value) => value.toString(16).padStart(2, "0")).join("");
}
async function signature(secret: string, raw: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw)));
}
function equal(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index++) difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return difference === 0;
}
const rank: Record<string, number> = { sent: 1, delivered: 2, read: 3 };

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = new URL(request.url);
  if (request.method === "GET") {
    const verifyToken = Deno.env.get("WHATSAPP_VERIFY_TOKEN") || "";
    if (url.searchParams.get("hub.mode") === "subscribe" &&
      verifyToken && url.searchParams.get("hub.verify_token") === verifyToken) {
      return new Response(url.searchParams.get("hub.challenge") || "", { status: 200 });
    }
    return reply({ error: "Webhook verification failed." }, 403);
  }
  if (request.method !== "POST") return reply({ error: "POST required." }, 405);

  const key = serviceKey();
  const appSecret = Deno.env.get("META_APP_SECRET") || "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!key || !appSecret || !supabaseUrl) return reply({ error: "Webhook server configuration is incomplete." }, 503);

  const raw = await request.text();
  const supplied = request.headers.get("x-hub-signature-256") || "";
  const expected = "sha256=" + await signature(appSecret, raw);
  if (!equal(supplied, expected)) return reply({ error: "Invalid Meta signature." }, 403);

  let body: Record<string, any>;
  try {
    body = JSON.parse(raw);
  } catch {
    return reply({ error: "Invalid JSON payload." }, 400);
  }
  const supabase = createClient(supabaseUrl, key, { auth: { persistSession: false, autoRefreshToken: false } });
  let processed = 0;
  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      for (const item of change.value?.statuses || []) {
        if (!item.id || !["sent", "delivered", "read", "failed"].includes(item.status)) continue;
        const found = await supabase.from("whatsapp_messages")
          .select("id,status,payload")
          .eq("provider_message_id", item.id)
          .maybeSingle();
        if (found.error || !found.data) continue;
        const current = found.data.status;
        if (item.status !== "failed" && (rank[current] || 0) >= rank[item.status]) continue;
        const timestamp = new Date().toISOString();
        const failure = item.status === "failed";
        const detail = item.errors?.[0]?.title || item.errors?.[0]?.message || null;
        const updated = await supabase.from("whatsapp_messages").update({
          status: item.status,
          last_error: failure ? detail : null,
          updated_at: timestamp,
        }).eq("id", found.data.id).select("id").maybeSingle();
        if (updated.error || !updated.data) continue;

        const reminderId = Number(found.data.payload?.reminder_id || 0);
        if (reminderId) {
          await supabase.from("reminders").update({
            status: failure ? "failed" : "sent",
            last_error: failure ? detail : null,
            ...(failure ? {} : { sent_at: timestamp }),
          }).eq("id", reminderId);
        }
        processed++;
      }
    }
  }
  return reply({ ok: true, processed });
});


