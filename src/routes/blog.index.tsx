import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/blog/")({
  head: () => ({
    meta: [
      { title: "Blog — Vohitra" },
      { name: "description", content: "Conseils, guides et actualités sur l'immobilier à Madagascar." },
      { property: "og:title", content: "Blog — Vohitra" },
      { property: "og:description", content: "Conseils, guides et actualités sur l'immobilier à Madagascar." },
      { property: "og:url", content: "https://malagasy-home.lovable.app/blog" },
    ],
    links: [{ rel: "canonical", href: "https://malagasy-home.lovable.app/blog" }],
  }),
  component: BlogIndex,
});

function BlogIndex() {
  const { data, isLoading } = useQuery({
    queryKey: ["blog", "list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("id, slug, title, excerpt, cover_url, published_at")
        .eq("published", true)
        .order("published_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <h1 className="font-display text-4xl md:text-5xl italic text-primary mb-3">Blog</h1>
      <p className="text-muted-foreground mb-10">Guides et actualités immobilières à Madagascar.</p>

      {isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}
      {!isLoading && (data?.length ?? 0) === 0 && (
        <p className="text-sm text-muted-foreground">Aucun article publié pour le moment.</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {data?.map((p) => (
          <Link key={p.id} to="/blog/$slug" params={{ slug: p.slug }}
            className="group block border border-border rounded-xl overflow-hidden hover:border-primary/40 transition-colors">
            {p.cover_url && (
              <div className="aspect-[16/9] overflow-hidden bg-muted">
                <img src={p.cover_url} alt={p.title} loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              </div>
            )}
            <div className="p-5">
              <h2 className="font-display text-xl text-foreground group-hover:text-primary transition-colors">{p.title}</h2>
              {p.excerpt && <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{p.excerpt}</p>}
              {p.published_at && (
                <p className="text-xs text-muted-foreground mt-3">
                  {new Date(p.published_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
