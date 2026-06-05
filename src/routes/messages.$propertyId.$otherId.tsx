import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { getPublicNamesFn } from "@/lib/profiles.functions";

export const Route = createFileRoute("/messages/$propertyId/$otherId")({
  component: ThreadPage,
});

type Msg = { id: string; sender_id: string; recipient_id: string; body: string; read_at: string | null; created_at: string };

function ThreadPage() {
  const { propertyId, otherId } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [property, setProperty] = useState<any | null>(null);
  const [other, setOther] = useState<any | null>(null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isOwner = !!(user && property && property.owner_id === user.id);
  const needsUnlock = !!property && !isOwner && !unlocked;

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate({ to: "/login" }); return; }
    void load();
    const ch = supabase.channel(`thread-${propertyId}-${otherId}`)
      .on("postgres_changes" as any, { event: "INSERT", schema: "public", table: "messages", filter: `property_id=eq.${propertyId}` }, () => void load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, loading, propertyId, otherId]);

  const load = async () => {
    if (!user) return;
    const [{ data: msgs }, { data: p }, namesRes, { data: unlock }] = await Promise.all([
      supabase.from("messages")
        .select("id, sender_id, recipient_id, body, read_at, created_at")
        .eq("property_id", propertyId)
        .or(`and(sender_id.eq.${user.id},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${user.id})`)
        .order("created_at", { ascending: true }),
      supabase.from("properties").select("id, title, city, owner_id").eq("id", propertyId).single(),
      getPublicNamesFn({ data: { ids: [otherId] } }).catch(() => ({ names: {} as Record<string, string> })),
      supabase.from("contact_unlocks").select("id").eq("user_id", user.id).eq("property_id", propertyId).maybeSingle(),
    ]);
    setMessages((msgs ?? []) as Msg[]);
    setProperty(p);
    setOther({ id: otherId, full_name: namesRes.names?.[otherId] || "Utilisateur" });
    setUnlocked(!!unlock);

    // Mark unread received messages as read
    const toMark = (msgs ?? []).filter(m => m.recipient_id === user.id && !m.read_at).map(m => m.id);
    if (toMark.length) {
      await supabase.from("messages").update({ read_at: new Date().toISOString() }).in("id", toMark);
    }

    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !body.trim() || sending) return;
    if (needsUnlock) {
      toast.error("Vous devez d'abord révéler les informations du propriétaire pour envoyer un message.");
      return;
    }
    setSending(true);
    const { error } = await supabase.from("messages").insert({
      property_id: propertyId,
      sender_id: user.id,
      recipient_id: otherId,
      body: body.trim(),
    });
    setSending(false);
    if (error) { toast.error(error.message); return; }
    setBody("");
    await load();
  };

  return (
    <main className="max-w-3xl mx-auto w-full px-4 md:px-6 py-6 flex flex-col">
      <Link to="/messages" className="text-sm text-muted-foreground hover:text-primary mb-4">← Messagerie</Link>

      <div className="border border-border rounded-t-xl bg-card p-4">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Conversation avec</div>
        <div className="font-display text-xl italic truncate">{other?.full_name ?? "Utilisateur"}</div>
      </div>

      <Link
        to="/property/$id"
        params={{ id: propertyId }}
        className="border-x border-b border-border bg-primary/5 hover:bg-primary/10 transition px-4 py-2.5 flex items-center gap-2 text-xs"
      >
        <span className="shrink-0 inline-flex items-center gap-1 bg-primary/15 text-primary font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full text-[10px]">
          Annonce
        </span>
        <span className="truncate font-medium text-foreground">{property?.title}</span>
        <span className="text-muted-foreground shrink-0">· {property?.city}</span>
      </Link>

      <div className="border-x border-border bg-background overflow-y-auto p-4 space-y-3 h-[50vh] min-h-[280px]">
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-12 text-sm">Aucun message. Écrivez le premier !</div>
        ) : messages.map((m) => {
          const mine = m.sender_id === user?.id;
          const senderName = mine ? "Vous" : (other?.full_name ?? "Utilisateur");
          return (
            <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
              <div className={`text-[10px] font-semibold mb-1 px-2 ${mine ? "text-primary" : "text-muted-foreground"}`}>
                {senderName}
              </div>
              <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap break-words ${mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                {m.body}
                <div className={`text-[10px] mt-1 font-mono ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  {new Date(m.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {needsUnlock && (
        <div className="border-x border-border bg-amber-500/10 text-amber-700 dark:text-amber-300 px-4 py-3 text-sm flex items-center justify-between gap-3">
          <span>Pour envoyer un message, révélez d'abord les informations du propriétaire.</span>
          <Link
            to="/property/$id"
            params={{ id: propertyId }}
            className="shrink-0 bg-primary text-primary-foreground rounded-lg px-3 py-1.5 text-xs font-medium hover:opacity-90"
          >
            Révéler
          </Link>
        </div>
      )}

      <form
        onSubmit={send}
        className="sticky bottom-0 z-10 border border-border rounded-b-xl bg-card p-3 flex items-end gap-2 shadow-lg"
      >
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(e as any); } }}
          rows={2}
          maxLength={4000}
          disabled={needsUnlock}
          placeholder={needsUnlock ? "Révélez les infos du propriétaire pour écrire…" : "Écrivez votre message ici…"}
          autoFocus={!needsUnlock}
          className="flex-1 resize-none bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-60 disabled:cursor-not-allowed"
        />
        <button
          type="submit"
          disabled={!body.trim() || sending || needsUnlock}
          className="bg-primary text-primary-foreground p-2.5 rounded-lg hover:opacity-90 disabled:opacity-50 shrink-0"
          aria-label="Envoyer"
        >
          <Send className="size-4" />
        </button>
      </form>
    </main>
  );
}
