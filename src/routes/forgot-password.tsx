import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Mot de passe oublié — Vohitra" }] }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSending(false);
    if (error) toast.error(error.message);
    else { toast.success("Email envoyé !"); setSent(true); }
  };

  return (
    <div className="max-w-md mx-auto px-6 py-20">
      <h1 className="font-display text-3xl italic mb-2">Mot de passe oublié</h1>
      <p className="text-sm text-muted-foreground mb-6">Recevez un lien pour réinitialiser votre mot de passe.</p>
      {sent ? (
        <div className="bg-card border border-border rounded-xl p-6 text-sm">
          Un email a été envoyé à <strong>{email}</strong> avec un lien de réinitialisation.
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4 bg-card border border-border rounded-xl p-6">
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="Email" className="w-full px-3 py-2 border border-border rounded-md text-sm" />
          <button type="submit" disabled={sending} className="w-full py-2.5 bg-primary text-primary-foreground rounded-md font-semibold disabled:opacity-50">
            {sending ? "Envoi..." : "Envoyer le lien"}
          </button>
        </form>
      )}
      <Link to="/login" className="text-sm text-primary mt-4 inline-block">← Retour à la connexion</Link>
    </div>
  );
}
