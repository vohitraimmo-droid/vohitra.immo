import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatAr } from "@/lib/format";
import { Search } from "lucide-react";

export const Route = createFileRoute("/history")({
  head: () => ({ meta: [{ title: "Historique — Vohitra" }] }),
  component: HistoryPage,
});

type Kind = "all" | "purchase" | "verification" | "unlock";
type Sort = "date_desc" | "date_asc" | "status";

interface Row {
  id: string;
  kind: "purchase" | "verification" | "unlock";
  ref: string;
  title: string;
  subtitle: string;
  status: string;
  created_at: string;
  amount?: number | null;
}

function statusBadge(s: string) {
  const cls =
    s === "approved" || s === "confirmé"
      ? "bg-verified text-verified-foreground"
      : s === "rejected"
      ? "bg-destructive text-destructive-foreground"
      : "bg-muted";
  return <span className={`text-[10px] font-bold px-2.5 py-1 rounded uppercase tracking-wider ${cls}`}>{s}</span>;
}

function HistoryPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [kind, setKind] = useState<Kind>("all");
  const [sort, setSort] = useState<Sort>("date_desc");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(true);

  useEffect(() => { if (!loading && !user) navigate({ to: "/login" }); }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setBusy(true);
      const [purchases, verifs, unlocks] = await Promise.all([
        supabase.from("token_purchase_requests").select("*").eq("user_id", user.id),
        supabase.from("verification_requests").select("*, properties(title)").eq("user_id", user.id),
        supabase.from("contact_unlocks").select("*, properties(title)").eq("user_id", user.id),
      ]);

      const all: Row[] = [];

      (purchases.data ?? []).forEach((r: any) => {
        all.push({
          id: r.id,
          kind: "purchase",
          ref: r.payment_reference || r.id.slice(0, 8).toUpperCase(),
          title: `Achat de ${r.tokens_amount} jeton${r.tokens_amount > 1 ? "s" : ""}`,
          subtitle: `Total : ${formatAr(r.total_price)}${r.reject_reason ? " — Refusé : " + r.reject_reason : ""}`,
          status: r.status,
          created_at: r.created_at,
          amount: r.tokens_amount,
        });
      });

      (verifs.data ?? []).forEach((r: any) => {
        all.push({
          id: r.id,
          kind: "verification",
          ref: "VER-" + r.id.slice(0, 8).toUpperCase(),
          title: `Vérification : ${r.properties?.title ?? "Annonce supprimée"}`,
          subtitle: r.reject_reason ? "Refusé : " + r.reject_reason : "Demande de vérification sur site",
          status: r.status,
          created_at: r.created_at,
        });
      });

      (unlocks.data ?? []).forEach((r: any) => {
        all.push({
          id: r.id,
          kind: "unlock",
          ref: "UNL-" + r.id.slice(0, 8).toUpperCase(),
          title: `Déblocage coordonnées : ${r.properties?.title ?? "Annonce supprimée"}`,
          subtitle: "1 jeton dépensé",
          status: "confirmé",
          created_at: r.created_at,
        });
      });

      setRows(all);
      setBusy(false);
    })();
  }, [user?.id]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = rows.filter((r) => {
      if (kind !== "all" && r.kind !== kind) return false;
      if (q && !(r.ref.toLowerCase().includes(q) || r.title.toLowerCase().includes(q) || r.subtitle.toLowerCase().includes(q))) return false;
      return true;
    });
    if (sort === "date_desc") out = out.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    if (sort === "date_asc") out = out.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
    if (sort === "status") out = out.sort((a, b) => a.status.localeCompare(b.status));
    return out;
  }, [rows, kind, sort, search]);

  if (loading || !user) return <div className="py-20 text-center text-muted-foreground">Chargement...</div>;

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-12">
      <Link to="/" className="text-sm text-muted-foreground hover:text-primary">← Retour</Link>
      <h1 className="font-display text-3xl md:text-4xl italic mt-3 mb-2">Mon historique</h1>
      <p className="text-muted-foreground text-sm mb-8">
        Toutes vos transactions et demandes : achats de jetons, vérifications d'annonces, déblocages.
      </p>

      <div className="bg-card border border-border rounded-2xl p-4 md:p-5 mb-6 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par référence, titre…"
            className="w-full pl-9 pr-3 py-2.5 border border-border rounded-md text-sm bg-background"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as Kind)}
            className="flex-1 px-3 py-2.5 border border-border rounded-md text-sm bg-background"
          >
            <option value="all">Tous les types</option>
            <option value="purchase">Achats de jetons</option>
            <option value="verification">Vérifications</option>
            <option value="unlock">Déblocages</option>
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="flex-1 px-3 py-2.5 border border-border rounded-md text-sm bg-background"
          >
            <option value="date_desc">Plus récent</option>
            <option value="date_asc">Plus ancien</option>
            <option value="status">Statut</option>
          </select>
        </div>
      </div>

      {busy ? (
        <div className="text-center py-12 text-muted-foreground">Chargement…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground bg-card border border-border rounded-2xl">
          Aucune transaction trouvée.
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((r) => (
            <li key={r.kind + r.id} className="bg-card border border-border rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-muted">
                    {r.kind === "purchase" ? "Achat" : r.kind === "verification" ? "Vérif." : "Déblocage"}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground select-all">Réf : {r.ref}</span>
                </div>
                <div className="font-medium truncate">{r.title}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleString("fr-FR")} · {r.subtitle}
                </div>
              </div>
              <div className="shrink-0">{statusBadge(r.status)}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
