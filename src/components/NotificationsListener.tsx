import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

/**
 * Mounted once at the root. Listens for new messages sent to the current user
 * and shows an in-app toast notification (with a "Voir" action that navigates
 * to the relevant thread). Skips toasting if the user is already on the matching
 * thread page.
 */
export function NotificationsListener() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notif-msg-${user.id}`)
      .on(
        "postgres_changes" as any,
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `recipient_id=eq.${user.id}`,
        },
        async (payload: any) => {
          const m = payload.new as {
            id: string;
            sender_id: string;
            property_id: string;
            body: string;
          };

          // Skip if we're already viewing this thread
          const path = router.state.location.pathname;
          const onThread =
            path === `/messages/${m.property_id}/${m.sender_id}`;
          if (onThread) return;

          // Resolve sender name
          const { data: sender } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", m.sender_id)
            .maybeSingle();

          const name = sender?.full_name?.trim() || "Quelqu'un";
          const preview =
            m.body.length > 80 ? m.body.slice(0, 80) + "…" : m.body;

          toast.message(`Nouveau message de ${name}`, {
            description: preview,
            action: {
              label: "Voir",
              onClick: () =>
                router.navigate({
                  to: "/messages/$propertyId/$otherId",
                  params: { propertyId: m.property_id, otherId: m.sender_id },
                }),
            },
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, router]);

  return null;
}
