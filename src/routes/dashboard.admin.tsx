import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  adminStatsFn, adminListFn, adminProcessKycFn, adminProcessVerifFn,
  adminProcessPurchaseFn, adminSetRoleFn, adminBanUserFn, adminAdjustTokensFn,
  adminUpdatePropertyFn, adminGetSettingsFn, adminUpdateSettingsFn,
} from "@/lib/admin.functions";
import { adminGetCguFn, adminUpdateCguFn } from "@/lib/cgu.functions";
import { adminListReportsFn, adminProcessReportFn } from "@/lib/reports.functions";
import { getFreeModeFn, adminSetFreeModeFn, adminClearFreeModeFn } from "@/lib/free-mode.functions";
import { supabase } from "@/integrations/supabase/client";
import { formatAr } from "@/lib/format";
import { useRealtimeInvalidate } from "@/hooks/use-realtime-invalidate";
import { Badge } from "@/components/ui/badge";


export const Route = createFileRoute("/dashboard/admin")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
    if (!roles?.some((r) => r.role === "admin")) throw redirect({ to: "/" });
  },
  component: AdminDashboard,
});

type Tab = "overview" | "users" | "properties" | "kyc" | "verifications" | "purchases" | "reports" | "settings" | "logs" | "cgu";

function AdminDashboard() {
  const [tab, setTab] = useState<Tab>("overview");
  useRealtimeInvalidate([
    { table: "properties", queryKeys: [["admin-list", "properties"], ["admin-stats"]] },
    { table: "property_reports", queryKeys: [["admin-reports"], ["admin-stats"]] },
    { table: "kyc_requests", queryKeys: [["admin-list", "kyc"], ["admin-stats"]] },
    { table: "verification_requests", queryKeys: [["admin-list", "verifications"], ["admin-stats"]] },
    { table: "token_purchase_requests", queryKeys: [["admin-list", "purchases"], ["admin-stats"]] },
    { table: "profiles", queryKeys: [["admin-list", "users"], ["admin-stats"]] },
    { table: "user_roles", queryKeys: [["admin-list", "users"]] },
    { table: "user_bans", queryKeys: [["admin-list", "users"]] },
    { table: "site_settings", queryKeys: [["admin-settings"]] },
  ], "admin");

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Vue d'ensemble" },
    { id: "users", label: "Utilisateurs" },
    { id: "properties", label: "Annonces" },
    { id: "kyc", label: "KYC" },
    { id: "verifications", label: "Vérifications" },
    { id: "purchases", label: "Achats jetons" },
    { id: "reports", label: "Signalements" },
    { id: "settings", label: "Paramètres" },
    { id: "cgu", label: "CGU" },
    { id: "logs", label: "Journal" },
  ];

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl italic text-primary">Administration</h1>
          <p className="text-sm text-muted-foreground mt-1">Gestion complète de la plateforme Vohitra.</p>
        </div>
        <Link to="/admin/blog" className="text-sm font-medium px-4 py-2 border border-border rounded-md hover:bg-muted">
          Gérer le blog →
        </Link>
      </div>

      <div className="border-b border-border mb-6 overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "overview" && <Overview />}
      {tab === "users" && <UsersTab />}
      {tab === "properties" && <PropertiesTab />}
      {tab === "kyc" && <KycTab />}
      {tab === "verifications" && <VerificationsTab />}
      {tab === "purchases" && <PurchasesTab />}
      {tab === "reports" && <ReportsTab />}
      {tab === "settings" && <SettingsTab />}
      {tab === "cgu" && <CguTab />}
      {tab === "logs" && <LogsTab />}
    </div>
  );
}

function Overview() {
  const fn = useServerFn(adminStatsFn);
  const { data } = useQuery({ queryKey: ["admin-stats"], queryFn: () => fn() });
  if (!data) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  const items = [
    { label: "Utilisateurs", value: data.users },
    { label: "Utilisateurs actifs (30 min)", value: data.activeUsers, highlight: true },
    { label: "Annonces", value: data.properties },
    { label: "KYC en attente", value: data.pendingKyc, highlight: data.pendingKyc > 0 },
    { label: "Vérifs en attente", value: data.pendingVerif, highlight: data.pendingVerif > 0 },
    { label: "Achats en attente", value: data.pendingPurchases, highlight: data.pendingPurchases > 0 },
    { label: "Jetons dépensés", value: data.totalTokensSpent },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {items.map((i) => (
        <div key={i.label} className={`p-6 rounded-xl border ${i.highlight ? "border-primary bg-primary/5" : "border-border bg-card"}`}>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">{i.label}</p>
          <p className="text-3xl font-display font-bold mt-2">{i.value}</p>
        </div>
      ))}
    </div>
  );
}

