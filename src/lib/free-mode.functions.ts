import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("Accès refusé : admin requis");
}

/** Public: read the current free-mode window (anyone can see if site is free right now). */
export const getFreeModeFn = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data } = await supabaseAdmin
      .from("site_settings").select("free_mode_until").eq("id", 1).single();
    const until = (data as { free_mode_until?: string | null } | null)?.free_mode_until ?? null;
    const active = !!until && new Date(until).getTime() > Date.now();
    return { active, until };
  });

/** Admin: enable free mode for N hours from now, or set an explicit ISO end date. */
export const adminSetFreeModeFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    hours: z.number().int().min(1).max(24 * 365).optional(),
    until: z.string().datetime().optional(),
  }).refine((v) => v.hours !== undefined || v.until !== undefined, {
    message: "hours ou until requis",
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const until = data.until
      ? new Date(data.until)
      : new Date(Date.now() + (data.hours ?? 0) * 3600 * 1000);
    await supabaseAdmin.from("site_settings")
      .update({ free_mode_until: until.toISOString(), updated_at: new Date().toISOString() })
      .eq("id", 1);
    await supabaseAdmin.from("admin_logs").insert({
      admin_id: context.userId, action: "free_mode_enable",
      target_type: "site_settings", target_id: "1",
      details: { until: until.toISOString() } as never,
    });
    return { ok: true, until: until.toISOString() };
  });

/** Admin: disable free mode immediately. */
export const adminClearFreeModeFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    await supabaseAdmin.from("site_settings")
      .update({ free_mode_until: null, updated_at: new Date().toISOString() })
      .eq("id", 1);
    await supabaseAdmin.from("admin_logs").insert({
      admin_id: context.userId, action: "free_mode_disable",
      target_type: "site_settings", target_id: "1",
    });
    return { ok: true };
  });
