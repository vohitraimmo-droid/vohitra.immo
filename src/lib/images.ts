/**
 * Génère une URL d'image transformée via Supabase Storage Render.
 * Supporte uniquement les URLs publiques `…/storage/v1/object/public/…` du projet.
 * Pour les autres URLs, retourne l'original tel quel.
 */
export function imgUrl(
  src: string | null | undefined,
  opts: { width?: number; quality?: number } = {}
): string {
  if (!src) return "";
  const m = src.match(/^(.*?)\/storage\/v1\/object\/public\/(.+)$/);
  if (!m) return src;
  const [, base, path] = m;
  const params = new URLSearchParams();
  if (opts.width) params.set("width", String(opts.width));
  params.set("quality", String(opts.quality ?? 70));
  params.set("resize", "cover");
  return `${base}/storage/v1/render/image/public/${path}?${params.toString()}`;
}

/**
 * Détecte une connexion lente ou le mode économie de données.
 * Utilisé pour réduire la qualité/taille des images sur 2G/3G.
 */
function isSlowNetwork(): boolean {
  if (typeof navigator === "undefined") return false;
  const c = (navigator as any).connection;
  if (!c) return false;
  if (c.saveData) return true;
  const t = c.effectiveType as string | undefined;
  return t === "slow-2g" || t === "2g" || t === "3g";
}

/**
 * Qualité adaptée au réseau : plus basse sur 3G / Save-Data.
 */
function adaptiveQuality(base: number): number {
  return isSlowNetwork() ? Math.max(40, base - 25) : base;
}

export const thumb = (src: string | null | undefined) =>
  imgUrl(src, { width: isSlowNetwork() ? 360 : 600, quality: adaptiveQuality(70) });

export const hero = (src: string | null | undefined) =>
  imgUrl(src, { width: isSlowNetwork() ? 800 : 1400, quality: adaptiveQuality(80) });

/**
 * Génère un srcSet responsive pour <img srcSet=...>.
 * Le navigateur choisit la plus petite image suffisante pour la taille rendue.
 */
export function thumbSrcSet(src: string | null | undefined): string {
  if (!src) return "";
  const widths = isSlowNetwork() ? [240, 360, 480] : [320, 480, 640, 800];
  const q = adaptiveQuality(70);
  return widths.map((w) => `${imgUrl(src, { width: w, quality: q })} ${w}w`).join(", ");
}

export function heroSrcSet(src: string | null | undefined): string {
  if (!src) return "";
  const widths = isSlowNetwork() ? [600, 900] : [800, 1200, 1600];
  const q = adaptiveQuality(80);
  return widths.map((w) => `${imgUrl(src, { width: w, quality: q })} ${w}w`).join(", ");
}
