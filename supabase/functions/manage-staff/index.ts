import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.117.2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: cors });

function serviceKey(): string | null {
  try {
    const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
    return keys.default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || null;
  } catch {
    return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || null;
  }
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return reply({ error: "POST required" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const key = serviceKey();
  const authorization = request.headers.get("Authorization") || "";
  if (!url || !key || !authorization.startsWith("Bearer ")) {
    return reply({ error: "Sign in with an active administrator account." }, 401);
  }

  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const auth = await admin.auth.getUser(authorization.slice(7));
  if (auth.error || !auth.data.user) return reply({ error: "Your session is not valid. Sign in again." }, 401);

  const profile = await admin.from("staff_users")
    .select("user_id,role,active,display_name")
    .eq("user_id", auth.data.user.id)
    .maybeSingle();
  if (profile.error) return reply({ error: "Team access could not be checked." }, 503);
  if (!profile.data?.active || profile.data.role !== "admin") {
    return reply({ error: "Administrator access is required." }, 403);
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.action !== "string") return reply({ error: "Invalid request." }, 400);

  if (body.action === "list") {
    const [members, users] = await Promise.all([
      admin.from("staff_users").select("user_id,display_name,role,active,created_at").order("created_at"),
      admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);
    if (members.error || users.error) return reply({ error: "The team list could not be loaded." }, 503);
    const emails = new Map((users.data.users || []).map((item) => [item.id, item.email || ""]));
    return reply({ members: (members.data || []).map((item) => ({
      user_id: item.user_id,
      email: emails.get(item.user_id) || "",
      display_name: item.display_name,
      role: item.role,
      active: item.active,
      created_at: item.created_at,
    })) });
  }

  if (body.action === "invite") {
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const displayName = typeof body.display_name === "string" ? body.display_name.trim().slice(0, 80) : "";
    const redirectTo = typeof body.redirect_to === "string" ? body.redirect_to : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !displayName) {
      return reply({ error: "Enter a valid email address and team member name." }, 400);
    }
    try {
      const target = new URL(redirectTo);
      if ((target.protocol !== "https:" && target.hostname !== "localhost") || !target.pathname.includes("/software/")) {
        return reply({ error: "The invitation return address must be the CleanEazy software sign-in page." }, 400);
      }
    } catch {
      return reply({ error: "The invitation return address is invalid." }, 400);
    }
    const invite = await admin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: displayName },
      redirectTo,
    });
    if (invite.error || !invite.data.user) {
      return reply({ error: invite.error?.message || "The invitation could not be sent." }, 400);
    }

    // The Auth trigger creates new invitees as staff. This upsert also covers an
    // existing Auth account that had no team profile before being invited.
    const existing = await admin.from("staff_users").select("user_id").eq("user_id", invite.data.user.id).maybeSingle();
    if (existing.error) return reply({ error: "The invitation was sent, but team access could not be confirmed." }, 503);
    if (!existing.data) {
      const provision = await admin.from("staff_users").insert({
        user_id: invite.data.user.id,
        display_name: displayName,
        role: "staff",
        active: true,
      });
      if (provision.error) return reply({ error: "The invitation was sent, but staff access could not be provisioned." }, 503);
    }
    return reply({ ok: true, invited: true, email });
  }

  if (body.action === "update") {
    const member = body.member;
    if (!member || typeof member.user_id !== "string" || member.user_id === auth.data.user.id) {
      return reply({ error: "You cannot change your own administrator access." }, 400);
    }
    const changes: Record<string, unknown> = {};
    if (member.role !== undefined) {
      if (member.role !== "admin" && member.role !== "staff") return reply({ error: "Choose Admin or Staff." }, 400);
      changes.role = member.role;
    }
    if (member.active !== undefined) {
      if (typeof member.active !== "boolean") return reply({ error: "Invalid team status." }, 400);
      changes.active = member.active;
    }
    if (!Object.keys(changes).length) return reply({ error: "No team access change was requested." }, 400);

    const current = await admin.from("staff_users").select("role,active").eq("user_id", member.user_id).maybeSingle();
    if (current.error || !current.data) return reply({ error: "Team member not found." }, 404);
    const removesAdmin = current.data.role === "admin" && current.data.active &&
      ((changes.role !== undefined && changes.role !== "admin") || changes.active === false);
    if (removesAdmin) {
      const count = await admin.from("staff_users").select("user_id", { count: "exact", head: true }).eq("role", "admin").eq("active", true);
      if (count.error) return reply({ error: "Administrator count could not be checked." }, 503);
      if ((count.count || 0) <= 1) return reply({ error: "The last active administrator cannot be demoted or deactivated." }, 409);
    }

    const updated = await admin.from("staff_users").update(changes).eq("user_id", member.user_id).select("user_id,display_name,role,active").single();
    if (updated.error) return reply({ error: "Team access could not be updated." }, 503);
    return reply({ ok: true, member: updated.data });
  }

  return reply({ error: "Unknown team management action." }, 400);
});


