import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/kyc")({
  head: () => ({ meta: [{ title: "Vérification d'identité — Vohitra" }] }),
  component: KycPage,
});

function KycPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [recto, setRecto] = useState<File | null>(null);
  const [verso, setVerso] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [existing, setExisting] = useState<any>(null);
  const [status, setStatus] = useState<string>("none");

  useEffect(() => { if (!loading && !user) navigate({ to: "/login" }); }, [user, loading, navigate]);
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("kyc_status").eq("id", user.id).single().then(({ data }) => setStatus(data?.kyc_status ?? "none"));
    supabase.from("kyc_requests").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle().then(({ data }) => setExisting(data));
  }, [user?.id]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !recto || !verso) { toast.error("Recto et verso requis"); return; }
    setSubmitting(true);
    try {
      const up = async (file: File, side: string) => {
        const path = `${user.id}/${Date.now()}-${side}.${file.name.split(".").pop()}`;
        const { error } = await supabase.storage.from("kyc-documents").upload(path, file, { upsert: false });
        if (error) throw error;
        return path;
      };
      const rectoPath = await up(recto, "recto");
      const versoPath = await up(verso, "verso");
      const { error } = await supabase.from("kyc_requests").insert({
        user_id: user.id, cin_recto_url: rectoPath, cin_verso_url: versoPath,
      });
      if (error) throw error;
      await supabase.from("profiles").update({ kyc_status: "pending" }).eq("id", user.id);
      toast.success("Documents envoyés, en attente de validation.");
      navigate({ to: "/dashboard/tenant" });
    } catch (e: any) { toast.error(e?.message ?? "Erreur"); }
    finally { setSubmitting(false); }
  };

  if (loading || !user) return <div className="py-20 text-center text-muted-foreground">Chargement...</div>;

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <Link to="/dashboard/tenant" className="text-sm text-muted-foreground hover:text-primary">← Retour</Link>
      <h1 className="font-display text-4xl italic mt-4 mb-2">Vérification d'identité</h1>
      <p className="text-muted-foreground mb-8">Uploadez le recto et le verso de votre Carte d'Identité Nationale (CIN). Vos documents sont privés.</p>

      <div className="mb-6 p-4 bg-muted/50 rounded-lg text-sm">
        Statut actuel : <span className="font-semibold">{status === "approved" ? "Vérifié ✓" : status === "pending" ? "En attente" : status === "rejected" ? "Refusé" : "Non vérifié"}</span>
        {existing?.reject_reason && <div className="text-destructive text-xs mt-1">Motif : {existing.reject_reason}</div>}
      </div>

      {status !== "approved" && status !== "pending" && (
        <form onSubmit={submit} className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1.5">CIN Recto</label>
            <input required type="file" accept="image/*,application/pdf" onChange={(e) => setRecto(e.target.files?.[0] ?? null)} />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">CIN Verso</label>
            <input required type="file" accept="image/*,application/pdf" onChange={(e) => setVerso(e.target.files?.[0] ?? null)} />
          </div>
          <button type="submit" disabled={submitting} className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-semibold disabled:opacity-50">
            {submitting ? "Envoi..." : "Envoyer pour vérification"}
          </button>
        </form>
      )}
    </div>
  );
}
