export function formatAr(amount: number | bigint | string): string {
  const n = typeof amount === "string" ? Number(amount) : Number(amount);
  if (!Number.isFinite(n)) return "0 Ar";
  return new Intl.NumberFormat("fr-FR").format(n) + " Ar";
}

export function propertyTypeLabel(t: string): string {
  switch (t) {
    case "appartement": return "Appartement";
    case "maison": return "Maison";
    case "local_commercial": return "Local commercial";
    case "terrain": return "Terrain";
    default: return t;
  }
}

/**
 * Normalise un texte saisi en majuscules / minuscules en "Title Case"
 * lisible : "TRANO MORA" -> "Trano Mora", "antananarivo" -> "Antananarivo".
 * Préserve les caractères Unicode (accents) et ne touche pas aux espaces.
 */
export function titleCase(input: string | null | undefined): string {
  if (!input) return "";
  const s = String(input).trim();
  if (!s) return "";
  return s
    .toLocaleLowerCase("fr-FR")
    .split(/(\s+|[-'’])/)
    .map((w) => (w.length > 0 && /[a-zà-ÿ]/i.test(w[0]) ? w[0].toLocaleUpperCase("fr-FR") + w.slice(1) : w))
    .join("");
}
