
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('locataire', 'proprietaire', 'admin');
CREATE TYPE public.property_type AS ENUM ('appartement', 'maison', 'local_commercial', 'terrain');
CREATE TYPE public.property_status AS ENUM ('active', 'inactive', 'pending');
CREATE TYPE public.request_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.kyc_status AS ENUM ('none', 'pending', 'approved', 'rejected');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT,
  avatar_url TEXT,
  tokens_balance INT NOT NULL DEFAULT 0,
  kyc_status public.kyc_status NOT NULL DEFAULT 'none',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role security definer to avoid RLS recursion
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin') $$;

-- ============ PROPERTIES ============
CREATE TABLE public.properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  property_type public.property_type NOT NULL,
  surface NUMERIC NOT NULL,
  price BIGINT NOT NULL,
  address TEXT NOT NULL,
  postal_code TEXT,
  city TEXT NOT NULL,
  rooms INT,
  visit_phone TEXT NOT NULL,
  status public.property_status NOT NULL DEFAULT 'active',
  is_premium BOOLEAN NOT NULL DEFAULT FALSE,
  premium_until TIMESTAMPTZ,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_properties_status ON public.properties(status);
CREATE INDEX idx_properties_premium ON public.properties(is_premium, premium_until);
CREATE INDEX idx_properties_owner ON public.properties(owner_id);
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.property_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_property_photos_property ON public.property_photos(property_id);
ALTER TABLE public.property_photos ENABLE ROW LEVEL SECURITY;

-- ============ FAVORITES ============
CREATE TABLE public.favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, property_id)
);
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

-- ============ CONTACT UNLOCKS ============
CREATE TABLE public.contact_unlocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, property_id)
);
ALTER TABLE public.contact_unlocks ENABLE ROW LEVEL SECURITY;

-- ============ VISIT SLOTS & BOOKINGS ============
CREATE TABLE public.visit_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  slot_at TIMESTAMPTZ NOT NULL,
  is_booked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.visit_slots ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.visit_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id UUID NOT NULL REFERENCES public.visit_slots(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'confirmed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.visit_bookings ENABLE ROW LEVEL SECURITY;

-- ============ TOKENS ============
CREATE TABLE public.token_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INT NOT NULL, -- positive = credit, negative = debit
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.token_transactions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.token_purchase_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tokens_amount INT NOT NULL,
  total_price BIGINT NOT NULL,
  payment_reference TEXT,
  status public.request_status NOT NULL DEFAULT 'pending',
  reject_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  processed_by UUID REFERENCES auth.users(id)
);
ALTER TABLE public.token_purchase_requests ENABLE ROW LEVEL SECURITY;

-- ============ KYC ============
CREATE TABLE public.kyc_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cin_recto_url TEXT NOT NULL,
  cin_verso_url TEXT NOT NULL,
  status public.request_status NOT NULL DEFAULT 'pending',
  reject_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  processed_by UUID REFERENCES auth.users(id)
);
ALTER TABLE public.kyc_requests ENABLE ROW LEVEL SECURITY;

-- ============ VERIFICATION REQUESTS (on-site) ============
CREATE TABLE public.verification_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.request_status NOT NULL DEFAULT 'pending',
  reject_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  processed_by UUID REFERENCES auth.users(id)
);
ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;

-- ============ SITE SETTINGS (singleton) ============
CREATE TABLE public.site_settings (
  id INT PRIMARY KEY DEFAULT 1,
  site_name TEXT NOT NULL DEFAULT 'Vohitra',
  logo_url TEXT,
  hero_background_url TEXT,
  primary_color TEXT NOT NULL DEFAULT 'hsl(15 75% 45%)',
  secondary_color TEXT NOT NULL DEFAULT 'hsl(158 64% 32%)',
  hero_title TEXT NOT NULL DEFAULT 'Trouvez votre foyer au cœur de Madagascar',
  hero_subtitle TEXT NOT NULL DEFAULT 'La première plateforme immobilière locale avec vérification sur site et système de mise en avant équitable.',
  token_price BIGINT NOT NULL DEFAULT 500,
  purchase_instructions TEXT NOT NULL DEFAULT 'Effectuez votre paiement par Mvola, Orange Money ou Airtel Money au 034 00 000 00, puis renseignez la référence de transaction ci-dessous. Vos jetons seront crédités après validation.',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT site_settings_singleton CHECK (id = 1)
);
INSERT INTO public.site_settings (id) VALUES (1);
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- ============ BANS & ADMIN LOGS ============
CREATE TABLE public.user_bans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  banned_until TIMESTAMPTZ, -- null = permanent
  banned_by UUID REFERENCES auth.users(id),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_bans ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.admin_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

-- ============ TRIGGERS ============
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_properties_updated BEFORE UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_site_settings_updated BEFORE UPDATE ON public.site_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile + default tenant role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'phone'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'locataire'))
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ RLS POLICIES ============

-- profiles
CREATE POLICY "Profiles: select own or admin" ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.is_admin(auth.uid()));
CREATE POLICY "Profiles: update own" ON public.profiles FOR UPDATE
  USING (auth.uid() = id);
