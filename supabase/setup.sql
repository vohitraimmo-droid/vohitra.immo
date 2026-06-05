-- ============================================================
-- VOHITRA — Reset complet + Setup
-- Copie-colle tout ça dans Supabase SQL Editor → Run
-- ============================================================


-- ============================================================
-- PARTIE 1 : TOUT SUPPRIMER
-- ============================================================

-- Supprimer toutes les politiques RLS (public + storage + realtime)
DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT schemaname, tablename, policyname FROM pg_policies
    WHERE schemaname IN ('public', 'storage', 'realtime')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- Supprimer les triggers sur auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Supprimer toutes les tables (dans l'ordre des dépendances)
DROP TABLE IF EXISTS public.admin_logs                CASCADE;
DROP TABLE IF EXISTS public.user_bans                 CASCADE;
DROP TABLE IF EXISTS public.email_unsubscribe_tokens  CASCADE;
DROP TABLE IF EXISTS public.suppressed_emails         CASCADE;
DROP TABLE IF EXISTS public.email_send_state          CASCADE;
DROP TABLE IF EXISTS public.email_send_log            CASCADE;
DROP TABLE IF EXISTS public.blog_posts                CASCADE;
DROP TABLE IF EXISTS public.cgu                       CASCADE;
DROP TABLE IF EXISTS public.site_settings             CASCADE;
DROP TABLE IF EXISTS public.verification_requests     CASCADE;
DROP TABLE IF EXISTS public.kyc_requests              CASCADE;
DROP TABLE IF EXISTS public.subscriptions             CASCADE;
DROP TABLE IF EXISTS public.token_purchase_requests   CASCADE;
DROP TABLE IF EXISTS public.token_transactions        CASCADE;
DROP TABLE IF EXISTS public.search_alerts             CASCADE;
DROP TABLE IF EXISTS public.owner_reviews             CASCADE;
DROP TABLE IF EXISTS public.messages                  CASCADE;
DROP TABLE IF EXISTS public.visit_bookings            CASCADE;
DROP TABLE IF EXISTS public.visit_slots               CASCADE;
DROP TABLE IF EXISTS public.contact_unlocks           CASCADE;
DROP TABLE IF EXISTS public.favorites                 CASCADE;
DROP TABLE IF EXISTS public.property_reports          CASCADE;
DROP TABLE IF EXISTS public.property_views            CASCADE;
DROP TABLE IF EXISTS public.property_photos           CASCADE;
DROP TABLE IF EXISTS public.property_contacts         CASCADE;
DROP TABLE IF EXISTS public.properties                CASCADE;
DROP TABLE IF EXISTS public.user_roles                CASCADE;
DROP TABLE IF EXISTS public.profiles                  CASCADE;

-- Supprimer toutes les fonctions
DROP FUNCTION IF EXISTS public.set_updated_at()                              CASCADE;
DROP FUNCTION IF EXISTS public.has_role(UUID, public.app_role)               CASCADE;
DROP FUNCTION IF EXISTS public.is_admin(UUID)                                CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user()                             CASCADE;
DROP FUNCTION IF EXISTS public.validate_property_content()                   CASCADE;
DROP FUNCTION IF EXISTS public.prevent_owner_privilege_escalation()          CASCADE;
DROP FUNCTION IF EXISTS public.apply_subscription_premium()                  CASCADE;
DROP FUNCTION IF EXISTS public.debit_tokens(uuid, int, text)                 CASCADE;
DROP FUNCTION IF EXISTS public.credit_tokens(uuid, int, text)                CASCADE;
DROP FUNCTION IF EXISTS public.get_visit_phone(uuid)                         CASCADE;
DROP FUNCTION IF EXISTS public.has_active_subscription(uuid)                 CASCADE;
DROP FUNCTION IF EXISTS public.count_active_users(timestamptz)               CASCADE;
DROP FUNCTION IF EXISTS public.delete_unconfirmed_users()                    CASCADE;
DROP FUNCTION IF EXISTS public.enqueue_email(TEXT, JSONB)                    CASCADE;
DROP FUNCTION IF EXISTS public.read_email_batch(TEXT, INT, INT)              CASCADE;
DROP FUNCTION IF EXISTS public.delete_email(TEXT, BIGINT)                    CASCADE;
DROP FUNCTION IF EXISTS public.move_to_dlq(TEXT, TEXT, BIGINT, JSONB)        CASCADE;

-- Supprimer les types
DROP TYPE IF EXISTS public.report_status  CASCADE;
DROP TYPE IF EXISTS public.listing_type   CASCADE;
DROP TYPE IF EXISTS public.kyc_status     CASCADE;
DROP TYPE IF EXISTS public.request_status CASCADE;
DROP TYPE IF EXISTS public.property_status CASCADE;
DROP TYPE IF EXISTS public.property_type  CASCADE;
DROP TYPE IF EXISTS public.app_role       CASCADE;

-- Retirer les tables de la publication realtime
DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
  LOOP
    EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', r.tablename);
  END LOOP;
END $$;


-- ============================================================
-- PARTIE 2 : EXTENSIONS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgmq;
CREATE EXTENSION IF NOT EXISTS supabase_vault;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    CREATE EXTENSION pg_cron;
  END IF;
END $$;


-- ============================================================
-- PARTIE 3 : ENUMS
-- ============================================================

CREATE TYPE public.app_role        AS ENUM ('locataire', 'proprietaire', 'admin');
CREATE TYPE public.property_type   AS ENUM ('appartement', 'maison', 'local_commercial', 'terrain');
CREATE TYPE public.property_status AS ENUM ('active', 'inactive', 'pending');
CREATE TYPE public.request_status  AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.kyc_status      AS ENUM ('none', 'pending', 'approved', 'rejected');
CREATE TYPE public.listing_type    AS ENUM ('rent', 'sale');
CREATE TYPE public.report_status   AS ENUM ('pending', 'reviewed', 'dismissed', 'removed');


-- ============================================================
-- PARTIE 4 : TABLES
-- ============================================================

CREATE TABLE public.profiles (
  id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name      TEXT NOT NULL DEFAULT '',
  email          TEXT NOT NULL DEFAULT '',
  phone          TEXT,
  avatar_url     TEXT,
  tokens_balance INT  NOT NULL DEFAULT 0,
  kyc_status     public.kyc_status NOT NULL DEFAULT 'none',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.properties (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  property_type public.property_type NOT NULL,
  listing_type  public.listing_type  NOT NULL DEFAULT 'rent',
  surface       NUMERIC NOT NULL,
  price         BIGINT  NOT NULL,
  address       TEXT    NOT NULL,
  postal_code   TEXT,
  city          TEXT    NOT NULL,
  rooms         INT,
  status        public.property_status NOT NULL DEFAULT 'active',
  is_premium    BOOLEAN NOT NULL DEFAULT FALSE,
  premium_until TIMESTAMPTZ,
  is_verified   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_properties_status                 ON public.properties(status);
CREATE INDEX idx_properties_premium                ON public.properties(is_premium, premium_until);
CREATE INDEX idx_properties_owner                  ON public.properties(owner_id);
CREATE INDEX idx_properties_status_premium_created ON public.properties(status, is_premium DESC, created_at DESC);
CREATE INDEX idx_properties_city_lower             ON public.properties(lower(city));
CREATE INDEX idx_properties_property_type          ON public.properties(property_type);
CREATE INDEX idx_properties_listing_type           ON public.properties(listing_type);
CREATE INDEX idx_properties_owner_status           ON public.properties(owner_id, status, created_at DESC);
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.property_contacts (
  property_id UUID PRIMARY KEY REFERENCES public.properties(id) ON DELETE CASCADE,
  visit_phone TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.property_contacts ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.property_photos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id   UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  url           TEXT NOT NULL,
  display_order INT  NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_property_photos_property ON public.property_photos(property_id, display_order);
ALTER TABLE public.property_photos ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.property_views (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL,
  viewer_id   UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_property_views_prop_created ON public.property_views(property_id, created_at DESC);
ALTER TABLE public.property_views ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.property_reports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id  UUID NOT NULL,
  reporter_id  UUID NOT NULL,
  reason       TEXT NOT NULL,
  details      TEXT,
  status       public.report_status NOT NULL DEFAULT 'pending',
  admin_note   TEXT,
  processed_by UUID,
  processed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_property_reports_property ON public.property_reports(property_id);
CREATE INDEX idx_property_reports_status   ON public.property_reports(status);
ALTER TABLE public.property_reports ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.favorites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, property_id)
);
CREATE INDEX idx_favorites_user ON public.favorites(user_id, created_at DESC);
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.contact_unlocks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, property_id)
);
CREATE INDEX idx_contact_unlocks_user_property ON public.contact_unlocks(user_id, property_id);
ALTER TABLE public.contact_unlocks ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.visit_slots (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  slot_at     TIMESTAMPTZ NOT NULL,
  is_booked   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_visit_slots_property_slot ON public.visit_slots(property_id, slot_at);
ALTER TABLE public.visit_slots ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.visit_bookings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id     UUID NOT NULL REFERENCES public.visit_slots(id) ON DELETE CASCADE,
  tenant_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'confirmed',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_visit_bookings_tenant   ON public.visit_bookings(tenant_id, created_at DESC);
CREATE INDEX idx_visit_bookings_property ON public.visit_bookings(property_id, created_at DESC);
ALTER TABLE public.visit_bookings ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id  UUID NOT NULL,
  sender_id    UUID NOT NULL,
  recipient_id UUID NOT NULL,
  body         TEXT NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 4000),
  read_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_messages_thread           ON public.messages(property_id, sender_id, recipient_id, created_at DESC);
CREATE INDEX idx_messages_recipient_unread ON public.messages(recipient_id, read_at, created_at DESC);
CREATE INDEX idx_messages_sender           ON public.messages(sender_id, created_at DESC);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.owner_reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID NOT NULL,
  author_id   UUID NOT NULL,
  property_id UUID,
  rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT CHECK (comment IS NULL OR length(btrim(comment)) BETWEEN 3 AND 1000),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(owner_id, author_id),
  CHECK(owner_id <> author_id)
);
CREATE INDEX idx_owner_reviews_owner ON public.owner_reviews(owner_id, created_at DESC);
ALTER TABLE public.owner_reviews ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.search_alerts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL,
  name             TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 80),
  city             TEXT,
  listing_type     TEXT,
  property_type    TEXT,
  price_max        BIGINT,
  surface_min      NUMERIC,
  rooms_min        INTEGER,
  q                TEXT,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  last_notified_at TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_search_alerts_user ON public.search_alerts(user_id, created_at DESC);
