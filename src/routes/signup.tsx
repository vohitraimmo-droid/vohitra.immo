import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Inscription — Vohitra" }] }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"locataire" | "proprietaire">("locataire");
  const [acceptCgu, setAcceptCgu] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptCgu) { toast.error("Vous devez accepter les CGU pour créer un compte."); return; }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
        data: { full_name: fullName, phone, role, cgu_accepted_at: new Date().toISOString() },
      },
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Compte créé avec succès !");
    navigate({ to: "/signup/confirm", search: { email } });
  };

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 py-12 sm:py-20">
      <header className="mb-8">
        <h1 className="font-display text-3xl sm:text-4xl italic mb-2 text-primary">Inscription</h1>
        <p className="text-muted-foreground text-sm">Rejoignez la communauté Vohitra.</p>
      </header>

      <form onSubmit={onSubmit} className="bg-card border border-border rounded-2xl p-5 sm:p-6 space-y-6">
        {/* Bloc 1 — Rôle */}
        <fieldset>
          <legend className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Je suis</legend>
          <div className="grid grid-cols-2 gap-3">
            {(["locataire", "proprietaire"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                aria-pressed={role === r}
                className={`min-h-12 py-3 px-4 rounded-lg border text-sm font-semibold transition-colors ${
                  role === r ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:border-primary"
                }`}
              >
                {r === "locataire" ? "Locataire" : "Propriétaire"}
              </button>
            ))}
          </div>
        </fieldset>

        {/* Bloc 2 — Identité */}
        <div className="space-y-4">
          <div>
            <label htmlFor="fullName" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nom complet</label>
            <input
              id="fullName" type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)}
              className="mt-1.5 w-full min-h-12 px-4 py-3 bg-background border border-border rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label htmlFor="phone" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Téléphone</label>
            <input
              id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="034 00 000 00"
              className="mt-1.5 w-full min-h-12 px-4 py-3 bg-background border border-border rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {/* Bloc 3 — Identifiants */}
        <div className="space-y-4">
          <div>
            <label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Email</label>
            <input
              id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 w-full min-h-12 px-4 py-3 bg-background border border-border rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Mot de passe</label>
            <input
              id="password" type="password" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 w-full min-h-12 px-4 py-3 bg-background border border-border rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="text-[11px] text-muted-foreground mt-1">Choisissez un mot de passe facile à retenir.</p>
          </div>
        </div>

        {/* CGU */}
        <label className="flex items-start gap-3 text-sm text-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={acceptCgu}
            onChange={(e) => setAcceptCgu(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-border accent-primary cursor-pointer"
          />
          <span>
            J'accepte les{" "}
            <Link to="/cgu" className="text-primary font-semibold hover:underline">
              Conditions Générales d'Utilisation
            </Link>{" "}
            de Vohitra.
          </span>
        </label>


        {/* CTA primaire */}
        <button
          type="submit" disabled={loading || !acceptCgu}
          className="w-full min-h-12 py-3 bg-primary text-primary-foreground rounded-lg font-semibold text-sm uppercase tracking-wider hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {loading ? "Création..." : "Créer mon compte"}
        </button>
      </form>

      <p className="text-sm text-muted-foreground mt-6 text-center">
        Déjà inscrit ? <Link to="/login" className="text-primary font-semibold hover:underline">Se connecter</Link>
      </p>
    </div>
  );
}
