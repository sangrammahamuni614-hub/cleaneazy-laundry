import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.117.2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });
const eventLabel: Record<string, string> = {
  order_received: "Order Received", pickup_assigned: "Pickup Assigned", picked_up: "Picked Up",
  processing: "Processing", washing_started: "Washing Started", ironing: "Ironing",
  quality_check: "Quality Check", ready: "Ready", out_for_delivery: "Out for Delivery",
  delivered: "Delivered", payment_confirmation: "Payment Confirmation",
  outstanding_reminder: "Customer Reminder",
};
const templateEnv: Record<string, string> = {
  order_received: "WA_TEMPLATE_ORDER_RECEIVED", pickup_assigned: "WA_TEMPLATE_PICKUP_ASSIGNED",
  picked_up: "WA_TEMPLATE_PICKED_UP", processing: "WA_TEMPLATE_PROCESSING",
  washing_started: "WA_TEMPLATE_WASHING_STARTED", ironing: "WA_TEMPLATE_IRONING",
  quality_check: "WA_TEMPLATE_QUALITY_CHECK", ready: "WA_TEMPLATE_READY",
  out_for_delivery: "WA_TEMPLATE_OUT_FOR_DELIVERY", delivered: "WA_TEMPLATE_DELIVERED",
  payment_confirmation: "WA_TEMPLATE_PAYMENT_CONFIRMATION",
  outstanding_reminder: "WA_TEMPLATE_OUTSTANDING_REMINDER",
};

