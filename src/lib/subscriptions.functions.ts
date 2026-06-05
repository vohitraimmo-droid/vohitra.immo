import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Purchase / extend a Pro subscription (tokens). */
export const subscribeProFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(() => ({}))
  .handler(async ({ context }) => {
    const uid = context.userId;

    const { data: settings, error: setErr } = await supabaseAdmin
      .from("site_settings")
      .select("pro_subscription_tokens, pro_subscription_days, free_mode_until, premium_enabled")
      .eq("id", 1)
      .single();
    if (setErr || !settings) throw new Error("Configuration introuvable");

    if ((settings as { premium_enabled?: boolean }).premium_enabled === false) {
      throw new Error("L'abonnement Premium est actuellement désactivé par l'administrateur.");
    }

    const cost = settings.pro_subscription_tokens;
    const days = settings.pro_subscription_days;
    const freeUntil = (settings as { free_mode_until?: string | null }).free_mode_until;
    const isFree = !!freeUntil && new Date(freeUntil).getTime() > Date.now();

    if (!isFree) {
      // Débit atomique
      const { error: debitErr } = await supabaseAdmin.rpc("debit_tokens", {
        _user_id: uid, _cost: cost,
        _reason: `Abonnement Pro (+${days}j)`,
      });
      if (debitErr) {
        if (debitErr.message?.includes("INSUFFICIENT_TOKENS")) {
          throw new Error(`Solde insuffisant (${cost} jetons requis)`);
        }
        console.error("[subscribePro] debit_tokens", debitErr);
        throw new Error("Erreur lors du débit");
      }
    }

    const { data: existing } = await supabaseAdmin
      .from("subscriptions").select("active_until").eq("user_id", uid).maybeSingle();
    const base = existing && new Date(existing.active_until) > new Date()
      ? new Date(existing.active_until) : new Date();
    const until = new Date(base.getTime() + days * 24 * 3600 * 1000);

    if (existing) {
      await supabaseAdmin.from("subscriptions")
        .update({ active_until: until.toISOString(), plan: "pro" })
        .eq("user_id", uid);
    } else {
      await supabaseAdmin.from("subscriptions").insert({
        user_id: uid, plan: "pro", active_until: until.toISOString(),
      });
    }

    // Promouvoir toutes les annonces actives du propriétaire en premium jusqu'à la fin de l'abo
    await supabaseAdmin.from("properties")
      .update({ is_premium: true, premium_until: until.toISOString() })
      .eq("owner_id", uid)
      .eq("status", "active");

    return { ok: true, active_until: until.toISOString() };
  });

/** Short boost (7 days, cheaper) — variant of boostPropertyFn. */
export const boostShortFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ propertyId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const uid = context.userId;

    const { data: settings } = await supabaseAdmin
      .from("site_settings").select("boost_short_tokens, boost_short_days, free_mode_until, boost_short_enabled").eq("id", 1).single();
    if (!settings) throw new Error("Configuration introuvable");
    if ((settings as { boost_short_enabled?: boolean }).boost_short_enabled === false) {
      throw new Error("Le Boost court est actuellement désactivé par l'administrateur.");
    }
    const cost = settings.boost_short_tokens;
    const days = settings.boost_short_days;
    const freeUntil = (settings as { free_mode_until?: string | null }).free_mode_until;
    const isFree = !!freeUntil && new Date(freeUntil).getTime() > Date.now();

    const { data: prop } = await supabaseAdmin
      .from("properties").select("id, owner_id, premium_until")
      .eq("id", data.propertyId).single();
    if (!prop) throw new Error("Annonce introuvable");

    const { data: adminRow } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", uid).eq("role", "admin").maybeSingle();
    const isAdmin = !!adminRow;
    if (prop.owner_id !== uid && !isAdmin) throw new Error("Annonce introuvable");

    if (!isAdmin && !isFree) {
      const { error: debitErr } = await supabaseAdmin.rpc("debit_tokens", {
        _user_id: uid, _cost: cost,
        _reason: `Boost court ${days}j annonce ${data.propertyId}`,
      });
      if (debitErr) {
        if (debitErr.message?.includes("INSUFFICIENT_TOKENS")) {
          throw new Error(`Solde insuffisant (${cost} jetons requis)`);
        }
        console.error("[boostShort] debit_tokens", debitErr);
        throw new Error("Erreur lors du débit");
      }
    }

    const base = prop.premium_until && new Date(prop.premium_until) > new Date()
      ? new Date(prop.premium_until) : new Date();
    const until = new Date(base.getTime() + days * 24 * 3600 * 1000);

    await supabaseAdmin.from("properties")
      .update({ is_premium: true, premium_until: until.toISOString() })
      .eq("id", data.propertyId);

    return { ok: true, premium_until: until.toISOString() };
  });

/** Owner-scoped stats for one property. */
export const getPropertyStatsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ propertyId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const uid = context.userId;
    const { data: prop } = await supabaseAdmin
      .from("properties").select("owner_id").eq("id", data.propertyId).single();
    if (!prop) throw new Error("Annonce introuvable");

    const { data: adminRow } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", uid).eq("role", "admin").maybeSingle();
    if (prop.owner_id !== uid && !adminRow) throw new Error("Accès refusé");

    const since7 = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const since30 = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

    const [viewsTotal, views7, views30, unlocks, favorites, messages] = await Promise.all([
      supabaseAdmin.from("property_views").select("id", { count: "exact", head: true }).eq("property_id", data.propertyId),
      supabaseAdmin.from("property_views").select("id", { count: "exact", head: true }).eq("property_id", data.propertyId).gte("created_at", since7),
      supabaseAdmin.from("property_views").select("id", { count: "exact", head: true }).eq("property_id", data.propertyId).gte("created_at", since30),
      supabaseAdmin.from("contact_unlocks").select("id", { count: "exact", head: true }).eq("property_id", data.propertyId),
      supabaseAdmin.from("favorites").select("id", { count: "exact", head: true }).eq("property_id", data.propertyId),
      supabaseAdmin.from("messages").select("id", { count: "exact", head: true }).eq("property_id", data.propertyId),
    ]);

    return {
      views_total: viewsTotal.count ?? 0,
      views_7d: views7.count ?? 0,
      views_30d: views30.count ?? 0,
      unlocks: unlocks.count ?? 0,
      favorites: favorites.count ?? 0,
      messages: messages.count ?? 0,
    };
  });

/** Compteur (vues + déblocages) pour toutes les annonces du propriétaire connecté. */
export const getOwnerListingsSummaryFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const uid = context.userId;
    const { data: props } = await supabaseAdmin
      .from("properties").select("id").eq("owner_id", uid);
    const ids = (props ?? []).map((p) => p.id);
    if (ids.length === 0) return {} as Record<string, { views: number; unlocks: number }>;

    const [{ data: views }, { data: unlocks }] = await Promise.all([
      supabaseAdmin.from("property_views").select("property_id").in("property_id", ids),
      supabaseAdmin.from("contact_unlocks").select("property_id").in("property_id", ids),
    ]);

    const out: Record<string, { views: number; unlocks: number }> = {};
    for (const id of ids) out[id] = { views: 0, unlocks: 0 };
    for (const v of views ?? []) out[v.property_id].views++;
    for (const u of unlocks ?? []) out[u.property_id].unlocks++;
    return out;
  });
