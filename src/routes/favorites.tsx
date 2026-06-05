import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatAr } from "@/lib/format";
import { Heart } from "lucide-react";

export const Route = createFileRoute("/favorites")({
  head: () => ({
    meta: [
      { title: "Mes favoris — Vohitra" },
      { name: "description", content: "Retrouvez toutes vos annonces favorites." },
    ],
  }),
  component: FavoritesPage,
});

function FavoritesPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate({ to: "/login" }); return; }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading]);

  const load = async () => {
    if (!user) return;
    setBusy(true);
    const { data } = await supabase
      .from("favorites")
      .select("property_id, created_at, properties(id, title, city, price, property_type, listing_type, is_premium, is_verified, property_photos(url, display_order))")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setFavorites(data ?? []);
    setBusy(false);
  };




  // Re-sync on realtime via simple effect tied to a channel
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`favorites-${user.id}`)
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "favorites", filter: `user_id=eq.${user.id}` }, () => { void load(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const remove = async (propertyId: string) => {
    if (!user) return;
    await supabase.from("favorites").delete().eq("user_id", user.id).eq("property_id", propertyId);
    setFavorites((prev) => prev.filter((f) => f.property_id !== propertyId));
  };

  return (
    <main className="max-w-7xl mx-auto w-full px-4 md:px-6 py-8">
        <header className="mb-8 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3">
              <Heart className="size-6 text-primary fill-primary" />
              <h1 className="font-display text-2xl md:text-3xl italic">Mes favoris</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {favorites.length} bien{favorites.length > 1 ? "s" : ""} sauvegardé{favorites.length > 1 ? "s" : ""}
            </p>
          </div>
          {favorites.length > 0 && (
            <Link to="/" className="text-sm font-medium px-4 py-2 min-h-11 inline-flex items-center rounded-lg border border-border hover:bg-muted transition">
              Continuer à explorer
            </Link>
          )}
        </header>

        {busy ? (
          <div className="text-center text-muted-foreground py-16">Chargement…</div>
        ) : favorites.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-border rounded-2xl bg-card">
            <Heart className="size-10 mx-auto text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground mb-6">Aucun favori pour l'instant.</p>
            <Link to="/" className="inline-flex items-center min-h-11 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90">Parcourir les annonces</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {favorites.map((f) => {
              const p = f.properties; if (!p) return null;
              const cover = (p.property_photos ?? []).sort((a: any, b: any) => a.display_order - b.display_order)[0]?.url;
              return (
                <article key={f.property_id} className="bg-card border border-border rounded-xl overflow-hidden hover:shadow-lg transition group relative">
                  <Link to="/property/$id" params={{ id: p.id }} aria-label={`Voir ${p.title}`}>
                    {cover ? <img src={cover} className="w-full aspect-[4/3] object-cover" alt={p.title} loading="lazy" /> : <div className="aspect-[4/3] bg-muted" />}
                  </Link>
                  <button
                    onClick={() => remove(p.id)}
                    aria-label="Retirer des favoris"
                    className="absolute top-2 right-2 bg-background/95 backdrop-blur-sm min-w-11 min-h-11 inline-flex items-center justify-center rounded-full hover:bg-destructive hover:text-destructive-foreground transition shadow-sm"
                  >
                    <Heart className="size-4 fill-current" />
                  </button>
                  <Link to="/property/$id" params={{ id: p.id }} className="block p-4">
                    <div className="font-display italic truncate text-base">{p.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{p.city}</div>
                    <div className="font-mono text-sm text-primary mt-2 font-semibold">{formatAr(p.price)}</div>
                  </Link>
                </article>
              );
            })}
          </div>
        )}
      </main>
  );
}
