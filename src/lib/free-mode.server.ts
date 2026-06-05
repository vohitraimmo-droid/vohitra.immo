import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Returns true if the admin enabled a "everything free" window currently active. */
export async function isFreeModeActive(): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("site_settings")
    .select("free_mode_until")
    .eq("id", 1)
    .single();
  const until = (data as { free_mode_until?: string | null } | null)?.free_mode_until;
  if (!until) return false;
  return new Date(until).getTime() > Date.now();
}
