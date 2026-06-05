import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Accès refusé : admin requis");
}

async function logAction(adminId: string, action: string, targetType: string, targetId: string, details?: Record<string, unknown>) {
  await supabaseAdmin.from("admin_logs").insert({
    admin_id: adminId, action, target_type: targetType, target_id: targetId,
    details: (details ?? {}) as never,
  });
}

/** Global statistics for admin dashboard */
export const adminStatsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const [users, props, kyc, verif, purchases, tx, activeUsers] = await Promise.all([
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("properties").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("kyc_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabaseAdmin.from("verification_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabaseAdmin.from("token_purchase_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabaseAdmin.from("token_transactions").select("amount"),
      supabaseAdmin.rpc("count_active_users", { since: thirtyMinAgo }),
    ]);
    const totalTokensSpent = (tx.data ?? []).reduce((s, t) => s + (t.amount < 0 ? -t.amount : 0), 0);
    return {
      users: users.count ?? 0,
      properties: props.count ?? 0,
      pendingKyc: kyc.count ?? 0,
      pendingVerif: verif.count ?? 0,
      pendingPurchases: purchases.count ?? 0,
      totalTokensSpent,
      activeUsers: activeUsers.data ?? 0,
    };
  });

/** List with filters */
export const adminListFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    type: z.enum(["users", "properties", "kyc", "verifications", "purchases", "bans", "logs"]),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.type === "users") {
      const { data: profiles } = await supabaseAdmin.from("profiles")
        .select("id, email, full_name, phone, tokens_balance, kyc_status, created_at")
        .order("created_at", { ascending: false }).limit(200);
      const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");
      const { data: bans } = await supabaseAdmin.from("user_bans").select("user_id, active, banned_until").eq("active", true);
      return (profiles ?? []).map((p) => ({
        ...p,
        roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role),
        banned: (bans ?? []).some((b) => b.user_id === p.id),
      }));
    }
    if (data.type === "properties") {
      const { data: rows } = await supabaseAdmin.from("properties")
        .select("id, title, city, price, owner_id, status, is_verified, is_premium, created_at")
        .order("created_at", { ascending: false }).limit(200);
      return rows ?? [];
    }
    if (data.type === "kyc") {
      const { data: rows } = await supabaseAdmin.from("kyc_requests")
        .select("id, user_id, cin_recto_url, cin_verso_url, status, reject_reason, created_at")
        .order("created_at", { ascending: false }).limit(100);
      const ids = (rows ?? []).map((r) => r.user_id);
      const { data: profs } = await supabaseAdmin.from("profiles").select("id, email, full_name").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
      // Signed URLs for private bucket
      const signed = await Promise.all((rows ?? []).map(async (r) => {
        const sign = async (url: string) => {
          const path = url.replace(/^.*kyc-documents\//, "");
          const { data } = await supabaseAdmin.storage.from("kyc-documents").createSignedUrl(path, 3600);
          return data?.signedUrl ?? url;
        };
        return { ...r, cin_recto_signed: await sign(r.cin_recto_url), cin_verso_signed: await sign(r.cin_verso_url),
          profile: (profs ?? []).find((p) => p.id === r.user_id) };
      }));
      return signed;
    }
    if (data.type === "verifications") {
      const { data: rows } = await supabaseAdmin.from("verification_requests")
        .select("id, user_id, property_id, status, reject_reason, created_at")
        .order("created_at", { ascending: false }).limit(100);
      const propIds = (rows ?? []).map((r) => r.property_id);
      const { data: props } = await supabaseAdmin.from("properties").select("id, title, city, address")
        .in("id", propIds.length ? propIds : ["00000000-0000-0000-0000-000000000000"]);
      return (rows ?? []).map((r) => ({ ...r, property: (props ?? []).find((p) => p.id === r.property_id) }));
    }
    if (data.type === "purchases") {
      const { data: rows } = await supabaseAdmin.from("token_purchase_requests")
        .select("id, user_id, tokens_amount, total_price, payment_reference, status, reject_reason, created_at")
        .order("created_at", { ascending: false }).limit(100);
      const ids = (rows ?? []).map((r) => r.user_id);
      const { data: profs } = await supabaseAdmin.from("profiles").select("id, email, full_name")
        .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
      return (rows ?? []).map((r) => ({ ...r, profile: (profs ?? []).find((p) => p.id === r.user_id) }));
    }
    if (data.type === "bans") {
      const { data: rows } = await supabaseAdmin.from("user_bans")
        .select("id, user_id, reason, banned_until, active, created_at")
        .order("created_at", { ascending: false }).limit(100);
      return rows ?? [];
    }
    if (data.type === "logs") {
      const { data: rows } = await supabaseAdmin.from("admin_logs")
        .select("id, admin_id, action, target_type, target_id, details, created_at")
        .order("created_at", { ascending: false }).limit(100);
      return rows ?? [];
    }
    return [];
  });

