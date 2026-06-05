create table public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  excerpt text not null default '',
  content text not null default '',
  cover_url text,
  published boolean not null default false,
  published_at timestamptz,
  author_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index blog_posts_published_idx on public.blog_posts (published, published_at desc);

alter table public.blog_posts enable row level security;

create policy "Blog: public read published"
  on public.blog_posts for select
  using (published = true or public.is_admin(auth.uid()));

create policy "Blog: admin insert"
  on public.blog_posts for insert
  with check (public.is_admin(auth.uid()));

create policy "Blog: admin update"
  on public.blog_posts for update
  using (public.is_admin(auth.uid()));

create policy "Blog: admin delete"
  on public.blog_posts for delete
  using (public.is_admin(auth.uid()));

create trigger blog_posts_updated_at
  before update on public.blog_posts
  for each row execute function public.set_updated_at();