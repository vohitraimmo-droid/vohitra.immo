import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Authenticated user reports a property. */
export const reportPropertyFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      propertyId: z.string().uuid(),
      reason: z.string().min(3).max(120),
      details: z.string().max(1000).optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const uid = context.userId;
    const { data: prop } = await supabaseAdmin
      .from("properties").select("id").eq("id", data.propertyId).maybeSingle();
    if (!prop) throw new Error("Annonce introuvable");

    // Prevent spam: max 1 pending report per user per property
    const { data: existing } = await supabaseAdmin
      .from("property_reports")
      .select("id")
      .eq("property_id", data.propertyId)
      .eq("reporter_id", uid)
      .eq("status", "pending")
      .maybeSingle();
    if (existing) throw new Error("Vous avez déjà un signalement en cours pour cette annonce");

    const { error } = await supabaseAdmin.from("property_reports").insert({
      property_id: data.propertyId,
      reporter_id: uid,
      reason: data.reason,
      details: data.details ?? null,
    });
    if (error) {
      console.error("createReportFn error:", error);
      throw new Error("Une erreur est survenue.");
    }
    return { ok: true };
  });

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles").select("role")
    .eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("Accès refusé : admin requis");
}

/** Admin lists reports with property + reporter info. */
export const adminListReportsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data: rows } = await supabaseAdmin
      .from("property_reports")
      .select("id, property_id, reporter_id, reason, details, status, admin_note, created_at, processed_at")
      .order("created_at", { ascending: false })
      .limit(200);
    const propIds = (rows ?? []).map((r) => r.property_id);
    const userIds = (rows ?? []).map((r) => r.reporter_id);
    const [{ data: props }, { data: profs }] = await Promise.all([
      supabaseAdmin.from("properties").select("id, title, city, status")
        .in("id", propIds.length ? propIds : ["00000000-0000-0000-0000-000000000000"]),
      supabaseAdmin.from("profiles").select("id, email, full_name")
        .in("id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]),
    ]);
    return (rows ?? []).map((r) => ({
      ...r,
      property: (props ?? []).find((p) => p.id === r.property_id) ?? null,
      reporter: (profs ?? []).find((p) => p.id === r.reporter_id) ?? null,
    }));
  });

/** Admin handles a report: dismiss, mark reviewed, or remove the property. */
export const adminProcessReportFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      id: z.string().uuid(),
      action: z.enum(["dismiss", "reviewed", "remove"]),
      note: z.string().max(500).optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: rep } = await supabaseAdmin
      .from("property_reports").select("id, property_id").eq("id", data.id).maybeSingle();
    if (!rep) throw new Error("Signalement introuvable");

    const newStatus =
      data.action === "dismiss" ? "dismissed" :
      data.action === "reviewed" ? "reviewed" : "removed";

    if (data.action === "remove") {
      await supabaseAdmin.from("properties").delete().eq("id", rep.property_id);
      // mark all reports on that property as removed
      await supabaseAdmin.from("property_reports")
        .update({
          status: "removed", admin_note: data.note ?? null,
          processed_by: context.userId, processed_at: new Date().toISOString(),
        })
        .eq("property_id", rep.property_id);
    } else {
      await supabaseAdmin.from("property_reports")
        .update({
          status: newStatus, admin_note: data.note ?? null,
          processed_by: context.userId, processed_at: new Date().toISOString(),
        })
        .eq("id", data.id);
    }

    await supabaseAdmin.from("admin_logs").insert({
      admin_id: context.userId,
      action: `report_${data.action}`,
      target_type: "property_report",
      target_id: data.id,
      details: { property_id: rep.property_id, note: data.note ?? null } as never,
    });
    return { ok: true };
  });
