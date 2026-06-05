import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Demander la vérification physique d'une annonce.
 * Par défaut GRATUIT : notre équipe se déplace pour vérifier.
 * Si l'admin active `verification_paid_enabled`, ça coûte `verification_cost_tokens` jetons.
 * Idempotent : refuse si une demande pending existe déjà pour cette annonce.
 */
export const requestVerificationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ propertyId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const userId = context.userId;

    const { data: prop, error: propErr } = await supabaseAdmin
      .from("properties").select("id, owner_id, is_verified").eq("id", data.propertyId).single();
    if (propErr || !prop) throw new Error("Annonce introuvable");
    if (prop.owner_id !== userId) throw new Error("Vous n'êtes pas le propriétaire de cette annonce");
    if (prop.is_verified) throw new Error("Cette annonce est déjà vérifiée");

    const { data: pending } = await supabaseAdmin
      .from("verification_requests")
      .select("id").eq("property_id", data.propertyId).eq("status", "pending").maybeSingle();
    if (pending) throw new Error("Une demande de vérification est déjà en cours pour cette annonce.");

    const { data: settings, error: setErr } = await supabaseAdmin
      .from("site_settings").select("verification_cost_tokens, verification_paid_enabled, free_mode_until").eq("id", 1).single();
    if (setErr || !settings) throw new Error("Configuration introuvable");
    const cost = Number((settings as { verification_cost_tokens?: number }).verification_cost_tokens ?? 10);
    const paidEnabled = !!(settings as { verification_paid_enabled?: boolean }).verification_paid_enabled;
    const freeUntil = (settings as { free_mode_until?: string | null }).free_mode_until;
    const isFreeMode = !!freeUntil && new Date(freeUntil).getTime() > Date.now();
    const shouldDebit = paidEnabled && !isFreeMode;

    if (shouldDebit) {
      const { error: debitErr } = await supabaseAdmin.rpc("debit_tokens", {
        _user_id: userId, _cost: cost,
        _reason: `Demande de vérification annonce ${data.propertyId}`,
      });
      if (debitErr) {
        if (debitErr.message?.includes("INSUFFICIENT_TOKENS")) {
          throw new Error(`Solde insuffisant : ${cost} jetons requis pour couvrir le déplacement de vérification.`);
        }
        console.error("[requestVerification] debit_tokens", debitErr);
        throw new Error("Erreur lors du débit");
      }
    }

    const { error: insErr } = await supabaseAdmin
      .from("verification_requests").insert({ user_id: userId, property_id: data.propertyId });
    if (insErr) {
      if (shouldDebit) {
        await supabaseAdmin.rpc("credit_tokens", {
          _user_id: userId, _amount: cost,
          _reason: `Remboursement échec demande vérification ${data.propertyId}`,
        });
      }
      console.error("[requestVerification] insert", insErr);
      throw new Error("Erreur lors de la création de la demande");
    }

    return { ok: true, cost: shouldDebit ? cost : 0, paid: shouldDebit };
  });
