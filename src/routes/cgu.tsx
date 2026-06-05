import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import DOMPurify from "isomorphic-dompurify";
import { getCguFn } from "@/lib/cgu.functions";
import { useI18n } from "@/hooks/use-i18n";


export const Route = createFileRoute("/cgu")({
  head: () => {
    const desc = "Conditions Générales d'Utilisation de Vohitra : règles d'usage, droits et obligations des propriétaires et locataires sur la plateforme.";
    const url = "https://vohitra-imo.com/cgu";
    return {
      meta: [
        { title: "CGU — Vohitra" },
        { name: "description", content: desc },
        { property: "og:title", content: "CGU — Vohitra" },
        { property: "og:description", content: desc },
        { property: "og:url", content: url },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: CguPage,
});

function CguPage() {
  const { locale } = useI18n();
  const fn = useServerFn(getCguFn);
  const { data, isLoading } = useQuery({ queryKey: ["cgu"], queryFn: () => fn() });

  const content = locale === "mg" ? (data?.content_mg ?? "") : (data?.content_fr ?? "");

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
      <h1 className="font-display text-3xl sm:text-4xl italic mb-6 text-primary">
        {locale === "mg" ? "Fitsipika fampiasana" : "Conditions Générales d'Utilisation"}
      </h1>
      <div className="bg-card border border-border rounded-2xl p-6 text-muted-foreground">
        {isLoading ? (
          <p>Chargement…</p>
        ) : content.trim() ? (
          <div className="prose prose-sm max-w-none text-muted-foreground" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content.replace(/\n/g, "<br/>"), { ALLOWED_TAGS: ["p","b","i","em","strong","br","ul","ol","li","h2","h3","h4","a","blockquote"], ALLOWED_ATTR: ["href","target","rel"] }) }} />
        ) : (
          <p>
            {locale === "mg"
              ? "Ny fitsipika fampiasana dia havoaka tsy ho ela."
              : "Les Conditions Générales d'Utilisation seront publiées prochainement."}
          </p>
        )}
      </div>
    </div>
  );
}