ALTER TABLE public.search_alerts ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.token_transactions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount     INT  NOT NULL,
  reason     TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.token_transactions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.token_purchase_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tokens_amount     INT    NOT NULL,
  total_price       BIGINT NOT NULL,
  payment_reference TEXT,
  status            public.request_status NOT NULL DEFAULT 'pending',
  reject_reason     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at      TIMESTAMPTZ,
  processed_by      UUID REFERENCES auth.users(id)
);
ALTER TABLE public.token_purchase_requests ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.subscriptions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL UNIQUE,
  plan         TEXT NOT NULL DEFAULT 'pro',
  active_until TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.kyc_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cin_recto_url TEXT NOT NULL,
  cin_verso_url TEXT NOT NULL,
  status        public.request_status NOT NULL DEFAULT 'pending',
  reject_reason TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at  TIMESTAMPTZ,
  processed_by  UUID REFERENCES auth.users(id)
);
ALTER TABLE public.kyc_requests ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.verification_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id   UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status        public.request_status NOT NULL DEFAULT 'pending',
  reject_reason TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at  TIMESTAMPTZ,
  processed_by  UUID REFERENCES auth.users(id)
);
ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.blog_posts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         TEXT NOT NULL UNIQUE,
  title        TEXT NOT NULL,
  excerpt      TEXT NOT NULL DEFAULT '',
  content      TEXT NOT NULL DEFAULT '',
  cover_url    TEXT,
  published    BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  author_id    UUID NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX blog_posts_published_idx ON public.blog_posts(published, published_at DESC);
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.cgu (
  id         INTEGER PRIMARY KEY DEFAULT 1,
  content_fr TEXT NOT NULL DEFAULT '',
  content_mg TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX cgu_singleton ON public.cgu ((true)) WHERE id = 1;
INSERT INTO public.cgu (id, content_fr, content_mg)
VALUES (1, 'Les CGU seront publiées prochainement.', 'Ny fitsipika fampiasana dia havoaka tsy ho ela.');
ALTER TABLE public.cgu ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.site_settings (
  id                        INT PRIMARY KEY DEFAULT 1,
  site_name                 TEXT    NOT NULL DEFAULT 'Vohitra',
  logo_url                  TEXT,
  hero_background_url       TEXT,
  primary_color             TEXT    NOT NULL DEFAULT 'hsl(15 75% 45%)',
  secondary_color           TEXT    NOT NULL DEFAULT 'hsl(158 64% 32%)',
  hero_title                TEXT    NOT NULL DEFAULT 'Trouvez votre foyer au cœur de Madagascar',
  hero_subtitle             TEXT    NOT NULL DEFAULT 'La première plateforme immobilière locale.',
  token_price               BIGINT  NOT NULL DEFAULT 500,
  purchase_instructions     TEXT    NOT NULL DEFAULT 'Paiement par Mvola, Orange Money ou Airtel Money.',
  pro_subscription_tokens   INT     NOT NULL DEFAULT 50,
  pro_subscription_days     INT     NOT NULL DEFAULT 30,
  boost_short_tokens        INT     NOT NULL DEFAULT 3,
  boost_short_days          INT     NOT NULL DEFAULT 7,
  boost_short_enabled       BOOLEAN NOT NULL DEFAULT true,
  boost_long_enabled        BOOLEAN NOT NULL DEFAULT true,
  premium_enabled           BOOLEAN NOT NULL DEFAULT true,
  unlock_cost_tokens        INT     NOT NULL DEFAULT 1,
  unlock_tokens_enabled     BOOLEAN NOT NULL DEFAULT true,
  free_unlocks_per_day      INT     NOT NULL DEFAULT 0,
  verification_cost_tokens  INT     NOT NULL DEFAULT 10,
  verification_paid_enabled BOOLEAN NOT NULL DEFAULT false,
  free_mode_until           TIMESTAMPTZ,
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT site_settings_singleton CHECK (id = 1)
);
INSERT INTO public.site_settings (id) VALUES (1);
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_bans (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason       TEXT NOT NULL,
  banned_until TIMESTAMPTZ,
  banned_by    UUID REFERENCES auth.users(id),
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_bans ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.admin_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    UUID NOT NULL REFERENCES auth.users(id),
  action      TEXT NOT NULL,
  target_type TEXT,
  target_id   TEXT,
  details     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.email_send_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id      TEXT,
  template_name   TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('pending','sent','suppressed','failed','bounced','complained','dlq')),
  error_message   TEXT,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_email_send_log_created   ON public.email_send_log(created_at DESC);
CREATE INDEX idx_email_send_log_recipient ON public.email_send_log(recipient_email);
CREATE INDEX idx_email_send_log_message   ON public.email_send_log(message_id);
CREATE UNIQUE INDEX idx_email_send_log_message_sent_unique ON public.email_send_log(message_id) WHERE status = 'sent';
ALTER TABLE public.email_send_log ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.email_send_state (
  id                              INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  retry_after_until               TIMESTAMPTZ,
  batch_size                      INTEGER NOT NULL DEFAULT 10,
  send_delay_ms                   INTEGER NOT NULL DEFAULT 200,
  auth_email_ttl_minutes          INTEGER NOT NULL DEFAULT 15,
  transactional_email_ttl_minutes INTEGER NOT NULL DEFAULT 60,
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.email_send_state (id) VALUES (1);
ALTER TABLE public.email_send_state ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.suppressed_emails (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT NOT NULL UNIQUE,
  reason     TEXT NOT NULL CHECK (reason IN ('unsubscribe','bounce','complaint')),
  metadata   JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_suppressed_emails_email ON public.suppressed_emails(email);
ALTER TABLE public.suppressed_emails ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.email_unsubscribe_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token      TEXT NOT NULL UNIQUE,
  email      TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_at    TIMESTAMPTZ
);
CREATE INDEX idx_unsubscribe_tokens_token ON public.email_unsubscribe_tokens(token);
ALTER TABLE public.email_unsubscribe_tokens ENABLE ROW LEVEL SECURITY;

-- Email queues
DO $$ BEGIN PERFORM pgmq.create('auth_emails');              EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM pgmq.create('transactional_emails');     EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM pgmq.create('auth_emails_dlq');          EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM pgmq.create('transactional_emails_dlq'); EXCEPTION WHEN OTHERS THEN NULL; END $$;


-- ============================================================
-- PARTIE 5 : FONCTIONS (après les tables)
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin')
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone)
  VALUES (NEW.id, COALESCE(NEW.email,''), COALESCE(NEW.raw_user_meta_data->>'full_name',''), NEW.raw_user_meta_data->>'phone')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'locataire'))
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.validate_property_content()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE blob text;
BEGIN
  blob := lower(coalesce(NEW.title,'') || ' ' || coalesce(NEW.description,''));
  IF blob ~ '(https?://|www\.|\.(com|fr|mg|org|net)|t\.me/|wa\.me/|bit\.ly|tinyurl)' THEN
    RAISE EXCEPTION 'Les liens ne sont pas autorisés dans le titre ou la description.';
  END IF;
  IF blob ~ '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}' THEN
    RAISE EXCEPTION 'Les adresses e-mail ne sont pas autorisées dans le titre ou la description.';
  END IF;
  IF regexp_replace(blob, '[^0-9]', '', 'g') ~ '[0-9]{8,}' THEN
    RAISE EXCEPTION 'Les numéros de téléphone ne sont pas autorisés dans le titre ou la description.';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.prevent_owner_privilege_escalation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.role() = 'service_role' OR public.is_admin(auth.uid()) THEN RETURN NEW; END IF;
  IF NEW.is_premium IS DISTINCT FROM OLD.is_premium OR
     NEW.premium_until IS DISTINCT FROM OLD.premium_until OR
     NEW.is_verified IS DISTINCT FROM OLD.is_verified THEN
    NEW.is_premium    := OLD.is_premium;
    NEW.premium_until := OLD.premium_until;
    NEW.is_verified   := OLD.is_verified;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.apply_subscription_premium()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sub_until timestamptz;