/** Approve/reject KYC */
export const adminProcessKycFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    id: z.string().uuid(), action: z.enum(["approve", "reject"]), reason: z.string().max(500).optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: req } = await supabaseAdmin.from("kyc_requests").select("user_id").eq("id", data.id).single();
    if (!req) throw new Error("Demande introuvable");
    await supabaseAdmin.from("kyc_requests").update({
      status: data.action === "approve" ? "approved" : "rejected",
      reject_reason: data.action === "reject" ? data.reason ?? null : null,
      processed_by: context.userId, processed_at: new Date().toISOString(),
    }).eq("id", data.id);
    await supabaseAdmin.from("profiles").update({
      kyc_status: data.action === "approve" ? "approved" : "rejected",
    }).eq("id", req.user_id);
    await logAction(context.userId, `kyc_${data.action}`, "kyc_request", data.id, { user_id: req.user_id });
    return { ok: true };
  });

/** Approve/reject property verification */
export const adminProcessVerifFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    id: z.string().uuid(), action: z.enum(["approve", "reject"]), reason: z.string().max(500).optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: req } = await supabaseAdmin.from("verification_requests").select("property_id").eq("id", data.id).single();
    if (!req) throw new Error("Demande introuvable");
    await supabaseAdmin.from("verification_requests").update({
      status: data.action === "approve" ? "approved" : "rejected",
      reject_reason: data.action === "reject" ? data.reason ?? null : null,
      processed_by: context.userId, processed_at: new Date().toISOString(),
    }).eq("id", data.id);
    if (data.action === "approve") {
      await supabaseAdmin.from("properties").update({ is_verified: true }).eq("id", req.property_id);
    }
    await logAction(context.userId, `verif_${data.action}`, "verification_request", data.id, { property_id: req.property_id });
    return { ok: true };
  });

/** Approve/reject token purchase request — credits tokens on approval */
export const adminProcessPurchaseFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    id: z.string().uuid(), action: z.enum(["approve", "reject"]), reason: z.string().max(500).optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: req } = await supabaseAdmin.from("token_purchase_requests")
      .select("id, user_id, tokens_amount, status").eq("id", data.id).single();
    if (!req) throw new Error("Demande introuvable");
    if (req.status !== "pending") throw new Error("Demande déjà traitée");
    await supabaseAdmin.from("token_purchase_requests").update({
      status: data.action === "approve" ? "approved" : "rejected",
      reject_reason: data.action === "reject" ? data.reason ?? null : null,
      processed_by: context.userId, processed_at: new Date().toISOString(),
    }).eq("id", data.id);
    if (data.action === "approve") {
      const { data: prof } = await supabaseAdmin.from("profiles").select("tokens_balance").eq("id", req.user_id).single();
      const newBal = (prof?.tokens_balance ?? 0) + req.tokens_amount;
      await supabaseAdmin.from("profiles").update({ tokens_balance: newBal }).eq("id", req.user_id);
      await supabaseAdmin.from("token_transactions").insert({
        user_id: req.user_id, amount: req.tokens_amount, reason: `Achat de jetons approuvé (#${data.id.slice(0, 8)})`,
      });
    }
    await logAction(context.userId, `purchase_${data.action}`, "purchase_request", data.id, { user_id: req.user_id, amount: req.tokens_amount });
    return { ok: true };
  });

/** Toggle role */
export const adminSetRoleFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    userId: z.string().uuid(),
    role: z.enum(["locataire", "proprietaire", "admin"]),
    add: z.boolean(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.add) {
      await supabaseAdmin.from("user_roles").insert({ user_id: data.userId, role: data.role });
    } else {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId).eq("role", data.role);
    }
    await logAction(context.userId, data.add ? "role_add" : "role_remove", "user", data.userId, { role: data.role });
    return { ok: true };
  });

