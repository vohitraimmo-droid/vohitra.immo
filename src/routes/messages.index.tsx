import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { MessageSquare } from "lucide-react";
import { getPublicNamesFn } from "@/lib/profiles.functions";

export const Route = createFileRoute("/messages/")({
  head: () => ({ meta: [{ title: "Messagerie — Vohitra" }] }),
  component: MessagesInbox,
});

type Thread = {
  property_id: string;
  other_id: string;
  last_body: string;
  last_at: string;
  unread: number;
  property_title?: string;
  property_city?: string;
  other_name?: string;
};

function MessagesInbox() {
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate({ to: "/login" }); return; }
    void load();
    const ch = supabase.channel(`inbox-${user.id}`)
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "messages" }, () => void load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, loading]);

  const load = async () => {
    if (!user) return;
    setBusy(true);
    const { data: msgs } = await supabase
      .from("messages")
      .select("property_id, sender_id, recipient_id, body, read_at, created_at")
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .order("created_at", { ascending: false })
      .limit(500);

    const map = new Map<string, Thread>();
    for (const m of msgs ?? []) {
      const other = m.sender_id === user.id ? m.recipient_id : m.sender_id;
      const key = `${m.property_id}::${other}`;
      const cur = map.get(key);
      const unreadInc = (m.recipient_id === user.id && !m.read_at) ? 1 : 0;
      if (!cur) {
        map.set(key, { property_id: m.property_id, other_id: other, last_body: m.body, last_at: m.created_at, unread: unreadInc });
      } else {
        cur.unread += unreadInc;
      }
    }
    const arr = Array.from(map.values());

    // Hydrate property + other party info
    const propIds = Array.from(new Set(arr.map(t => t.property_id)));
    const userIds = Array.from(new Set(arr.map(t => t.other_id)));
    const [props, namesRes] = await Promise.all([
      propIds.length ? supabase.from("properties").select("id, title, city").in("id", propIds) : Promise.resolve({ data: [] as any[] }),
      userIds.length ? getPublicNamesFn({ data: { ids: userIds } }).catch(() => ({ names: {} as Record<string, string> })) : Promise.resolve({ names: {} as Record<string, string> }),
    ]);
    const pMap = new Map((props.data ?? []).map(p => [p.id, p]));
    const nameMap = namesRes.names || {};
    for (const t of arr) {
      const p = pMap.get(t.property_id);
      t.property_title = p?.title;
      t.property_city = p?.city;
      t.other_name = nameMap[t.other_id] || "Utilisateur";
    }
    setThreads(arr);
    setBusy(false);
  };

  const totalUnread = threads.reduce((s, t) => s + t.unread, 0);
  const visible = filter === "unread" ? threads.filter(t => t.unread > 0) : threads;

  return (
    <main className="max-w-3xl mx-auto w-full px-4 md:px-6 py-8">
      <header className="mb-6 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3">
            <MessageSquare className="size-6 text-primary" />
            <h1 className="font-display text-2xl md:text-3xl italic">Messagerie</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {threads.length} conversation{threads.length > 1 ? "s" : ""}
            {totalUnread > 0 ? ` · ${totalUnread} non lu${totalUnread > 1 ? "s" : ""}` : ""}
          </p>
        </div>
        {threads.length > 0 && (
          <div className="flex items-center bg-muted rounded-full p-0.5" role="tablist">
            <button
              onClick={() => setFilter("all")}
              className={`min-h-9 px-4 text-xs font-medium rounded-full transition ${filter === "all" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
            >Tous</button>
            <button
              onClick={() => setFilter("unread")}
              className={`min-h-9 px-4 text-xs font-medium rounded-full transition ${filter === "unread" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
            >Non lus{totalUnread > 0 && ` (${totalUnread})`}</button>
          </div>
        )}
      </header>
      {busy ? (
        <div className="text-center text-muted-foreground py-16">Chargement…</div>
      ) : visible.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-border rounded-2xl bg-card">
          <MessageSquare className="size-10 mx-auto text-muted-foreground/40 mb-4" />
          <p className="text-muted-foreground">
            {filter === "unread" ? "Aucun message non lu." : "Aucune conversation pour l'instant."}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border border border-border rounded-xl overflow-hidden bg-card">
          {visible.map((t) => (
            <li key={`${t.property_id}-${t.other_id}`}>
              <Link
                to="/messages/$propertyId/$otherId"
                params={{ propertyId: t.property_id, otherId: t.other_id }}
                className="block p-4 min-h-16 hover:bg-muted/50 transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className={`truncate ${t.unread > 0 ? "font-semibold" : "font-medium"}`}>{t.other_name}</div>
                    <div className="text-xs text-muted-foreground truncate italic">
                      {t.property_title} · {t.property_city}
                    </div>
                    <div className={`text-sm truncate mt-1 ${t.unread > 0 ? "text-foreground" : "text-foreground/70"}`}>{t.last_body}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[10px] text-muted-foreground font-mono">
                      {new Date(t.last_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                    </div>
                    {t.unread > 0 && (
                      <span className="inline-block mt-1 text-[10px] font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full min-w-5">
                        {t.unread}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
