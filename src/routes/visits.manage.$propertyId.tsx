import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/visits/manage/$propertyId")({
  head: () => ({ meta: [{ title: "Gestion des créneaux — Vohitra" }] }),
  component: ManageSlotsPage,
});

function ManageSlotsPage() {
  const { propertyId } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [property, setProperty] = useState<any>(null);
  const [slots, setSlots] = useState<any[]>([]);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");

  useEffect(() => { if (!loading && !user) navigate({ to: "/login" }); }, [user, loading, navigate]);

  const load = async () => {
    const { data: p } = await supabase.from("properties").select("id, title, owner_id").eq("id", propertyId).single();
    setProperty(p);
    const { data: s } = await supabase.from("visit_slots").select("*, visit_bookings(tenant_id, profiles:tenant_id(full_name, phone, email))").eq("property_id", propertyId).order("slot_at");
    setSlots(s ?? []);
  };
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [propertyId]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !time) return;
    const iso = new Date(`${date}T${time}`).toISOString();
    const { error } = await supabase.from("visit_slots").insert({ property_id: propertyId, slot_at: iso });
    if (error) toast.error(error.message);
    else { setDate(""); setTime(""); await load(); }
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer ce créneau ?")) return;
    await supabase.from("visit_slots").delete().eq("id", id);
    await load();
  };

  if (loading || !user) return <div className="py-20 text-center text-muted-foreground">Chargement...</div>;
  if (property && property.owner_id !== user.id) return <div className="py-20 text-center">Accès refusé.</div>;

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <Link to="/dashboard/owner" className="text-sm text-muted-foreground hover:text-primary">← Retour</Link>
      <h1 className="font-display text-4xl italic mt-4 mb-2">Créneaux de visite</h1>
      <p className="text-muted-foreground mb-8">{property?.title}</p>

      <form onSubmit={add} className="flex gap-3 mb-8 bg-card border border-border rounded-xl p-4">
        <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} className="px-3 py-2 border border-border rounded-md text-sm flex-1" />
        <input required type="time" value={time} onChange={(e) => setTime(e.target.value)} className="px-3 py-2 border border-border rounded-md text-sm flex-1" />
        <button className="bg-primary text-primary-foreground px-5 py-2 rounded-md font-semibold text-sm">+ Ajouter</button>
      </form>

      {slots.length === 0 ? <div className="text-sm text-muted-foreground text-center py-8">Aucun créneau.</div> : (
        <ul className="space-y-2">
          {slots.map((s) => {
            const booking = s.visit_bookings?.[0];
            return (
              <li key={s.id} className="bg-card border border-border rounded-lg p-4 flex justify-between items-center">
                <div>
                  <div className="font-mono">{new Date(s.slot_at).toLocaleString("fr-FR")}</div>
                  {s.is_booked && booking?.profiles ? (
                    <div className="text-xs text-primary mt-1">Réservé par {booking.profiles.full_name || booking.profiles.email} · {booking.profiles.phone ?? ""}</div>
                  ) : <div className="text-xs text-muted-foreground">Libre</div>}
                </div>
                {!s.is_booked && <button onClick={() => remove(s.id)} className="text-xs text-destructive">Supprimer</button>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
