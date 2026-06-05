import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { PropertyCard, PropertyCardSkeleton, type PropertyCardData } from "@/components/PropertyCard";
import { useRealtimeInvalidate } from "@/hooks/use-realtime-invalidate";
import { useRecentlyViewed } from "@/hooks/use-recently-viewed";
import { SlidersHorizontal, X } from "lucide-react";

const PAGE_SIZE = 12;

const searchSchema = z.object({
  city: fallback(z.string(), "").default(""),
  type: fallback(z.enum(["", "appartement", "maison", "local_commercial", "terrain"]), "").default(""),
  listing: fallback(z.enum(["", "rent", "sale"]), "").default(""),
  q: fallback(z.string(), "").default(""),
  pmin: fallback(z.number().int().nonnegative(), 0).default(0),
  pmax: fallback(z.number().int().nonnegative(), 0).default(0),
  smin: fallback(z.number().int().nonnegative(), 0).default(0),
  rooms: fallback(z.number().int().nonnegative(), 0).default(0),
});

export const Route = createFileRoute("/")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Vohitra — Annonces immobilières à Madagascar" },
      { name: "description", content: "Découvrez des appartements, maisons, locaux et terrains à louer ou vendre à Madagascar. Annonces vérifiées sur site." },
      { property: "og:url", content: "https://vohitra-imo.com/" },
    ],
    links: [{ rel: "canonical", href: "https://vohitra-imo.com/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Vohitra",
          url: "https://vohitra-imo.com/",
          potentialAction: {
            "@type": "SearchAction",
            target: "https://vohitra-imo.com/?q={search_term_string}",
            "query-input": "required name=search_term_string",
          },
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Vohitra",
          url: "https://vohitra-imo.com/",
          description: "Plateforme immobilière locale à Madagascar avec annonces vérifiées sur site.",
          areaServed: "MG",
        }),
      },
    ],
  }),
  component: HomePage,
});

const TYPES = [
  { value: "", label: "Tous types" },
  { value: "appartement", label: "Appartement" },
  { value: "maison", label: "Maison" },
  { value: "local_commercial", label: "Local commercial" },
  { value: "terrain", label: "Terrain" },
] as const;

const LISTINGS = [
  { value: "", label: "Louer & vendre" },
  { value: "rent", label: "À louer" },
  { value: "sale", label: "À vendre" },
] as const;

