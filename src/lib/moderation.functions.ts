import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Scan a property photo for forbidden contact info.
 * Uses OpenAI GPT-4o Vision if OPENAI_API_KEY is set,
 * otherwise fails open (non-blocking) so users aren't stuck.
 * 
 * To enable: add OPENAI_API_KEY to your Vercel environment variables.
 */
export const scanPhotoFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      imageDataUrl: z.string().startsWith("data:image/").max(8_000_000),
    }).parse(i),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      // Fail open: if no AI key is configured, don't block users.
      return { blocked: false, reason: "" };
    }

    const systemPrompt =
      "Tu es un modérateur d'images pour une plateforme immobilière. " +
      "BLOQUE la photo UNIQUEMENT si elle contient l'un de ces éléments : " +
      "(1) un numéro de téléphone visible, (2) une adresse e-mail, " +
      "(3) un lien internet / URL / nom de domaine, " +
      "(4) un identifiant ou handle de réseau social avec un nom d'utilisateur, " +
      "(5) un filigrane d'agence externe invitant à contacter en dehors de la plateforme, " +
      "(6) une capture d'écran (screenshot d'un téléphone, ordinateur ou application). " +
      "AUTORISE explicitement : logos/marques sans coordonnées, horodatages, noms de marques de téléphone, panneaux génériques sans coordonnées. " +
      'Réponds UNIQUEMENT par un objet JSON strict : {"blocked": true|false, "reason": "courte raison en français"}.';

    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                { type: "text", text: "Analyse cette photo d'annonce immobilière." },
                { type: "image_url", image_url: { url: data.imageDataUrl, detail: "low" } },
              ],
            },
          ],
          max_tokens: 100,
        }),
      });

      if (!res.ok) {
        console.error("scanPhotoFn openai error", res.status, await res.text());
        return { blocked: false, reason: "" };
      }

      const json = await res.json() as { choices?: { message?: { content?: string } }[] };
      const raw = json.choices?.[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(raw) as { blocked?: boolean; reason?: string };
      return {
        blocked: !!parsed.blocked,
        reason: typeof parsed.reason === "string" ? parsed.reason.slice(0, 200) : "",
      };
    } catch (err) {
      console.error("scanPhotoFn error", err);
      return { blocked: false, reason: "" };
    }
  });
