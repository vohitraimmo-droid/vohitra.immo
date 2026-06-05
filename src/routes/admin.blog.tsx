import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { upsertBlogPostFn, deleteBlogPostFn } from "@/lib/blog.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/admin/blog")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
    if (!roles?.some((r) => r.role === "admin")) throw redirect({ to: "/" });
  },
  component: AdminBlog,
});

type Post = {
  id: string; slug: string; title: string; excerpt: string; content: string;
  cover_url: string | null; published: boolean; published_at: string | null;
};

function AdminBlog() {
  const qc = useQueryClient();
  const upsert = useServerFn(upsertBlogPostFn);
  const del = useServerFn(deleteBlogPostFn);
  const [editing, setEditing] = useState<Partial<Post> | null>(null);

  const { data: posts } = useQuery({
    queryKey: ["admin-blog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("id, slug, title, excerpt, content, cover_url, published, published_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Post[];
    },
  });

  const saveMut = useMutation({
    mutationFn: async (p: Partial<Post>) => upsert({ data: {
      id: p.id, slug: p.slug || undefined, title: p.title!, excerpt: p.excerpt ?? "",
      content: p.content ?? "", cover_url: p.cover_url || null, published: !!p.published,
    } }),
    onSuccess: () => { toast.success("Article enregistré"); setEditing(null); qc.invalidateQueries({ queryKey: ["admin-blog"] }); qc.invalidateQueries({ queryKey: ["blog"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Supprimé"); qc.invalidateQueries({ queryKey: ["admin-blog"] }); qc.invalidateQueries({ queryKey: ["blog"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl italic text-primary">Blog — Administration</h1>
          <p className="text-sm text-muted-foreground mt-1">Créez et publiez les articles du blog.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/dashboard/admin" className="text-sm text-muted-foreground hover:text-primary">← Admin</Link>
          <Button onClick={() => setEditing({ published: false })}>Nouvel article</Button>
        </div>
      </div>

      {editing && (
        <div className="border border-border rounded-lg p-5 mb-8 space-y-4 bg-card">
          <h2 className="font-semibold">{editing.id ? "Modifier" : "Nouvel article"}</h2>
          <div><Label>Titre</Label><Input value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></div>
          <div><Label>Slug (optionnel)</Label><Input placeholder="auto-généré depuis le titre" value={editing.slug ?? ""} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} /></div>
          <div><Label>Image de couverture (URL)</Label><Input value={editing.cover_url ?? ""} onChange={(e) => setEditing({ ...editing, cover_url: e.target.value })} /></div>
          <div><Label>Extrait</Label><Textarea rows={2} value={editing.excerpt ?? ""} onChange={(e) => setEditing({ ...editing, excerpt: e.target.value })} /></div>
          <div><Label>Contenu</Label><Textarea rows={12} value={editing.content ?? ""} onChange={(e) => setEditing({ ...editing, content: e.target.value })} /></div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!editing.published} onChange={(e) => setEditing({ ...editing, published: e.target.checked })} />
            Publié
          </label>
          <div className="flex gap-2">
            <Button disabled={!editing.title || saveMut.isPending} onClick={() => saveMut.mutate(editing)}>
              {saveMut.isPending ? "Enregistrement…" : "Enregistrer"}
            </Button>
            <Button variant="outline" onClick={() => setEditing(null)}>Annuler</Button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {posts?.map((p) => (
          <div key={p.id} className="flex items-center justify-between border border-border rounded-lg p-4">
            <div className="min-w-0">
              <p className="font-medium truncate">{p.title}</p>
              <p className="text-xs text-muted-foreground">/{p.slug} · {p.published ? "Publié" : "Brouillon"}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(p)}>Modifier</Button>
              <Button variant="destructive" size="sm" onClick={() => { if (confirm("Supprimer ?")) delMut.mutate(p.id); }}>Supprimer</Button>
            </div>
          </div>
        ))}
        {!posts?.length && <p className="text-sm text-muted-foreground">Aucun article.</p>}
      </div>
    </div>
  );
}
