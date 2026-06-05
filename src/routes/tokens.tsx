import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatAr } from "@/lib/format";
import { createTokenPurchaseRequestFn } from "@/lib/tokens.functions";
import { toast } from "sonner";


export const Route = createFileRoute("/tokens")({
  head: () => ({ meta: [{ title: "Acheter des jetons — Vohitra" }] }),
  component: TokensPage,
});

const PACKS = [1, 5, 10, 25, 50];

function TokensPage() {
  const { user, roles, loading } = useAuth();
  const isAdmin = roles.includes("admin");
  const navigate = useNavigate();
  const [tokensAmount, setTokensAmount] = useState(5);
  const [reference, setReference] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [settings, setSettings] = useState<{ token_price: number; purchase_instructions: string } | null>(null);
  const [requests, setRequests] = useState<any[]>([]);

  useEffect(() => { if (!loading && !user) navigate({ to: "/login" }); }, [user, loading, navigate]);

  useEffect(() => {
    supabase.from("site_settings").select("token_price, purchase_instructions").eq("id", 1).single()
      .then(({ data }) => setSettings(data as any));
  }, []);
  useEffect(() => {
    if (!user) return;
    supabase.from("token_purchase_requests").select("*").eq("user_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => setRequests(data ?? []));
  }, [user?.id]);

  const createPurchase = useServerFn(createTokenPurchaseRequestFn);

  const cooldown = useMemo(() => {
    if (!requests.length) return null;
    const last = requests[0];
    const nextAt = new Date(new Date(last.created_at).getTime() + 24 * 60 * 60 * 1000);
    if (nextAt.getTime() <= Date.now()) return null;
    const hoursLeft = Math.max(1, Math.ceil((nextAt.getTime() - Date.now()) / (60 * 60 * 1000)));
    return { nextAt, hoursLeft };
  }, [requests]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !settings) return;
    const ref = reference.trim();
    if (ref.length < 4) {
      toast.error("La référence de transaction Mvola est obligatoire.");
      return;
    }
    if (cooldown) {
      toast.error(`Un seul achat est autorisé par 24h. Réessayez dans environ ${cooldown.hoursLeft}h.`);
      return;
    }
    setSubmitting(true);
    try {
      await createPurchase({ data: { tokensAmount, paymentReference: ref } });
      toast.success("Demande envoyée, en attente de validation.");
      setReference("");
      const { data } = await supabase.from("token_purchase_requests").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      setRequests(data ?? []);
    } catch (err: any) {
      toast.error(err?.message ?? "Erreur lors de l'envoi de la demande.");
    }
    setSubmitting(false);
  };

  if (loading || !user || !settings) return <div className="py-20 text-center text-muted-foreground">Chargement...</div>;


  if (isAdmin) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-20 text-center">
        <h1 className="font-display text-3xl italic mb-3">Compte administrateur</h1>
        <p className="text-muted-foreground">
          En tant qu'admin, vous n'avez pas besoin d'acheter de jetons. Le déblocage des
          coordonnées et le boost de vos annonces sont gratuits.
        </p>
      </div>
    );
  }


  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="font-display text-4xl italic mb-2">Acheter des jetons</h1>
      <p className="text-muted-foreground mb-6">1 jeton = {formatAr(settings.token_price)}. Un jeton débloque les coordonnées d'une annonce ; un boost coûte 5 jetons.</p>

      <div className="mb-6 text-xs text-muted-foreground bg-muted/40 border border-border rounded-lg p-3">
        Pour éviter les surcharges et tentatives de fraude, un seul achat de jetons est autorisé toutes les 24h par compte.
      </div>

      {cooldown && (
        <div className="mb-6 bg-destructive/10 border border-destructive/30 text-destructive rounded-lg p-4 text-sm">
          Vous avez déjà envoyé une demande d'achat récemment. Vous pourrez en créer une nouvelle dans environ <strong>{cooldown.hoursLeft}h</strong> (le {cooldown.nextAt.toLocaleString("fr-FR")}).
        </div>
      )}

      <form onSubmit={submit} className="bg-card border border-border rounded-2xl p-6 space-y-5">

        <div>
          <label className="text-sm font-medium block mb-2">Nombre de jetons</label>
          <div className="flex flex-wrap gap-2 mb-3">
            {PACKS.map((n) => (
              <button type="button" key={n} onClick={() => setTokensAmount(n)}
                className={`px-4 py-2 rounded-md text-sm font-semibold border ${tokensAmount === n ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>
                {n} jetons
              </button>
            ))}
          </div>
          <input type="number" min={1} max={500} value={tokensAmount}
            onChange={(e) => setTokensAmount(Math.max(1, Number(e.target.value)))}
            className="w-full px-3 py-2 border border-border rounded-md text-sm" />
        </div>

        <div className="bg-muted/50 rounded-lg p-4">
          <div className="flex justify-between text-sm">
            <span>Total à payer</span>
            <span className="font-mono font-bold text-primary text-lg">{formatAr(tokensAmount * settings.token_price)}</span>
          </div>
        </div>

        <div className="text-sm bg-background border border-border rounded-lg p-4 whitespace-pre-line">
          {settings.purchase_instructions}
        </div>

        <div>
          <label className="text-sm font-medium block mb-1.5">
            Référence de transaction Mvola <span className="text-destructive">*</span>
          </label>
          <input
            required
            minLength={4}
            maxLength={50}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-md text-sm"
            placeholder="Ex: MP240522.1234.A12345"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Saisissez la référence reçue par SMS après votre paiement Mvola / Orange Money / Airtel Money. Elle est obligatoire pour la validation.
          </p>
        </div>

        <button type="submit" disabled={submitting || !!cooldown} className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-semibold disabled:opacity-50">
          {submitting ? "Envoi..." : cooldown ? `Disponible dans ~${cooldown.hoursLeft}h` : "Envoyer la demande"}
        </button>

      </form>

      {requests.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-2xl italic mb-3">Mes demandes</h2>
          <ul className="space-y-2">
            {requests.map((r) => (
              <li key={r.id} className="bg-card border border-border rounded-lg p-4 flex justify-between items-center">
                <div>
                  <div className="font-medium">{r.tokens_amount} jetons — {formatAr(r.total_price)}</div>
                  <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("fr-FR")} · Réf: {r.payment_reference ?? "—"}</div>
                  {r.reject_reason && <div className="text-xs text-destructive mt-1">Refusé : {r.reject_reason}</div>}
                </div>
                <span className={`text-xs font-bold px-3 py-1 rounded uppercase ${r.status === "approved" ? "bg-verified text-verified-foreground" : r.status === "rejected" ? "bg-destructive text-destructive-foreground" : "bg-muted"}`}>{r.status}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
