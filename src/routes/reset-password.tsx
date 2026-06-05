import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Réinitialiser le mot de passe — Vohitra" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("Mot de passe mis à jour."); navigate({ to: "/" }); }
  };

  return (
    <div className="max-w-md mx-auto px-6 py-20">
      <h1 className="font-display text-3xl italic mb-2">Nouveau mot de passe</h1>
      <p className="text-sm text-muted-foreground mb-6">Choisissez un nouveau mot de passe.</p>
      <form onSubmit={submit} className="space-y-4 bg-card border border-border rounded-xl p-6">
        <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder="Nouveau mot de passe" className="w-full px-3 py-2 border border-border rounded-md text-sm" />
        <button type="submit" disabled={saving} className="w-full py-2.5 bg-primary text-primary-foreground rounded-md font-semibold disabled:opacity-50">
          {saving ? "Enregistrement..." : "Enregistrer"}
        </button>
      </form>
    </div>
  );
}