function serviceKey(): string | null {
  try {
    const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
    return keys.default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || null;
  } catch {
    return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || null;
  }
}
const phone = (value: string) => value.replace(/\D/g, "").slice(-10);

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return reply({ error: "POST required" }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const key = serviceKey();
  if (!url || !key) return reply({ error: "Supabase function credentials are unavailable." }, 500);

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const authorization = request.headers.get("Authorization") || "";
  let cronAuthorized = false;
  if (authorization.startsWith("Bearer ")) {
    const result = await supabase.auth.getUser(authorization.slice(7));
    if (result.error || !result.data.user) return reply({ error: "Unauthorized." }, 401);
    const profile = await supabase.from("staff_users").select("active").eq("user_id", result.data.user.id).maybeSingle();
    if (profile.error) return reply({ error: "Staff access could not be checked." }, 503);
    if (!profile.data?.active) return reply({ error: "Active CleanEazy staff access is required." }, 403);
  } else {
    const secret = request.headers.get("x-cron-secret") || "";
    if (secret) {
      const verified = await supabase.rpc("verify_cron_secret", { p_secret: secret });
      if (verified.error) return reply({ error: "Cron access could not be checked." }, 503);
      cronAuthorized = verified.data === true;
    }
    if (!cronAuthorized) return reply({ error: "Unauthorized." }, 401);
  }

  const body = await request.json().catch(() => ({}));
  const limit = Math.max(1, Math.min(Number(body.limit) || 10, 50));
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") || "";
  const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN") || "";
  if (!phoneNumberId || !accessToken) {
    return reply({ error: "Meta WhatsApp Cloud API credentials are not configured.", code: "WHATSAPP_NOT_CONFIGURED" }, 503);
  }

  const now = new Date().toISOString();
  // Return abandoned claims to the queue, then claim each due row with a status
  // predicate so concurrent invocations cannot send the same row twice.
  await supabase.from("whatsapp_messages").update({
    status: "pending", next_attempt_at: now, updated_at: now,
  }).eq("status", "processing").lt("updated_at", new Date(Date.now() - 15 * 60_000).toISOString());

  const due = await supabase.from("whatsapp_messages").select("*")
    .eq("status", "pending")
    .lte("next_attempt_at", now)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (due.error) return reply({ error: "The WhatsApp queue could not be read." }, 503);

  const apiVersion = Deno.env.get("WHATSAPP_API_VERSION") || "v23.0";
  const results: Record<string, unknown>[] = [];
  for (const candidate of due.data || []) {
    const templateKey = templateEnv[candidate.event];
    const template = templateKey ? Deno.env.get(templateKey) || "" : "";
    if (!template) {
      results.push({ id: candidate.id, ok: false, status: "pending", code: "TEMPLATE_NOT_CONFIGURED" });
      continue;
    }

    const claim = await supabase.from("whatsapp_messages").update({
      status: "processing", attempts: Number(candidate.attempts || 0) + 1, updated_at: now,
    }).eq("id", candidate.id).eq("status", "pending").select("*").maybeSingle();
    if (claim.error || !claim.data) continue;
    const message = claim.data;
    const reminderId = Number(message.payload?.reminder_id || 0);
    const customerResult = await supabase.from("customers")
      .select("id,full_name,whatsapp_number,whatsapp_number_normalized")
      .eq("id", message.customer_id).maybeSingle();
    const orderResult = message.order_id
      ? await supabase.from("orders").select("order_number,total_amount,paid_amount,expected_delivery_date").eq("id", message.order_id).maybeSingle()
      : { data: null, error: null };

    const finishFailure = async (error: string, retryable: boolean) => {
      const attempts = Number(message.attempts || 0);
      const terminal = !retryable || attempts >= 5;
      const retryAt = new Date(Date.now() + Math.min(60, 2 ** Math.min(attempts, 5)) * 60_000).toISOString();
      const timestamp = new Date().toISOString();
      await supabase.from("whatsapp_messages").update({
        status: terminal ? "failed" : "pending",
        last_error: error.slice(0, 1000),
        next_attempt_at: retryAt,
        updated_at: timestamp,
      }).eq("id", message.id).eq("status", "processing");
      if (reminderId && terminal) {
        await supabase.from("reminders").update({ status: "failed", last_error: error.slice(0, 1000) }).eq("id", reminderId);
      }
      results.push({ id: message.id, ok: false, status: terminal ? "failed" : "pending", error, attempts, retry_at: terminal ? null : retryAt });
    };

    if (customerResult.error || !customerResult.data) {
      await finishFailure("Customer not found.", false);
      continue;
    }
    if (orderResult.error) {
      await finishFailure("Order details could not be read.", true);
      continue;
    }
    const customer = customerResult.data;
    const order = orderResult.data;
    const recipient = phone(customer.whatsapp_number_normalized || customer.whatsapp_number || message.recipient || "");
    if (recipient.length !== 10) {
      await finishFailure("Customer WhatsApp number is invalid.", false);
      continue;
    }

    const total = order ? Number(order.total_amount || 0).toFixed(2) : "0.00";
    const paid = order ? Number(order.paid_amount || 0).toFixed(2) : "0.00";
    const balance = order ? Math.max(Number(order.total_amount || 0) - Number(order.paid_amount || 0), 0).toFixed(2) : "0.00";
    let detail = "Expected delivery: " + (order?.expected_delivery_date || "");
    if (message.event === "payment_confirmation") {
      detail = "Payment: ₹" + Number(message.payload?.payment_amount || 0).toFixed(2);
    } else if (message.event === "outstanding_reminder") {
      detail = String(message.payload?.message || "Please contact CleanEazy Laundry about your reminder.");
    }
    const payload = {
      messaging_product: "whatsapp",
      to: "91" + recipient,
      type: "template",
      template: {
        name: template,
        language: { code: message.template_language || "en_US" },
        components: [{
          type: "body",
          parameters: [
            customer.full_name || "Customer",
            order?.order_number || "",
            eventLabel[message.event] || message.event,
            total,
            paid,
            balance,
            detail,
          ].map((value) => ({ type: "text", text: String(value) })),
        }],
      },
    };

    let providerId = "";
    let lastError = "";
    let retryable = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await response.json().catch(() => ({}));
        if (response.ok) {
          providerId = data?.messages?.[0]?.id || "";
          if (!providerId) lastError = "Meta accepted the request but returned no message id.";
          break;
        }
        lastError = String(data?.error?.message || `Meta API error ${response.status}`);
        retryable = response.status === 429 || response.status >= 500;
        if (!retryable || attempt === 3) break;
      } catch (error) {
        lastError = error instanceof Error ? error.message : "Meta API request failed.";
        retryable = true;
        if (attempt === 3) break;
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 700));
    }

    if (providerId) {
      const sentAt = new Date().toISOString();
      const saved = await supabase.from("whatsapp_messages").update({
        status: "sent", sent_at: sentAt, provider_message_id: providerId,
        last_error: null, next_attempt_at: null, updated_at: sentAt,
      }).eq("id", message.id).eq("status", "processing");
      if (saved.error) {
        results.push({ id: message.id, ok: false, status: "processing", error: "Provider accepted the message, but its delivery id could not be saved." });
      } else {
        if (reminderId) await supabase.from("reminders").update({ status: "sent", sent_at: sentAt, last_error: null }).eq("id", reminderId);
        results.push({ id: message.id, ok: true, status: "sent", provider_message_id: providerId, attempts: message.attempts });
      }
    } else {
      await finishFailure(lastError || "Meta WhatsApp did not accept the message.", retryable);
    }
  }

  return reply({ ok: true, results });
});


