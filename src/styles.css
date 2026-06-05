import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatAr, propertyTypeLabel } from "@/lib/format";
import { hero, heroSrcSet, thumb, thumbSrcSet } from "@/lib/images";
import { toast } from "sonner";
import { X, ChevronLeft, ChevronRight, Flag, MessageSquare } from "lucide-react";
import { ReportPropertyDialog } from "@/components/ReportPropertyDialog";
import { OwnerReviews } from "@/components/OwnerReviews";
import { ShareButton } from "@/components/ShareButton";
import { trackRecentlyViewed } from "@/hooks/use-recently-viewed";

async function loadPropertyMeta(id: string) {
  const [{ data: p }, { data: ph }] = await Promise.all([
    supabase
      .from("properties")
      .select("id, title, description, property_type, listing_type, price, address, city, surface, rooms")
      .eq("id", id)
      .eq("status", "active")
      .maybeSingle(),
    supabase
      .from("property_photos")
      .select("url")
      .eq("property_id", id)
      .order("display_order")
      .limit(1),
  ]);
  if (!p) return null;
  return { ...p, cover_url: ph?.[0]?.url ?? null };
}

export const Route = createFileRoute("/property/$id/")({
  loader: ({ params }) => loadPropertyMeta(params.id),
  head: ({ loaderData, params }) => {
    const url = `https://vohitra-imo.com/property/${params.id}`;
    if (!loaderData) {
      return {
        meta: [
          { title: "Annonce — Vohitra" },
          { name: "description", content: "Annonce immobilière sur Vohitra, plateforme locale à Madagascar." },
          { property: "og:url", content: url },
        ],
        links: [{ rel: "canonical", href: url }],
      };
    }
    const p = loaderData;
    const isSale = p.listing_type === "sale";
    const priceFmt = new Intl.NumberFormat("fr-FR").format(Number(p.price));
    const titleTag = `${p.title} — ${isSale ? "À vendre" : "À louer"} à ${p.city} | Vohitra`;
    const baseDesc = `${p.title} à ${p.city} — ${p.surface} m²${p.rooms ? `, ${p.rooms} pièces` : ""}. ${isSale ? "Prix d'achat" : "Loyer mensuel"} : ${priceFmt} Ar. ${(p.description ?? "").trim()}`.replace(/\s+/g, " ").trim();
    const desc = baseDesc.length > 160 ? baseDesc.slice(0, 157) + "…" : baseDesc.length < 50 ? `${baseDesc} Annonce vérifiée sur Vohitra, plateforme immobilière à Madagascar.`.slice(0, 160) : baseDesc;
    return {
      meta: [
        { title: titleTag },
        { name: "description", content: desc },
        { property: "og:title", content: titleTag },
        { property: "og:description", content: desc },
        { property: "og:type", content: "product" },
        { property: "og:url", content: url },
        ...(p.cover_url
          ? [
              { property: "og:image", content: p.cover_url },
              { name: "twitter:image", content: p.cover_url },
              { name: "twitter:card", content: "summary_large_image" },
            ]
          : []),
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": isSale ? "Product" : "Accommodation",
            name: p.title,
            description: (p.description ?? "").slice(0, 500) || titleTag,
            image: p.cover_url || undefined,
            url,
            address: {
              "@type": "PostalAddress",
              streetAddress: p.address,
              addressLocality: p.city,
              addressCountry: "MG",
            },
            ...(isSale
              ? {
                  offers: {
                    "@type": "Offer",
                    price: String(p.price),
                    priceCurrency: "MGA",
                    availability: "https://schema.org/InStock",
                  },
                }
              : {
                  floorSize: { "@type": "QuantitativeValue", value: p.surface, unitCode: "MTK" },
                  numberOfRooms: p.rooms ?? undefined,
                }),
          }),
        },
      ],
    };
  },
  component: PropertyPage,
});

interface OwnerContact { full_name: string; phone: string | null; email: string; }
type OwnerRes = { unlocked: true; owner: OwnerContact; visit_phone: string | null } | { unlocked: false; owner: null; visit_phone: null };

function PropertyPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [property, setProperty] = useState<any | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [unlocked, setUnlocked] = useState(false);
  const [owner, setOwner] = useState<OwnerContact | null>(null);
  const [visitPhone, setVisitPhone] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [tokensEnabled, setTokensEnabled] = useState(true);

  const load = async () => {
    setLoading(true);
    const [{ data: p }, { data: ph }, { data: s }] = await Promise.all([
      supabase.from("properties").select("id, owner_id, title, description, property_type, listing_type, price, address, postal_code, city, rooms, surface, status, is_premium, premium_until, is_verified, created_at, updated_at").eq("id", id).single(),
      supabase.from("property_photos").select("url, display_order").eq("property_id", id).order("display_order"),
      supabase.from("site_settings").select("unlock_tokens_enabled").eq("id", 1).maybeSingle(),
    ]);
    if (!p) { setLoading(false); return; }
    setProperty(p);
    setPhotos((ph ?? []).map((x) => x.url));
    setTokensEnabled((s as { unlock_tokens_enabled?: boolean } | null)?.unlock_tokens_enabled !== false);
    setLoading(false);

    if (user) {
      void (async () => {
        try {
          const { getOwnerContactFn } = await import("@/lib/tokens.functions");
          const [resSettled, favRes] = await Promise.all([
            getOwnerContactFn({ data: { propertyId: id } }) as Promise<OwnerRes>,
            supabase.from("favorites").select("id").eq("user_id", user.id).eq("property_id", id).maybeSingle(),
          ]);
          if (resSettled.unlocked && resSettled.owner) {
            setUnlocked(true);
            setOwner(resSettled.owner);
            setVisitPhone(resSettled.visit_phone);
          } else {
            setUnlocked(false); setOwner(null); setVisitPhone(null);
          }
          setIsFavorite(!!favRes.data);
        } catch {
          setUnlocked(false); setOwner(null); setVisitPhone(null);
        }
      })();
    }
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [id, user?.id]);
  useEffect(() => { trackRecentlyViewed(id); }, [id]);

  useEffect(() => {
    if (!property) return;
    if (user && property.owner_id === user.id) return;
    void supabase.from("property_views").insert({
      property_id: id, viewer_id: user?.id ?? null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [property?.id, user?.id]);

  useEffect(() => {
    const ch = supabase.channel(`prop-${id}`)
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "properties", filter: `id=eq.${id}` }, () => { void load(); })
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "property_photos", filter: `property_id=eq.${id}` }, () => { void load(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const closeLightbox = useCallback(() => setLightboxIdx(null), []);
  const prev = useCallback(() => setLightboxIdx((i) => (i === null ? null : (i - 1 + photos.length) % photos.length)), [photos.length]);
  const next = useCallback(() => setLightboxIdx((i) => (i === null ? null : (i + 1) % photos.length)), [photos.length]);

  useEffect(() => {
    if (lightboxIdx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [lightboxIdx, closeLightbox, prev, next]);

  const toggleFavorite = async () => {
    if (!user) { navigate({ to: "/login" }); return; }
    if (isFavorite) {
      await supabase.from("favorites").delete().eq("user_id", user.id).eq("property_id", id);
      setIsFavorite(false); toast.success("Retiré des favoris");
    } else {
      await supabase.from("favorites").insert({ user_id: user.id, property_id: id });
      setIsFavorite(true); toast.success("Ajouté aux favoris");
    }
  };

  const unlockContact = async () => {
    if (!user) { navigate({ to: "/login" }); return; }
    setUnlocking(true);
    try {
      const { unlockContactFn } = await import("@/lib/tokens.functions");
      await unlockContactFn({ data: { propertyId: id } });
      toast.success("Coordonnées débloquées !");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur lors du déblocage");
    } finally {
      setUnlocking(false);
    }
  };

  if (loading) return <div className="max-w-7xl mx-auto px-6 py-20 text-center text-muted-foreground">Chargement...</div>;
  if (!property) return <div className="max-w-7xl mx-auto px-6 py-20 text-center">Annonce introuvable.</div>;

  const isSale = property.listing_type === "sale";
  const priceSuffix = isSale ? "prix d'achat" : "par mois";

  return (
    <article className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 pb-28 lg:pb-12">
      <Link to="/" className="text-sm text-muted-foreground hover:text-primary mb-6 inline-block">
        ← Retour aux annonces
      </Link>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          {photos.length > 0 ? (
            <>
              <button type="button" onClick={() => setLightboxIdx(0)} className="block w-full group relative overflow-hidden rounded-2xl mb-4">
                <img src={hero(photos[0])} srcSet={heroSrcSet(photos[0])} sizes="(min-width: 1024px) 900px, 100vw" alt={property.title} width={1400} height={875} fetchPriority="high" decoding="async" className="w-full aspect-[16/10] object-cover group-hover:scale-[1.02] transition-transform" />
                <span className="absolute bottom-3 right-3 bg-black/60 text-white text-xs px-2.5 py-1 rounded">Voir en grand</span>
              </button>
              {photos.length > 1 && (
                <div className="grid grid-cols-4 gap-3">
                  {photos.slice(1, 5).map((url, i) => (
                    <button type="button" key={i} onClick={() => setLightboxIdx(i + 1)} className="block">
                      <img src={thumb(url)} srcSet={thumbSrcSet(url)} sizes="(min-width: 1024px) 220px, 25vw" alt={`Photo ${i + 2}`} width={400} height={400} loading="lazy" decoding="async" className="w-full aspect-square object-cover rounded-lg hover:opacity-90 transition-opacity" />
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="w-full aspect-[16/10] bg-muted rounded-2xl grid place-items-center text-muted-foreground">
              Aucune photo
            </div>
          )}

          <div className="mt-8">
            <div className="flex flex-wrap gap-2 mb-4">
              <span className={`text-xs font-bold px-3 py-1 rounded-md uppercase tracking-wider ${isSale ? "bg-foreground text-background" : "bg-primary text-primary-foreground"}`}>
                {isSale ? "À vendre" : "À louer"}
              </span>
              {property.is_premium && (
                <span
                  style={{ backgroundColor: "oklch(0.78 0.16 75)", color: "oklch(0.20 0.015 40)" }}
                  className="text-xs font-bold px-3 py-1 rounded-md uppercase tracking-wider"
                >
                  Premium
                </span>
              )}
              {property.is_verified && (
                <span
                  style={{ backgroundColor: "oklch(0.50 0.10 165)", color: "oklch(0.985 0.005 60)" }}
                  className="text-xs font-bold px-3 py-1 rounded-md uppercase tracking-wider flex items-center gap-1"
                >
                  ✓ Vérifié sur site
                </span>
              )}
              <span className="bg-muted text-foreground text-xs font-bold px-3 py-1 rounded-md uppercase tracking-wider">
                {propertyTypeLabel(property.property_type)}
              </span>
            </div>
            <h1 className="font-display text-4xl md:text-5xl italic mb-2">{property.title}</h1>
            <p className="text-muted-foreground mb-6">
              {property.address}, {property.city} {property.postal_code ?? ""}
            </p>
            <div className="grid grid-cols-3 gap-4 mb-8 max-w-md">
              <div className="p-4 bg-card rounded-lg border border-border">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Surface</div>
                <div className="font-mono font-semibold text-lg">{property.surface} m²</div>
              </div>
              {property.rooms && (
                <div className="p-4 bg-card rounded-lg border border-border">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Pièces</div>
                  <div className="font-mono font-semibold text-lg">{property.rooms}</div>
                </div>
              )}
              <div className="p-4 bg-card rounded-lg border border-border">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{isSale ? "Prix achat" : "Loyer / mois"}</div>
                <div className="font-mono font-semibold text-sm text-primary">{formatAr(property.price)}</div>
              </div>
            </div>
            <h2 className="font-display text-2xl italic mb-3">Description</h2>
            <p className="text-foreground/80 whitespace-pre-line leading-relaxed">
              {property.description || "Aucune description fournie."}
            </p>
          </div>
        </div>

        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="bg-card border border-border rounded-2xl p-6 shadow-lg">
            <div className="pb-5 border-b border-border">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">{isSale ? "Prix d'achat" : "Loyer mensuel"}</div>
              <div className="font-mono font-semibold text-3xl text-primary leading-none mb-1">{formatAr(property.price)}</div>
              <div className="text-xs text-muted-foreground">{priceSuffix}</div>
              {property.is_verified && (
                <div
                  style={{ backgroundColor: "oklch(0.50 0.10 165 / 0.12)", color: "oklch(0.50 0.10 165)" }}
                  className="mt-3 text-xs font-semibold px-3 py-1.5 rounded-md flex items-center gap-1.5 w-fit"
                >
                  ✓ Annonce vérifiée sur site par notre équipe
                </div>
              )}
            </div>

            <div className="py-5 border-b border-border">
              <h3 className="font-display text-lg italic mb-3">Contacter le propriétaire</h3>
              {unlocked && owner ? (
                <div className="space-y-2 text-sm">
                  <div><span className="text-muted-foreground">Nom : </span><span className="font-medium">{owner.full_name || "Non renseigné"}</span></div>
                  <div><span className="text-muted-foreground">Tél. : </span><a href={`tel:${visitPhone ?? ""}`} className="font-mono text-primary font-medium">{visitPhone ?? "—"}</a></div>
                  <div><span className="text-muted-foreground">Email : </span><span className="font-mono text-sm break-all">{owner.email}</span></div>
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground mb-4">
                    Coordonnées masquées. Débloquez le contact du propriétaire.
                  </p>
                  <button
                    onClick={unlockContact}
                    disabled={unlocking}
                    className="w-full min-h-12 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 text-sm uppercase tracking-wider transition-opacity"
                  >
                    {unlocking ? "Déblocage..." : !user ? "Se connecter pour débloquer" : "Débloquer le contact du propriétaire"}
                  </button>
                </>
              )}
            </div>

            <div className="py-5 border-b border-border space-y-3">
              <Link to="/visits/book/$propertyId" params={{ propertyId: id }} className="w-full min-h-11 inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium rounded-lg border border-border hover:bg-muted transition-colors">
                Réserver une visite
              </Link>
              {user && user.id !== property.owner_id && (
                <Link
                  to="/messages/$propertyId/$otherId"
                  params={{ propertyId: id, otherId: property.owner_id }}
                  className="w-full min-h-11 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border border-border hover:bg-muted transition-colors"
                >
                  <MessageSquare className="size-4" /> Envoyer un message
                </Link>
              )}
              <button onClick={toggleFavorite} className="w-full min-h-11 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border border-border hover:bg-muted transition-colors">
                {isFavorite ? "♥ Retirer des favoris" : "♡ Ajouter aux favoris"}
              </button>
            </div>

            <div className="pt-5 flex flex-col gap-2">
              <ShareButton
                title={property.title}
                text={`${property.title} — ${property.city} · ${formatAr(property.price)}`}
                className="w-full inline-flex items-center justify-center gap-2 py-2 text-sm rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              />
              <button
                onClick={() => { if (!user) { navigate({ to: "/login" }); return; } setReportOpen(true); }}
                className="w-full inline-flex items-center justify-center gap-1.5 py-2 text-xs rounded-md text-muted-foreground hover:text-destructive transition-colors"
              >
                <Flag className="size-3.5" /> Signaler cette annonce
              </button>
            </div>
          </div>
          <div className="lg:hidden">
            <OwnerReviews ownerId={property.owner_id} propertyId={id} />
          </div>
        </aside>
      </div>

      <div className="hidden lg:block">
        <OwnerReviews ownerId={property.owner_id} propertyId={id} />
      </div>

      {lightboxIdx !== null && photos[lightboxIdx] && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
          onClick={closeLightbox}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); closeLightbox(); }}
            className="absolute top-4 right-4 text-white/90 hover:text-white p-2 rounded-full bg-white/10 hover:bg-white/20"
            aria-label="Fermer"
          >
            <X className="size-6" />
          </button>
          {photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); prev(); }}
                className="absolute left-2 md:left-6 text-white/90 hover:text-white p-3 rounded-full bg-white/10 hover:bg-white/20"
                aria-label="Précédente"
              >
                <ChevronLeft className="size-6" />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); next(); }}
                className="absolute right-2 md:right-6 text-white/90 hover:text-white p-3 rounded-full bg-white/10 hover:bg-white/20"
                aria-label="Suivante"
              >
                <ChevronRight className="size-6" />
              </button>
            </>
          )}
          <img
            src={photos[lightboxIdx]}
            alt={`Photo ${lightboxIdx + 1}`}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => {
              (e.currentTarget as any)._tx = e.touches[0].clientX;
            }}
            onTouchEnd={(e) => {
              const start = (e.currentTarget as any)._tx as number | undefined;
              if (start == null) return;
              const dx = e.changedTouches[0].clientX - start;
              if (Math.abs(dx) > 50 && photos.length > 1) {
                if (dx < 0) next(); else prev();
              }
            }}
            className="max-w-[95vw] max-h-[90vh] object-contain select-none touch-pan-y"
          />
          {photos.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/80 text-xs font-mono bg-black/40 px-3 py-1 rounded-full">
              {lightboxIdx + 1} / {photos.length}
            </div>
          )}
        </div>
      )}

      {reportOpen && <ReportPropertyDialog propertyId={id} onClose={() => setReportOpen(false)} />}

      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur-md border-t border-border px-4 py-3 flex items-center gap-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
        <button
          onClick={toggleFavorite}
          aria-label={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
          className="min-h-12 min-w-12 grid place-items-center rounded-lg border border-border hover:bg-muted shrink-0"
        >
          <span className={`text-xl ${isFavorite ? "text-primary" : ""}`}>{isFavorite ? "♥" : "♡"}</span>
        </button>
        {unlocked && owner ? (
          <a
            href={`tel:${visitPhone ?? ""}`}
            className="flex-1 min-h-12 inline-flex items-center justify-center px-4 py-3 bg-primary text-primary-foreground rounded-lg font-semibold text-sm uppercase tracking-wider"
          >
            Appeler {visitPhone ?? ""}
          </a>
        ) : (
          <button
            onClick={unlockContact}
            disabled={unlocking}
            className="flex-1 min-h-12 px-4 py-3 bg-primary text-primary-foreground rounded-lg font-semibold text-sm uppercase tracking-wider disabled:opacity-50"
          >
            {unlocking ? "Déblocage..." : "Débloquer le contact"}
          </button>
        )}
      </div>
    </article>
  );
}