/** Ban or unban a user */
export const adminBanUserFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    userId: z.string().uuid(),
    action: z.enum(["ban", "unban"]),
    reason: z.string().max(500).optional(),
    days: z.number().int().min(1).max(3650).optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.action === "ban") {
      const until = data.days ? new Date(Date.now() + data.days * 86400000).toISOString() : null;
      await supabaseAdmin.from("user_bans").insert({
        user_id: data.userId, reason: data.reason ?? "Violation des conditions", banned_until: until,
        active: true, banned_by: context.userId,
      });
    } else {
      await supabaseAdmin.from("user_bans").update({ active: false }).eq("user_id", data.userId).eq("active", true);
    }
    await logAction(context.userId, data.action, "user", data.userId, { reason: data.reason });
    return { ok: true };
  });

/** Adjust tokens manually (gift or correction) */
export const adminAdjustTokensFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    userId: z.string().uuid(),
    amount: z.number().int(),
    reason: z.string().min(1).max(500),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: prof } = await supabaseAdmin.from("profiles").select("tokens_balance").eq("id", data.userId).single();
    const newBal = Math.max(0, (prof?.tokens_balance ?? 0) + data.amount);
    await supabaseAdmin.from("profiles").update({ tokens_balance: newBal }).eq("id", data.userId);
    await supabaseAdmin.from("token_transactions").insert({
      user_id: data.userId, amount: data.amount, reason: `[ADMIN] ${data.reason}`,
    });
    await logAction(context.userId, "tokens_adjust", "user", data.userId, { amount: data.amount, reason: data.reason });
    return { ok: true };
  });

/** Update / delete property */
export const adminUpdatePropertyFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    propertyId: z.string().uuid(),
    action: z.enum(["suspend", "activate", "delete", "verify", "unverify"]),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.action === "delete") {
      await supabaseAdmin.from("properties").delete().eq("id", data.propertyId);
    } else if (data.action === "suspend") {
      await supabaseAdmin.from("properties").update({ status: "inactive" }).eq("id", data.propertyId);
    } else if (data.action === "activate") {
      await supabaseAdmin.from("properties").update({ status: "active" }).eq("id", data.propertyId);
    } else if (data.action === "verify") {
      await supabaseAdmin.from("properties").update({ is_verified: true }).eq("id", data.propertyId);
    } else {
      await supabaseAdmin.from("properties").update({ is_verified: false }).eq("id", data.propertyId);
    }
    await logAction(context.userId, `property_${data.action}`, "property", data.propertyId);
    return { ok: true };
  });

/** Site settings */
export const adminGetSettingsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data } = await supabaseAdmin.from("site_settings").select("*").eq("id", 1).single();
    return data;
  });

export const adminUpdateSettingsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    site_name: z.string().min(1).max(100).optional(),
    hero_title: z.string().min(1).max(200).optional(),
    hero_subtitle: z.string().min(1).max(500).optional(),
    hero_background_url: z.string().url().optional().or(z.literal("")),
    logo_url: z.string().url().optional().or(z.literal("")),
    primary_color: z.string().max(80).optional(),
    secondary_color: z.string().max(80).optional(),
    token_price: z.number().int().min(1).optional(),
    unlock_cost_tokens: z.number().int().min(0).max(1000).optional(),
    free_unlocks_per_day: z.number().int().min(0).max(1000).optional(),
    verification_cost_tokens: z.number().int().min(0).max(1000).optional(),
    verification_paid_enabled: z.boolean().optional(),
    boost_short_tokens: z.number().int().min(0).max(10000).optional(),
    boost_short_days: z.number().int().min(1).max(365).optional(),
    pro_subscription_tokens: z.number().int().min(0).max(100000).optional(),
    pro_subscription_days: z.number().int().min(1).max(3650).optional(),
    purchase_instructions: z.string().min(1).max(2000).optional(),
    premium_enabled: z.boolean().optional(),
    boost_short_enabled: z.boolean().optional(),
    boost_long_enabled: z.boolean().optional(),
    unlock_tokens_enabled: z.boolean().optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    await supabaseAdmin.from("site_settings").update({ ...data, updated_at: new Date().toISOString() } as never).eq("id", 1);
    await logAction(context.userId, "settings_update", "site_settings", "1", data);
    return { ok: true };
  });
