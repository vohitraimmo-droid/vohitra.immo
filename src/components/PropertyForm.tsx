import { useEffect, useState } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import imageCompression from "browser-image-compression";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { scanPhotoFn } from "@/lib/moderation.functions";

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

interface ExistingPhoto { id: string; url: string; display_order: number; }

const TYPES = [
  { value: "appartement", label: "Appartement" },
  { value: "maison", label: "Maison" },
  { value: "local_commercial", label: "Local commercial" },
  { value: "terrain", label: "Terrain" },
];

export function PropertyForm({ propertyId }: { propertyId?: string }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: "", description: "", property_type: "appartement",
    listing_type: "rent" as "rent" | "sale",
    surface: "", price: "", address: "", postal_code: "", city: "",
    rooms: "", visit_phone: "",
  });
  const [photos, setPhotos] = useState<ExistingPhoto[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!propertyId) return;
    (async () => {
      const { data: p } = await supabase.from("properties")
        .select("id, title, description, property_type, listing_type, surface, price, address, postal_code, city, rooms")
        .eq("id", propertyId).single();
      const { data: phoneData } = await supabase.rpc("get_visit_phone", { _property_id: propertyId });
      if (p) {
        setForm({
          title: p.title, description: p.description ?? "",
          property_type: p.property_type,
          listing_type: ((p as any).listing_type ?? "rent") as "rent" | "sale",
          surface: String(p.surface),
          price: String(p.price), address: p.address, postal_code: p.postal_code ?? "",
          city: p.city, rooms: p.rooms ? String(p.rooms) : "", visit_phone: (phoneData as string | null) ?? "",
        });
      }
      const { data: ph } = await supabase.from("property_photos")
        .select("id, url, display_order").eq("property_id", propertyId).order("display_order");
      setPhotos(ph ?? []);
    })();
  }, [propertyId]);

  const onFiles = (files: FileList | null) => {
    if (!files) return;
    const available = 5 - photos.length - newFiles.length;
    const accepted = Array.from(files).slice(0, available);
    if (accepted.length < files.length) toast.warning("Maximum 5 photos.");
    setNewFiles((prev) => [...prev, ...accepted]);
  };

  const removeExisting = async (ph: ExistingPhoto) => {
    await supabase.from("property_photos").delete().eq("id", ph.id);
    setPhotos((arr) => arr.filter((x) => x.id !== ph.id));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Au moins une photo obligatoire
    if (photos.length + newFiles.length < 1) {
      toast.error("Veuillez ajouter au moins une photo de l'annonce.");
      return;
    }


    // Bloque liens / emails / téléphones dans le titre + description
    const blob = `${form.title} ${form.description}`.toLowerCase();
    if (/(https?:\/\/|www\.|\.com|\.fr|\.mg|\.org|\.net|t\.me\/|wa\.me\/|bit\.ly|tinyurl)/.test(blob)) {
      toast.error("Les liens ne sont pas autorisés dans le titre ou la description.");
      return;
    }
    if (/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/.test(blob)) {
      toast.error("Les adresses e-mail ne sont pas autorisées dans la description.");
      return;
    }
    if (/[0-9]{8,}/.test(blob.replace(/\D/g, ""))) {
      toast.error("Les numéros de téléphone ne sont pas autorisés dans la description. Utilisez le champ téléphone.");
      return;
    }

    setSaving(true);
    try {
      const visitPhone = form.visit_phone.trim();
      const payload: any = {
        owner_id: user.id,
        title: form.title.trim(), description: form.description.trim(),
        property_type: form.property_type as any,
        listing_type: form.listing_type,
        surface: Number(form.surface), price: Number(form.price.replace(/\s/g, "")),
        address: form.address.trim(), postal_code: form.postal_code.trim() || null,
        city: form.city.trim(), rooms: form.rooms ? Number(form.rooms) : null,
      };
      let id = propertyId;
      if (id) {
        const { error } = await supabase.from("properties").update(payload).eq("id", id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("properties").insert(payload).select("id").single();
        if (error) throw error;
        id = data.id;
      }

      // Numéro de visite stocké dans une table séparée à RLS stricte
      const { error: phoneErr } = await supabase
        .from("property_contacts")
        .upsert({ property_id: id, visit_phone: visitPhone }, { onConflict: "property_id" });
      if (phoneErr) throw phoneErr;


      // Compress + moderate all new photos in parallel before any upload
      const prepared = await Promise.all(newFiles.map(async (file, i) => {
        const compressed = await imageCompression(file, {
          maxSizeMB: 0.5, maxWidthOrHeight: 1200, useWebWorker: true,
        });
        try {
          const dataUrl = await blobToDataUrl(compressed);
          const scan = await scanPhotoFn({ data: { imageDataUrl: dataUrl } });
          if (scan.blocked) {
            throw new Error(
              `Photo n°${i + 1} refusée : ${scan.reason || "informations de contact détectées"}. ` +
              "Retirez tout numéro, e-mail, lien ou compte de réseau social visible sur l'image.",
            );
          }
        } catch (err) {
          if (err instanceof Error && err.message.startsWith("Photo n°")) throw err;
          // gateway error => fail open
        }
        return { compressed, index: i };
      }));

      // Upload + DB insert in parallel
      const baseOrder = photos.length;
      await Promise.all(prepared.map(async ({ compressed, index }) => {
        const path = `${user.id}/${id}/${Date.now()}-${index}.jpg`;
        const { error: upErr } = await supabase.storage.from("property-photos")
          .upload(path, compressed, { contentType: "image/jpeg", upsert: false });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("property-photos").getPublicUrl(path);
        await supabase.from("property_photos").insert({
          property_id: id, url: pub.publicUrl, display_order: baseOrder + index,
        });
      }));

      toast.success(propertyId ? "Annonce modifiée" : "Annonce publiée !");
      navigate({ to: "/dashboard/owner" });
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur");
    } finally { setSaving(false); }
  };

  if (loading || !user) return <div className="py-20 text-center text-muted-foreground">Chargement...</div>;

  const totalPhotos = photos.length + newFiles.length;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 pb-28 md:pb-12">
      <Link to="/dashboard/owner" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center min-h-11 py-2">← Retour</Link>
      <h1 className="font-display text-3xl sm:text-4xl italic mt-2 mb-6 sm:mb-8">
        {propertyId ? "Modifier l'annonce" : "Nouvelle annonce"}
      </h1>

      <form onSubmit={submit} className="space-y-5 sm:space-y-6">
        {/* Section 1 — Informations générales */}
        <section className="bg-card border border-border rounded-2xl p-5 sm:p-6 space-y-5">
          <h2 className="font-semibold text-base">Informations générales</h2>
          <Field label="Titre" required>
            <input required maxLength={120} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Description">
            <textarea rows={5} maxLength={2000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputCls} />
            <p className="text-xs text-muted-foreground mt-1.5">
              Pas de numéros, e-mails ni liens dans la description. Renseignez votre téléphone dans le champ dédié — les locataires le débloquent via la plateforme.
            </p>
          </Field>
          <Field label="Type d'annonce" required>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              {[
                { v: "rent", l: "À louer (prix / mois)" },
                { v: "sale", l: "À vendre (prix d'achat)" },
              ].map((opt) => (
                <button
                  type="button"
                  key={opt.v}
                  onClick={() => setForm({ ...form, listing_type: opt.v as "rent" | "sale" })}
                  aria-pressed={form.listing_type === opt.v}
                  className={`flex-1 min-h-11 px-4 py-2.5 rounded-lg text-sm font-semibold border transition-colors ${form.listing_type === opt.v ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
                >
                  {opt.l}
                </button>
              ))}
            </div>
          </Field>
        </section>

        {/* Section 2 — Caractéristiques */}
        <section className="bg-card border border-border rounded-2xl p-5 sm:p-6 space-y-5">
          <h2 className="font-semibold text-base">Caractéristiques</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Type" required>
              <select value={form.property_type} onChange={(e) => setForm({ ...form, property_type: e.target.value })} className={inputCls}>
                {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </Field>
            <Field label="Surface (m²)" required>
              <input required type="number" min={1} value={form.surface} onChange={(e) => setForm({ ...form, surface: e.target.value })} className={inputCls} />
            </Field>
            <Field label={form.listing_type === "sale" ? "Prix d'achat (Ar)" : "Loyer mensuel (Ar)"} required>
              <input required inputMode="numeric" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value.replace(/[^\d\s]/g, "") })} className={inputCls} />
            </Field>
            <Field label="Nombre de pièces">
              <input type="number" min={0} value={form.rooms} onChange={(e) => setForm({ ...form, rooms: e.target.value })} className={inputCls} />
            </Field>
          </div>
        </section>

        {/* Section 3 — Localisation & contact */}
        <section className="bg-card border border-border rounded-2xl p-5 sm:p-6 space-y-5">
          <h2 className="font-semibold text-base">Localisation & contact</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Ville" required>
              <input required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Code postal">
              <input value={form.postal_code} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} className={inputCls} />
            </Field>
          </div>
          <Field label="Adresse" required>
            <input required value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Téléphone de visite" required>
            <input required type="tel" inputMode="tel" value={form.visit_phone} onChange={(e) => setForm({ ...form, visit_phone: e.target.value })} className={inputCls} placeholder="034 00 000 00" />
          </Field>
        </section>

        {/* Section 4 — Photos */}
        <section className="bg-card border border-border rounded-2xl p-5 sm:p-6">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="font-semibold text-base">Photos</h2>
            <span className="text-xs text-muted-foreground">{totalPhotos}/5</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-4">
            {photos.map((ph) => (
              <div key={ph.id} className="relative group">
                <img src={ph.url} alt="" className="w-full aspect-square object-cover rounded-lg" />
                <button type="button" aria-label="Retirer la photo" onClick={() => removeExisting(ph)} className="absolute top-1.5 right-1.5 min-h-8 min-w-8 grid place-items-center bg-black/70 text-white rounded-full text-sm hover:bg-destructive">×</button>
              </div>
            ))}
            {newFiles.map((f, i) => (
              <div key={i} className="relative group">
                <img src={URL.createObjectURL(f)} alt="" className="w-full aspect-square object-cover rounded-lg" />
                <button type="button" aria-label="Retirer la photo" onClick={() => setNewFiles(newFiles.filter((_, j) => j !== i))} className="absolute top-1.5 right-1.5 min-h-8 min-w-8 grid place-items-center bg-black/70 text-white rounded-full text-sm hover:bg-destructive">×</button>
              </div>
            ))}
          </div>
          {totalPhotos < 5 && (
            <label className="block">
              <span className="sr-only">Ajouter des photos</span>
              <input type="file" accept="image/*" multiple onChange={(e) => onFiles(e.target.files)} className="block w-full text-sm text-muted-foreground file:mr-3 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:bg-muted file:text-foreground file:font-medium file:cursor-pointer hover:file:bg-muted/70" />
            </label>
          )}
          <p className="text-xs text-muted-foreground mt-3">
            Max 5 photos. Compression auto à 500 Ko. Les photos avec numéro, e-mail, lien ou réseau social visible sont refusées.
          </p>
        </section>

        {/* CTA desktop (au-dessus de la barre sticky mobile) */}
        <div className="hidden md:flex justify-end gap-3">
          <Link to="/dashboard/owner" className="min-h-12 inline-flex items-center px-5 py-3 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors">
            Annuler
          </Link>
          <button type="submit" disabled={saving} className="min-h-12 px-8 py-3 bg-primary text-primary-foreground rounded-lg font-semibold text-sm uppercase tracking-wider disabled:opacity-50 hover:opacity-90 transition-opacity">
            {saving ? "Enregistrement..." : propertyId ? "Enregistrer" : "Publier l'annonce"}
          </button>
        </div>

        {/* Barre d'actions sticky mobile */}
        <div className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur-md border-t border-border px-4 py-3 flex items-center gap-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
          <Link to="/dashboard/owner" className="min-h-12 inline-flex items-center px-4 text-sm text-muted-foreground">
            Annuler
          </Link>
          <button type="submit" disabled={saving} className="flex-1 min-h-12 px-4 py-3 bg-primary text-primary-foreground rounded-lg font-semibold text-sm uppercase tracking-wider disabled:opacity-50">
            {saving ? "Enregistrement..." : propertyId ? "Enregistrer" : "Publier"}
          </button>
        </div>
      </form>
    </div>
  );
}

const inputCls = "w-full min-h-12 px-3 py-2.5 border border-border rounded-lg bg-background text-base focus:outline-none focus:ring-2 focus:ring-ring transition-shadow";

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
