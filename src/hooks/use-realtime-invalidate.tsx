import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type Sub = {
  table: string;
  filter?: string;
  queryKeys: ReadonlyArray<ReadonlyArray<unknown>>;
};

/**
 * Subscribe to Postgres changes and invalidate React Query keys live.
 * Pass a stable array (memoize if needed) to avoid re-subscribing.
 */
export function useRealtimeInvalidate(subs: ReadonlyArray<Sub>, channelName = "rt") {
  const qc = useQueryClient();

  useEffect(() => {
    if (!subs.length) return;
    const channel = supabase.channel(`${channelName}-${Math.random().toString(36).slice(2, 8)}`);

    for (const s of subs) {
      (channel as any).on(
        "postgres_changes",
        { event: "*", schema: "public", table: s.table, ...(s.filter ? { filter: s.filter } : {}) },
        () => {
          for (const key of s.queryKeys) {
            qc.invalidateQueries({ queryKey: key as unknown[] });
          }
        }
      );
    }

    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
