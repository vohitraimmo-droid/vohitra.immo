import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId);
  if (!data?.some((r) => r.role === "admin")) throw new Error("Accès refusé");
}

const PostInput = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().min(1).max(120).regex(/^[a-z0-9-]+$/).optional(),
  title: z.string().min(1).max(200),
  excerpt: z.string().max(500).default(""),
  content: z.string().max(50000).default(""),
  cover_url: z.string().url().nullable().optional(),
  published: z.boolean().default(false),
});

export const upsertBlogPostFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PostInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const slug = data.slug || slugify(data.title);
    const payload = {
      title: data.title,
      excerpt: data.excerpt ?? "",
      content: data.content ?? "",
      cover_url: data.cover_url ?? null,
      published: data.published,
      slug,
      author_id: context.userId,
      published_at: data.published ? new Date().toISOString() : null,
    };
    if (data.id) {
      const { error } = await supabaseAdmin.from("blog_posts").update(payload).eq("id", data.id);
      if (error) {
        console.error("upsertBlogPostFn update error:", error);
        throw new Error("Une erreur est survenue.");
      }
      return { id: data.id };
    }
    const { data: row, error } = await supabaseAdmin.from("blog_posts").insert(payload).select("id").single();
    if (error) {
      console.error("upsertBlogPostFn insert error:", error);
      throw new Error("Une erreur est survenue.");
    }
    return { id: row.id };
  });

export const deleteBlogPostFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("blog_posts").delete().eq("id", data.id);
    if (error) {
      console.error("deleteBlogPostFn error:", error);
      throw new Error("Une erreur est survenue.");
    }
    return { ok: true };
  });
