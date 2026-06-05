import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BOOST_COST = 5;
const BOOST_DAYS = 14;

/** Boost a property to premium for 14 days. Costs BOOST_COST tokens. */
export const boostPropertyFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ propertyId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const uid = context.userId;
    const { data: prop } = await supabaseAdmin
      .from("properties").select("id, owner_id, premium_until")
      .eq("id", data.propertyId).single();
    if (!prop) throw new Error("Annonce introuvable");

    const { data: adminRow } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", uid).eq("role", "admin").maybeSingle();
    const isAdmin = !!adminRow;

    if (prop.owner_id !== uid && !isAdmin) throw new Error("Annonce introuvable");

    const { data: settings } = await supabaseAdmin
      .from("site_settings").select("free_mode_until, boost_long_enabled").eq("id", 1).single();
    if ((settings as { boost_long_enabled?: boolean } | null)?.boost_long_enabled === false && !isAdmin) {
      throw new Error("Le Boost 14 jours est actuellement désactivé par l'administrateur.");
    }
    const freeUntil = (settings as { free_mode_until?: string | null } | null)?.free_mode_until;
    const isFree = !!freeUntil && new Date(freeUntil).getTime() > Date.now();

    if (!isAdmin && !isFree) {
      const { error: debitErr } = await supabaseAdmin.rpc("debit_tokens", {
        _user_id: uid, _cost: BOOST_COST,
        _reason: `Boost annonce ${data.propertyId}`,
      });
      if (debitErr) {
        if (debitErr.message?.includes("INSUFFICIENT_TOKENS")) {
          throw new Error(`Solde insuffisant (${BOOST_COST} jetons requis)`);
        }
        console.error("[boostProperty] debit_tokens", debitErr);
        throw new Error("Erreur lors du débit");
      }
    }

    const base = prop.premium_until && new Date(prop.premium_until) > new Date()
      ? new Date(prop.premium_until) : new Date();
    const until = new Date(base.getTime() + BOOST_DAYS * 24 * 3600 * 1000);

    await supabaseAdmin.from("properties")
      .update({ is_premium: true, premium_until: until.toISOString() })
      .eq("id", data.propertyId);

    return { ok: true, premium_until: until.toISOString() };
  });

/** Tenant books a visit slot (atomic). */
export const bookVisitFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ slotId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const uid = context.userId;
    const { data: slot } = await supabaseAdmin
      .from("visit_slots").select("id, property_id, is_booked").eq("id", data.slotId).single();
    if (!slot) throw new Error("Créneau introuvable");
    if (slot.is_booked) throw new Error("Créneau déjà réservé");

    const { error: updErr } = await supabaseAdmin
      .from("visit_slots").update({ is_booked: true })
      .eq("id", data.slotId).eq("is_booked", false);
    if (updErr) throw new Error("Erreur de réservation");

    const { error: insErr } = await supabaseAdmin.from("visit_bookings").insert({
      slot_id: slot.id, property_id: slot.property_id, tenant_id: uid,
    });
    if (insErr) {
      await supabaseAdmin.from("visit_slots").update({ is_booked: false }).eq("id", data.slotId);
      throw new Error("Erreur de réservation");
    }
    return { ok: true };
  });
