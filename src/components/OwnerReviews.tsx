import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Star } from "lucide-react";
import { toast } from "sonner";

type Review = { id: string; author_id: string; rating: number; created_at: string; author_name?: string };

export function OwnerReviews({ ownerId, propertyId }: { ownerId: string; propertyId: string }) {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [canReview, setCanReview] = useState(false);
  const [mine, setMine] = useState<Review | null>(null);
  const [rating, setRating] = useState(5);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("owner_reviews")
      .select("id, author_id, rating, created_at")
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false });
    const list = (data ?? []) as Review[];
    if (list.length) {
      const ids = Array.from(new Set(list.map(r => r.author_id)));
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      const map = new Map((profs ?? []).map(p => [p.id, p.full_name as string]));
      list.forEach(r => { r.author_name = map.get(r.author_id) || "Utilisateur"; });
    }
    setReviews(list);
    if (user) {
      const own = list.find(r => r.author_id === user.id) ?? null;
      setMine(own);
      if (own) setRating(own.rating);
      const { data: cu } = await supabase
        .from("contact_unlocks")
        .select("property_id, properties!inner(owner_id)")
        .eq("user_id", user.id)
        .eq("properties.owner_id", ownerId)
        .limit(1);
      setCanReview((cu?.length ?? 0) > 0 && user.id !== ownerId);
    }
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [ownerId, user?.id]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    if (mine) {
      const { error } = await supabase.from("owner_reviews").update({ rating }).eq("id", mine.id);
      if (error) toast.error(error.message); else toast.success("Note mise à jour");
    } else {
      const { error } = await supabase.from("owner_reviews").insert({
        owner_id: ownerId, author_id: user.id, property_id: propertyId, rating,
      });
      if (error) toast.error(error.message); else toast.success("Note publiée");
    }
    setBusy(false);
    await load();
  };

  const removeMine = async () => {
    if (!mine) return;
    await supabase.from("owner_reviews").delete().eq("id", mine.id);
    setMine(null); setRating(5);
    await load();
  };

  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  return (
    <section className="mt-12 border-t border-border pt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-2xl italic">Notes du propriétaire</h2>
        {reviews.length > 0 && (
          <div className="flex items-center gap-1.5 text-sm">
            <Star className="size-4 fill-primary text-primary" />
            <span className="font-mono font-semibold">{avg.toFixed(1)}</span>
            <span className="text-muted-foreground">({reviews.length})</span>
          </div>
        )}
      </div>

      {canReview && (
        <form onSubmit={submit} className="bg-card border border-border rounded-xl p-4 mb-6">
          <div className="text-sm font-medium mb-2">{mine ? "Modifier votre note" : "Laisser une note"}</div>
          <div className="flex items-center gap-1 mb-3">
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} étoiles`}>
                <Star className={`size-7 ${n <= rating ? "fill-primary text-primary" : "text-muted-foreground"}`} />
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button type="submit" disabled={busy} className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50">
              {mine ? "Mettre à jour" : "Publier"}
            </button>
            {mine && (
              <button type="button" onClick={removeMine} className="text-sm text-destructive hover:underline">Supprimer ma note</button>
            )}
          </div>
        </form>
      )}
      {!canReview && user && user.id !== ownerId && (
        <p className="text-xs text-muted-foreground italic mb-4">Vous pouvez laisser une note après avoir débloqué le contact d'une annonce de ce propriétaire.</p>
      )}

      {reviews.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune note pour l'instant.</p>
      ) : (
        <ul className="space-y-3">
          {reviews.map(r => (
            <li key={r.id} className="border border-border rounded-xl p-3 bg-card flex items-center justify-between">
              <div className="font-medium text-sm">{r.author_name}</div>
              <div className="flex items-center gap-3">
                <div className="flex items-center">
                  {[1, 2, 3, 4, 5].map(n => (
                    <Star key={n} className={`size-4 ${n <= r.rating ? "fill-primary text-primary" : "text-muted-foreground/40"}`} />
                  ))}
                </div>
                <div className="text-[10px] text-muted-foreground font-mono">
                  {new Date(r.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
