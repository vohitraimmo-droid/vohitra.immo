import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => {
    const desc = "Connectez-vous à votre compte Vohitra pour gérer vos annonces, vos favoris et contacter directement les propriétaires à Madagascar.";
    const url = "https://vohitra-imo.com/login";
    return {
      meta: [
        { title: "Connexion — Vohitra" },
        { name: "description", content: desc },
        { property: "og:title", content: "Connexion — Vohitra" },
        { property: "og:description", content: desc },
        { property: "og:url", content: url },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Connexion réussie");
    navigate({ to: "/" });
  };

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 py-12 sm:py-20">
      <header className="mb-8">
        <h1 className="font-display text-3xl sm:text-4xl italic mb-2 text-primary">Connexion</h1>
        <p className="text-muted-foreground text-sm">Accédez à votre espace Vohitra.</p>
      </header>

      <form onSubmit={onSubmit} className="bg-card border border-border rounded-2xl p-5 sm:p-6 space-y-5">
        <div>
          <label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Email</label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1.5 w-full min-h-12 px-4 py-3 bg-background border border-border rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Mot de passe</label>
            <Link to="/forgot-password" className="text-xs text-muted-foreground hover:text-primary">Oublié ?</Link>
          </div>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1.5 w-full min-h-12 px-4 py-3 bg-background border border-border rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* CTA primaire */}
        <button
          type="submit"
          disabled={loading}
          className="w-full min-h-12 py-3 bg-primary text-primary-foreground rounded-lg font-semibold text-sm uppercase tracking-wider hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {loading ? "Connexion..." : "Se connecter"}
        </button>
      </form>

      <p className="text-sm text-muted-foreground mt-6 text-center">
        Pas encore de compte ?{" "}
        <Link to="/signup" className="text-primary font-semibold hover:underline">
          Créer un compte
        </Link>
      </p>
    </div>
  );
}