function useList<T>(type: string) {
  const fn = useServerFn(adminListFn);
  const q = useQuery({ queryKey: ["admin-list", type], queryFn: () => fn({ data: { type: type as never } }) });
  return { ...q, data: q.data as T[] | undefined };
}

function UsersTab() {
  const qc = useQueryClient();
  const { data } = useList<{ id: string; email: string; full_name: string; phone: string | null; tokens_balance: number; kyc_status: string; roles: string[]; banned: boolean; created_at: string }>("users");
  const setRoleFn = useServerFn(adminSetRoleFn);
  const banFn = useServerFn(adminBanUserFn);
  const adjustFn = useServerFn(adminAdjustTokensFn);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-list", "users"] });

  return (
    <div className="space-y-3">
      {data?.map((u) => (
        <div key={u.id} className="p-4 rounded-lg border border-border bg-card">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold">{u.full_name || "—"} <span className="font-normal text-muted-foreground text-sm">{u.email}</span></p>
              <p className="text-xs text-muted-foreground mt-0.5">{u.phone ?? "—"} · {u.tokens_balance} jetons · KYC: {u.kyc_status}</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {u.roles.map((r) => <span key={r} className="text-xs px-2 py-0.5 rounded bg-secondary/10 text-secondary">{r}</span>)}
                {u.banned && <span className="text-xs px-2 py-0.5 rounded bg-destructive/10 text-destructive">banni</span>}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {(["locataire", "proprietaire", "admin"] as const).map((r) => (
                <button key={r} onClick={async () => {
                  await setRoleFn({ data: { userId: u.id, role: r, add: !u.roles.includes(r) } });
                  toast.success(u.roles.includes(r) ? `Rôle ${r} retiré` : `Rôle ${r} ajouté`);
                  invalidate();
                }} className={`text-xs px-2.5 py-1 rounded border ${u.roles.includes(r) ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}>
                  {r}
                </button>
              ))}
              <button onClick={async () => {
                const amount = Number(prompt("Montant (négatif pour retirer) :", "10"));
                if (!Number.isFinite(amount) || amount === 0) return;
                const reason = prompt("Raison :", "Bonus") ?? "Ajustement";
                await adjustFn({ data: { userId: u.id, amount, reason } });
                toast.success("Jetons mis à jour"); invalidate();
              }} className="text-xs px-2.5 py-1 rounded border border-border">+/- jetons</button>
              <button onClick={async () => {
                if (u.banned) {
                  await banFn({ data: { userId: u.id, action: "unban" } });
                  toast.success("Utilisateur débanni");
                } else {
                  const reason = prompt("Raison du bannissement :") ?? "Violation";
                  const days = Number(prompt("Durée (jours, vide = permanent) :", "30")) || undefined;
                  await banFn({ data: { userId: u.id, action: "ban", reason, days } });
                  toast.success("Utilisateur banni");
                }
                invalidate();
              }} className={`text-xs px-2.5 py-1 rounded border ${u.banned ? "border-border" : "border-destructive text-destructive"}`}>
                {u.banned ? "Débannir" : "Bannir"}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function PropertiesTab() {
  const qc = useQueryClient();
  const { data } = useList<{ id: string; title: string; city: string; price: number; status: string; is_verified: boolean; is_premium: boolean; created_at: string }>("properties");
  const fn = useServerFn(adminUpdatePropertyFn);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-list", "properties"] });
  return (
    <div className="space-y-3">
      {data?.map((p) => {
        const isActive = p.status === "active";
        const actions = [
          {
            key: "suspend" as const,
            label: "Suspendre",
            cls: "border-red-500/50 text-red-600 hover:bg-red-500/10",
            disabled: !isActive,
          },
          {
            key: "activate" as const,
            label: "Réactiver",
            cls: "border-emerald-500/50 text-emerald-600 hover:bg-emerald-500/10",
            disabled: isActive,
          },
          {
            key: "verify" as const,
            label: "Vérifier",
            cls: "border-blue-500/50 text-blue-600 hover:bg-blue-500/10",
            disabled: p.is_verified,
          },
          {
            key: "unverify" as const,
            label: "Dé-vérifier",
            cls: "border-amber-500/50 text-amber-600 hover:bg-amber-500/10",
            disabled: !p.is_verified,
          },
          {
            key: "delete" as const,
            label: "Supprimer",
            cls: "border-red-600 bg-red-600/5 text-red-600 hover:bg-red-600/15 font-semibold",
            disabled: false,
          },
        ];
        return (
          <div key={p.id} className="p-4 rounded-lg border border-border bg-card flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1.5">
              <Link to="/property/$id" params={{ id: p.id }} className="font-semibold hover:text-primary">{p.title}</Link>
              <p className="text-xs text-muted-foreground">{p.city} · {formatAr(p.price)}</p>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline" className={isActive ? "border-emerald-500/40 text-emerald-600 bg-emerald-500/10" : "border-red-500/40 text-red-600 bg-red-500/10"}>
                  {isActive ? "● Active" : "● Suspendue"}
                </Badge>
                <Badge variant="outline" className={p.is_verified ? "border-blue-500/40 text-blue-600 bg-blue-500/10" : "border-muted-foreground/30 text-muted-foreground"}>
                  {p.is_verified ? "✓ Vérifiée" : "Non vérifiée"}
                </Badge>
                {p.is_premium && (
                  <Badge variant="outline" className="border-amber-500/40 text-amber-600 bg-amber-500/10">★ Premium</Badge>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {actions.map((a) => (
                <button
                  key={a.key}
                  disabled={a.disabled}
                  onClick={async () => {
                    if (a.key === "delete" && !confirm("Supprimer définitivement cette annonce ?")) return;
                    await fn({ data: { propertyId: p.id, action: a.key } });
                    toast.success("Annonce mise à jour"); invalidate();
                  }}
                  className={`text-xs px-2.5 py-1 rounded border transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent ${a.cls}`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function KycTab() {
  const qc = useQueryClient();
  const { data } = useList<{ id: string; status: string; reject_reason: string | null; cin_recto_signed: string; cin_verso_signed: string; profile?: { email: string; full_name: string } }>("kyc");
  const fn = useServerFn(adminProcessKycFn);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-list", "kyc"] });
  return (
    <div className="space-y-4">
      {data?.map((k) => (
        <div key={k.id} className="p-4 rounded-lg border border-border bg-card">
          <p className="font-semibold">{k.profile?.full_name} <span className="font-normal text-sm text-muted-foreground">{k.profile?.email}</span></p>
          <p className="text-xs text-muted-foreground mb-3">Statut : {k.status}{k.reject_reason && ` · ${k.reject_reason}`}</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <a href={k.cin_recto_signed} target="_blank" rel="noopener noreferrer"><img src={k.cin_recto_signed} alt="CIN recto" className="w-full h-40 object-cover rounded border" /></a>
            <a href={k.cin_verso_signed} target="_blank" rel="noopener noreferrer"><img src={k.cin_verso_signed} alt="CIN verso" className="w-full h-40 object-cover rounded border" /></a>
          </div>
          {k.status === "pending" && (
            <div className="flex gap-2">
              <button onClick={async () => { await fn({ data: { id: k.id, action: "approve" } }); toast.success("KYC approuvé"); invalidate(); }}
                className="text-xs px-3 py-1.5 rounded bg-secondary text-secondary-foreground">Approuver</button>
              <button onClick={async () => {
                const reason = prompt("Raison du refus :") ?? "Document illisible";
                await fn({ data: { id: k.id, action: "reject", reason } });
                toast.success("KYC refusé"); invalidate();
              }} className="text-xs px-3 py-1.5 rounded border border-destructive text-destructive">Refuser</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function VerificationsTab() {
  const qc = useQueryClient();
  const { data } = useList<{ id: string; property_id: string; status: string; reject_reason: string | null; property?: { title: string; city: string; address: string } }>("verifications");
  const fn = useServerFn(adminProcessVerifFn);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-list", "verifications"] });
  return (
    <div className="space-y-3">
      {data?.map((v) => (
        <div key={v.id} className="p-4 rounded-lg border border-border bg-card flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-semibold">{v.property?.title ?? "—"}</p>
            <p className="text-xs text-muted-foreground">{v.property?.address} · {v.property?.city}</p>
            <p className="text-xs text-muted-foreground mt-1">Statut : {v.status}{v.reject_reason && ` · ${v.reject_reason}`}</p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <Link
              to="/property/$id"
              params={{ id: v.property_id }}
              target="_blank"
              className="text-xs px-3 py-1.5 rounded border border-border hover:bg-muted"
            >
              Voir l'annonce
            </Link>
            {v.status === "pending" && (
              <>
                <button onClick={async () => { await fn({ data: { id: v.id, action: "approve" } }); toast.success("Vérification approuvée"); invalidate(); }}
                  className="text-xs px-3 py-1.5 rounded bg-secondary text-secondary-foreground">Approuver</button>
                <button onClick={async () => {
                  const reason = prompt("Raison du refus :") ?? "Visite non concluante";
                  await fn({ data: { id: v.id, action: "reject", reason } });
                  toast.success("Vérification refusée"); invalidate();
                }} className="text-xs px-3 py-1.5 rounded border border-destructive text-destructive">Refuser</button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function PurchasesTab() {
  const qc = useQueryClient();
  const { data } = useList<{ id: string; tokens_amount: number; total_price: number; payment_reference: string | null; status: string; reject_reason: string | null; profile?: { email: string; full_name: string } }>("purchases");
  const fn = useServerFn(adminProcessPurchaseFn);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-list", "purchases"] });
  return (
    <div className="space-y-3">
      {data?.map((p) => (
        <div key={p.id} className="p-4 rounded-lg border border-border bg-card flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-semibold">{p.profile?.full_name} <span className="font-normal text-sm text-muted-foreground">{p.profile?.email}</span></p>
            <p className="text-sm mt-1">{p.tokens_amount} jetons · {formatAr(p.total_price)}</p>
            <p className="text-xs text-muted-foreground mt-1">Réf paiement : <span className="font-mono">{p.payment_reference ?? "—"}</span></p>
            <p className="text-xs text-muted-foreground">Statut : {p.status}{p.reject_reason && ` · ${p.reject_reason}`}</p>
          </div>
          {p.status === "pending" && (
            <div className="flex gap-2">
              <button onClick={async () => { await fn({ data: { id: p.id, action: "approve" } }); toast.success("Achat approuvé, jetons crédités"); invalidate(); }}
                className="text-xs px-3 py-1.5 rounded bg-secondary text-secondary-foreground">Approuver</button>
              <button onClick={async () => {
                const reason = prompt("Raison du refus :") ?? "Paiement non reçu";
                await fn({ data: { id: p.id, action: "reject", reason } });
                toast.success("Achat refusé"); invalidate();
              }} className="text-xs px-3 py-1.5 rounded border border-destructive text-destructive">Refuser</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function SettingsTab() {
  const qc = useQueryClient();
  const getFn = useServerFn(adminGetSettingsFn);
  const updateFn = useServerFn(adminUpdateSettingsFn);
  const { data } = useQuery({ queryKey: ["admin-settings"], queryFn: () => getFn() });
  const mut = useMutation({
    mutationFn: (vals: Record<string, unknown>) => updateFn({ data: vals as never }),
    onSuccess: () => { toast.success("Paramètres enregistrés"); qc.invalidateQueries({ queryKey: ["admin-settings"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  if (!data) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  return (
    <div className="space-y-6 max-w-2xl">
      <FreeModePanel />
      <SettingsForm data={data} mut={mut} />
    </div>
  );
}

function FreeModePanel() {
  const qc = useQueryClient();
  const getFn = useServerFn(getFreeModeFn);
  const setFn = useServerFn(adminSetFreeModeFn);
  const clearFn = useServerFn(adminClearFreeModeFn);
  const { data } = useQuery({ queryKey: ["free-mode"], queryFn: () => getFn(), refetchInterval: 30_000 });
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["free-mode"] });
    qc.invalidateQueries({ queryKey: ["admin-settings"] });
  };
  const enable = useMutation({
    mutationFn: (vals: { hours?: number; until?: string }) => setFn({ data: vals }),
    onSuccess: (r) => { toast.success(`Gratuit activé jusqu'au ${new Date(r.until).toLocaleString("fr-FR")}`); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const disable = useMutation({
    mutationFn: () => clearFn(),
    onSuccess: () => { toast.success("Mode gratuit désactivé"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const [customDate, setCustomDate] = useState("");

  return (
    <section className="space-y-3 p-4 rounded-lg border-2 border-emerald-500/50 bg-emerald-500/5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Mode « tout gratuit »</h3>
          <p className="text-xs text-muted-foreground">
            Pendant la fenêtre, déblocage de contacts, vérifications, boosts et abonnements ne coûtent aucun jeton.
          </p>
        </div>
        {data?.active ? (
          <Badge className="bg-emerald-600 hover:bg-emerald-600">Actif</Badge>
        ) : (
          <Badge variant="outline">Inactif</Badge>
        )}
      </div>

      {data?.active && data.until && (
        <p className="text-sm">
          Actif jusqu'au <strong>{new Date(data.until).toLocaleString("fr-FR")}</strong>
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {[
          { h: 1, label: "1 h" },
          { h: 6, label: "6 h" },
          { h: 24, label: "24 h" },
          { h: 24 * 3, label: "3 jours" },
          { h: 24 * 7, label: "7 jours" },
          { h: 24 * 30, label: "30 jours" },
        ].map((opt) => (
          <button
            key={opt.h}
            type="button"
            disabled={enable.isPending}
            onClick={() => enable.mutate({ hours: opt.h })}
            className="px-3 py-1.5 text-xs rounded-md border border-emerald-500/40 bg-background hover:bg-emerald-500/10 disabled:opacity-50"
          >
            Activer {opt.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Date/heure de fin précise</label>
          <input
            type="datetime-local"
            value={customDate}
            onChange={(e) => setCustomDate(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          />
        </div>
        <button
          type="button"
          disabled={!customDate || enable.isPending}
          onClick={() => {
            const iso = new Date(customDate).toISOString();
            enable.mutate({ until: iso });
          }}
          className="h-9 px-3 text-xs rounded-md border border-emerald-500/40 bg-background hover:bg-emerald-500/10 disabled:opacity-50"
        >
          Activer jusqu'à cette date
        </button>
        {data?.active && (
          <button
            type="button"
            disabled={disable.isPending}
            onClick={() => disable.mutate()}
            className="h-9 px-3 text-xs rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
          >
            Désactiver maintenant
          </button>
        )}
      </div>
    </section>
  );
}

function SettingsForm({ data, mut }: { data: unknown; mut: { isPending: boolean; mutate: (v: Record<string, unknown>) => void } }) {
  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      mut.mutate({
        site_name: String(f.get("site_name") || ""),
        hero_title: String(f.get("hero_title") || ""),
        hero_subtitle: String(f.get("hero_subtitle") || ""),
        hero_background_url: String(f.get("hero_background_url") || ""),
        logo_url: String(f.get("logo_url") || ""),
        primary_color: String(f.get("primary_color") || ""),
        secondary_color: String(f.get("secondary_color") || ""),
        token_price: Number(f.get("token_price")),
        unlock_cost_tokens: Number(f.get("unlock_cost_tokens")),
        free_unlocks_per_day: Number(f.get("free_unlocks_per_day")),
        verification_cost_tokens: Number(f.get("verification_cost_tokens")),
        boost_short_tokens: Number(f.get("boost_short_tokens")),
        boost_short_days: Number(f.get("boost_short_days")),
        pro_subscription_tokens: Number(f.get("pro_subscription_tokens")),
        pro_subscription_days: Number(f.get("pro_subscription_days")),
        purchase_instructions: String(f.get("purchase_instructions") || ""),
        premium_enabled: f.get("premium_enabled") === "on",
        boost_short_enabled: f.get("boost_short_enabled") === "on",
        boost_long_enabled: f.get("boost_long_enabled") === "on",
        unlock_tokens_enabled: f.get("unlock_tokens_enabled") === "on",
        verification_paid_enabled: f.get("verification_paid_enabled") === "on",
      });
    }} className="space-y-6 max-w-2xl">

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Identité du site</h3>
        {([
          ["site_name", "Nom du site", "text"],
          ["hero_title", "Titre hero", "text"],
          ["hero_subtitle", "Sous-titre hero", "textarea"],
          ["hero_background_url", "URL image hero", "text"],
          ["logo_url", "URL logo", "text"],
          ["primary_color", "Couleur primaire (CSS)", "text"],
          ["secondary_color", "Couleur secondaire (CSS)", "text"],
        ] as const).map(([name, label, type]) => (
          <SettingField key={name} name={name} label={label} type={type} data={data} />
        ))}
      </section>

      <section className="space-y-3 p-4 rounded-lg border border-primary/30 bg-primary/5">
        <h3 className="text-sm font-semibold text-primary">Tarifs & jetons</h3>
        <p className="text-xs text-muted-foreground">Configurez le coût en jetons de chaque action de la plateforme.</p>
        {([
          ["token_price", "Prix d'un jeton (Ar)", "number"],
          ["unlock_cost_tokens", "Déblocage coordonnées propriétaire (jetons)", "number"],
          ["free_unlocks_per_day", "Déblocages gratuits par locataire / 24 h (0 = désactivé)", "number"],
          ["verification_cost_tokens", "Demande de vérification d'annonce (jetons)", "number"],
          ["boost_short_tokens", "Boost court — coût (jetons)", "number"],
          ["boost_short_days", "Boost court — durée (jours)", "number"],
          ["pro_subscription_tokens", "Abonnement Premium — coût (jetons)", "number"],
          ["pro_subscription_days", "Abonnement Premium — durée (jours)", "number"],
        ] as const).map(([name, label, type]) => (
          <SettingField key={name} name={name} label={label} type={type} data={data} />
        ))}
      </section>

      <section className="space-y-3 p-4 rounded-lg border border-border bg-card">
        <h3 className="text-sm font-semibold text-foreground">Disponibilité des offres payantes</h3>
        <p className="text-xs text-muted-foreground">Activez ou désactivez chaque offre indépendamment. Une offre désactivée n'apparaît plus aux propriétaires et ne peut plus être achetée.</p>
        <SettingToggle name="premium_enabled" label="Abonnement Premium (propriétaire Pro)" data={data} />
        <SettingToggle name="boost_short_enabled" label="Boost court (7 jours)" data={data} />
        <SettingToggle name="boost_long_enabled" label="Boost long (14 jours)" data={data} />
        <SettingToggle name="unlock_tokens_enabled" label="Déblocage des contacts avec jetons (désactivé = déblocage gratuit pour tous)" data={data} />
        <SettingToggle name="verification_paid_enabled" label="Vérification d'annonce payante (désactivé = gratuit, simple message au propriétaire)" data={data} />
      </section>

      <section className="space-y-3">

        <h3 className="text-sm font-semibold text-foreground">Paiement</h3>
        <SettingField name="purchase_instructions" label="Instructions d'achat" type="textarea" data={data} />
      </section>

      <button type="submit" disabled={mut.isPending}
        className="px-5 py-2 rounded bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60">
        Enregistrer
      </button>
    </form>
  );
}

function SettingField({ name, label, type, data }: { name: string; label: string; type: "text" | "number" | "textarea"; data: unknown }) {
  const value = (data as Record<string, unknown>)[name];
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      {type === "textarea" ? (
        <textarea name={name} defaultValue={(value as string) ?? ""} rows={3}
          className="w-full px-3 py-2 rounded border border-border bg-background text-sm" />
      ) : (
        <input name={name} type={type} defaultValue={(value as string | number) ?? ""}
          className="w-full px-3 py-2 rounded border border-border bg-background text-sm" />
      )}
    </div>
  );
}

function SettingToggle({ name, label, data }: { name: string; label: string; data: unknown }) {
  const value = (data as Record<string, unknown>)[name];
  const checked = value !== false;
  return (
    <label className="flex items-center gap-3 cursor-pointer py-1">
      <input type="checkbox" name={name} defaultChecked={checked} className="h-4 w-4 accent-primary" />
      <span className="text-sm text-foreground">{label}</span>
    </label>
  );
}


function LogsTab() {
  const { data } = useList<{ id: string; action: string; target_type: string; target_id: string; created_at: string; details: unknown }>("logs");
  return (
    <div className="space-y-2">
      {data?.map((l) => (
        <div key={l.id} className="p-3 rounded border border-border bg-card text-sm font-mono">
          <span className="text-muted-foreground">{new Date(l.created_at).toLocaleString("fr-FR")}</span>
          {" · "}<span className="text-primary">{l.action}</span>
          {" · "}{l.target_type}:{l.target_id.slice(0, 8)}
          {l.details ? <pre className="text-xs text-muted-foreground mt-1 overflow-x-auto">{JSON.stringify(l.details)}</pre> : null}
        </div>
      ))}
    </div>
  );
}

function ReportsTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListReportsFn);
  const processFn = useServerFn(adminProcessReportFn);
  const { data } = useQuery({ queryKey: ["admin-reports"], queryFn: () => listFn() });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-reports"] });

  if (!data) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  if (data.length === 0) return <p className="text-sm text-muted-foreground">Aucun signalement.</p>;

  return (
    <div className="space-y-3">
      {data.map((r) => (
        <div key={r.id} className="p-4 rounded-lg border border-border bg-card">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {r.property ? (
                  <Link to="/property/$id" params={{ id: r.property_id }} target="_blank"
                    className="font-semibold hover:text-primary">{r.property.title}</Link>
                ) : (
                  <span className="font-semibold text-muted-foreground italic">Annonce supprimée</span>
                )}
                <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded ${
                  r.status === "pending" ? "bg-primary/10 text-primary" :
                  r.status === "removed" ? "bg-destructive/10 text-destructive" :
                  "bg-muted text-muted-foreground"
                }`}>{r.status}</span>
              </div>
              <p className="text-sm mt-1"><span className="text-muted-foreground">Motif : </span>{r.reason}</p>
              {r.details && <p className="text-sm text-foreground/80 mt-1 whitespace-pre-line">{r.details}</p>}
              <p className="text-xs text-muted-foreground mt-2">
                Signalé par {r.reporter?.full_name || r.reporter?.email || "—"} · {new Date(r.created_at).toLocaleString("fr-FR")}
              </p>
              {r.admin_note && <p className="text-xs text-muted-foreground mt-1">Note admin : {r.admin_note}</p>}
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              {r.property && (
                <Link to="/property/$id" params={{ id: r.property_id }} target="_blank"
                  className="text-xs px-3 py-1.5 rounded border border-border hover:bg-muted">Voir</Link>
              )}
              {r.status === "pending" && (
                <>
                  <button onClick={async () => {
                    await processFn({ data: { id: r.id, action: "dismiss" } });
                    toast.success("Signalement rejeté"); invalidate();
                  }} className="text-xs px-3 py-1.5 rounded border border-border">Rejeter</button>
                  <button onClick={async () => {
                    const note = prompt("Note (optionnel) :") ?? undefined;
                    await processFn({ data: { id: r.id, action: "reviewed", note: note || undefined } });
                    toast.success("Marqué comme vérifié"); invalidate();
                  }} className="text-xs px-3 py-1.5 rounded bg-secondary text-secondary-foreground">Vérifié</button>
                  <button onClick={async () => {
                    if (!confirm("Supprimer définitivement cette annonce ?")) return;
                    const note = prompt("Raison de la suppression :") ?? "Annonce non conforme";
                    await processFn({ data: { id: r.id, action: "remove", note } });
                    toast.success("Annonce supprimée"); invalidate();
                  }} className="text-xs px-3 py-1.5 rounded border border-destructive text-destructive">Supprimer l'annonce</button>
                </>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function CguTab() {
  const qc = useQueryClient();
  const getFn = useServerFn(adminGetCguFn);
  const updateFn = useServerFn(adminUpdateCguFn);
  const { data } = useQuery({ queryKey: ["admin-cgu"], queryFn: () => getFn() });
  const [fr, setFr] = useState("");
  const [mg, setMg] = useState("");
  const mut = useMutation({
    mutationFn: (vals: { content_fr: string; content_mg: string }) => updateFn({ data: vals }),
    onSuccess: () => { toast.success("CGU enregistrées"); qc.invalidateQueries({ queryKey: ["admin-cgu"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    if (data) { setFr(data.content_fr ?? ""); setMg(data.content_mg ?? ""); }
  }, [data]);

  if (!data) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  return (
    <form onSubmit={(e) => { e.preventDefault(); mut.mutate({ content_fr: fr, content_mg: mg }); }} className="space-y-6 max-w-3xl">
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Français</h3>
        <textarea value={fr} onChange={(e) => setFr(e.target.value)} rows={12}
          className="w-full px-3 py-2 rounded border border-border bg-background text-sm" />
      </section>
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Malagasy</h3>
        <textarea value={mg} onChange={(e) => setMg(e.target.value)} rows={12}
          className="w-full px-3 py-2 rounded border border-border bg-background text-sm" />
      </section>
      <button type="submit" disabled={mut.isPending}
        className="px-5 py-2 rounded bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60">
        Enregistrer les CGU
      </button>
    </form>
  );
}