function HomePage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/" });
  const { ids: recentIds } = useRecentlyViewed();
  const [recent, setRecent] = useState<PropertyCardData[]>([]);
  const [advancedOpen, setAdvancedOpen] = useState(
    search.pmin > 0 || search.smin > 0 || search.rooms > 0 || search.listing !== ""
  );

  // Local inputs mirror URL state; commit to URL on debounce
  const [city, setCity] = useState(search.city);
  const [type, setType] = useState<string>(search.type);
  const [listing, setListing] = useState<string>(search.listing);
  const [q, setQ] = useState(search.q);
  const [pmin, setPmin] = useState(search.pmin ? String(search.pmin) : "");
  const [pmax, setPmax] = useState(search.pmax ? String(search.pmax) : "");
  const [smin, setSmin] = useState(search.smin ? String(search.smin) : "");
  const [rooms, setRooms] = useState(search.rooms ? String(search.rooms) : "");

  useEffect(() => {
    const t = setTimeout(() => {
      navigate({
        search: {
          city: city.trim(),
          type: type as any,
          listing: listing as any,
          q: q.trim(),
          pmin: Number(pmin.replace(/\s/g, "")) || 0,
          pmax: Number(pmax.replace(/\s/g, "")) || 0,
          smin: Number(smin) || 0,
          rooms: Number(rooms) || 0,
        },
        replace: true,
      });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, type, listing, q, pmin, pmax, smin, rooms]);

  const queryKey = useMemo(() => ["properties", "home", search] as const, [search]);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey,
    initialPageParam: 0,
    staleTime: 60_000,
    queryFn: async ({ pageParam }) => {
      const from = (pageParam as number) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      let qy = supabase
        .from("properties")
        .select("id, title, city, surface, price, rooms, property_type, listing_type, is_premium, premium_until, is_verified, property_photos(url, display_order)")
        .eq("status", "active")
        // 1) Premium d'abord (boost payant) — visibilité maximale
        .order("is_premium", { ascending: false })
        // 2) Parmi les premium : les plus récemment boostés en tête
        .order("premium_until", { ascending: false, nullsFirst: false })
        // 3) Parmi les non-premium : ordre pseudo-aléatoire stable (UUID v4)
        //    pas d'avantage à l'ancienneté ni à la date de publication
        .order("id", { ascending: false })
        .range(from, to);

      if (search.type) qy = qy.eq("property_type", search.type as any);
      if (search.listing) qy = qy.eq("listing_type", search.listing as any);
      if (search.city) qy = qy.ilike("city", `%${search.city}%`);
      if (search.pmin > 0) qy = qy.gte("price", search.pmin);
      if (search.pmax > 0) qy = qy.lte("price", search.pmax);
      if (search.smin > 0) qy = qy.gte("surface", search.smin);
      if (search.rooms > 0) qy = qy.gte("rooms", search.rooms);
      if (search.q) qy = qy.ilike("title", `%${search.q}%`);

      const { data, error } = await qy;
      if (error) throw error;
      const rows: PropertyCardData[] = (data ?? []).map((p: any) => {
        const photos = (p.property_photos ?? []).sort((a: any, b: any) => a.display_order - b.display_order);
        return { ...p, cover_url: photos[0]?.url ?? null };
      });
      return { rows, nextPage: rows.length < PAGE_SIZE ? null : (pageParam as number) + 1 };
    },
    getNextPageParam: (last) => last.nextPage,
  });

  useRealtimeInvalidate([
    { table: "properties", queryKeys: [["properties", "home"]] },
    { table: "property_photos", queryKeys: [["properties", "home"]] },
  ], "home");

  const items = useMemo(() => data?.pages.flatMap((p) => p.rows) ?? [], [data]);

  // Recently viewed
  useEffect(() => {
    if (recentIds.length === 0) { setRecent([]); return; }
    (async () => {
      const { data } = await supabase
        .from("properties")
        .select("id, title, city, surface, price, rooms, property_type, listing_type, is_premium, is_verified, property_photos(url, display_order)")
        .in("id", recentIds.slice(0, 6))
        .eq("status", "active");
      const mapped: PropertyCardData[] = (data ?? []).map((p: any) => {
        const photos = (p.property_photos ?? []).sort((a: any, b: any) => a.display_order - b.display_order);
        return { ...p, cover_url: photos[0]?.url ?? null };
      });
      mapped.sort((a, b) => recentIds.indexOf(a.id) - recentIds.indexOf(b.id));
      setRecent(mapped);
    })();
  }, [recentIds.join(",")]);

  // Sentinel for infinite scroll
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    }, { rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const reset = () => {
    setCity(""); setType(""); setListing(""); setQ("");
    setPmin(""); setPmax(""); setSmin(""); setRooms("");
  };

  const hasFilters =
    city || type || listing || q || pmin || pmax || smin || rooms;

  return (
    <>
      <section className="max-w-7xl mx-auto px-4 md:px-6 pt-8 md:pt-16 pb-8 md:pb-12 text-center animate-fade-up">
        <h1 className="font-display text-3xl sm:text-4xl md:text-6xl lg:text-7xl mb-4 md:mb-6 text-balance leading-[1.1]">
          Trouvez votre <span className="italic">foyer</span> au cœur de Madagascar
        </h1>
        <p className="text-muted-foreground max-w-2xl mx-auto text-sm md:text-lg mb-8 md:mb-12 text-pretty px-2">
          La première plateforme immobilière locale avec vérification sur site.
        </p>

        <div className="max-w-4xl mx-auto bg-card p-2 rounded-2xl shadow-xl shadow-primary/5 border border-border flex flex-col md:flex-row gap-1 md:gap-2 text-left">
          <label className="flex-1 flex flex-col items-start px-4 py-2 md:border-r border-border min-h-12 justify-center">
            <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-1">Ville</span>
            <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Antananarivo, Tamatave..." className="w-full text-base md:text-sm font-medium focus:outline-none bg-transparent" />
          </label>
          <label className="flex-1 flex flex-col items-start px-4 py-2 md:border-r border-border min-h-12 justify-center">
            <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-1">Type de bien</span>
            <select value={type} onChange={(e) => setType(e.target.value)} className="w-full text-base md:text-sm font-medium focus:outline-none bg-transparent text-foreground">
              {TYPES.map((t) => <option key={t.value} value={t.value} className="bg-background text-foreground">{t.label}</option>)}
            </select>
          </label>
          <label className="flex-1 flex flex-col items-start px-4 py-2 md:border-r border-border min-h-12 justify-center">
            <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-1">Budget Max (Ar)</span>
            <input type="text" inputMode="numeric" value={pmax} onChange={(e) => setPmax(e.target.value.replace(/[^\d\s]/g, ""))} placeholder="5 000 000" className="w-full text-base md:text-sm font-medium focus:outline-none bg-transparent" />
          </label>
          <label className="flex-1 flex flex-col items-start px-4 py-2 min-h-12 justify-center">
            <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-1">Recherche</span>
            <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Mot-clé..." className="w-full text-base md:text-sm font-medium focus:outline-none bg-transparent" />
          </label>
        </div>

        <div className="max-w-4xl mx-auto mt-3 flex items-center justify-between text-xs">
          <button
            onClick={() => setAdvancedOpen((v) => !v)}
            aria-expanded={advancedOpen}
            className="flex items-center gap-2 px-4 min-h-10 rounded-full hover:bg-muted text-foreground font-medium"
          >
            <SlidersHorizontal className="size-3.5" />
            Filtres avancés
          </button>
          {hasFilters && (
            <button onClick={reset} className="flex items-center gap-1 px-4 min-h-10 rounded-full text-muted-foreground hover:text-destructive hover:bg-muted">
              <X className="size-3.5" /> Réinitialiser
            </button>
          )}
        </div>

        {advancedOpen && (
          <div className="max-w-4xl mx-auto mt-3 bg-card border border-border rounded-2xl p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-left animate-fade-up">
            <div className="flex flex-col">
              <label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-1">Transaction</label>
              <select value={listing} onChange={(e) => setListing(e.target.value)} className="bg-background text-foreground border border-input rounded-md px-2 py-1.5 text-sm">
                {LISTINGS.map((l) => <option key={l.value} value={l.value} className="bg-background text-foreground">{l.label}</option>)}
              </select>
            </div>
            <div className="flex flex-col">
              <label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-1">Prix min (Ar)</label>
              <input type="text" value={pmin} onChange={(e) => setPmin(e.target.value.replace(/[^\d\s]/g, ""))} placeholder="0" className="bg-background border border-input rounded-md px-2 py-1.5 text-sm" />
            </div>
            <div className="flex flex-col">
              <label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-1">Surface min (m²)</label>
              <input type="number" min="0" value={smin} onChange={(e) => setSmin(e.target.value)} placeholder="0" className="bg-background border border-input rounded-md px-2 py-1.5 text-sm" />
            </div>
            <div className="flex flex-col">
              <label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-1">Pièces min</label>
              <input type="number" min="0" value={rooms} onChange={(e) => setRooms(e.target.value)} placeholder="0" className="bg-background border border-input rounded-md px-2 py-1.5 text-sm" />
            </div>
          </div>
        )}
      </section>

      {recent.length > 0 && !hasFilters && (
        <section className="max-w-7xl mx-auto px-4 md:px-6 pb-10">
          <div className="text-center mb-6">
            <h2 className="text-lg md:text-xl font-display font-bold italic">Vus récemment</h2>
            <p className="text-xs text-muted-foreground mt-1">Reprenez où vous vous étiez arrêté</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
            {recent.map((p, i) => (
              <PropertyCard key={p.id} p={p} delay={(i % 6) * 40} />
            ))}
          </div>
        </section>
      )}

      <section className="max-w-7xl mx-auto px-4 md:px-6 pb-16 md:pb-24">
        <div className="text-center mb-8 md:mb-12">
          <h2 className="text-2xl md:text-3xl font-display font-bold italic">Annonces récentes</h2>
          <p className="text-xs md:text-sm text-muted-foreground mt-2">
            {isLoading ? "Chargement des annonces…" : `${items.length} bien${items.length > 1 ? "s" : ""} disponible${items.length > 1 ? "s" : ""}`}
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {Array.from({ length: 6 }).map((_, i) => <PropertyCardSkeleton key={i} />)}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            Aucune annonce ne correspond à vos critères pour le moment.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
              {items.map((p, i) => (
                <PropertyCard key={p.id} p={p} delay={(i % 6) * 60} priority={i < 3} />
              ))}
            </div>
            <div ref={sentinelRef} className="h-10" />
            {isFetchingNextPage && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 mt-6">
                {Array.from({ length: 3 }).map((_, i) => <PropertyCardSkeleton key={i} />)}
              </div>
            )}
            {!hasNextPage && items.length > 0 && (
              <p className="text-center text-xs text-muted-foreground py-8">Vous avez atteint la fin.</p>
            )}
          </>
        )}
      </section>
    </>
  );
}