BEGIN
  SELECT active_until INTO sub_until FROM public.subscriptions
    WHERE user_id = NEW.owner_id AND active_until > now();
  IF sub_until IS NOT NULL THEN
    NEW.is_premium := true;
    IF NEW.premium_until IS NULL OR NEW.premium_until < sub_until THEN
      NEW.premium_until := sub_until;
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.debit_tokens(_user_id uuid, _cost int, _reason text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_bal int;
BEGIN
  IF _cost <= 0 THEN RAISE EXCEPTION 'INVALID_COST' USING ERRCODE = '22023'; END IF;
  UPDATE public.profiles SET tokens_balance = tokens_balance - _cost
    WHERE id = _user_id AND tokens_balance >= _cost RETURNING tokens_balance INTO new_bal;
  IF new_bal IS NULL THEN RAISE EXCEPTION 'INSUFFICIENT_TOKENS' USING ERRCODE = 'P0001'; END IF;
  INSERT INTO public.token_transactions (user_id, amount, reason) VALUES (_user_id, -_cost, _reason);
  RETURN new_bal;
END $$;

CREATE OR REPLACE FUNCTION public.credit_tokens(_user_id uuid, _amount int, _reason text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_bal int;
BEGIN
  IF _amount <= 0 THEN RAISE EXCEPTION 'INVALID_AMOUNT' USING ERRCODE = '22023'; END IF;
  UPDATE public.profiles SET tokens_balance = tokens_balance + _amount
    WHERE id = _user_id RETURNING tokens_balance INTO new_bal;
  IF new_bal IS NULL THEN RAISE EXCEPTION 'USER_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  INSERT INTO public.token_transactions (user_id, amount, reason) VALUES (_user_id, _amount, _reason);
  RETURN new_bal;
END $$;

CREATE OR REPLACE FUNCTION public.get_visit_phone(_property_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_phone text; v_owner uuid;
BEGIN
  SELECT pc.visit_phone, p.owner_id INTO v_phone, v_owner
    FROM public.properties p
    LEFT JOIN public.property_contacts pc ON pc.property_id = p.id
   WHERE p.id = _property_id;
  IF v_phone IS NULL THEN RETURN NULL; END IF;
  IF auth.uid() = v_owner THEN RETURN v_phone; END IF;
  IF public.is_admin(auth.uid()) THEN RETURN v_phone; END IF;
  IF EXISTS (SELECT 1 FROM public.contact_unlocks WHERE user_id = auth.uid() AND property_id = _property_id) THEN
    RETURN v_phone;
  END IF;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.has_active_subscription(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.subscriptions WHERE user_id = _user_id AND active_until > now())
$$;

CREATE OR REPLACE FUNCTION public.count_active_users(since timestamptz)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COUNT(DISTINCT user_id)::int FROM (
    SELECT sender_id AS user_id FROM messages           WHERE created_at >= since
    UNION SELECT viewer_id      FROM property_views     WHERE created_at >= since AND viewer_id IS NOT NULL
    UNION SELECT user_id        FROM contact_unlocks    WHERE created_at >= since
    UNION SELECT user_id        FROM favorites          WHERE created_at >= since
    UNION SELECT tenant_id      FROM visit_bookings     WHERE created_at >= since
    UNION SELECT user_id        FROM token_transactions WHERE created_at >= since
    UNION SELECT user_id        FROM token_purchase_requests WHERE created_at >= since
    UNION SELECT user_id        FROM search_alerts      WHERE created_at >= since
  ) t
$$;

CREATE OR REPLACE FUNCTION public.delete_unconfirmed_users()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE deleted_count integer := 0;
BEGIN
  WITH del AS (
    DELETE FROM auth.users
    WHERE email_confirmed_at IS NULL AND confirmed_at IS NULL
      AND created_at < now() - interval '30 minutes'
    RETURNING id
  )
  SELECT count(*) INTO deleted_count FROM del;
  RETURN deleted_count;
END $$;

CREATE OR REPLACE FUNCTION public.enqueue_email(queue_name TEXT, payload JSONB)
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN pgmq.send(queue_name, payload);
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name); RETURN pgmq.send(queue_name, payload);
END $$;

CREATE OR REPLACE FUNCTION public.read_email_batch(queue_name TEXT, batch_size INT, vt INT)
RETURNS TABLE(msg_id BIGINT, read_ct INT, message JSONB) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY SELECT r.msg_id, r.read_ct, r.message FROM pgmq.read(queue_name, vt, batch_size) r;
EXCEPTION WHEN undefined_table THEN PERFORM pgmq.create(queue_name); RETURN;
END $$;

CREATE OR REPLACE FUNCTION public.delete_email(queue_name TEXT, message_id BIGINT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN pgmq.delete(queue_name, message_id);
EXCEPTION WHEN undefined_table THEN RETURN FALSE;
END $$;

CREATE OR REPLACE FUNCTION public.move_to_dlq(source_queue TEXT, dlq_name TEXT, message_id BIGINT, payload JSONB)
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE new_id BIGINT;
BEGIN
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  PERFORM pgmq.delete(source_queue, message_id);
  RETURN new_id;
EXCEPTION WHEN undefined_table THEN
  BEGIN PERFORM pgmq.create(dlq_name); EXCEPTION WHEN OTHERS THEN NULL; END;
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  BEGIN PERFORM pgmq.delete(source_queue, message_id); EXCEPTION WHEN undefined_table THEN NULL; END;
  RETURN new_id;
END $$;


-- ============================================================
-- PARTIE 6 : TRIGGERS
-- ============================================================

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_properties_updated BEFORE UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_validate_property_content BEFORE INSERT OR UPDATE OF title, description ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.validate_property_content();

CREATE TRIGGER trg_prevent_owner_privilege_escalation BEFORE UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.prevent_owner_privilege_escalation();

CREATE TRIGGER properties_apply_subscription BEFORE INSERT ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.apply_subscription_premium();

CREATE TRIGGER trg_site_settings_updated BEFORE UPDATE ON public.site_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_owner_reviews_updated BEFORE UPDATE ON public.owner_reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER subscriptions_set_updated BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER blog_posts_updated_at BEFORE UPDATE ON public.blog_posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER property_contacts_updated_at BEFORE UPDATE ON public.property_contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- PARTIE 7 : POLITIQUES RLS
-- ============================================================

-- profiles
CREATE POLICY "Profiles: select own or admin" ON public.profiles FOR SELECT USING (auth.uid() = id OR public.is_admin(auth.uid()));
CREATE POLICY "Profiles: update own"          ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Profiles: admin update"        ON public.profiles FOR UPDATE USING (public.is_admin(auth.uid()));

-- user_roles
CREATE POLICY "Roles: select own or admin" ON public.user_roles FOR SELECT USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
CREATE POLICY "Roles: admin insert others" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()) AND user_id <> auth.uid());
CREATE POLICY "Roles: admin update others" ON public.user_roles FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()) AND user_id <> auth.uid()) WITH CHECK (public.is_admin(auth.uid()) AND user_id <> auth.uid());
CREATE POLICY "Roles: admin delete others" ON public.user_roles FOR DELETE TO authenticated USING (public.is_admin(auth.uid()) AND user_id <> auth.uid());

