import { Link } from "@tanstack/react-router";
import { formatAr, propertyTypeLabel, titleCase } from "@/lib/format";
import { thumb, thumbSrcSet } from "@/lib/images";
import { useCompare, MAX_COMPARE } from "@/hooks/use-compare";
import { GitCompare, Check, ImageOff, BadgeCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";

export interface PropertyCardData {
  id: string;
  title: string;
  city: string;
  surface: number;
  price: number;
  rooms: number | null;
  property_type: string;
  listing_type?: "rent" | "sale" | null;
  is_premium: boolean;
  is_verified: boolean;
  cover_url: string | null;
}

export function PropertyCard({ p, delay = 0, priority = false }: { p: PropertyCardData; delay?: number; priority?: boolean }) {
  const isSale = p.listing_type === "sale";
  const { ids, toggle, isFull } = useCompare();
  const inCompare = ids.includes(p.id);

  const title = titleCase(p.title);
  const city = titleCase(p.city);

  const onCompare = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!inCompare && isFull) {
      toast.error(`Maximum ${MAX_COMPARE} biens à comparer`);
      return;
    }
    toggle(p.id);
    toast.success(inCompare ? "Retiré du comparateur" : "Ajouté au comparateur");
  };

  return (
    <Link
      to="/property/$id"
      params={{ id: p.id }}
      className="group cursor-pointer animate-fade-up block"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className={`relative overflow-hidden rounded-2xl mb-4 bg-muted ${p.is_premium ? "ring-2 ring-premium/60 ring-offset-2 ring-offset-background" : ""}`}>
        {p.cover_url ? (
          <img
            src={thumb(p.cover_url)}
            srcSet={thumbSrcSet(p.cover_url)}
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            alt={title}
            width={600}
            height={450}
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "low"}
            decoding="async"
            className="w-full aspect-[4/3] object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full aspect-[4/3] flex flex-col items-center justify-center gap-2 bg-muted text-muted-foreground">
            <ImageOff className="size-7 opacity-60" />
            <span className="text-[10px] uppercase tracking-widest font-semibold">
              {propertyTypeLabel(p.property_type)}
            </span>
          </div>
        )}

        {/* Premium badge — top-left ribbon for maximum visibility */}
        {p.is_premium && (
          <span className="absolute top-3 left-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-premium text-premium-foreground shadow-md ring-1 ring-black/5 text-[10px] font-bold uppercase tracking-wider">
            <Sparkles className="size-3" />
            Premium
          </span>
        )}

        {/* Top-right actions row: verified badge + compare button */}
        <div className="absolute top-3 right-3 flex items-center gap-2">
          {p.is_verified && (
            <span
              title="Annonce vérifiée"
              aria-label="Annonce vérifiée"
              className="size-8 grid place-items-center rounded-full bg-verified text-verified-foreground shadow-md ring-1 ring-black/5"
            >
              <BadgeCheck className="size-4" />
            </span>
          )}
          <button
            onClick={onCompare}
            aria-label={inCompare ? "Retirer du comparateur" : "Ajouter au comparateur"}
            title={inCompare ? "Retirer du comparateur" : "Ajouter au comparateur"}
            className={`min-h-11 min-w-11 grid place-items-center rounded-full shadow-md transition-colors ${
              inCompare ? "bg-primary text-primary-foreground" : "bg-background/90 hover:bg-background text-foreground"
            }`}
          >
            {inCompare ? <Check className="size-4" /> : <GitCompare className="size-4" />}
          </button>
        </div>
      </div>

      {/* Info block — title left, price right, both top-aligned with equal vertical rhythm */}
      <div className="flex justify-between items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-base md:text-lg leading-tight truncate" title={title}>{title}</h3>
          <p className="text-xs md:text-sm text-muted-foreground truncate mt-1">
            {p.rooms ? `${p.rooms} pièces · ` : ""}{p.surface} m² · {city}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-mono font-semibold text-primary whitespace-nowrap leading-tight">
            {formatAr(p.price)}
          </p>
          <p className="text-[10px] text-muted-foreground font-sans mt-1 uppercase tracking-wider">
            {isSale ? "Prix d'achat" : "/ mois"}
          </p>
        </div>
      </div>
    </Link>
  );
}

/** Skeleton placeholder — preserves card geometry while data is loading. */
export function PropertyCardSkeleton() {
  return (
    <div className="block animate-pulse">
      <div className="w-full aspect-[4/3] rounded-2xl bg-muted mb-4" />
      <div className="flex justify-between items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="h-4 bg-muted rounded w-3/4 mb-2" />
          <div className="h-3 bg-muted rounded w-1/2" />
        </div>
        <div className="text-right shrink-0">
          <div className="h-4 bg-muted rounded w-20 mb-2" />
          <div className="h-2.5 bg-muted rounded w-12 ml-auto" />
        </div>
      </div>
    </div>
  );
}
