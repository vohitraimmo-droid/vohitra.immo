import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

async function loadPost(slug: string) {
  const { data, error } = await supabase
    .from("blog_posts")
    .select("id, slug, title, excerpt, content, cover_url, published_at, published")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw notFound();
  return data;
}

export const Route = createFileRoute("/blog/$slug")({
  loader: ({ params }) => loadPost(params.slug),
  head: ({ loaderData, params }) => {
    const url = `https://vohitra-imo.com/blog/${params.slug}`;
    const title = loaderData ? `${loaderData.title} — Vohitra Blog` : "Article — Vohitra";
    const fallbackDesc = "Article du blog Vohitra : conseils, actualités et guides pratiques sur l'immobilier à Madagascar.";
    const rawDesc = loaderData?.excerpt?.trim() || fallbackDesc;
    const desc = rawDesc.length < 50 ? `${rawDesc} ${fallbackDesc}`.slice(0, 160) : rawDesc.slice(0, 160);
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        ...(loaderData?.cover_url
          ? [{ property: "og:image", content: loaderData.cover_url }, { name: "twitter:image", content: loaderData.cover_url }]
          : []),
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: loaderData
        ? [{
            type: "application/ld+json",
            children: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Article",
              headline: loaderData.title,
              image: loaderData.cover_url || undefined,
              datePublished: loaderData.published_at,
            }),
          }]
        : [],
    };
  },
  notFoundComponent: () => (
    <div className="max-w-2xl mx-auto px-6 py-20 text-center">
      <h1 className="font-display text-3xl italic text-primary">Article introuvable</h1>
      <Link to="/blog" className="mt-6 inline-block text-sm text-primary underline">Retour au blog</Link>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="max-w-2xl mx-auto px-6 py-20 text-center">
      <h1 className="text-xl font-semibold">Erreur</h1>
      <p className="text-sm text-muted-foreground mt-2">{error.message}</p>
    </div>
  ),
  component: BlogPost,
});

function BlogPost() {
  const post = Route.useLoaderData();
  return (
    <article className="max-w-3xl mx-auto px-6 py-12">
      <Link to="/blog" className="text-sm text-muted-foreground hover:text-primary">← Retour au blog</Link>
      <h1 className="font-display text-4xl md:text-5xl italic text-primary mt-4">{post.title}</h1>
      {post.published_at && (
        <p className="text-sm text-muted-foreground mt-3">
          {new Date(post.published_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
        </p>
      )}
      {post.cover_url && (
        <div className="mt-8 rounded-xl overflow-hidden aspect-[16/9] bg-muted">
          <img src={post.cover_url} alt={post.title} className="w-full h-full object-cover" />
        </div>
      )}
      {post.excerpt && <p className="mt-8 text-lg text-muted-foreground italic">{post.excerpt}</p>}
      <div className="mt-8 prose prose-neutral max-w-none whitespace-pre-wrap leading-relaxed">
        {post.content}
      </div>
    </article>
  );
}