-- properties
CREATE POLICY "Properties: public read active" ON public.properties FOR SELECT USING (status = 'active' OR auth.uid() = owner_id OR public.is_admin(auth.uid()));
CREATE POLICY "Properties: owner insert"       ON public.properties FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Properties: owner update"       ON public.properties FOR UPDATE
  USING (auth.uid() = owner_id OR public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()) OR (auth.uid() = owner_id
    AND is_premium    = (SELECT p.is_premium    FROM public.properties p WHERE p.id = properties.id)
    AND is_verified   = (SELECT p.is_verified   FROM public.properties p WHERE p.id = properties.id)
    AND premium_until IS NOT DISTINCT FROM (SELECT p.premium_until FROM public.properties p WHERE p.id = properties.id)));
CREATE POLICY "Properties: owner delete" ON public.properties FOR DELETE USING (auth.uid() = owner_id OR public.is_admin(auth.uid()));

-- property_contacts
CREATE POLICY "Contacts: owner/admin select" ON public.property_contacts FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_contacts.property_id AND (p.owner_id = auth.uid() OR public.is_admin(auth.uid()))));
CREATE POLICY "Contacts: owner/admin insert" ON public.property_contacts FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_contacts.property_id AND (p.owner_id = auth.uid() OR public.is_admin(auth.uid()))));
CREATE POLICY "Contacts: owner/admin update" ON public.property_contacts FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_contacts.property_id AND (p.owner_id = auth.uid() OR public.is_admin(auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_contacts.property_id AND (p.owner_id = auth.uid() OR public.is_admin(auth.uid()))));

