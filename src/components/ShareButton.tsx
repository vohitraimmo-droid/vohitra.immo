import { useState } from "react";
import { Share2, Check } from "lucide-react";
import { toast } from "sonner";

type Props = {
  title: string;
  text?: string;
  url?: string;
  className?: string;
};

export function ShareButton({ title, text, url, className }: Props) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const shareUrl = url ?? (typeof window !== "undefined" ? window.location.href : "");
    const payload = { title, text: text ?? title, url: shareUrl };

    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share(payload);
        return;
      } catch (e: any) {
        if (e?.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Lien copié dans le presse-papier");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Impossible de partager");
    }
  };

  return (
    <button
      type="button"
      onClick={handleShare}
      className={
        className ??
        "inline-flex items-center gap-2 border border-border bg-background hover:bg-muted text-foreground rounded-lg px-4 py-2 text-sm font-medium transition"
      }
      aria-label="Partager"
    >
      {copied ? <Check className="size-4" /> : <Share2 className="size-4" />}
      <span>{copied ? "Copié" : "Partager"}</span>
    </button>
  );
}