CREATE POLICY "Profiles: admin update" ON public.profiles FOR UPDATE
  USING (public.is_admin(auth.uid()));

-- user_roles
CREATE POLICY "Roles: select own or admin" ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
CREATE POLICY "Roles: admin manage" ON public.user_roles FOR ALL
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- properties: anyone can see active; owner full access; admin full access
CREATE POLICY "Properties: public read active" ON public.properties FOR SELECT
  USING (status = 'active' OR auth.uid() = owner_id OR public.is_admin(auth.uid()));
CREATE POLICY "Properties: owner insert" ON public.properties FOR INSERT
  WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Properties: owner update" ON public.properties FOR UPDATE
  USING (auth.uid() = owner_id OR public.is_admin(auth.uid()));
CREATE POLICY "Properties: owner delete" ON public.properties FOR DELETE
  USING (auth.uid() = owner_id OR public.is_admin(auth.uid()));

-- property_photos
CREATE POLICY "Photos: public read" ON public.property_photos FOR SELECT USING (TRUE);
CREATE POLICY "Photos: owner manage" ON public.property_photos FOR ALL
  USING (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND (p.owner_id = auth.uid() OR public.is_admin(auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND (p.owner_id = auth.uid() OR public.is_admin(auth.uid()))));

-- favorites
CREATE POLICY "Favorites: own only" ON public.favorites FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- contact_unlocks: select own; insert via server function only (admin policy)
CREATE POLICY "Unlocks: own select" ON public.contact_unlocks FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- visit_slots: public read; owner manage
CREATE POLICY "Slots: public read" ON public.visit_slots FOR SELECT USING (TRUE);
CREATE POLICY "Slots: owner manage" ON public.visit_slots FOR ALL
  USING (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND (p.owner_id = auth.uid() OR public.is_admin(auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND (p.owner_id = auth.uid() OR public.is_admin(auth.uid()))));

-- visit_bookings: tenant sees own, owner sees their property bookings
CREATE POLICY "Bookings: tenant select own" ON public.visit_bookings FOR SELECT
  USING (auth.uid() = tenant_id OR EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid()) OR public.is_admin(auth.uid()));
CREATE POLICY "Bookings: tenant insert" ON public.visit_bookings FOR INSERT
  WITH CHECK (auth.uid() = tenant_id);

-- token_transactions: own + admin
CREATE POLICY "Tx: own select" ON public.token_transactions FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- token_purchase_requests
CREATE POLICY "Purchase: own select" ON public.token_purchase_requests FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
CREATE POLICY "Purchase: own insert" ON public.token_purchase_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Purchase: admin update" ON public.token_purchase_requests FOR UPDATE
  USING (public.is_admin(auth.uid()));

-- kyc_requests
CREATE POLICY "KYC: own select" ON public.kyc_requests FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
CREATE POLICY "KYC: own insert" ON public.kyc_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "KYC: admin update" ON public.kyc_requests FOR UPDATE
  USING (public.is_admin(auth.uid()));

-- verification_requests
CREATE POLICY "Verif: own select" ON public.verification_requests FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
CREATE POLICY "Verif: owner insert" ON public.verification_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid()));
CREATE POLICY "Verif: admin update" ON public.verification_requests FOR UPDATE
  USING (public.is_admin(auth.uid()));

-- site_settings
CREATE POLICY "Settings: public read" ON public.site_settings FOR SELECT USING (TRUE);
CREATE POLICY "Settings: admin update" ON public.site_settings FOR UPDATE
  USING (public.is_admin(auth.uid()));

-- user_bans
CREATE POLICY "Bans: own select" ON public.user_bans FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
CREATE POLICY "Bans: admin manage" ON public.user_bans FOR ALL
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- admin_logs
CREATE POLICY "Logs: admin only" ON public.admin_logs FOR SELECT
  USING (public.is_admin(auth.uid()));

-- ============ STORAGE BUCKETS ============
INSERT INTO storage.buckets (id, name, public) VALUES
  ('property-photos', 'property-photos', TRUE),
  ('site-assets', 'site-assets', TRUE),
  ('kyc-documents', 'kyc-documents', FALSE)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for property-photos
CREATE POLICY "Property photos: public read" ON storage.objects FOR SELECT
  USING (bucket_id = 'property-photos');
CREATE POLICY "Property photos: authenticated upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'property-photos' AND auth.uid() IS NOT NULL);
CREATE POLICY "Property photos: owner delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'property-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Site assets: admin only write, public read
CREATE POLICY "Site assets: public read" ON storage.objects FOR SELECT
  USING (bucket_id = 'site-assets');
CREATE POLICY "Site assets: admin write" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'site-assets' AND public.is_admin(auth.uid()));
CREATE POLICY "Site assets: admin update" ON storage.objects FOR UPDATE
  USING (bucket_id = 'site-assets' AND public.is_admin(auth.uid()));

-- KYC documents: private, user can upload their own (folder = user_id)
CREATE POLICY "KYC: owner read" ON storage.objects FOR SELECT
  USING (bucket_id = 'kyc-documents' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin(auth.uid())));
CREATE POLICY "KYC: owner upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'kyc-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
