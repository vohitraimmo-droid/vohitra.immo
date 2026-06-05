import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Eye, Heart, MessageSquare, Unlock } from "lucide-react";

export const Route = createFileRoute("/property/$id/stats")({
  head: () => ({ meta: [{ title: "Statistiques de l'annonce — Vohitra" }] }),
  component: PropertyStatsPage,
});

interface Stats {
  views_total: number; views_7d: number; views_30d: number;
  unlocks: number; favorites: number; messages: number;
}

function PropertyStatsPage() {
  const { id } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [title, setTitle] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { if (!loading && !user) navigate({ to: "/login" }); }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      try {
        const [{ data: prop }, { getPropertyStatsFn }] = await Promise.all([
          supabase.from("properties").select("title").eq("id", id).single(),
          import("@/lib/subscriptions.functions"),
        ]);
        setTitle(prop?.title ?? "");
        const s = await getPropertyStatsFn({ data: { propertyId: id } });
        setStats(s);
      } catch (e: any) { setErr(e?.message ?? "Erreur"); }
    })();
  }, [id, user?.id]);

  if (loading || !user) return <div className="py-20 text-center text-muted-foreground">Chargement...</div>;

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-8 md:py-12">
      <Link to="/dashboard/owner" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Retour au dashboard
      </Link>
      <h1 className="font-display text-3xl md:text-4xl italic mb-1">Statistiques</h1>
      <p className="text-muted-foreground mb-8">{title}</p>

      {err && <div className="border border-destructive/30 bg-destructive/10 text-destructive rounded-lg p-4 mb-6 text-sm">{err}</div>}

      {!stats ? (
        <div className="text-muted-foreground">Chargement...</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatCard icon={<Eye className="h-5 w-5" />} label="Vues (total)" value={stats.views_total} />
          <StatCard icon={<Eye className="h-5 w-5" />} label="Vues (30 jours)" value={stats.views_30d} />
          <StatCard icon={<Eye className="h-5 w-5" />} label="Vues (7 jours)" value={stats.views_7d} />
          <StatCard icon={<Unlock className="h-5 w-5" />} label="Déblocages coordonnées" value={stats.unlocks} />
          <StatCard icon={<Heart className="h-5 w-5" />} label="Mises en favoris" value={stats.favorites} />
          <StatCard icon={<MessageSquare className="h-5 w-5" />} label="Messages reçus" value={stats.messages} />
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase font-semibold mb-2">
        {icon} {label}
      </div>
      <div className="font-display text-3xl italic">{value}</div>
    </div>
  );
}
