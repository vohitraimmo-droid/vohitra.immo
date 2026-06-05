import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BASE_URL = "https://vohitra-imo.com";

interface SitemapEntry { path: string; lastmod?: string; changefreq?: string; priority?: string; }

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "daily", priority: "1.0" },
          { path: "/blog", changefreq: "weekly", priority: "0.8" },
          { path: "/compare", changefreq: "monthly", priority: "0.5" },
          { path: "/cgu", changefreq: "yearly", priority: "0.3" },
          { path: "/login", changefreq: "yearly", priority: "0.3" },
          { path: "/signup", changefreq: "yearly", priority: "0.3" },
        ];

        try {
          const { data: props } = await supabaseAdmin
            .from("properties")
            .select("id, updated_at")
            .eq("status", "active")
            .order("updated_at", { ascending: false })
            .limit(2000);
          for (const p of props ?? []) {
            entries.push({ path: `/property/${p.id}`, lastmod: p.updated_at, changefreq: "weekly", priority: "0.7" });
          }

          const { data: posts } = await supabaseAdmin
            .from("blog_posts")
            .select("slug, updated_at")
            .eq("published", true)
            .limit(1000);
          for (const b of posts ?? []) {
            entries.push({ path: `/blog/${b.slug}`, lastmod: b.updated_at, changefreq: "monthly", priority: "0.6" });
          }
        } catch (e) {
          console.error("[sitemap]", e);
        }

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ].filter(Boolean).join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
