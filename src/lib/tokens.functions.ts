import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Spend 1 token to unlock the owner contact info on a property.
 * Idempotent: if already unlocked, succeeds without debiting.
 */
export const unlockContactFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ propertyId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const userId = context.userId;

    // Already unlocked?
    const { data: existing } = await supabaseAdmin
      .from("contact_unlocks")
      .select("id")
      .eq("user_id", userId)
      .eq("property_id", data.propertyId)
      .maybeSingle();
    if (existing) return { ok: true, alreadyUnlocked: true };

    // Verify property exists and is active
    const { data: prop, error: propErr } = await supabaseAdmin
      .from("properties").select("id, owner_id").eq("id", data.propertyId).single();
    if (propErr || !prop) throw new Error("Annonce introuvable");
    if (prop.owner_id === userId) return { ok: true, alreadyUnlocked: true };

    // Admins unlock for free
    const { data: adminRow } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
    if (adminRow) {
      await supabaseAdmin.from("contact_unlocks")
        .insert({ user_id: userId, property_id: data.propertyId });
      return { ok: true, alreadyUnlocked: false };
    }

    // Read configurable unlock cost + free mode window + free daily quota + global toggle
    const { data: settings } = await supabaseAdmin
      .from("site_settings").select("unlock_cost_tokens, free_mode_until, free_unlocks_per_day, unlock_tokens_enabled").eq("id", 1).single();
    const cost = Number(settings?.unlock_cost_tokens ?? 1);
    const freeUntil = (settings as { free_mode_until?: string | null } | null)?.free_mode_until;
    const isFreeMode = !!freeUntil && new Date(freeUntil).getTime() > Date.now();
    const freeQuota = Number((settings as { free_unlocks_per_day?: number } | null)?.free_unlocks_per_day ?? 0);
    const tokensEnabled = (settings as { unlock_tokens_enabled?: boolean } | null)?.unlock_tokens_enabled !== false;

    // Quota gratuit journalier (fenêtre glissante 24h, non cumulable)
    let isFreeDaily = false;
    if (tokensEnabled && !isFreeMode && freeQuota > 0) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count } = await supabaseAdmin
        .from("contact_unlocks")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", since);
      if ((count ?? 0) < freeQuota) isFreeDaily = true;
    }

    const isFree = !tokensEnabled || isFreeMode || isFreeDaily;

    if (!isFree) {
      // Atomic debit (anti-race condition)
      const { error: debitErr } = await supabaseAdmin.rpc("debit_tokens", {
        _user_id: userId, _cost: cost,
        _reason: `Déblocage coordonnées annonce ${data.propertyId}`,
      });
      if (debitErr) {
        if (debitErr.message?.includes("INSUFFICIENT_TOKENS")) {
          throw new Error(`Solde insuffisant : ${cost} jeton(s) requis`);
        }
        console.error("[unlockContact] debit_tokens", debitErr);
        throw new Error("Erreur lors du débit");
      }
    }

    const { error: insErr } = await supabaseAdmin
      .from("contact_unlocks").insert({ user_id: userId, property_id: data.propertyId });
    if (insErr) {
      // refund (atomique) only if we actually charged
      if (!isFree) {
        await supabaseAdmin.rpc("credit_tokens", {
          _user_id: userId, _amount: cost,
          _reason: `Remboursement échec déblocage ${data.propertyId}`,
        });
      }
      console.error("[unlockContact] insert unlock", insErr);
      throw new Error("Erreur lors du déblocage");
    }

    return { ok: true, alreadyUnlocked: false };
  });


/**
 * Fetch the owner contact info for a property, but only if the caller
 * has unlocked it (or is the owner / an admin). Bypasses the profiles RLS
 * which only allows users to read their own profile.
 */
export const getOwnerContactFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ propertyId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const userId = context.userId;

    const { data: prop, error: propErr } = await supabaseAdmin
      .from("properties").select("id, owner_id").eq("id", data.propertyId).single();
    if (propErr || !prop) throw new Error("Annonce introuvable");

    const isOwner = prop.owner_id === userId;
    const { data: isAdminRow } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
    const isAdmin = !!isAdminRow;

    let unlocked = isOwner || isAdmin;
    if (!unlocked) {
      const { data: u } = await supabaseAdmin
        .from("contact_unlocks").select("id").eq("user_id", userId).eq("property_id", data.propertyId).maybeSingle();
      unlocked = !!u;
    }

    if (!unlocked) {
      return { unlocked: false as const, owner: null, visit_phone: null };
    }

    const [{ data: prof, error: profErr }, { data: contact }] = await Promise.all([
      supabaseAdmin.from("profiles").select("full_name, phone, email").eq("id", prop.owner_id).single(),
      supabaseAdmin.from("property_contacts").select("visit_phone").eq("property_id", data.propertyId).maybeSingle(),
    ]);
    if (profErr || !prof) throw new Error("Profil propriétaire introuvable");

    return {
      unlocked: true as const,
      owner: { full_name: prof.full_name, phone: prof.phone, email: prof.email },
      visit_phone: contact?.visit_phone ?? null,
    };
  });

/**
 * Create a token purchase request, with a 24h cooldown per user
 * to mitigate spam and fraud attempts.
 */
export const createTokenPurchaseRequestFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      tokensAmount: z.number().int().min(1).max(1000),
      paymentReference: z.string().trim().min(4).max(120),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const userId = context.userId;

    const { data: adminRow } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
    if (adminRow) throw new Error("Les administrateurs n'achètent pas de jetons.");

    // 24h cooldown
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recent, error: recentErr } = await supabaseAdmin
      .from("token_purchase_requests")
      .select("id, created_at")
      .eq("user_id", userId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (recentErr) throw new Error(recentErr.message);
    if (recent) {
      const nextAt = new Date(new Date(recent.created_at).getTime() + 24 * 60 * 60 * 1000);
      const hoursLeft = Math.max(1, Math.ceil((nextAt.getTime() - Date.now()) / (60 * 60 * 1000)));
      throw new Error(
        `Vous avez déjà effectué un achat dans les dernières 24h. Réessayez dans environ ${hoursLeft}h.`,
      );
    }

    const { data: settings, error: setErr } = await supabaseAdmin
      .from("site_settings").select("token_price").eq("id", 1).single();
    if (setErr || !settings) throw new Error("Configuration introuvable");

    const { error: insErr } = await supabaseAdmin.from("token_purchase_requests").insert({
      user_id: userId,
      tokens_amount: data.tokensAmount,
      total_price: data.tokensAmount * Number(settings.token_price),
      payment_reference: data.paymentReference,
    });
    if (insErr) throw new Error(insErr.message);

    return { ok: true };
  });