-- property_photos
CREATE POLICY "Photos: public read"  ON public.property_photos FOR SELECT USING (TRUE);
CREATE POLICY "Photos: owner manage" ON public.property_photos FOR ALL
  USING (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND (p.owner_id = auth.uid() OR public.is_admin(auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND (p.owner_id = auth.uid() OR public.is_admin(auth.uid()))));

-- property_views
CREATE POLICY "Views: anyone insert"         ON public.property_views FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_views.property_id AND p.status = 'active'));
CREATE POLICY "Views: owner or admin select" ON public.property_views FOR SELECT USING (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_views.property_id AND p.owner_id = auth.uid()) OR public.is_admin(auth.uid()));

-- property_reports
CREATE POLICY "Reports: own insert"          ON public.property_reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Reports: own or admin select" ON public.property_reports FOR SELECT USING (auth.uid() = reporter_id OR public.is_admin(auth.uid()));
CREATE POLICY "Reports: admin update"        ON public.property_reports FOR UPDATE USING (public.is_admin(auth.uid()));

-- favorites
CREATE POLICY "Favorites: own only" ON public.favorites FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- contact_unlocks
CREATE POLICY "Unlocks: own select"       ON public.contact_unlocks FOR SELECT USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
CREATE POLICY "Unlocks: no client insert" ON public.contact_unlocks FOR INSERT TO authenticated, anon WITH CHECK (false);
CREATE POLICY "Unlocks: no client update" ON public.contact_unlocks FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false);
CREATE POLICY "Unlocks: no client delete" ON public.contact_unlocks FOR DELETE TO authenticated, anon USING (false);

