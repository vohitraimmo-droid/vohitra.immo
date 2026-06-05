import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatAr, propertyTypeLabel } from "@/lib/format";
import { thumb } from "@/lib/images";
import { useCompare } from "@/hooks/use-compare";
import { X, Check, Minus } from "lucide-react";

export const Route = createFileRoute("/compare")({
  head: () => ({
    meta: [
      { title: "Comparer des biens — Vohitra" },
      { name: "description", content: "Comparez côte à côte jusqu'à 3 biens immobiliers." },
    ],
  }),
  component: ComparePage,
});

interface Row {
  id: string;
  title: string;
  city: string;
  address: string;
  surface: number;
  price: number;
  rooms: number | null;
  property_type: string;
  listing_type: "rent" | "sale" | null;
  is_premium: boolean;
  is_verified: boolean;
  cover_url: string | null;
}

function ComparePage() {
  const { ids, remove, clear } = useCompare();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (ids.length === 0) { setRows([]); return; }
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("properties")
        .select("id, title, city, address, surface, price, rooms, property_type, listing_type, is_premium, is_verified, property_photos(url, display_order)")
        .in("id", ids);
      const mapped: Row[] = (data ?? []).map((p: any) => {
        const photos = (p.property_photos ?? []).sort((a: any, b: any) => a.display_order - b.display_order);
        return { ...p, cover_url: photos[0]?.url ?? null };
      });
      // Preserve user-selected order
      mapped.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
      setRows(mapped);
      setLoading(false);
    })();
  }, [ids.join(",")]);

  if (ids.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <h1 className="font-display text-3xl italic mb-3">Comparer des biens</h1>
        <p className="text-muted-foreground">
          Aucun bien sélectionné. Ouvrez une annonce et cliquez sur « Comparer » pour ajouter jusqu'à 3 biens.
        </p>
        <Link to="/" className="mt-6 inline-block bg-primary text-primary-foreground px-5 py-2 rounded-lg text-sm font-semibold">
          Parcourir les annonces
        </Link>
      </div>
    );
  }

  const fields: { label: string; render: (r: Row) => React.ReactNode }[] = [
    { label: "Type", render: (r) => propertyTypeLabel(r.property_type) },
    { label: "Transaction", render: (r) => (r.listing_type === "sale" ? "Vente" : "Location") },
    { label: "Prix", render: (r) => <span className="font-mono text-primary font-semibold">{formatAr(r.price)}</span> },
    { label: "Surface", render: (r) => `${r.surface} m²` },
    { label: "Pièces", render: (r) => r.rooms ?? "—" },
    { label: "Prix au m²", render: (r) => <span className="font-mono">{formatAr(Math.round(r.price / Math.max(r.surface, 1)))}</span> },
    { label: "Ville", render: (r) => r.city },
    { label: "Adresse", render: (r) => <span className="text-xs">{r.address}</span> },
    { label: "Premium", render: (r) => (r.is_premium ? <Check className="size-4 text-primary" /> : <Minus className="size-4 text-muted-foreground" />) },
    { label: "Vérifié sur site", render: (r) => (r.is_verified ? <Check className="size-4 text-verified" /> : <Minus className="size-4 text-muted-foreground" />) },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-10 md:py-16">
      <div className="flex justify-between items-center mb-8">
        <h1 className="font-display text-3xl md:text-4xl italic">Comparer</h1>
        <button onClick={clear} className="text-sm text-muted-foreground hover:text-destructive">Tout effacer</button>
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground py-12">Chargement…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-x-3 min-w-[700px]">
            <thead>
              <tr>
                <th className="w-32"></th>
                {rows.map((r) => (
                  <th key={r.id} className="text-left align-top pb-4">
                    <div className="relative bg-card border border-border rounded-2xl overflow-hidden">
                      <button
                        onClick={() => remove(r.id)}
                        className="absolute top-2 right-2 z-10 bg-background/90 hover:bg-destructive hover:text-destructive-foreground p-1.5 rounded-full"
                        aria-label="Retirer"
                      >
                        <X className="size-3.5" />
                      </button>
                      <Link to="/property/$id" params={{ id: r.id }}>
                        {r.cover_url ? (
                          <img src={thumb(r.cover_url)} alt={r.title} loading="lazy" className="w-full aspect-[4/3] object-cover" />
                        ) : (
                          <div className="w-full aspect-[4/3] bg-muted" />
                        )}
                        <div className="p-3">
                          <p className="font-semibold text-sm truncate">{r.title}</p>
                        </div>
                      </Link>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fields.map((f, i) => (
                <tr key={f.label} className={i % 2 === 0 ? "bg-muted/30" : ""}>
                  <td className="py-3 px-3 text-xs uppercase tracking-wider text-muted-foreground font-semibold align-top">
                    {f.label}
                  </td>
                  {rows.map((r) => (
                    <td key={r.id} className="py-3 px-3 text-sm align-top">{f.render(r)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
