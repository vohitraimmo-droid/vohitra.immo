import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatAr } from "@/lib/format";

export const Route = createFileRoute("/dashboard/tenant")({
  head: () => ({ meta: [{ title: "Mon espace locataire — Vohitra" }] }),
  component: TenantDashboard,
});

function TenantDashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState<any[]>([]);
  const [unlocks, setUnlocks] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [transactions, setTx] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  const load = async () => {
    if (!user) return;
    const [{ data: prof }, { data: favs }, { data: unl }, { data: bks }, { data: txs }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase.from("favorites").select("property_id, properties(id, title, city, price, property_type, listing_type, is_premium, is_verified, property_photos(url, display_order))").eq("user_id", user.id),
      supabase.from("contact_unlocks").select("property_id, created_at, properties(id, title, city)").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("visit_bookings").select("*, visit_slots(slot_at), properties(id, title, city)").eq("tenant_id", user.id).order("created_at", { ascending: false }),
      supabase.from("token_transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
    ]);
    setProfile(prof);
    setFavorites(favs ?? []);
    setUnlocks(unl ?? []);
    setBookings(bks ?? []);
    setTx(txs ?? []);
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel(`tenant-${user.id}`)
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "profiles", filter: `id=eq.${user.id}` }, () => { void load(); })
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "favorites", filter: `user_id=eq.${user.id}` }, () => { void load(); })
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "contact_unlocks", filter: `user_id=eq.${user.id}` }, () => { void load(); })
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "visit_bookings", filter: `tenant_id=eq.${user.id}` }, () => { void load(); })
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "token_transactions", filter: `user_id=eq.${user.id}` }, () => { void load(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  if (loading || !user) return <div className="py-20 text-center text-muted-foreground">Chargement...</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8 sm:space-y-10">
      {/* Header */}
      <header className="flex flex-col md:flex-row gap-4 md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl italic">Mon espace</h1>
          <p className="text-muted-foreground text-sm mt-1">Bienvenue {profile?.full_name || user.email}</p>
        </div>
        <div className="flex items-stretch gap-3">
          <div className="bg-card border border-border rounded-xl px-4 sm:px-5 py-3 flex-1 md:flex-none">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Solde</div>
            <div className="font-mono font-bold text-2xl text-primary leading-tight">{profile?.tokens_balance ?? 0} <span className="text-sm font-normal">Jetons</span></div>
          </div>
          <Link to="/tokens" className="min-h-12 inline-flex items-center px-5 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity">
            + Acheter
          </Link>
        </div>
      </header>

      {/* KPI Status */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <StatusCard label="KYC" value={profile?.kyc_status === "approved" ? "Vérifié ✓" : profile?.kyc_status === "pending" ? "En attente" : "Non vérifié"} link={profile?.kyc_status !== "approved" ? { to: "/kyc", label: "Vérifier" } : undefined} />
        <StatusCard label="Favoris" value={`${favorites.length}`} />
        <StatusCard label="Coordonnées débloquées" value={`${unlocks.length}`} />
      </div>

      <Section title="Mes favoris">
        {favorites.length === 0 ? <Empty msg="Aucun favori pour l'instant." /> : (
          <div className="grid md:grid-cols-3 gap-4">
            {favorites.map((f) => {
              const p = f.properties; if (!p) return null;
              const cover = (p.property_photos ?? []).sort((a: any, b: any) => a.display_order - b.display_order)[0]?.url;
              return (
                <Link key={f.property_id} to="/property/$id" params={{ id: p.id }} className="bg-card border border-border rounded-xl overflow-hidden hover:shadow-lg transition">
                  {cover ? <img src={cover} className="w-full aspect-[4/3] object-cover" alt="" /> : <div className="aspect-[4/3] bg-muted" />}
                  <div className="p-3">
                    <div className="font-display italic">{p.title}</div>
                    <div className="text-xs text-muted-foreground">{p.city}</div>
                    <div className="font-mono text-sm text-primary mt-1">{formatAr(p.price)}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Section>

      <Section title="Coordonnées débloquées">
        {unlocks.length === 0 ? <Empty msg="Aucune coordonnée débloquée." /> : (
          <ul className="space-y-2">
            {unlocks.map((u) => (
              <li key={u.property_id} className="bg-card border border-border rounded-lg p-4 flex justify-between">
                <div>
                  <Link to="/property/$id" params={{ id: u.properties.id }} className="font-medium hover:text-primary">{u.properties.title}</Link>
                  <div className="text-xs text-muted-foreground">{u.properties.city}</div>
                </div>
                <Link to="/property/$id" params={{ id: u.properties.id }} className="text-primary text-sm self-center hover:underline">Voir les coordonnées →</Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Mes réservations de visite">
        {bookings.length === 0 ? <Empty msg="Aucune visite réservée." /> : (
          <ul className="space-y-2">
            {bookings.map((b) => (
              <li key={b.id} className="bg-card border border-border rounded-lg p-4 flex justify-between">
                <div>
                  <Link to="/property/$id" params={{ id: b.properties.id }} className="font-medium hover:text-primary">{b.properties.title}</Link>
                  <div className="text-xs text-muted-foreground">{b.properties.city}</div>
                </div>
                <div className="text-sm font-mono">{new Date(b.visit_slots.slot_at).toLocaleString("fr-FR")}</div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Historique des jetons">
        {transactions.length === 0 ? <Empty msg="Aucune transaction." /> : (
          <ul className="divide-y divide-border border border-border rounded-lg bg-card">
            {transactions.map((t) => (
              <li key={t.id} className="flex justify-between p-3 text-sm">
                <div>
                  <div>{t.reason}</div>
                  <div className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString("fr-FR")}</div>
                </div>
                <div className={`font-mono font-semibold ${t.amount > 0 ? "text-verified" : "text-destructive"}`}>{t.amount > 0 ? "+" : ""}{t.amount}</div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function StatusCard({ label, value, link }: { label: string; value: string; link?: { to: string; label: string } }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="font-display text-2xl italic mt-1">{value}</div>
      {link && <Link to={link.to} className="text-xs text-primary font-semibold mt-2 inline-block">{link.label} →</Link>}
    </div>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (<section><h2 className="font-display text-2xl italic mb-4">{title}</h2>{children}</section>);
}
function Empty({ msg }: { msg: string }) {
  return <div className="text-sm text-muted-foreground border border-dashed border-border rounded-lg p-6 text-center">{msg}</div>;
}