-- visit_slots
CREATE POLICY "Slots: public read"  ON public.visit_slots FOR SELECT USING (TRUE);
CREATE POLICY "Slots: owner manage" ON public.visit_slots FOR ALL
  USING (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND (p.owner_id = auth.uid() OR public.is_admin(auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND (p.owner_id = auth.uid() OR public.is_admin(auth.uid()))));

-- visit_bookings
CREATE POLICY "Bookings: tenant select own" ON public.visit_bookings FOR SELECT
  USING (auth.uid() = tenant_id OR EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid()) OR public.is_admin(auth.uid()));
CREATE POLICY "Bookings: tenant insert" ON public.visit_bookings FOR INSERT WITH CHECK (auth.uid() = tenant_id);

-- messages
CREATE POLICY "Messages: participants select" ON public.messages FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id OR public.is_admin(auth.uid()));
CREATE POLICY "Messages: insert as sender" ON public.messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id AND sender_id <> recipient_id
    AND EXISTS (SELECT 1 FROM public.properties p WHERE p.id = messages.property_id AND p.status = 'active'
      AND ((p.owner_id = messages.recipient_id AND auth.uid() <> p.owner_id)
        OR (p.owner_id = messages.sender_id AND auth.uid() = p.owner_id))));
CREATE POLICY "Messages: recipient mark read" ON public.messages FOR UPDATE
  USING (auth.uid() = recipient_id) WITH CHECK (auth.uid() = recipient_id);

