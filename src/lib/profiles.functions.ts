import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const getPublicNamesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ ids: z.array(z.string().uuid()).min(1).max(200) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { data: rows, error } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name")
      .in("id", data.ids);
    if (error) {
      console.error("getPublicNamesFn error:", error);
      throw new Error("Une erreur est survenue.");
    }
    const map: Record<string, string> = {};
    for (const r of rows ?? []) {
      map[r.id] = (r.full_name && r.full_name.trim()) || "Utilisateur";
    }
    return { names: map };
  });
