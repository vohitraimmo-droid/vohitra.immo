import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { Mail, ArrowLeft, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";

const searchSchema = z.object({
  email: z.string().optional(),
});

export const Route = createFileRoute("/signup/confirm")({
  head: () => ({
    meta: [{ title: "Vérifiez votre email — Vohitra" }],
  }),
  validateSearch: searchSchema,
  component: SignupConfirmPage,
});

function SignupConfirmPage() {
  const { email } = Route.useSearch();
  const [resending, setResending] = useState(false);

  const handleResend = async () => {
    if (!email) return;
    setResending(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
    });
    setResending(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Email de confirmation renvoyé !");
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 py-12 sm:py-20">
      <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Mail className="w-8 h-8 text-primary" />
        </div>

        <div className="space-y-2">
          <h1 className="font-display text-2xl sm:text-3xl italic text-foreground">
            Vérifiez votre email
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Un email de confirmation a été envoyé à l'adresse suivante :
          </p>
          <p className="font-semibold text-foreground break-all">
            {email ?? "votre adresse email"}
          </p>
        </div>

        <div className="bg-muted/50 border border-border rounded-lg p-4 text-sm text-muted-foreground text-left space-y-2">
          <p>
            Cliquez sur le lien contenu dans cet email pour activer votre
            compte. Sans cette étape, vous ne pourrez pas vous connecter.
          </p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>Vérifiez votre boîte de réception.</li>
            <li>Si vous ne voyez rien, regardez dans vos spams ou courriers indésirables.</li>
            <li>L'email peut mettre quelques minutes à arriver.</li>
          </ul>
          <p className="text-xs text-destructive font-medium pt-2 border-t border-border/50">
            ⚠️ Important : si votre adresse email n'est pas confirmée dans les 30 minutes, votre compte sera automatiquement supprimé et vous devrez recommencer l'inscription.
          </p>
        </div>

        {email && (
          <button
            onClick={handleResend}
            disabled={resending}
            className="inline-flex items-center gap-2 text-sm text-primary font-semibold hover:underline disabled:opacity-50"
          >
            <RotateCcw className="w-4 h-4" />
            {resending ? "Envoi en cours..." : "Renvoyer l'email de confirmation"}
          </button>
        )}

        <div className="pt-2 border-t border-border">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour à la connexion
          </Link>
        </div>
      </div>
    </div>
  );
}
