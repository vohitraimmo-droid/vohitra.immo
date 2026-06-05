import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { supabase } from "@/integrations/supabase/client";

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Accès refusé : admin requis");
}

/** Get current CGU (public) */
export const getCguFn = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data } = await supabaseAdmin.from("cgu").select("*").eq("id", 1).single();
    return data ?? { id: 1, content_fr: "", content_mg: "", updated_at: new Date().toISOString(), updated_by: null };
  });

/** Admin: get CGU content */
export const adminGetCguFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data } = await supabaseAdmin.from("cgu").select("*").eq("id", 1).single();
    return data ?? { id: 1, content_fr: "", content_mg: "", updated_at: new Date().toISOString(), updated_by: null };
  });

/** Admin: update CGU content */
export const adminUpdateCguFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    content_fr: z.string().max(50000).optional(),
    content_mg: z.string().max(50000).optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    await supabaseAdmin.from("cgu").update({
      ...data,
      updated_at: new Date().toISOString(),
      updated_by: context.userId,
    }).eq("id", 1);
    return { ok: true };
  });
