import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/visits/book/$propertyId")({
  head: () => ({ meta: [{ title: "Réserver une visite — Vohitra" }] }),
  component: BookVisitPage,
});

function BookVisitPage() {
  const { propertyId } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [property, setProperty] = useState<any>(null);
  const [slots, setSlots] = useState<any[]>([]);

  useEffect(() => { if (!loading && !user) navigate({ to: "/login" }); }, [user, loading, navigate]);

  const load = async () => {
    const { data: p } = await supabase.from("properties").select("id, title, city").eq("id", propertyId).single();
    setProperty(p);
    const { data: s } = await supabase.from("visit_slots").select("*")
      .eq("property_id", propertyId).eq("is_booked", false).gte("slot_at", new Date().toISOString()).order("slot_at");
    setSlots(s ?? []);
  };
  useEffect(() => { void load(); }, [propertyId]);

  const book = async (slotId: string) => {
    try {
      const { bookVisitFn } = await import("@/lib/properties.functions");
      await bookVisitFn({ data: { slotId } });
      toast.success("Visite réservée !");
      navigate({ to: "/dashboard/tenant" });
    } catch (e: any) { toast.error(e?.message ?? "Erreur"); }
  };

  if (loading || !user) return <div className="py-20 text-center text-muted-foreground">Chargement...</div>;

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <Link to="/property/$id" params={{ id: propertyId }} className="text-sm text-muted-foreground hover:text-primary">← Retour à l'annonce</Link>
      <h1 className="font-display text-4xl italic mt-4 mb-2">Réserver une visite</h1>
      <p className="text-muted-foreground mb-8">{property?.title} — {property?.city}</p>

      {slots.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border rounded-xl text-muted-foreground">
          Aucun créneau disponible pour le moment.
        </div>
      ) : (
        <ul className="space-y-2">
          {slots.map((s) => (
            <li key={s.id} className="bg-card border border-border rounded-lg p-4 flex justify-between items-center">
              <span className="font-mono">{new Date(s.slot_at).toLocaleString("fr-FR")}</span>
              <button onClick={() => book(s.id)} className="bg-primary text-primary-foreground px-4 py-2 rounded-md font-semibold text-sm">
                Réserver
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
