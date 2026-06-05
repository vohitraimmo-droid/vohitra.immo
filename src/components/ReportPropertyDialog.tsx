import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { reportPropertyFn } from "@/lib/reports.functions";

const REASONS = [
  "Annonce frauduleuse",
  "Contenu inapproprié",
  "Photos trompeuses",
  "Prix manifestement incorrect",
  "Bien indisponible / déjà loué",
  "Coordonnées dans la description",
  "Autre",
];

export function ReportPropertyDialog({ propertyId, onClose }: { propertyId: string; onClose: () => void }) {
  const fn = useServerFn(reportPropertyFn);
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await fn({ data: { propertyId, reason, details: details.trim() || undefined } });
      toast.success("Signalement envoyé. Merci, nos modérateurs vont vérifier.");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors du signalement");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="bg-card border border-border rounded-2xl p-6 max-w-md w-full space-y-4"
      >
        <h2 className="font-display text-2xl italic">Signaler cette annonce</h2>
        <p className="text-sm text-muted-foreground">
          Aidez-nous à garder Vohitra fiable. Les modérateurs examinent chaque signalement.
        </p>
        <div>
          <label className="block text-xs font-medium mb-1.5">Motif</label>
          <select value={reason} onChange={(e) => setReason(e.target.value)}
            className="w-full px-3 py-2 rounded border border-border bg-background text-sm">
            {REASONS.map((r) => <option key={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5">Détails (optionnel)</label>
          <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={4} maxLength={1000}
            className="w-full px-3 py-2 rounded border border-border bg-background text-sm"
            placeholder="Expliquez brièvement le problème…" />
        </div>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded border border-border text-sm">Annuler</button>
          <button type="submit" disabled={busy}
            className="px-4 py-2 rounded bg-destructive text-destructive-foreground text-sm font-semibold disabled:opacity-60">
            {busy ? "Envoi…" : "Envoyer le signalement"}
          </button>
        </div>
      </form>
    </div>
  );
}
