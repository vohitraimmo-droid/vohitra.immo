ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS premium_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS boost_enabled boolean NOT NULL DEFAULT true;