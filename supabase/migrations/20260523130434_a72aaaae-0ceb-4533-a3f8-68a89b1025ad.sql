
-- =========================================================
-- Phase 3 — Communication & Confiance
-- =========================================================

-- 1) MESSAGES (messagerie propriétaire ↔ locataire, par annonce)
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  recipient_id uuid NOT NULL,
  body text NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 4000),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_thread
  ON public.messages (property_id, sender_id, recipient_id, created_at DESC);
CREATE INDEX idx_messages_recipient_unread
  ON public.messages (recipient_id, read_at, created_at DESC);
CREATE INDEX idx_messages_sender
  ON public.messages (sender_id, created_at DESC);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Voir : participant (envoyeur ou destinataire) ou admin
CREATE POLICY "Messages: participants select"
  ON public.messages FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id OR public.is_admin(auth.uid()));

-- Insert : uniquement en tant qu'envoyeur, et le destinataire doit être le owner de l'annonce OU l'envoyeur doit être le owner
CREATE POLICY "Messages: insert as sender"
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND sender_id <> recipient_id
    AND EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = messages.property_id
        AND p.status = 'active'
        AND (
          (p.owner_id = messages.recipient_id AND auth.uid() <> p.owner_id) -- locataire écrit au owner
          OR (p.owner_id = messages.sender_id AND auth.uid() = p.owner_id)  -- owner répond
        )
    )
  );

-- Update : seulement le destinataire peut marquer comme lu (read_at)
CREATE POLICY "Messages: recipient mark read"
  ON public.messages FOR UPDATE
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;


-- 2) AVIS PROPRIÉTAIRE
CREATE TABLE public.owner_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  author_id uuid NOT NULL,
  property_id uuid,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text CHECK (comment IS NULL OR length(btrim(comment)) BETWEEN 3 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT owner_reviews_no_self CHECK (owner_id <> author_id),
  CONSTRAINT owner_reviews_unique UNIQUE (owner_id, author_id)
);

CREATE INDEX idx_owner_reviews_owner ON public.owner_reviews (owner_id, created_at DESC);

ALTER TABLE public.owner_reviews ENABLE ROW LEVEL SECURITY;

-- Lecture publique
CREATE POLICY "Reviews: public read"
  ON public.owner_reviews FOR SELECT USING (true);

-- Insert : auteur authentifié, jamais soi-même, et doit avoir débloqué au moins une annonce de ce owner (preuve d'interaction)
CREATE POLICY "Reviews: author insert with interaction"
  ON public.owner_reviews FOR INSERT
  WITH CHECK (
    auth.uid() = author_id
    AND author_id <> owner_id
    AND EXISTS (
      SELECT 1
      FROM public.contact_unlocks cu
      JOIN public.properties p ON p.id = cu.property_id
      WHERE cu.user_id = auth.uid()
        AND p.owner_id = owner_reviews.owner_id
    )
  );

-- Update / Delete : auteur uniquement
CREATE POLICY "Reviews: author update"
  ON public.owner_reviews FOR UPDATE
  USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Reviews: author or admin delete"
  ON public.owner_reviews FOR DELETE
  USING (auth.uid() = author_id OR public.is_admin(auth.uid()));

CREATE TRIGGER trg_owner_reviews_updated_at
  BEFORE UPDATE ON public.owner_reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- 3) ALERTES DE RECHERCHE
CREATE TABLE public.search_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 80),
  city text,
  listing_type text,
  property_type text,
  price_max bigint,
  surface_min numeric,
  rooms_min integer,
  q text,
  is_active boolean NOT NULL DEFAULT true,
  last_notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_search_alerts_user ON public.search_alerts (user_id, created_at DESC);

ALTER TABLE public.search_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alerts: own all"
  ON public.search_alerts FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