-- owner_reviews
CREATE POLICY "Reviews: public read" ON public.owner_reviews FOR SELECT USING (true);
CREATE POLICY "Reviews: author insert with interaction" ON public.owner_reviews FOR INSERT
  WITH CHECK (auth.uid() = author_id AND author_id <> owner_id
    AND EXISTS (SELECT 1 FROM public.contact_unlocks cu JOIN public.properties p ON p.id = cu.property_id
      WHERE cu.user_id = auth.uid() AND p.owner_id = owner_reviews.owner_id));
CREATE POLICY "Reviews: author update"          ON public.owner_reviews FOR UPDATE USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Reviews: author or admin delete" ON public.owner_reviews FOR DELETE USING (auth.uid() = author_id OR public.is_admin(auth.uid()));

-- search_alerts
CREATE POLICY "Alerts: own all" ON public.search_alerts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- token_transactions
CREATE POLICY "Tx: own select"       ON public.token_transactions FOR SELECT USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
CREATE POLICY "Tx: no client insert" ON public.token_transactions FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY "Tx: no client update" ON public.token_transactions FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "Tx: no client delete" ON public.token_transactions FOR DELETE TO anon, authenticated USING (false);

-- token_purchase_requests
CREATE POLICY "Purchase: own select"   ON public.token_purchase_requests FOR SELECT USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
CREATE POLICY "Purchase: own insert"   ON public.token_purchase_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Purchase: admin update" ON public.token_purchase_requests FOR UPDATE USING (public.is_admin(auth.uid()));

-- subscriptions
CREATE POLICY "Sub: own or admin select" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
CREATE POLICY "Sub: no client insert"    ON public.subscriptions FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY "Sub: no client update"    ON public.subscriptions FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "Sub: no client delete"    ON public.subscriptions FOR DELETE TO anon, authenticated USING (false);

-- kyc_requests
CREATE POLICY "KYC: own select"   ON public.kyc_requests FOR SELECT USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
CREATE POLICY "KYC: own insert"   ON public.kyc_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "KYC: admin update" ON public.kyc_requests FOR UPDATE USING (public.is_admin(auth.uid()));

-- verification_requests
CREATE POLICY "Verif: own select"   ON public.verification_requests FOR SELECT USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
CREATE POLICY "Verif: owner insert" ON public.verification_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid()));
CREATE POLICY "Verif: admin update" ON public.verification_requests FOR UPDATE USING (public.is_admin(auth.uid()));

-- blog_posts
CREATE POLICY "Blog: public read published" ON public.blog_posts FOR SELECT USING (published = true OR public.is_admin(auth.uid()));
CREATE POLICY "Blog: admin insert"          ON public.blog_posts FOR INSERT WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Blog: admin update"          ON public.blog_posts FOR UPDATE USING (public.is_admin(auth.uid()));
CREATE POLICY "Blog: admin delete"          ON public.blog_posts FOR DELETE USING (public.is_admin(auth.uid()));

-- cgu
CREATE POLICY "CGU: public read"  ON public.cgu FOR SELECT TO public USING (true);
CREATE POLICY "CGU: admin update" ON public.cgu FOR UPDATE TO public USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "CGU: no insert"    ON public.cgu FOR INSERT TO public WITH CHECK (false);
CREATE POLICY "CGU: no delete"    ON public.cgu FOR DELETE TO public USING (false);

