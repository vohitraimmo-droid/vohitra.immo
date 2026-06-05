import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Bell, Trash2 } from "lucide-react";

export const Route = createFileRoute("/alerts")({
  head: () => ({ meta: [{ title: "Mes alertes — Vohitra" }] }),
  component: AlertsPage,
});

type Alert = {
  id: string; name: string; city: string | null; listing_type: string | null; property_type: string | null;
  price_max: number | null; surface_min: number | null; rooms_min: number | null; q: string | null;
  is_active: boolean; created_at: string;
};

function AlertsPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [busy, setBusy] = useState(true);
  const [form, setForm] = useState({ name: "", city: "", listing_type: "", property_type: "", price_max: "", surface_min: "", rooms_min: "", q: "" });

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate({ to: "/login" }); return; }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, loading]);

  const load = async () => {
    if (!user) return;
    setBusy(true);
    const { data } = await supabase.from("search_alerts").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setAlerts((data ?? []) as Alert[]);
    setBusy(false);
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !form.name.trim()) return;
    const { error } = await supabase.from("search_alerts").insert({
      user_id: user.id,
      name: form.name.trim(),
      city: form.city.trim() || null,
      listing_type: form.listing_type || null,
      property_type: form.property_type || null,
      price_max: form.price_max ? Number(form.price_max) : null,
      surface_min: form.surface_min ? Number(form.surface_min) : null,
      rooms_min: form.rooms_min ? Number(form.rooms_min) : null,
      q: form.q.trim() || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Alerte créée");
    setForm({ name: "", city: "", listing_type: "", property_type: "", price_max: "", surface_min: "", rooms_min: "", q: "" });
    await load();
  };

  const remove = async (id: string) => {
    await supabase.from("search_alerts").delete().eq("id", id);
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  const toggle = async (a: Alert) => {
    await supabase.from("search_alerts").update({ is_active: !a.is_active }).eq("id", a.id);
    await load();
  };

  return (
    <main className="max-w-4xl mx-auto w-full px-4 md:px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Bell className="size-6 text-primary" />
        <h1 className="font-display text-2xl md:text-3xl italic">Mes alertes</h1>
      </div>

      <form onSubmit={create} className="bg-card border border-border rounded-xl p-4 mb-8 grid sm:grid-cols-2 gap-3">
        <input required placeholder="Nom de l'alerte (ex: 2 pièces Tana)" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="sm:col-span-2 bg-background border border-border rounded-lg px-3 py-2 text-sm" />
        <input placeholder="Ville" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} className="bg-background border border-border rounded-lg px-3 py-2 text-sm" />
        <input placeholder="Mot-clé" value={form.q} onChange={e => setForm({ ...form, q: e.target.value })} className="bg-background border border-border rounded-lg px-3 py-2 text-sm" />
        <select value={form.listing_type} onChange={e => setForm({ ...form, listing_type: e.target.value })} className="bg-background border border-border rounded-lg px-3 py-2 text-sm">
          <option value="">Location ou vente</option>
          <option value="rent">Location</option>
          <option value="sale">Vente</option>
        </select>
        <select value={form.property_type} onChange={e => setForm({ ...form, property_type: e.target.value })} className="bg-background border border-border rounded-lg px-3 py-2 text-sm">
          <option value="">Tout type</option>
          <option value="apartment">Appartement</option>
          <option value="house">Maison</option>
          <option value="studio">Studio</option>
          <option value="room">Chambre</option>
          <option value="land">Terrain</option>
          <option value="commercial">Local commercial</option>
        </select>
        <input type="number" placeholder="Budget max (Ar)" value={form.price_max} onChange={e => setForm({ ...form, price_max: e.target.value })} className="bg-background border border-border rounded-lg px-3 py-2 text-sm" />
        <input type="number" placeholder="Surface min (m²)" value={form.surface_min} onChange={e => setForm({ ...form, surface_min: e.target.value })} className="bg-background border border-border rounded-lg px-3 py-2 text-sm" />
        <input type="number" placeholder="Pièces min" value={form.rooms_min} onChange={e => setForm({ ...form, rooms_min: e.target.value })} className="bg-background border border-border rounded-lg px-3 py-2 text-sm" />
        <button type="submit" className="sm:col-span-2 bg-primary text-primary-foreground py-2.5 rounded-lg font-semibold hover:opacity-90">
          Créer l'alerte
        </button>
      </form>

      {busy ? (
        <div className="text-center text-muted-foreground py-12">Chargement…</div>
      ) : alerts.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">Aucune alerte enregistrée.</p>
      ) : (
        <ul className="space-y-3">
          {alerts.map(a => (
            <li key={a.id} className="border border-border rounded-xl p-4 bg-card flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium">{a.name}</div>
                <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1">
                  {a.city && <span>📍 {a.city}</span>}
                  {a.listing_type && <span>{a.listing_type === "rent" ? "Location" : "Vente"}</span>}
                  {a.property_type && <span>{a.property_type}</span>}
                  {a.price_max && <span>≤ {a.price_max.toLocaleString("fr-FR")} Ar</span>}
                  {a.surface_min && <span>≥ {a.surface_min} m²</span>}
                  {a.rooms_min && <span>≥ {a.rooms_min} pièces</span>}
                  {a.q && <span>« {a.q} »</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => toggle(a)} className={`text-xs px-2.5 py-1 rounded-md border ${a.is_active ? "bg-primary/10 text-primary border-primary/30" : "bg-muted text-muted-foreground border-border"}`}>
                  {a.is_active ? "Active" : "Inactive"}
                </button>
                <button onClick={() => remove(a.id)} aria-label="Supprimer" className="p-1.5 text-muted-foreground hover:text-destructive">
                  <Trash2 className="size-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-muted-foreground italic mt-8">
        L'envoi automatique des alertes par email sera activé prochainement (nécessite la configuration d'un domaine d'envoi).
      </p>
    </main>
  );
}
