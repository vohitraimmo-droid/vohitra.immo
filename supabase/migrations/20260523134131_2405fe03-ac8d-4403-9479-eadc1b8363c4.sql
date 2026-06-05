
-- Subscriptions
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  plan text NOT NULL DEFAULT 'pro',
  active_until timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sub: own or admin select" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
CREATE POLICY "Sub: no client insert" ON public.subscriptions
  FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY "Sub: no client update" ON public.subscriptions
  FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "Sub: no client delete" ON public.subscriptions
  FOR DELETE TO anon, authenticated USING (false);

CREATE TRIGGER subscriptions_set_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.has_active_subscription(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = _user_id AND active_until > now()
  )
$$;

-- Auto-premium pour nouvelles annonces si owner a un abo actif
CREATE OR REPLACE FUNCTION public.apply_subscription_premium()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

CREATE TRIGGER properties_apply_subscription
  BEFORE INSERT ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.apply_subscription_premium();

-- Vues
CREATE TABLE public.property_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL,
  viewer_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_property_views_prop_created
  ON public.property_views(property_id, created_at DESC);

ALTER TABLE public.property_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Views: anyone insert" ON public.property_views
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = property_views.property_id AND p.status = 'active'
    )
  );
CREATE POLICY "Views: owner or admin select" ON public.property_views
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = property_views.property_id AND p.owner_id = auth.uid()
    ) OR public.is_admin(auth.uid())
  );

-- Settings columns
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS pro_subscription_tokens int NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS pro_subscription_days int NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS boost_short_tokens int NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS boost_short_days int NOT NULL DEFAULT 7;