-- site_settings
CREATE POLICY "Settings: public read"  ON public.site_settings FOR SELECT USING (TRUE);
CREATE POLICY "Settings: admin update" ON public.site_settings FOR UPDATE USING (public.is_admin(auth.uid()));

-- user_bans
CREATE POLICY "Bans: own select"   ON public.user_bans FOR SELECT USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
CREATE POLICY "Bans: admin manage" ON public.user_bans FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- admin_logs
CREATE POLICY "Logs: admin only" ON public.admin_logs FOR SELECT USING (public.is_admin(auth.uid()));

-- email tables
CREATE POLICY "Email log: service role read"   ON public.email_send_log FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "Email log: service role insert" ON public.email_send_log FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Email log: service role update" ON public.email_send_log FOR UPDATE USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Email state: service role"      ON public.email_send_state FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Suppressed: service role read"  ON public.suppressed_emails FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "Suppressed: service role insert" ON public.suppressed_emails FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Unsub tokens: service role read"   ON public.email_unsubscribe_tokens FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "Unsub tokens: service role insert" ON public.email_unsubscribe_tokens FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Unsub tokens: service role update" ON public.email_unsubscribe_tokens FOR UPDATE USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Realtime channel
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Realtime: messages participants only" ON realtime.messages FOR SELECT TO authenticated
  USING (realtime.topic() = ('notif-msg-' || auth.uid()::text));


-- ============================================================
-- PARTIE 8 : STORAGE
-- ============================================================

INSERT INTO storage.buckets (id, name, public) VALUES
  ('property-photos', 'property-photos', TRUE),
  ('site-assets',     'site-assets',     TRUE),
  ('kyc-documents',   'kyc-documents',   FALSE)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Property photos: public read"  ON storage.objects FOR SELECT USING (bucket_id = 'property-photos');
CREATE POLICY "Property photos: owner upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'property-photos' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin(auth.uid())));
CREATE POLICY "Property photos: owner update" ON storage.objects FOR UPDATE
  USING (bucket_id = 'property-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Property photos: owner delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'property-photos' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin(auth.uid())));
CREATE POLICY "Site assets: public read"  ON storage.objects FOR SELECT USING (bucket_id = 'site-assets');
CREATE POLICY "Site assets: admin write"  ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'site-assets' AND public.is_admin(auth.uid()));
CREATE POLICY "Site assets: admin update" ON storage.objects FOR UPDATE USING (bucket_id = 'site-assets' AND public.is_admin(auth.uid()));
CREATE POLICY "Site assets: admin delete" ON storage.objects FOR DELETE USING (bucket_id = 'site-assets' AND public.is_admin(auth.uid()));
CREATE POLICY "KYC: owner read"   ON storage.objects FOR SELECT USING (bucket_id = 'kyc-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "KYC: admin read"   ON storage.objects FOR SELECT USING (bucket_id = 'kyc-documents' AND public.is_admin(auth.uid()));
CREATE POLICY "KYC: owner upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'kyc-documents' AND auth.uid()::text = (storage.foldername(name))[1]);


-- ============================================================
-- PARTIE 9 : REALTIME
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.properties;
ALTER PUBLICATION supabase_realtime ADD TABLE public.property_photos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.visit_slots;
ALTER TABLE public.properties      REPLICA IDENTITY FULL;
ALTER TABLE public.property_photos REPLICA IDENTITY FULL;
ALTER TABLE public.messages        REPLICA IDENTITY FULL;
ALTER TABLE public.visit_slots     REPLICA IDENTITY FULL;


-- ============================================================
-- PARTIE 10 : GRANTS
-- ============================================================

GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_visit_phone(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_visit_phone(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.debit_tokens(uuid, int, text)  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.credit_tokens(uuid, int, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(TEXT, JSONB)             FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(TEXT, INT, INT)       FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_email(TEXT, BIGINT)             FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(TEXT, TEXT, BIGINT, JSONB) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.enqueue_email(TEXT, JSONB)             TO service_role;
GRANT  EXECUTE ON FUNCTION public.read_email_batch(TEXT, INT, INT)       TO service_role;
GRANT  EXECUTE ON FUNCTION public.delete_email(TEXT, BIGINT)             TO service_role;
GRANT  EXECUTE ON FUNCTION public.move_to_dlq(TEXT, TEXT, BIGINT, JSONB) TO service_role;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at()                     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_property_content()          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_owner_privilege_escalation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_subscription_premium()         FROM PUBLIC, anon, authenticated;


-- ============================================================
-- PARTIE 11 : CRON
-- ============================================================

DO $$ BEGIN PERFORM cron.unschedule('delete-unconfirmed-users'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule('delete-unconfirmed-users', '*/5 * * * *', $$ SELECT public.delete_unconfirmed_users(); $$);
