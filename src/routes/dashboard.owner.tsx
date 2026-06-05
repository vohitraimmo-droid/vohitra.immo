import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatAr, propertyTypeLabel } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/owner")({
  head: () => ({ meta: [{ title: "Mon espace propriétaire — Vohitra" }] }),
  component: OwnerDashboard,
});

function OwnerDashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [properties, setProperties] = useState<any[]>([]);
  const [reloading, setReloading] = useState(true);
  const [sub, setSub] = useState<{ active_until: string } | null>(null);
  const [settings, setSettings] = useState<any>(null);
  const [subBusy, setSubBusy] = useState(false);
  const [stats, setStats] = useState<Record<string, { views: number; unlocks: number }>>({});

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  const load = async () => {
    if (!user) return;
    setReloading(true);
    const [{ data }, { data: subRow }, { data: cfg }] = await Promise.all([
      supabase.from("properties")
        .select("id, owner_id, title, description, property_type, listing_type, surface, price, address, postal_code, city, rooms, status, is_premium, premium_until, is_verified, created_at, updated_at, property_photos(url, display_order)")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false }),
      supabase.from("subscriptions").select("active_until").eq("user_id", user.id).maybeSingle(),
      supabase.from("site_settings").select("pro_subscription_tokens, pro_subscription_days, boost_short_tokens, boost_short_days, premium_enabled, boost_short_enabled, boost_long_enabled").eq("id", 1).single(),
    ]);
    setProperties(data ?? []);
    setSub(subRow && new Date(subRow.active_until) > new Date() ? subRow : null);
    setSettings(cfg);
    setReloading(false);
    try {
      const { getOwnerListingsSummaryFn } = await import("@/lib/subscriptions.functions");
      const s = await getOwnerListingsSummaryFn();
      setStats(s);
    } catch { /* silencieux */ }
  };
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel(`owner-${user.id}`)
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "properties", filter: `owner_id=eq.${user.id}` }, () => { void load(); })
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "property_photos" }, () => { void load(); })
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "verification_requests", filter: `user_id=eq.${user.id}` }, () => { void load(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const boost = async (id: string) => {
    try {
      const { boostPropertyFn } = await import("@/lib/properties.functions");
      await boostPropertyFn({ data: { propertyId: id } });
      toast.success("Annonce boostée pendant 14 jours !");
      await load();
    } catch (e: any) { toast.error(e?.message ?? "Erreur"); }
  };

  const boostShort = async (id: string) => {
    try {
      const { boostShortFn } = await import("@/lib/subscriptions.functions");
      const res = await boostShortFn({ data: { propertyId: id } });
      toast.success(`Annonce boostée jusqu'au ${new Date(res.premium_until).toLocaleDateString("fr-FR")} !`);
      await load();
    } catch (e: any) { toast.error(e?.message ?? "Erreur"); }
  };

  const subscribePro = async () => {
    setSubBusy(true);
    try {
      const { subscribeProFn } = await import("@/lib/subscriptions.functions");
      const res = await subscribeProFn({ data: {} });
      toast.success(`Abonnement Pro actif jusqu'au ${new Date(res.active_until).toLocaleDateString("fr-FR")} !`);
      await load();
    } catch (e: any) { toast.error(e?.message ?? "Erreur"); }
    finally { setSubBusy(false); }
  };

  const requestVerification = async (propertyId: string) => {
    if (!user) return;
    try {
      const { data: s } = await supabase.from("site_settings")
        .select("verification_cost_tokens, verification_paid_enabled").eq("id", 1).single();
      const paidEnabled = !!(s as any)?.verification_paid_enabled;
      const cost = Number((s as any)?.verification_cost_tokens ?? 10);
      const msg = paidEnabled
        ? `Cette demande nécessite ${cost} jetons (déplacement de notre équipe sur place). Continuer ?`
        : `Notre équipe va se déplacer sur place pour vérifier votre annonce. Confirmer la demande ?`;
      if (!confirm(msg)) return;
      const { requestVerificationFn } = await import("@/lib/verification.functions");
      const res = await requestVerificationFn({ data: { propertyId } });
      toast.success(res.paid
        ? `Demande envoyée. ${res.cost} jetons débités.`
        : `Demande envoyée. Notre équipe va se déplacer pour vérifier votre annonce.`);
      await load();
    } catch (e: any) { toast.error(e?.message ?? "Erreur"); }
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer cette annonce ?")) return;
    const { error } = await supabase.from("properties").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Annonce supprimée"); await load(); }
  };

  const toggleStatus = async (p: any) => {
    const next = p.status === "active" ? "pending" : "active";
    await supabase.from("properties").update({ status: next }).eq("id", p.id);
    await load();
  };

  if (loading || !user) return <div className="py-20 text-center text-muted-foreground">Chargement...</div>;

  // KPI globaux (somme des stats)
  const totals = Object.values(stats).reduce(
    (acc, s) => ({ views: acc.views + (s?.views ?? 0), unlocks: acc.unlocks + (s?.unlocks ?? 0) }),
    { views: 0, unlocks: 0 }
  );
  const activeCount = properties.filter((p) => p.status === "active").length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 pb-24 md:pb-12">
      {/* Header — H1 + actions principales */}
      <header className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 mb-8">
        <div>
          <h1 className="font-display text-3xl md:text-4xl italic">Espace propriétaire</h1>
          <p className="text-muted-foreground text-sm mt-1">Gérez vos annonces, créneaux de visite et boosts.</p>
        </div>
        <div className="hidden md:flex items-center gap-3">
          <Link to="/tokens" className="min-h-11 inline-flex items-center px-4 py-2.5 border border-border rounded-lg font-medium text-sm hover:bg-muted transition-colors">
            Acheter des jetons
          </Link>
          <Link to="/property/new" className="min-h-11 inline-flex items-center gap-1 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity">
            + Nouvelle annonce
          </Link>
        </div>
      </header>

      {/* Bloc KPI globaux */}
      <section aria-labelledby="kpi-title" className="mb-6">
        <h2 id="kpi-title" className="sr-only">Statistiques globales</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-card border border-border rounded-2xl p-4 sm:p-5">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Annonces</div>
            <div className="font-mono font-semibold text-2xl sm:text-3xl mt-1">{properties.length}</div>
            <div className="text-xs text-muted-foreground mt-1">{activeCount} active{activeCount > 1 ? "s" : ""}</div>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4 sm:p-5">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Vues totales</div>
            <div className="font-mono font-semibold text-2xl sm:text-3xl mt-1 text-primary">{totals.views}</div>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4 sm:p-5">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Contacts débloqués</div>
            <div className="font-mono font-semibold text-2xl sm:text-3xl mt-1 text-primary">{totals.unlocks}</div>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4 sm:p-5">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Statut Pro</div>
            <div className="font-semibold text-sm mt-2">
              {sub ? <span className="text-premium">Actif</span> : <span className="text-muted-foreground">Inactif</span>}
            </div>
            {sub && <div className="text-[11px] text-muted-foreground mt-0.5">Jusqu'au {new Date(sub.active_until).toLocaleDateString("fr-FR")}</div>}
          </div>
        </div>
      </section>

      {/* Abonnement Pro */}
      {settings?.premium_enabled !== false && (
      <section className="bg-card border border-border rounded-2xl p-5 sm:p-6 mb-8 flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-premium text-premium-foreground text-[10px] font-bold px-2 py-0.5 rounded uppercase">Pro</span>
            <h2 className="font-display text-xl italic">Abonnement Propriétaire Pro</h2>
          </div>
          {sub ? (
            <p className="text-sm text-muted-foreground">
              Actif jusqu'au <span className="font-semibold text-foreground">{new Date(sub.active_until).toLocaleDateString("fr-FR")}</span>.
              Toutes vos annonces sont automatiquement Premium.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {settings ? `${settings.pro_subscription_tokens} jetons / ${settings.pro_subscription_days} jours.` : ""} Toutes vos annonces actives passent en Premium pendant la durée de l'abonnement.
            </p>
          )}
        </div>
        <button
          onClick={subscribePro}
          disabled={subBusy}
          className="min-h-11 bg-premium text-premium-foreground px-5 py-2.5 rounded-lg font-semibold text-sm disabled:opacity-50 hover:opacity-90 transition-opacity"
        >
          {sub ? "Prolonger" : "S'abonner"}{settings ? ` (${settings.pro_subscription_tokens} jetons)` : ""}
        </button>
      </section>
      )}



      {/* Mes annonces */}
      <section aria-labelledby="listings-title">
        <h2 id="listings-title" className="font-display text-2xl italic mb-4">Mes annonces</h2>
        {reloading ? (
          <div className="text-muted-foreground">Chargement...</div>
        ) : properties.length === 0 ? (
          <div className="border border-dashed border-border rounded-2xl p-12 text-center">
            <p className="text-muted-foreground mb-4">Vous n'avez encore aucune annonce.</p>
            <Link to="/property/new" className="inline-flex min-h-11 items-center px-5 py-2.5 bg-primary text-primary-foreground rounded-lg font-semibold">
              Créer votre première annonce
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {properties.map((p) => {
              const cover = (p.property_photos ?? []).sort((a: any, b: any) => a.display_order - b.display_order)[0]?.url;
              const premiumActive = p.is_premium && p.premium_until && new Date(p.premium_until) > new Date();
              const views = stats[p.id]?.views ?? 0;
              const unlocks = stats[p.id]?.unlocks ?? 0;
              return (
                <article key={p.id} className="bg-card border border-border rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row gap-4 sm:gap-5">
                  {cover ? (
                    <img src={cover} alt={p.title} className="w-full md:w-48 h-40 md:h-32 object-cover rounded-lg shrink-0" />
                  ) : (
                    <div className="w-full md:w-48 h-40 md:h-32 bg-muted rounded-lg grid place-items-center text-xs text-muted-foreground shrink-0">Sans photo</div>
                  )}

                  {/* Infos */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {premiumActive && <span className="bg-premium text-premium-foreground text-[10px] font-bold px-2 py-0.5 rounded uppercase">Premium</span>}
                      {p.is_verified && <span className="bg-verified text-verified-foreground text-[10px] font-bold px-2 py-0.5 rounded uppercase">Vérifié</span>}
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase bg-muted text-foreground">{p.status}</span>
                    </div>
                    <Link to="/property/$id" params={{ id: p.id }} className="font-display text-lg sm:text-xl italic hover:text-primary block leading-tight">{p.title}</Link>
                    <p className="text-sm text-muted-foreground mt-1">{propertyTypeLabel(p.property_type)} · {p.city} · {p.surface} m²</p>
                    <p className="font-mono text-primary font-semibold mt-1">{formatAr(p.price)}</p>
                    <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                      <span><span className="font-semibold text-foreground">{views}</span> vue{views > 1 ? "s" : ""}</span>
                      <span><span className="font-semibold text-foreground">{unlocks}</span> contact{unlocks > 1 ? "s" : ""} débloqué{unlocks > 1 ? "s" : ""}</span>
                    </div>
                  </div>

                  {/* Actions — hiérarchisées, gap 12px, tap targets ≥ 44px */}
                  <div className="flex md:flex-col gap-2 md:gap-3 flex-wrap md:w-44 md:shrink-0">
                    {/* Primaire */}
                    <Link
                      to="/property/$id/stats"
                      params={{ id: p.id }}
                      className="min-h-11 inline-flex items-center justify-center px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity flex-1 md:flex-none"
                    >
                      Stats
                    </Link>
                    {/* Secondaires */}
                    <Link to="/property/$id/edit" params={{ id: p.id }} className="min-h-11 inline-flex items-center justify-center px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors flex-1 md:flex-none">
                      Modifier
                    </Link>
                    <Link to="/visits/manage/$propertyId" params={{ propertyId: p.id }} className="min-h-11 inline-flex items-center justify-center px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors flex-1 md:flex-none">
                      Créneaux
                    </Link>
                    {/* Boost (mis en avant si applicable) */}
                    {settings?.boost_short_enabled !== false && !premiumActive && !sub && (
                      <button onClick={() => boostShort(p.id)} className="min-h-11 inline-flex items-center justify-center px-4 py-2 bg-premium/90 text-premium-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity flex-1 md:flex-none">
                        Booster 7j{settings ? ` (${settings.boost_short_tokens}j)` : ""}
                      </button>
                    )}
                    {!p.is_verified && (
                      <button onClick={() => requestVerification(p.id)} className="min-h-11 inline-flex items-center justify-center px-4 py-2 border border-verified text-verified rounded-lg text-sm font-medium hover:bg-verified/10 transition-colors flex-1 md:flex-none">
                        Faire vérifier
                      </button>
                    )}
                    {/* Tertiaires (progressive disclosure via details) */}
                    <details className="md:mt-1 w-full">
                      <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground py-2 text-center select-none">Plus d'options</summary>
                      <div className="flex flex-col gap-2 mt-2">
                        {settings?.boost_long_enabled !== false && !premiumActive && !sub && (
                          <button onClick={() => boost(p.id)} className="min-h-10 px-3 py-2 text-xs rounded-md bg-premium text-premium-foreground font-medium hover:opacity-90">Boost 14J (5j)</button>
                        )}
                        <button onClick={() => toggleStatus(p)} className="min-h-10 px-3 py-2 text-xs rounded-md border border-border hover:bg-muted">
                          {p.status === "active" ? "Désactiver" : "Activer"}
                        </button>
                        <button onClick={() => remove(p.id)} className="min-h-10 px-3 py-2 text-xs rounded-md text-destructive hover:bg-destructive/10">
                          Supprimer
                        </button>
                      </div>
                    </details>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* FAB mobile — Nouvelle annonce (Fitts: bas-droite, pouce naturel) */}
      <Link
        to="/property/new"
        aria-label="Créer une nouvelle annonce"
        className="md:hidden fixed bottom-5 right-5 z-40 min-h-14 min-w-14 px-5 grid place-items-center bg-primary text-primary-foreground rounded-full shadow-2xl font-semibold text-sm hover:opacity-90 transition-opacity"
      >
        + Annonce
      </Link>
    </div>
  );
}
